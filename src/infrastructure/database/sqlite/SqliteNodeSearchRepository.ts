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

type SqliteParam = string | number | boolean | null;
type SqliteParams = SqliteParam[];

interface CandidateQuery {
	query: string;
	params: SqliteParams;
}

export class SqliteNodeSearchRepository implements INodeSearchRepository {
	private fullTextIndexAvailable: boolean | undefined;

	constructor(private readonly db: Database) {}

	async searchNodes(
		tableId: TableId,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
	): Promise<PaginatedResult<NodeSearchResult>> {
		try {
			const fullTextIndexAvailable = this.hasFullTextIndex();
			const { query: countQuery, params: countParams } = this.buildNodeQuery(
				tableId,
				searchQuery,
				availableAttributes,
				true,
				fullTextIndexAvailable,
			);
			const { query: pageQuery, params: pageParams } = this.buildNodeQuery(
				tableId,
				searchQuery,
				availableAttributes,
				false,
				fullTextIndexAvailable,
			);

			const countResult = this.db
				.query<{ count: number }, SqliteParams>(countQuery)
				.get(...countParams);
			const total = countResult?.count || 0;
			const pageRows = this.db
				.query<NodePageRow, SqliteParams>(pageQuery)
				.all(...pageParams);

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

			const data = pageRows.flatMap((row) => {
				const result = nodeMap.get(row.node_id);
				return result ? [result] : [];
			});
			const limit = searchQuery.limit || 10;
			const offset = searchQuery.offset || 0;

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

	private buildNodeQuery(
		tableId: TableId,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
		isCountQuery: boolean,
		fullTextIndexAvailable: boolean,
	): { query: string; params: SqliteParams } {
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
				!isCountQuery,
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

			const conditionName = `condition_candidates_${conditionIndex++}`;
			if (condition.logicalOperator === "or") {
				withClauses.push(
					`${conditionName} AS MATERIALIZED (${filterCandidates
						.map((candidate) => `SELECT node_id FROM ${candidate}`)
						.join(" UNION ")})`,
				);
			} else {
				withClauses.push(
					`${conditionName} AS MATERIALIZED (${filterCandidates
						.map((candidate) => `SELECT node_id FROM ${candidate}`)
						.join(" INTERSECT ")})`,
				);
			}
			requiredCandidateSets.push(conditionName);
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

		const sortJoins: string[] = [];
		const sortParams: SqliteParams = [];
		const clauses: string[] = [];
		if (!isCountQuery) {
			for (const [sortIndex, sort] of (searchQuery.sortBy ?? []).entries()) {
				const direction = sort.direction === "asc" ? "ASC" : "DESC";
				if (["created_at", "updated_at"].includes(sort.field)) {
					clauses.push(`n.${sort.field} ${direction}`);
					continue;
				}
				if (["title", "content"].includes(sort.field)) {
					clauses.push(`n.${sort.field} COLLATE NOCASE ${direction}`);
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
             ON ${sortValueName}.node_id = n.id AND ${sortValueName}.attribute_id = ${sortAttributeName}.id`,
				);
				sortParams.push(tableId, sort.field);
				const sortValue = this.castSortValue(
					`${sortValueName}.value`,
					attribute.dataType,
				);
				clauses.push(
					`${sortValue} IS NULL ${sort.direction === "asc" ? "ASC" : "DESC"}`,
				);
				clauses.push(`${sortValue} ${direction}`);
			}
		}

		// INTERSECT also deduplicates the IDs, so COUNT remains exact while the
		// page query can hydrate attributes separately after LIMIT/OFFSET.
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

		const withClause = `WITH ${withClauses.join(",\n")}`;
		if (isCountQuery) {
			return {
				query: `${withClause}\nSELECT COUNT(*) AS count FROM eligible_node_ids`,
				params,
			};
		}

		const rankingCandidate = fullTextIndexAvailable
			? (preferredTextCandidate ?? firstTextCandidate)
			: undefined;
		if (rankingCandidate) {
			withClauses.push(`eligible_nodes AS MATERIALIZED (
        SELECT ranked.node_id, ranked.relevance_score
        FROM ${rankingCandidate} ranked
        WHERE ranked.node_id IN (SELECT node_id FROM eligible_node_ids)
        UNION ALL
        SELECT eligible.node_id, NULL AS relevance_score
        FROM eligible_node_ids eligible
        WHERE eligible.node_id NOT IN (SELECT node_id FROM ${rankingCandidate})
      )`);
		} else {
			withClauses.push(`eligible_nodes AS MATERIALIZED (
        SELECT node_id, NULL AS relevance_score FROM eligible_node_ids
      )`);
		}
		const pageWithClause = `WITH ${withClauses.join(",\n")}`;
		const orderBy =
			clauses.length > 0
				? `ORDER BY ${clauses.join(", ")}, n.id ASC`
				: rankingCandidate
					? "ORDER BY eligible.relevance_score IS NULL ASC, eligible.relevance_score ASC, n.id ASC"
					: "ORDER BY n.created_at DESC, n.id ASC";
		const limit = searchQuery.limit || 10;
		const offset = searchQuery.offset || 0;
		params.push(...sortParams, limit, offset);

		return {
			query: `${pageWithClause}
        SELECT CAST(n.id AS TEXT) AS node_id, CAST(n.table_id AS TEXT) AS node_table_id,
               n.content AS node_content, n.title AS node_title,
               n.description AS node_description, n.metadata AS node_metadata,
               n.created_at AS node_created_at, n.updated_at AS node_updated_at,
               eligible.relevance_score AS relevance_score
        FROM eligible_nodes eligible
        JOIN nodes n ON n.id = eligible.node_id
        ${sortJoins.join("\n")}
        ${orderBy}
        LIMIT ? OFFSET ?`,
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
			case "gt":
				params.push(this.toSqliteParam(filter.value));
				valueClause = this.buildComparisonClause(attributeInfo.dataType, ">");
				break;
			case "gte":
				params.push(this.toSqliteParam(filter.value));
				valueClause = this.buildComparisonClause(attributeInfo.dataType, ">=");
				break;
			case "lt":
				params.push(this.toSqliteParam(filter.value));
				valueClause = this.buildComparisonClause(attributeInfo.dataType, "<");
				break;
			case "lte":
				params.push(this.toSqliteParam(filter.value));
				valueClause = this.buildComparisonClause(attributeInfo.dataType, "<=");
				break;
			case "range": {
				if (!this.isRangeValue(filter.value)) {
					throw new DatabaseException(
						`Invalid range filter for ${filter.field}`,
					);
				}
				const range = filter.value as RangeValue;
				params.push(
					this.toSqliteParam(range.min),
					this.toSqliteParam(range.max),
				);
				valueClause = this.buildRangeClause(attributeInfo.dataType);
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
        SELECT DISTINCT filter_nav.node_id
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
				params: [tableId, this.toFtsQuery(text), likePattern],
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

	private castSortValue(expression: string, dataType: string): string {
		switch (dataType) {
			case "number":
				return `CAST(${expression} AS REAL)`;
			case "integer":
				return `CAST(${expression} AS INTEGER)`;
			case "datetime":
				return `datetime(${expression})`;
			case "boolean":
				return `CAST(${expression} AS INTEGER)`;
			default:
				return `${expression} COLLATE NOCASE`;
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

	private toFtsQuery(value: unknown): string {
		const terms = String(value)
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.map((term) => `"${term.replaceAll('"', '""')}"`);

		return terms.length > 0 ? terms.join(" AND ") : '""';
	}

	private buildComparisonClause(dataType: string, operator: string): string {
		switch (dataType) {
			case "number":
				return `CAST(filter_nav.value AS REAL) ${operator} ?`;
			case "datetime":
				return `datetime(filter_nav.value) ${operator} datetime(?)`;
			case "boolean":
				return `CAST(filter_nav.value AS INTEGER) ${operator} ?`;
			default:
				return `filter_nav.value ${operator} ?`;
		}
	}

	private buildRangeClause(dataType: string): string {
		switch (dataType) {
			case "number":
				return "CAST(filter_nav.value AS REAL) BETWEEN ? AND ?";
			case "datetime":
				return "datetime(filter_nav.value) BETWEEN datetime(?) AND datetime(?)";
			default:
				return "filter_nav.value BETWEEN ? AND ?";
		}
	}

	private parseAttributeValue(value: string, dataType: string): SafeJsonValue {
		switch (dataType) {
			case "number": {
				const num = Number(value);
				return Number.isNaN(num) ? value : num;
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
