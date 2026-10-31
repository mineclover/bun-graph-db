import type { Database } from "bun:sqlite";
import type { AttributeTypeInfo } from "@/application/services/SearchQueryParser.js";
import type { INodeSearchRepository } from "@/application/use-cases/nodes/SearchNodes.js";
import type { PaginatedResult, TableId } from "@/core/types/CommonTypes.js";
import { Node } from "@/domain/entities/Node.js";
import type {
	RangeValue,
	SearchFilter,
	SearchOperator,
	SearchQuery,
} from "@/domain/value-objects/SearchFilter.js";
import { DatabaseException } from "@/shared/exceptions/DomainException.js";
import { parseSafeJson, type SafeJsonValue } from "@/shared/utils/safeJson.js";

interface NodePageRow {
	node_id: string;
	node_table_id: string;
	node_content: string;
	node_title: string | null;
	node_description: string | null;
	node_metadata: string | null;
	node_created_at: string;
	node_updated_at: string;
	relevance_score: number | null;
	total_count?: number;
}

interface NodeAttributeRow {
	node_id: string;
	attribute_identifier: string | null;
	attribute_value: string | null;
	attribute_data_type: string | null;
}

export interface NodeSearchResult {
	node: Node;
	attributes: Record<string, SafeJsonValue>;
	relevanceScore?: number;
}

export interface LexicalMatchRank {
	nodeId: string;
	bm25Score: number;
	rank: number;
}

type SqliteParam = string | number | boolean | null;
type SqliteParams = SqliteParam[];

interface CandidateQuery {
	query: string;
	params: SqliteParams;
}

export class SqliteNodeSearchRepository implements INodeSearchRepository {
	private fullTextIndexAvailable: boolean | undefined;
	private attributeFullTextIndexAvailable: boolean | undefined;
	private typedNumericColumnAvailable: boolean | undefined;

	constructor(private readonly db: Database) {}

	async searchNodes(
		tableId: TableId,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
	): Promise<PaginatedResult<NodeSearchResult>> {
		try {
			const fullTextIndexAvailable = this.hasFullTextIndex();
			const { query: pageQuery, params: pageParams } = this.buildNodeQuery(
				tableId,
				searchQuery,
				availableAttributes,
				false,
				fullTextIndexAvailable,
			);

			const pageRows = this.db
				.query<NodePageRow, SqliteParams>(pageQuery)
				.all(...pageParams);

			const limit = searchQuery.limit || 10;
			const offset = searchQuery.offset || 0;
			let total = 0;
			if (pageRows.length > 0 && typeof pageRows[0]?.total_count === "number") {
				total = pageRows[0].total_count;
			} else if (offset > 0) {
				const { query: countQuery, params: countParams } = this.buildNodeQuery(
					tableId,
					searchQuery,
					availableAttributes,
					true,
					fullTextIndexAvailable,
				);
				const countResult = this.db
					.query<{ count: number }, SqliteParams>(countQuery)
					.get(...countParams);
				total = countResult?.count || 0;
			}

			const data = this.hydratePageRows(pageRows);

			return {
				nodes: data,
				totalCount: total,
				hasNextPage: offset + limit < total,
				hasPreviousPage: offset > 0,
				data,
				total,
				hasMore: offset + limit < total,
			};
		} catch (error) {
			throw new DatabaseException(`Failed to search nodes: ${error}`);
		}
	}

	/**
	 * Evaluates typed EAV and optional text filter conditions for hybrid search
	 * and returns the matching table-scoped node IDs (optionally intersected with
	 * an N-hop graph candidate set).
	 */
	filterNodeIds(
		tableId: TableId,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
		restrictToNodeIds?: ReadonlySet<string>,
	): string[] {
		try {
			if (restrictToNodeIds && restrictToNodeIds.size === 0) {
				return [];
			}

			const fullTextIndexAvailable = this.hasFullTextIndex();
			const { withClause, params } = this.buildEligibleWithClause(
				tableId,
				searchQuery,
				availableAttributes,
				fullTextIndexAvailable,
				false,
			);

			let restrictionSql = "";
			const queryParams = [...params];
			if (restrictToNodeIds && restrictToNodeIds.size <= 900) {
				const ids = [...restrictToNodeIds];
				const placeholders = ids.map(() => "?").join(",");
				restrictionSql = ` WHERE node_id IN (${placeholders})`;
				queryParams.push(...ids);
			}

			const rows = this.db
				.query<{ node_id: string }, SqliteParams>(
					`${withClause}\nSELECT CAST(node_id AS TEXT) AS node_id FROM eligible_node_ids${restrictionSql}`,
				)
				.all(...queryParams);

			if (restrictToNodeIds && restrictToNodeIds.size > 900) {
				return rows
					.map((row) => row.node_id)
					.filter((id) => restrictToNodeIds.has(id));
			}

			return rows.map((row) => row.node_id);
		} catch (error) {
			throw new DatabaseException(`Failed to filter node IDs: ${error}`);
		}
	}

	/**
	 * Fast covering-index table node count used by unfiltered hybrid search so
	 * full-table node ID sets do not need to be materialized in JS heap.
	 */
	countNodesInTable(tableId: TableId): number {
		const row = this.db
			.query<{ count: number }, [string]>(
				"SELECT COUNT(*) AS count FROM nodes WHERE table_id = ?",
			)
			.get(tableId);
		return row?.count ?? 0;
	}

	/**
	 * Filters a candidate set (e.g. N-hop graph neighbors) down to node IDs that
	 * belong to `tableId` using primary-key lookups without building EAV CTEs.
	 */
	filterExistingNodeIdsInTable(
		tableId: TableId,
		candidateIds: ReadonlySet<string>,
	): string[] {
		if (candidateIds.size === 0) return [];
		const allIds = [...candidateIds];
		const matched: string[] = [];
		const chunkSize = 500;
		for (let offset = 0; offset < allIds.length; offset += chunkSize) {
			const chunk = allIds.slice(offset, offset + chunkSize);
			const placeholders = chunk.map(() => "?").join(",");
			const rows = this.db
				.query<{ node_id: string }, SqliteParams>(
					`SELECT CAST(id AS TEXT) AS node_id
           FROM nodes
           WHERE table_id = ? AND id IN (${placeholders})`,
				)
				.all(tableId, ...chunk);
			for (const row of rows) {
				matched.push(row.node_id);
			}
		}
		return matched;
	}

	/**
	 * Computes ranked FTS5 BM25 lexical matches across node body and node
	 * attributes for hybrid RRF fusion.
	 */
	rankLexicalMatches(
		tableId: TableId,
		text: string,
		limit: number,
		restrictToNodeIds?: ReadonlySet<string>,
	): LexicalMatchRank[] {
		const trimmed = text.trim();
		if (!trimmed) return [];
		if (restrictToNodeIds && restrictToNodeIds.size === 0) return [];
		const boundedLimit = Math.max(1, Math.trunc(limit));

		const fullTextIndexAvailable = this.hasFullTextIndex();
		const candidate = this.buildTextCandidate(
			trimmed,
			fullTextIndexAvailable,
			tableId,
			true,
		);

		if (!restrictToNodeIds) {
			const rows = this.db
				.query<
					{ node_id: string; relevance_score: number | null },
					SqliteParams
				>(
					`SELECT CAST(text_src.node_id AS TEXT) AS node_id,
                  text_src.relevance_score AS relevance_score
           FROM (${candidate.query}) text_src
           JOIN nodes n ON n.id = text_src.node_id
           WHERE n.table_id = ?
           ORDER BY text_src.relevance_score IS NULL ASC, text_src.relevance_score ASC, n.id ASC
           LIMIT ?`,
				)
				.all(...candidate.params, tableId, boundedLimit);

			return rows.map((row, index) => ({
				nodeId: row.node_id,
				bm25Score:
					row.relevance_score === null ? 1 : Math.max(0, -row.relevance_score),
				rank: index + 1,
			}));
		}

		if (restrictToNodeIds.size <= 900) {
			const ids = [...restrictToNodeIds];
			const placeholders = ids.map(() => "?").join(",");
			const rows = this.db
				.query<
					{ node_id: string; relevance_score: number | null },
					SqliteParams
				>(
					`SELECT CAST(text_src.node_id AS TEXT) AS node_id,
                  text_src.relevance_score AS relevance_score
           FROM (${candidate.query}) text_src
           JOIN nodes n ON n.id = text_src.node_id
           WHERE n.table_id = ? AND n.id IN (${placeholders})
           ORDER BY text_src.relevance_score IS NULL ASC, text_src.relevance_score ASC, n.id ASC
           LIMIT ?`,
				)
				.all(...candidate.params, tableId, ...ids, boundedLimit);

			return rows.map((row, index) => ({
				nodeId: row.node_id,
				bm25Score:
					row.relevance_score === null ? 1 : Math.max(0, -row.relevance_score),
				rank: index + 1,
			}));
		}

		const rows = this.db
			.query<{ node_id: string; relevance_score: number | null }, SqliteParams>(
				`SELECT CAST(text_src.node_id AS TEXT) AS node_id,
                text_src.relevance_score AS relevance_score
         FROM (${candidate.query}) text_src
         JOIN nodes n ON n.id = text_src.node_id
         WHERE n.table_id = ?
         ORDER BY text_src.relevance_score IS NULL ASC, text_src.relevance_score ASC, n.id ASC`,
			)
			.all(...candidate.params, tableId);

		const results: LexicalMatchRank[] = [];
		for (const row of rows) {
			if (!restrictToNodeIds.has(row.node_id)) continue;
			const bm25Score =
				row.relevance_score === null ? 1 : Math.max(0, -row.relevance_score);
			results.push({
				nodeId: row.node_id,
				bm25Score,
				rank: results.length + 1,
			});
			if (results.length >= boundedLimit) break;
		}
		return results;
	}

	/**
	 * Hydrates an ordered list of node IDs with their full Node entity and typed
	 * attributes in two batched SQLite queries using INTEGER PRIMARY KEY lookups.
	 */
	hydrateNodesByIds(orderedNodeIds: readonly string[]): NodeSearchResult[] {
		if (orderedNodeIds.length === 0) return [];
		const placeholders = orderedNodeIds.map(() => "?").join(",");
		const rows = this.db
			.query<NodePageRow, SqliteParams>(
				`SELECT CAST(n.id AS TEXT) AS node_id,
                CAST(n.table_id AS TEXT) AS node_table_id,
                n.content AS node_content,
                n.title AS node_title,
                n.description AS node_description,
                n.metadata AS node_metadata,
                n.created_at AS node_created_at,
                n.updated_at AS node_updated_at,
                NULL AS relevance_score
         FROM nodes n
         WHERE n.id IN (${placeholders})`,
			)
			.all(...orderedNodeIds);

		const hydrated = this.hydratePageRows(rows);
		const byId = new Map(hydrated.map((entry) => [entry.node.getId(), entry]));
		return orderedNodeIds.flatMap((id) => {
			const entry = byId.get(id);
			return entry ? [entry] : [];
		});
	}

	private hydratePageRows(pageRows: readonly NodePageRow[]): NodeSearchResult[] {
		const nodeMap = new Map<string, NodeSearchResult>();
		for (const row of pageRows) {
			nodeMap.set(row.node_id, {
				node: Node.fromDatabase(
					row.node_id,
					row.node_table_id,
					row.node_content,
					row.node_title,
					row.node_description,
					row.node_metadata ?? null,
					new Date(row.node_created_at),
					new Date(row.node_updated_at),
				),
				attributes: {},
				relevanceScore:
					row.relevance_score === null
						? undefined
						: Math.max(0, -row.relevance_score),
			});
		}

		if (pageRows.length > 0) {
			const nodeIds = pageRows.map((row) => row.node_id);
			const placeholders = nodeIds.map(() => "?").join(",");
			const attributeRows = this.db
				.query<NodeAttributeRow, SqliteParams>(
					`SELECT CAST(nav.node_id AS TEXT) AS node_id,
                  a.identifier AS attribute_identifier,
                  nav.value AS attribute_value,
                  at.json_type AS attribute_data_type
           FROM node_attributes nav
           JOIN attributes a ON a.id = nav.attribute_id
           LEFT JOIN attribute_types at ON at.id = a.attribute_type_id
           WHERE nav.node_id IN (${placeholders})
           ORDER BY nav.node_id, a.identifier`,
				)
				.all(...nodeIds);

			for (const row of attributeRows) {
				const nodeResult = nodeMap.get(row.node_id);
				if (
					nodeResult &&
					row.attribute_identifier &&
					row.attribute_value !== null
				) {
					nodeResult.attributes[row.attribute_identifier] =
						this.parseAttributeValue(
							row.attribute_value,
							row.attribute_data_type || "string",
						);
				}
			}
		}

		return pageRows.flatMap((row) => {
			const result = nodeMap.get(row.node_id);
			return result ? [result] : [];
		});
	}

	private buildEligibleWithClause(
		tableId: TableId,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
		fullTextIndexAvailable: boolean,
		includeRelevance: boolean,
	): {
		withClauses: string[];
		withClause: string;
		params: SqliteParams;
		firstTextCandidate: string | undefined;
		preferredTextCandidate: string | undefined;
	} {
		const withClauses: string[] = [];
		const params: SqliteParams = [];
		const requiredCandidateSets: string[] = [];
		let candidateIndex = 0;
		let conditionIndex = 0;
		let firstTextCandidate: string | undefined;
		let preferredTextCandidate: string | undefined;

		// Evaluate each filter once. Set operations keep independent EAV rows
		// composable without re-running a correlated lookup for every node.
		const addFilterCandidate = (
			filter: SearchFilter,
			preferredForRanking = false,
		): string => {
			const candidateName = `filter_candidates_${candidateIndex++}`;
			const candidate = this.buildFilterCandidate(
				filter,
				availableAttributes,
				fullTextIndexAvailable,
				tableId,
				includeRelevance,
			);
			withClauses.push(`${candidateName} AS MATERIALIZED (${candidate.query})`);
			params.push(...candidate.params);
			if (filter.field === "_text_search") {
				firstTextCandidate ??= candidateName;
				if (preferredForRanking) preferredTextCandidate = candidateName;
			}
			return candidateName;
		};

		for (const condition of searchQuery.conditions ?? []) {
			const filterCandidates = condition.filters.map((filter) =>
				addFilterCandidate(filter),
			);
			if (filterCandidates.length === 0) continue;
			if (filterCandidates.length === 1) {
				const onlyCandidate = filterCandidates[0];
				if (onlyCandidate) requiredCandidateSets.push(onlyCandidate);
				continue;
			}

			if (condition.logicalOperator === "or") {
				const conditionName = `condition_candidates_${conditionIndex++}`;
				withClauses.push(
					`${conditionName} AS MATERIALIZED (${filterCandidates
						.map((candidate) => `SELECT node_id FROM ${candidate}`)
						.join(" UNION ")})`,
				);
				requiredCandidateSets.push(conditionName);
			} else {
				// Associative AND filters flatten directly into the top-level INTERSECT,
				// avoiding an intermediate materialized CTE and extra temp B-tree pass.
				requiredCandidateSets.push(...filterCandidates);
			}
		}

		if (searchQuery.textSearch) {
			requiredCandidateSets.push(
				addFilterCandidate(
					{
						field: "_text_search",
						operator: "contains" as SearchOperator,
						value: searchQuery.textSearch,
						valueType: "string",
					},
					true,
				),
			);
		}

		// INTERSECT deduplicates IDs, so COUNT remains exact while the page query
		// can hydrate full node payloads and EAV attributes only after LIMIT/OFFSET.
		const eligibleSets = [
			"SELECT n.id AS node_id FROM nodes n WHERE n.table_id = ?",
			...requiredCandidateSets.map(
				(candidate) => `SELECT node_id FROM ${candidate}`,
			),
		];
		withClauses.push(
			`eligible_node_ids AS MATERIALIZED (${eligibleSets.join(" INTERSECT ")})`,
		);
		params.push(tableId);

		return {
			withClauses,
			withClause: `WITH ${withClauses.join(",\n")}`,
			params,
			firstTextCandidate,
			preferredTextCandidate,
		};
	}

	private buildNodeQuery(
		tableId: TableId,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
		isCountQuery: boolean,
		fullTextIndexAvailable: boolean,
	): { query: string; params: SqliteParams } {
		const {
			withClauses,
			withClause,
			params,
			firstTextCandidate,
			preferredTextCandidate,
		} = this.buildEligibleWithClause(
			tableId,
			searchQuery,
			availableAttributes,
			fullTextIndexAvailable,
			!isCountQuery,
		);

		if (isCountQuery) {
			return {
				query: `${withClause}\nSELECT COUNT(*) AS count FROM eligible_node_ids`,
				params,
			};
		}

		const typedNumericAvailable = this.hasTypedNumericColumn();
		const sortJoins: string[] = [];
		const sortParams: SqliteParams = [];
		const clauses: string[] = [];
		let needsNodeForSort = false;

		for (const [sortIndex, sort] of (searchQuery.sortBy ?? []).entries()) {
			const direction = sort.direction === "asc" ? "ASC" : "DESC";
			if (["created_at", "updated_at"].includes(sort.field)) {
				needsNodeForSort = true;
				clauses.push(`sort_n.${sort.field} ${direction}`);
				continue;
			}
			if (["title", "content"].includes(sort.field)) {
				needsNodeForSort = true;
				clauses.push(`sort_n.${sort.field} COLLATE NOCASE ${direction}`);
				continue;
			}

			const attribute = availableAttributes.find(
				(candidate) => candidate.identifier === sort.field,
			);
			if (!attribute) continue;

			const sortAttributeName = `sort_attribute_${sortIndex}`;
			const sortValueName = `sort_value_${sortIndex}`;
			// Both joins resolve through schema uniqueness, allowing SQLite to use
			// (table_id, identifier) and (node_id, attribute_id) indexes directly.
			sortJoins.push(
				`LEFT JOIN attributes ${sortAttributeName}
           ON ${sortAttributeName}.table_id = ? AND ${sortAttributeName}.identifier = ?`,
			);
			sortJoins.push(
				`LEFT JOIN node_attributes ${sortValueName}
           ON ${sortValueName}.node_id = eligible.node_id AND ${sortValueName}.attribute_id = ${sortAttributeName}.id`,
			);
			sortParams.push(tableId, sort.field);
			const sortValue = this.castSortValue(
				sortValueName,
				attribute.dataType,
				typedNumericAvailable,
			);
			clauses.push(
				`${sortValue} IS NULL ${sort.direction === "asc" ? "ASC" : "DESC"}`,
			);
			clauses.push(`${sortValue} ${direction}`);
		}

		const rankingCandidate = fullTextIndexAvailable
			? (preferredTextCandidate ?? firstTextCandidate)
			: undefined;
		const sortUsesRelevance = clauses.length === 0 && Boolean(rankingCandidate);

		if (clauses.length === 0 && !rankingCandidate) {
			needsNodeForSort = true;
		}

		const innerRankingJoin =
			sortUsesRelevance && rankingCandidate
				? `${rankingCandidate === preferredTextCandidate ? "JOIN" : "LEFT JOIN"} ${rankingCandidate} ranked ON ranked.node_id = eligible.node_id`
				: "";
		const innerRelevanceExpr = sortUsesRelevance ? "ranked.relevance_score" : "NULL";
		const outerRankingJoin =
			!sortUsesRelevance && rankingCandidate
				? `LEFT JOIN ${rankingCandidate} ranked ON ranked.node_id = paged.node_id`
				: "";
		const outerRelevanceExpr = sortUsesRelevance
			? "paged.relevance_score"
			: rankingCandidate
				? "ranked.relevance_score"
				: "NULL";
		const sortNodeJoin = needsNodeForSort
			? "JOIN nodes sort_n ON sort_n.id = eligible.node_id"
			: "";
		const tieBreakId = needsNodeForSort ? "sort_n.id" : "eligible.node_id";

		const orderBy =
			clauses.length > 0
				? `ORDER BY ${clauses.join(", ")}, ${tieBreakId} ASC`
				: rankingCandidate
					? `ORDER BY ${innerRelevanceExpr} IS NULL ASC, ${innerRelevanceExpr} ASC, ${tieBreakId} ASC`
					: "ORDER BY sort_n.created_at DESC, sort_n.id ASC";

		const limit = searchQuery.limit || 10;
		const offset = searchQuery.offset || 0;
		params.push(...sortParams, limit, offset);

		// Late row hydration: sort and paginate narrow tuples first (carrying total_count
		// via a single window pass), then fetch wide node columns and deferred FTS scores
		// only for the surviving page rows.
		withClauses.push(`paged_nodes AS MATERIALIZED (
        SELECT eligible.node_id AS node_id,
               ${innerRelevanceExpr} AS relevance_score,
               COUNT(*) OVER () AS total_count
        FROM eligible_node_ids eligible
        ${innerRankingJoin}
        ${sortNodeJoin}
        ${sortJoins.join("\n")}
        ${orderBy}
        LIMIT ? OFFSET ?
      )`);
		const pageWithClause = `WITH ${withClauses.join(",\n")}`;

		return {
			query: `${pageWithClause}
        SELECT CAST(n.id AS TEXT) AS node_id, CAST(n.table_id AS TEXT) AS node_table_id,
               n.content AS node_content, n.title AS node_title,
               n.description AS node_description, n.metadata AS node_metadata,
               n.created_at AS node_created_at, n.updated_at AS node_updated_at,
               ${outerRelevanceExpr} AS relevance_score,
               paged.total_count AS total_count
        FROM paged_nodes paged
        CROSS JOIN nodes n ON n.id = paged.node_id
        ${outerRankingJoin}`,
			params,
		};
	}

	private buildFilterCandidate(
		filter: SearchFilter,
		availableAttributes: AttributeTypeInfo[],
		fullTextIndexAvailable: boolean,
		tableId: TableId,
		includeRelevance: boolean,
	): CandidateQuery {
		if (filter.field === "_text_search") {
			return this.buildTextCandidate(
				String(filter.value),
				fullTextIndexAvailable,
				tableId,
				includeRelevance,
			);
		}

		const attributeInfo = availableAttributes.find(
			(attribute) => attribute.identifier === filter.field,
		);
		if (!attributeInfo) {
			throw new DatabaseException(`Unknown attribute: ${filter.field}`);
		}

		const typedNumericAvailable = this.hasTypedNumericColumn();
		const params: SqliteParams = [tableId, filter.field];
		let valueClause: string;
		switch (filter.operator as SearchOperator) {
			case "equals":
				params.push(this.toSqliteParam(filter.value));
				valueClause = "filter_nav.value = ?";
				break;
			case "not_equals":
				params.push(this.toSqliteParam(filter.value));
				valueClause = "filter_nav.value != ?";
				break;
			case "contains":
				params.push(`%${filter.value}%`);
				valueClause = "filter_nav.value LIKE ?";
				break;
			case "starts_with":
				params.push(`${filter.value}%`);
				valueClause = "filter_nav.value LIKE ?";
				break;
			case "ends_with":
				params.push(`%${filter.value}`);
				valueClause = "filter_nav.value LIKE ?";
				break;
			case "gt": {
				const built = this.buildComparisonClause(
					attributeInfo.dataType,
					">",
					filter.value,
					typedNumericAvailable,
				);
				params.push(...built.params);
				valueClause = built.clause;
				break;
			}
			case "gte": {
				const built = this.buildComparisonClause(
					attributeInfo.dataType,
					">=",
					filter.value,
					typedNumericAvailable,
				);
				params.push(...built.params);
				valueClause = built.clause;
				break;
			}
			case "lt": {
				const built = this.buildComparisonClause(
					attributeInfo.dataType,
					"<",
					filter.value,
					typedNumericAvailable,
				);
				params.push(...built.params);
				valueClause = built.clause;
				break;
			}
			case "lte": {
				const built = this.buildComparisonClause(
					attributeInfo.dataType,
					"<=",
					filter.value,
					typedNumericAvailable,
				);
				params.push(...built.params);
				valueClause = built.clause;
				break;
			}
			case "range": {
				if (!this.isRangeValue(filter.value)) {
					throw new DatabaseException(
						`Invalid range filter for ${filter.field}`,
					);
				}
				const range = filter.value as RangeValue;
				const built = this.buildRangeClause(
					attributeInfo.dataType,
					range,
					typedNumericAvailable,
				);
				params.push(...built.params);
				valueClause = built.clause;
				break;
			}
			case "in": {
				const values = Array.isArray(filter.value)
					? filter.value
					: [filter.value];
				params.push(...values.map((value) => this.toSqliteParam(value)));
				valueClause = `filter_nav.value IN (${values.map(() => "?").join(",")})`;
				break;
			}
			case "not_in": {
				const values = Array.isArray(filter.value)
					? filter.value
					: [filter.value];
				params.push(...values.map((value) => this.toSqliteParam(value)));
				valueClause = `filter_nav.value NOT IN (${values.map(() => "?").join(",")})`;
				break;
			}
			case "is_null":
				valueClause = "filter_nav.value IS NULL";
				break;
			case "is_not_null":
				valueClause = "filter_nav.value IS NOT NULL";
				break;
			default:
				throw new DatabaseException(`Unsupported operator: ${filter.operator}`);
		}

		return {
			query: `
        SELECT filter_nav.node_id
        FROM attributes filter_a
        JOIN node_attributes filter_nav ON filter_nav.attribute_id = filter_a.id
        WHERE filter_a.table_id = ?
          AND filter_a.identifier = ?
          AND ${valueClause}
      `,
			params,
		};
	}

	private buildTextCandidate(
		text: string,
		fullTextIndexAvailable: boolean,
		tableId: TableId,
		includeRelevance: boolean,
	): CandidateQuery {
		const likePattern = `%${text}%`;
		if (fullTextIndexAvailable) {
			const ftsQuery = this.toFtsQuery(text);
			if (this.hasAttributeFullTextIndex()) {
				if (!includeRelevance) {
					return {
						query: `
              SELECT node_id, NULL AS relevance_score
              FROM node_search_fts
              WHERE CAST(table_id AS TEXT) = CAST(? AS TEXT) AND node_search_fts MATCH ?
              UNION
              SELECT node_id, NULL AS relevance_score
              FROM node_attribute_search_fts
              WHERE CAST(table_id AS TEXT) = CAST(? AS TEXT) AND node_attribute_search_fts MATCH ?
            `,
						params: [tableId, ftsQuery, tableId, ftsQuery],
					};
				}

				return {
					query: `
            SELECT text_match.node_id, MIN(text_match.relevance_score) AS relevance_score
            FROM (
              SELECT node_id, bm25(node_search_fts) AS relevance_score
              FROM node_search_fts
              WHERE CAST(table_id AS TEXT) = CAST(? AS TEXT) AND node_search_fts MATCH ?
              UNION ALL
              SELECT node_id, bm25(node_attribute_search_fts) AS relevance_score
              FROM node_attribute_search_fts
              WHERE CAST(table_id AS TEXT) = CAST(? AS TEXT) AND node_attribute_search_fts MATCH ?
            ) text_match
            GROUP BY text_match.node_id
          `,
					params: [tableId, ftsQuery, tableId, ftsQuery],
				};
			}

			return {
				query: `
          SELECT text_match.node_id, MIN(text_match.relevance_score) AS relevance_score
          FROM (
            SELECT node_id, ${includeRelevance ? "bm25(node_search_fts)" : "NULL"} AS relevance_score
            FROM node_search_fts
            WHERE CAST(table_id AS TEXT) = CAST(? AS TEXT) AND node_search_fts MATCH ?
            UNION ALL
            SELECT text_nav.node_id, NULL AS relevance_score
            FROM node_attributes text_nav
            WHERE text_nav.value LIKE ?
          ) text_match
          GROUP BY text_match.node_id
        `,
				params: [tableId, ftsQuery, likePattern],
			};
		}

		return {
			query: `
        SELECT text_match.node_id, NULL AS relevance_score
        FROM (
          SELECT text_node.id AS node_id
          FROM nodes text_node
          WHERE text_node.table_id = ?
            AND (text_node.content LIKE ? OR text_node.title LIKE ? OR text_node.description LIKE ? OR text_node.metadata LIKE ?)
          UNION
          SELECT text_nav.node_id
          FROM node_attributes text_nav
          WHERE text_nav.value LIKE ?
        ) text_match
      `,
			params: [
				tableId,
				likePattern,
				likePattern,
				likePattern,
				likePattern,
				likePattern,
			],
		};
	}

	private castSortValue(
		tableAlias: string,
		dataType: string,
		typedNumericAvailable: boolean,
	): string {
		switch (dataType) {
			case "number":
				return typedNumericAvailable
					? `${tableAlias}.value_num`
					: `CAST(${tableAlias}.value AS REAL)`;
			case "integer":
				return `CAST(${tableAlias}.value AS INTEGER)`;
			case "datetime":
			case "date":
			case "date-time":
				return typedNumericAvailable
					? `${tableAlias}.value_num`
					: `datetime(${tableAlias}.value)`;
			case "boolean":
				return typedNumericAvailable
					? `${tableAlias}.value_num`
					: `CAST(${tableAlias}.value AS INTEGER)`;
			default:
				return `${tableAlias}.value COLLATE NOCASE`;
		}
	}

	private hasFullTextIndex(): boolean {
		if (this.fullTextIndexAvailable !== undefined)
			return this.fullTextIndexAvailable;
		const result = this.db
			.query<{ name: string }, [string]>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
			)
			.get("node_search_fts");
		this.fullTextIndexAvailable = Boolean(result);
		return this.fullTextIndexAvailable;
	}

	private hasAttributeFullTextIndex(): boolean {
		if (this.attributeFullTextIndexAvailable !== undefined)
			return this.attributeFullTextIndexAvailable;
		const result = this.db
			.query<{ name: string }, [string]>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
			)
			.get("node_attribute_search_fts");
		this.attributeFullTextIndexAvailable = Boolean(result);
		return this.attributeFullTextIndexAvailable;
	}

	private hasTypedNumericColumn(): boolean {
		if (this.typedNumericColumnAvailable !== undefined)
			return this.typedNumericColumnAvailable;
		const columns = this.db
			.query<{ name: string }, []>("PRAGMA table_info(node_attributes)")
			.all();
		this.typedNumericColumnAvailable = columns.some(
			(column) => column.name === "value_num",
		);
		return this.typedNumericColumnAvailable;
	}

	private toFtsQuery(value: unknown): string {
		const terms = String(value)
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((term) => `"${term.replaceAll('"', '""')}"`);

		return terms.length > 0 ? terms.join(" AND ") : '""';
	}

	private buildComparisonClause(
		dataType: string,
		operator: string,
		rawValue: unknown,
		typedNumericAvailable: boolean,
	): { clause: string; params: SqliteParams } {
		if (typedNumericAvailable) {
			if (dataType === "number") {
				const num = Number(rawValue);
				if (Number.isFinite(num)) {
					return {
						clause: `filter_nav.value_num IS NOT NULL AND filter_nav.value_num ${operator} ?`,
						params: [num],
					};
				}
			}
			if (dataType === "integer") {
				const num = Number(rawValue);
				if (Number.isFinite(num) && Math.abs(num) <= Number.MAX_SAFE_INTEGER) {
					return {
						clause: `filter_nav.value_num IS NOT NULL AND filter_nav.value_num ${operator} ?`,
						params: [num],
					};
				}
				return {
					clause: `CAST(filter_nav.value AS INTEGER) ${operator} CAST(? AS INTEGER)`,
					params: [this.toSqliteParam(rawValue)],
				};
			}
			if (
				dataType === "datetime" ||
				dataType === "date" ||
				dataType === "date-time"
			) {
				return {
					clause: `filter_nav.value_num IS NOT NULL AND filter_nav.value_num ${operator} julianday(?)`,
					params: [this.toSqliteParam(rawValue)],
				};
			}
			if (dataType === "boolean") {
				const normalized = this.toBooleanNumericParam(rawValue);
				if (normalized !== null) {
					return {
						clause: `filter_nav.value_num IS NOT NULL AND filter_nav.value_num ${operator} ?`,
						params: [normalized],
					};
				}
			}
		}

		switch (dataType) {
			case "number":
				return {
					clause: `CAST(filter_nav.value AS REAL) ${operator} ?`,
					params: [this.toSqliteParam(rawValue)],
				};
			case "integer":
				return {
					clause: `CAST(filter_nav.value AS INTEGER) ${operator} CAST(? AS INTEGER)`,
					params: [this.toSqliteParam(rawValue)],
				};
			case "datetime":
			case "date":
			case "date-time":
				return {
					clause: `datetime(filter_nav.value) ${operator} datetime(?)`,
					params: [this.toSqliteParam(rawValue)],
				};
			case "boolean":
				return {
					clause: `CAST(filter_nav.value AS INTEGER) ${operator} ?`,
					params: [this.toSqliteParam(rawValue)],
				};
			default:
				return {
					clause: `filter_nav.value ${operator} ?`,
					params: [this.toSqliteParam(rawValue)],
				};
		}
	}

	private buildRangeClause(
		dataType: string,
		range: RangeValue,
		typedNumericAvailable: boolean,
	): { clause: string; params: SqliteParams } {
		if (typedNumericAvailable) {
			if (dataType === "number") {
				const minNum = Number(range.min);
				const maxNum = Number(range.max);
				if (Number.isFinite(minNum) && Number.isFinite(maxNum)) {
					return {
						clause:
							"filter_nav.value_num IS NOT NULL AND filter_nav.value_num BETWEEN ? AND ?",
						params: [minNum, maxNum],
					};
				}
			}
			if (dataType === "integer") {
				const minNum = Number(range.min);
				const maxNum = Number(range.max);
				if (
					Number.isFinite(minNum) &&
					Number.isFinite(maxNum) &&
					Math.abs(minNum) <= Number.MAX_SAFE_INTEGER &&
					Math.abs(maxNum) <= Number.MAX_SAFE_INTEGER
				) {
					return {
						clause:
							"filter_nav.value_num IS NOT NULL AND filter_nav.value_num BETWEEN ? AND ?",
						params: [minNum, maxNum],
					};
				}
				return {
					clause:
						"CAST(filter_nav.value AS INTEGER) BETWEEN CAST(? AS INTEGER) AND CAST(? AS INTEGER)",
					params: [
						this.toSqliteParam(range.min),
						this.toSqliteParam(range.max),
					],
				};
			}
			if (
				dataType === "datetime" ||
				dataType === "date" ||
				dataType === "date-time"
			) {
				return {
					clause:
						"filter_nav.value_num IS NOT NULL AND filter_nav.value_num BETWEEN julianday(?) AND julianday(?)",
					params: [
						this.toSqliteParam(range.min),
						this.toSqliteParam(range.max),
					],
				};
			}
		}

		switch (dataType) {
			case "number":
				return {
					clause: "CAST(filter_nav.value AS REAL) BETWEEN ? AND ?",
					params: [
						this.toSqliteParam(range.min),
						this.toSqliteParam(range.max),
					],
				};
			case "integer":
				return {
					clause:
						"CAST(filter_nav.value AS INTEGER) BETWEEN CAST(? AS INTEGER) AND CAST(? AS INTEGER)",
					params: [
						this.toSqliteParam(range.min),
						this.toSqliteParam(range.max),
					],
				};
			case "datetime":
			case "date":
			case "date-time":
				return {
					clause:
						"datetime(filter_nav.value) BETWEEN datetime(?) AND datetime(?)",
					params: [
						this.toSqliteParam(range.min),
						this.toSqliteParam(range.max),
					],
				};
			default:
				return {
					clause: "filter_nav.value BETWEEN ? AND ?",
					params: [
						this.toSqliteParam(range.min),
						this.toSqliteParam(range.max),
					],
				};
		}
	}

	private toBooleanNumericParam(value: unknown): number | null {
		if (value === true || value === 1 || value === "1") return 1;
		if (value === false || value === 0 || value === "0") return 0;
		if (typeof value === "string") {
			const lower = value.trim().toLowerCase();
			if (lower === "true") return 1;
			if (lower === "false") return 0;
		}
		return null;
	}

	private parseAttributeValue(value: string, dataType: string): SafeJsonValue {
		switch (dataType) {
			case "number":
			case "integer": {
				const num = Number(value);
				return Number.isNaN(num) || !Number.isSafeInteger(num) && dataType === "integer"
					? value
					: Number.isNaN(num)
						? value
						: num;
			}

			case "boolean":
				if (value === "true" || value === "1") {
					return true;
				}
				if (value === "false" || value === "0") {
					return false;
				}
				return value;

			case "datetime":
				try {
					return new Date(value).toISOString();
				} catch {
					return value;
				}

			case "json":
			case "object":
			case "array":
				try {
					return parseSafeJson(value) ?? value;
				} catch {
					return value;
				}

			default:
				return value;
		}
	}

	private isRangeValue(value: unknown): value is RangeValue {
		if (typeof value !== "object" || value === null) {
			return false;
		}

		return "min" in value && "max" in value;
	}

	private toSqliteParam(value: unknown): SqliteParam {
		if (
			value === null ||
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			return value;
		}

		return JSON.stringify(value);
	}
}
