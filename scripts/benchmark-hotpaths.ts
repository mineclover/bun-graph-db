#!/usr/bin/env bun

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ILogger } from "../src/application/ports/ILogger.js";
import type { AttributeTypeInfo } from "../src/application/services/SearchQueryParser.js";
import { TableSchemaProjectionService } from "../src/application/services/TableSchemaProjectionService.js";
import { Node } from "../src/domain/entities/Node.js";
import { JsonlBackupService } from "../src/domain/services/JsonlBackupService.js";
import { RelationDirection } from "../src/domain/value-objects/RelationQuery.js";
import {
	LogicalOperator,
	SearchOperator,
	type SearchQuery,
} from "../src/domain/value-objects/SearchFilter.js";
import { SqliteAttributeRepository } from "../src/infrastructure/database/sqlite/SqliteAttributeRepository.js";
import { SqliteAttributeTypeRepository } from "../src/infrastructure/database/sqlite/SqliteAttributeTypeRepository.js";
import { SqliteGraphRepository } from "../src/infrastructure/database/sqlite/SqliteGraphRepository.js";
import { SqliteNodeAttributeRepository } from "../src/infrastructure/database/sqlite/SqliteNodeAttributeRepository.js";
import { SqliteNodeMutationRepository } from "../src/infrastructure/database/sqlite/SqliteNodeMutationRepository.js";
import { SqliteNodeRelationRepository } from "../src/infrastructure/database/sqlite/SqliteNodeRelationRepository.js";
import { SqliteNodeRepository } from "../src/infrastructure/database/sqlite/SqliteNodeRepository.js";
import { SqliteNodeSearchRepository } from "../src/infrastructure/database/sqlite/SqliteNodeSearchRepository.js";
import { SqliteRelationTypeRepository } from "../src/infrastructure/database/sqlite/SqliteRelationTypeRepository.js";
import { SqliteTableRepository } from "../src/infrastructure/database/sqlite/SqliteTableRepository.js";

export const BENCHMARK_REPORT_SCHEMA = "bun-graph-db.hotpath-benchmark.v1";
export const BENCHMARK_DATABASE_SCHEMA = "bun-graph-db.hotpath-fixture.v1";
export const BENCHMARK_SEED = 0x5eedc0de;

const DEFAULT_FULL_CONFIGURATION: BenchmarkConfiguration = {
	profile: "full",
	datasetNodes: 3_000,
	attributeFanout: 8,
	warmupIterations: 5,
	samples: 30,
	searchLimit: 25,
	searchOffset: 2_100,
	jsonlExportNodes: 501,
};

const DEFAULT_CI_CONFIGURATION: BenchmarkConfiguration = {
	profile: "ci",
	datasetNodes: 1_000,
	attributeFanout: 6,
	warmupIterations: 3,
	samples: 15,
	searchLimit: 20,
	searchOffset: 700,
	jsonlExportNodes: 501,
};

const FIXED_TIMESTAMP = "2026-08-11T00:00:00.000Z";
const SEARCH_TABLE_ID = "1";
const JSONL_TABLE_ID = "2";
const NOOP_LOGGER: ILogger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
};
const SEARCH_QUERY: SearchQuery = {
	conditions: [
		{
			logicalOperator: LogicalOperator.AND,
			filters: [
				{
					field: "attr_0",
					operator: SearchOperator.EQUALS,
					value: "common",
					valueType: "string",
				},
				{
					field: "attr_1",
					operator: SearchOperator.EQUALS,
					value: "active",
					valueType: "string",
				},
			],
		},
	],
	textSearch: "benchmark",
	sortBy: [{ field: "attr_2", direction: "desc" }],
};

export interface BenchmarkConfiguration {
	profile: "full" | "ci" | "test";
	datasetNodes: number;
	attributeFanout: number;
	warmupIterations: number;
	samples: number;
	searchLimit: number;
	searchOffset: number;
	jsonlExportNodes: number;
}

export interface TimingSummary {
	minMs: number;
	maxMs: number;
	meanMs: number;
	medianMs: number;
	p95Ms: number;
	p99Ms: number;
}

interface ResourceSnapshot {
	rssBytes: number;
	heapUsedBytes: number;
	databaseBytes: number;
	databaseFileBytes: number;
}

interface ResourceDelta {
	before: ResourceSnapshot;
	after: ResourceSnapshot;
	delta: ResourceSnapshot;
}

interface QueryPlanRow {
	id: number;
	parent: number;
	notused: number;
	detail: string;
}

interface QueryPlanSnapshot {
	count: QueryPlanRow[];
	page: QueryPlanRow[];
}

interface BenchmarkResult {
	id: string;
	description: string;
	timings: TimingSummary;
	sampleCount: number;
	sql: {
		logicalStatementsPerSample: number;
		transactionsPerSample: number;
		rowAccounting: string;
	};
	rows: Record<string, number>;
	invariants: Record<string, boolean | number | string> & { passed: true };
	resources: ResourceDelta;
	queryPlan?: QueryPlanSnapshot;
}

export interface RegressionWarning {
	benchmarkId: string;
	metric: "medianMs" | "p95Ms";
	baselineMs: number;
	currentMs: number;
	deltaMs: number;
	regressionPercent: number | null;
	percentThreshold: number;
	absoluteFloorMs: number;
}

export interface BaselineComparison {
	status: "pass" | "warning";
	enforced: boolean;
	thresholds: {
		medianRegressionPercent: 15;
		p95RegressionPercent: 20;
		absoluteFloorMs: 5;
	};
	warnings: RegressionWarning[];
}

export interface BenchmarkReport {
	schemaVersion: typeof BENCHMARK_REPORT_SCHEMA;
	generatedAt: string;
	metadata: {
		databaseSchemaVersion: typeof BENCHMARK_DATABASE_SCHEMA;
		fixtureSeed: number;
		executionModel: string;
		concurrencyClaim: "none";
		rowAccounting: string;
		runtime: { bun: string; platform: string; arch: string };
		pragmas: { journalMode: "wal"; synchronous: "normal"; foreignKeys: true };
	};
	configuration: BenchmarkConfiguration;
	benchmarks: BenchmarkResult[];
	invariants: { passed: true; benchmarkCount: number };
	comparison: BaselineComparison | null;
}

export interface RunBenchmarkOptions {
	configuration?: BenchmarkConfiguration;
	baseline?: BenchmarkReport;
	enforce?: boolean;
}

interface CliOptions {
	configuration: BenchmarkConfiguration;
	baselinePath?: string;
	outputPath?: string;
	enforce: boolean;
}

interface SearchRepositoryIntrospection {
	hasFullTextIndex(): boolean;
	buildNodeQuery(
		tableId: string,
		searchQuery: SearchQuery,
		availableAttributes: AttributeTypeInfo[],
		isCountQuery: boolean,
		fullTextIndexAvailable: boolean,
	): { query: string; params: SQLQueryBindings[] };
}

interface Fixture {
	database: Database;
	databasePath: string;
	temporaryDirectory: string;
	availableAttributes: AttributeTypeInfo[];
}

export function summarizeSamples(samples: readonly number[]): TimingSummary {
	if (samples.length === 0) throw new Error("At least one sample is required");
	if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
		throw new Error("Samples must be finite, non-negative durations");
	}

	const sorted = [...samples].sort((left, right) => left - right);
	const total = sorted.reduce((sum, sample) => sum + sample, 0);
	return {
		minMs: round(sorted[0] ?? 0),
		maxMs: round(sorted.at(-1) ?? 0),
		meanMs: round(total / sorted.length),
		medianMs: round(percentile(sorted, 0.5)),
		p95Ms: round(percentile(sorted, 0.95)),
		p99Ms: round(percentile(sorted, 0.99)),
	};
}

export function compareBenchmarkReports(
	current: BenchmarkReport,
	baseline: BenchmarkReport,
	enforced = false,
): BaselineComparison {
	assertComparableReports(current, baseline);

	const warnings: RegressionWarning[] = [];
	const baselineById = new Map(
		baseline.benchmarks.map((benchmark) => [benchmark.id, benchmark]),
	);
	for (const benchmark of current.benchmarks) {
		const previous = baselineById.get(benchmark.id);
		if (!previous) {
			throw new Error(
				`Baseline is missing benchmark '${benchmark.id}' for same-schema comparison`,
			);
		}

		for (const threshold of [
			{ metric: "medianMs" as const, percent: 15 },
			{ metric: "p95Ms" as const, percent: 20 },
		]) {
			const baselineMs = previous.timings[threshold.metric];
			const currentMs = benchmark.timings[threshold.metric];
			const deltaMs = currentMs - baselineMs;
			const regressionPercent =
				baselineMs === 0 ? null : (deltaMs / baselineMs) * 100;
			const exceedsPercent =
				regressionPercent === null
					? currentMs > 0
					: regressionPercent > threshold.percent;

			if (deltaMs >= 5 && exceedsPercent) {
				warnings.push({
					benchmarkId: benchmark.id,
					metric: threshold.metric,
					baselineMs,
					currentMs,
					deltaMs: round(deltaMs),
					regressionPercent:
						regressionPercent === null ? null : round(regressionPercent),
					percentThreshold: threshold.percent,
					absoluteFloorMs: 5,
				});
			}
		}
	}

	return {
		status: warnings.length > 0 ? "warning" : "pass",
		enforced,
		thresholds: {
			medianRegressionPercent: 15,
			p95RegressionPercent: 20,
			absoluteFloorMs: 5,
		},
		warnings,
	};
}

export async function runHotPathBenchmarks(
	options: RunBenchmarkOptions = {},
): Promise<BenchmarkReport> {
	const configuration = options.configuration ?? DEFAULT_FULL_CONFIGURATION;
	validateConfiguration(configuration);
	const fixture = createFixture(configuration);

	try {
		const tableRepository = new SqliteTableRepository(fixture.database);
		const attributeRepository = new SqliteAttributeRepository(fixture.database);
		const attributeTypeRepository = new SqliteAttributeTypeRepository(
			fixture.database,
		);
		const searchRepository = new SqliteNodeSearchRepository(fixture.database);
		const graphRepository = new SqliteGraphRepository(fixture.database);
		const mutationRepository = new SqliteNodeMutationRepository(
			fixture.database,
		);
		const projectionService = new TableSchemaProjectionService(
			tableRepository,
			attributeRepository,
			attributeTypeRepository,
		);
		const jsonlBackupService = new JsonlBackupService(
			tableRepository,
			attributeRepository,
			attributeTypeRepository,
			new SqliteNodeRepository(fixture.database),
			new SqliteNodeAttributeRepository(fixture.database),
			new SqliteNodeRelationRepository(fixture.database),
			new SqliteRelationTypeRepository(fixture.database),
			NOOP_LOGGER,
		);

		const benchmarks = [
			await benchmarkSearch(fixture, searchRepository, configuration),
			await benchmarkGraphTraversal(fixture, graphRepository, configuration),
			await benchmarkJsonlExport(fixture, jsonlBackupService, configuration),
			await benchmarkAtomicCreate(fixture, mutationRepository, configuration),
			await benchmarkProjectionMiss(fixture, projectionService, configuration),
			await benchmarkProjectionHit(fixture, projectionService, configuration),
		];

		const report: BenchmarkReport = {
			schemaVersion: BENCHMARK_REPORT_SCHEMA,
			generatedAt: new Date().toISOString(),
			metadata: {
				databaseSchemaVersion: BENCHMARK_DATABASE_SCHEMA,
				fixtureSeed: BENCHMARK_SEED,
				executionModel:
					"Single process and one synchronous bun:sqlite connection; operations are sampled serially.",
				concurrencyClaim: "none",
				rowAccounting:
					"Logical API result/write rows only; SQLite rows scanned are not inferred.",
				runtime: {
					bun: Bun.version,
					platform: process.platform,
					arch: process.arch,
				},
				pragmas: {
					journalMode: "wal",
					synchronous: "normal",
					foreignKeys: true,
				},
			},
			configuration: { ...configuration },
			benchmarks,
			invariants: { passed: true, benchmarkCount: benchmarks.length },
			comparison: null,
		};

		if (options.baseline) {
			report.comparison = compareBenchmarkReports(
				report,
				options.baseline,
				options.enforce ?? false,
			);
		}

		return report;
	} finally {
		TableSchemaProjectionService.clearCache();
		fixture.database.close();
		removeFixtureDirectory(fixture.temporaryDirectory);
	}
}

async function benchmarkSearch(
	fixture: Fixture,
	repository: SqliteNodeSearchRepository,
	configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> {
	const query: SearchQuery = {
		...SEARCH_QUERY,
		limit: configuration.searchLimit,
		offset: configuration.searchOffset,
	};
	let expectedNodeIds: string[] | undefined;
	let lastResultCount = 0;
	const operation = async () => {
		const result = await repository.searchNodes(
			SEARCH_TABLE_ID,
			query,
			fixture.availableAttributes,
		);
		const data = result.data ?? result.nodes;
		const nodeIds = data.map((entry) => entry.node.getId());
		const uniqueNodeIds = new Set(nodeIds);
		assertInvariant(
			result.total === configuration.datasetNodes,
			`search total (expected ${configuration.datasetNodes}, got ${result.total ?? result.totalCount})`,
		);
		assertInvariant(
			data.length === configuration.searchLimit,
			"search page node count",
		);
		assertInvariant(
			uniqueNodeIds.size === data.length,
			"search page node uniqueness",
		);
		assertInvariant(
			data.every(
				(entry) =>
					Object.keys(entry.attributes).length ===
					configuration.attributeFanout,
			),
			"search attribute fanout",
		);
		if (expectedNodeIds) {
			assertInvariant(
				arraysEqual(expectedNodeIds, nodeIds),
				"search stable ordering",
			);
		} else {
			expectedNodeIds = nodeIds;
		}
		lastResultCount = data.length;
	};

	const measured = await measureOperation(fixture, configuration, operation);
	const queryPlan = captureSearchQueryPlan(
		fixture.database,
		repository,
		query,
		fixture.availableAttributes,
	);
	const planRows = [...queryPlan.count, ...queryPlan.page];
	const correlatedSubqueryCount = planRows.filter((row) =>
		row.detail.includes("CORRELATED"),
	).length;
	const attributeCompositeIndexUsed = planRows.some((row) =>
		row.detail.includes("idx_node_attributes_attr_value_node"),
	);
	const setIntersectionUsed = planRows.some((row) =>
		row.detail.includes("INTERSECT"),
	);
	assertInvariant(
		correlatedSubqueryCount === 0,
		"search plan has no correlated subqueries",
	);
	assertInvariant(
		attributeCompositeIndexUsed,
		"search plan uses the attribute/value/node composite index",
	);
	assertInvariant(setIntersectionUsed, "search plan uses set intersection");
	return {
		id: "search.eav-fanout-fts-deep-offset",
		description:
			"Two independent EAV filters, FTS match, attribute sort, deep OFFSET, and page attribute hydration.",
		timings: measured.timings,
		sampleCount: configuration.samples,
		sql: {
			logicalStatementsPerSample: 3,
			transactionsPerSample: 0,
			rowAccounting:
				"COUNT result + page node results + hydrated attribute results; query-plan rows are reported separately.",
		},
		rows: {
			totalMatches: configuration.datasetNodes,
			pageNodesReturnedPerSample: lastResultCount,
			attributesReturnedPerSample:
				lastResultCount * configuration.attributeFanout,
			uniqueNodesReturnedPerSample: expectedNodeIds?.length ?? 0,
		},
		invariants: {
			passed: true,
			expectedNodeCount: configuration.searchLimit,
			uniqueNodeCount: expectedNodeIds?.length ?? 0,
			stableOrdering: true,
			completeAttributeFanout: true,
			correlatedSubqueryCount,
			attributeCompositeIndexUsed,
			setIntersectionUsed,
		},
		resources: measured.resources,
		queryPlan,
	};
}

async function benchmarkGraphTraversal(
	fixture: Fixture,
	repository: SqliteGraphRepository,
	configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> {
	let expectedNodeIds: string[] | undefined;
	let lastResultCount = 0;
	const expectedResultCount = Math.min(configuration.datasetNodes - 1, 100);
	const operation = async () => {
		const dependencies = await repository.getDependencyChain(
			SEARCH_TABLE_ID,
			"1",
			RelationDirection.OUTGOING,
			["depends_on"],
		);
		const nodeIds = dependencies.map((dependency) => String(dependency.nodeId));
		assertInvariant(
			dependencies.length === expectedResultCount,
			`graph traversal result count (expected ${expectedResultCount}, got ${dependencies.length})`,
		);
		assertInvariant(
			new Set(nodeIds).size === nodeIds.length,
			"graph traversal node uniqueness",
		);
		assertInvariant(
			!nodeIds.includes("1"),
			"graph traversal excludes root cycle",
		);
		assertInvariant(
			dependencies.every(
				(dependency) => dependency.relationPath.length === dependency.level,
			),
			"graph traversal relation path depth",
		);
		if (expectedNodeIds) {
			assertInvariant(
				arraysEqual(expectedNodeIds, nodeIds),
				"graph traversal stable ordering",
			);
		} else {
			expectedNodeIds = nodeIds;
		}
		lastResultCount = dependencies.length;
	};

	const measured = await measureOperation(fixture, configuration, operation);
	return {
		id: "graph.outgoing-dependency-tree",
		description:
			"Bounded recursive CTE traversal over a deterministic binary dependency tree.",
		timings: measured.timings,
		sampleCount: configuration.samples,
		sql: {
			logicalStatementsPerSample: 1,
			transactionsPerSample: 0,
			rowAccounting:
				"Rows returned by the recursive dependency API; internal recursive CTE rows are not inferred.",
		},
		rows: {
			dependencyRowsReturnedPerSample: lastResultCount,
			uniqueNodesReturnedPerSample: expectedNodeIds?.length ?? 0,
			fixtureRelations: configuration.datasetNodes - 1,
		},
		invariants: {
			passed: true,
			expectedNodeCount: expectedResultCount,
			uniqueNodeCount: expectedNodeIds?.length ?? 0,
			stableOrdering: true,
			rootExcluded: true,
			pathDepthsValid: true,
		},
		resources: measured.resources,
	};
}

async function benchmarkJsonlExport(
	fixture: Fixture,
	service: JsonlBackupService,
	configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> {
	let sequence = 0;
	let expectedTotalBytes: number | undefined;
	let lastTotalBytes = 0;
	let lastTableBytes = 0;
	let lastLineCount = 0;
	const exportOnce = async () => {
		const outputDir = join(
			fixture.temporaryDirectory,
			`jsonl-export-${sequence++}`,
		);
		const result = await service.export({
			outputDir,
			tableIds: [JSONL_TABLE_ID],
			includeSchema: true,
			includeRelations: false,
		});
		return { outputDir, result };
	};
	const validateAndRemove = async (
		outputDir: string,
		result: Awaited<ReturnType<JsonlBackupService["export"]>>,
	) => {
		try {
			assertInvariant(result.success, "JSONL export success");
			assertInvariant(result.errors.length === 0, "JSONL export errors");
			assertInvariant(
				result.stats.tablesExported === 1,
				"JSONL exported table count",
			);
			assertInvariant(
				result.stats.nodesExported === configuration.jsonlExportNodes,
				"JSONL exported node count",
			);
			const tableFile = result.files.find(
				(file) =>
					file.type === "table" &&
					file.tableIdentifier === "jsonl_export_nodes",
			);
			assertInvariant(tableFile !== undefined, "JSONL table file presence");
			const content = await Bun.file(tableFile.path).text();
			const lines = content.length === 0 ? [] : content.split("\n");
			const parsedIds = lines.map((line) =>
				String((JSON.parse(line) as { _id: unknown })._id),
			);
			assertInvariant(
				lines.length === configuration.jsonlExportNodes,
				"JSONL physical line count",
			);
			assertInvariant(
				new Set(parsedIds).size === parsedIds.length,
				"JSONL exported node uniqueness",
			);
			const highestNodeId =
				configuration.datasetNodes + configuration.jsonlExportNodes;
			assertInvariant(
				parsedIds[0] === String(highestNodeId),
				"JSONL first node across page boundary",
			);
			assertInvariant(
				parsedIds.at(-1) === String(configuration.datasetNodes + 1),
				"JSONL final node across page boundary",
			);
			if (expectedTotalBytes === undefined) {
				expectedTotalBytes = result.stats.totalBytes;
			} else {
				assertInvariant(
					result.stats.totalBytes === expectedTotalBytes,
					"JSONL deterministic byte count",
				);
			}
			lastTotalBytes = result.stats.totalBytes;
			lastTableBytes = tableFile.sizeBytes;
			lastLineCount = tableFile.lineCount;
		} finally {
			removeJsonlExportDirectory(fixture.temporaryDirectory, outputDir);
		}
	};

	for (let index = 0; index < configuration.warmupIterations; index++) {
		const exported = await exportOnce();
		await validateAndRemove(exported.outputDir, exported.result);
	}
	const before = resourceSnapshot(fixture);
	const samples: number[] = [];
	for (let index = 0; index < configuration.samples; index++) {
		const started = Bun.nanoseconds();
		const exported = await exportOnce();
		samples.push(Number(Bun.nanoseconds() - started) / 1_000_000);
		await validateAndRemove(exported.outputDir, exported.result);
	}
	const after = resourceSnapshot(fixture);
	const expectedPages = Math.ceil(configuration.jsonlExportNodes / 500);

	return {
		id: "persistence.jsonl-multi-page-export",
		description:
			"Production JSONL backup export over a dedicated 500+1 page-boundary fixture.",
		timings: summarizeSamples(samples),
		sampleCount: configuration.samples,
		sql: {
			logicalStatementsPerSample: 7 + expectedPages * 3,
			transactionsPerSample: 0,
			rowAccounting:
				"Current production table/schema discovery plus node page count/data and batched node-attribute reads.",
		},
		rows: {
			nodesExportedPerSample: lastLineCount,
			uniqueNodesExportedPerSample: lastLineCount,
			nodeAttributesExportedPerSample: lastLineCount,
			exportPagesPerSample: expectedPages,
			tableFileBytesPerSample: lastTableBytes,
			totalExportBytesPerSample: lastTotalBytes,
		},
		invariants: {
			passed: true,
			expectedNodeCount: configuration.jsonlExportNodes,
			physicalLineCount: lastLineCount,
			uniqueNodeCount: lastLineCount,
			pageBoundaryCrossed: expectedPages > 1,
			pageSize: 500,
			noTruncation: true,
			deterministicByteCount: true,
		},
		resources: {
			before,
			after,
			delta: subtractResources(after, before),
		},
	};
}

async function benchmarkAtomicCreate(
	fixture: Fixture,
	repository: SqliteNodeMutationRepository,
	configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> {
	let sequence = 0;
	let lastCreatedId = "";
	const initialNodeCount = readCount(fixture.database, "nodes");
	const createNode = async () => {
		const current = sequence++;
		const created = await repository.create(
			Node.create(
				SEARCH_TABLE_ID,
				`atomic benchmark node ${current}`,
				`Atomic benchmark ${current}`,
			),
			Array.from({ length: configuration.attributeFanout }, (_, index) => ({
				attributeId: String(index + 1),
				value: benchmarkAttributeValue(index, current),
			})),
		);
		lastCreatedId = created.getId();
		return created.getId();
	};
	const validateNode = (nodeId: string) => {
		const attributeCount = fixture.database
			.query<{ count: number }, [string]>(
				"SELECT COUNT(*) AS count FROM node_attributes WHERE node_id = ?",
			)
			.get(nodeId)?.count;
		assertInvariant(
			attributeCount === configuration.attributeFanout,
			"atomic create attribute count",
		);
	};

	for (let index = 0; index < configuration.warmupIterations; index++) {
		validateNode(await createNode());
	}
	const before = resourceSnapshot(fixture);
	const samples: number[] = [];
	for (let index = 0; index < configuration.samples; index++) {
		const started = Bun.nanoseconds();
		const nodeId = await createNode();
		samples.push(Number(Bun.nanoseconds() - started) / 1_000_000);
		validateNode(nodeId);
	}
	const after = resourceSnapshot(fixture);
	const measured = {
		timings: summarizeSamples(samples),
		resources: {
			before,
			after,
			delta: subtractResources(after, before),
		},
	};
	const createdRows = configuration.warmupIterations + configuration.samples;
	const finalNodeCount = readCount(fixture.database, "nodes");
	assertInvariant(
		finalNodeCount === initialNodeCount + createdRows,
		"atomic create committed node count",
	);

	return {
		id: "write.atomic-node-with-attributes",
		description:
			"One node INSERT and EAV attribute UPSERT fanout inside the production repository transaction.",
		timings: measured.timings,
		sampleCount: configuration.samples,
		sql: {
			logicalStatementsPerSample: 1 + configuration.attributeFanout,
			transactionsPerSample: 1,
			rowAccounting:
				"Repository writes only; the post-sample invariant SELECT is excluded from timed SQL counts and duration.",
		},
		rows: {
			rowsWrittenPerSample: 1 + configuration.attributeFanout,
			nodesWrittenPerSample: 1,
			attributesWrittenPerSample: configuration.attributeFanout,
		},
		invariants: {
			passed: true,
			lastCreatedId,
			committedNodes: createdRows,
			attributesPerNode: configuration.attributeFanout,
		},
		resources: measured.resources,
	};
}

async function benchmarkProjectionMiss(
	fixture: Fixture,
	service: TableSchemaProjectionService,
	configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> {
	let versionHash = "";
	const operation = async () => {
		TableSchemaProjectionService.clearCache(SEARCH_TABLE_ID);
		const projection = await service.project({ tableId: SEARCH_TABLE_ID });
		assertInvariant(
			Object.keys(projection.attributeValueSchemas).length ===
				configuration.attributeFanout,
			"projection miss attribute count",
		);
		assertInvariant(
			projection.diagnostics.length === 0,
			"projection miss diagnostics",
		);
		if (versionHash) {
			assertInvariant(
				projection.versionHash === versionHash,
				"projection miss stable hash",
			);
		} else {
			versionHash = projection.versionHash;
		}
	};

	const measured = await measureOperation(fixture, configuration, operation);
	return projectionResult(
		"projection.cache-miss",
		"Repository-backed schema projection with its allocation cache cleared before every sample.",
		configuration,
		measured,
		versionHash,
		false,
	);
}

async function benchmarkProjectionHit(
	fixture: Fixture,
	service: TableSchemaProjectionService,
	configuration: BenchmarkConfiguration,
): Promise<BenchmarkResult> {
	TableSchemaProjectionService.clearCache(SEARCH_TABLE_ID);
	const cached = await service.project({ tableId: SEARCH_TABLE_ID });
	const operation = async () => {
		const projection = await service.project({ tableId: SEARCH_TABLE_ID });
		assertInvariant(projection === cached, "projection hit object reuse");
		assertInvariant(
			projection.versionHash === cached.versionHash,
			"projection hit stable hash",
		);
	};

	const measured = await measureOperation(fixture, configuration, operation);
	return projectionResult(
		"projection.cache-hit",
		"Reuse of the cached production projection allocation without repository I/O.",
		configuration,
		measured,
		cached.versionHash,
		true,
	);
}

function projectionResult(
	id: string,
	description: string,
	configuration: BenchmarkConfiguration,
	measured: { timings: TimingSummary; resources: ResourceDelta },
	versionHash: string,
	objectReused: boolean,
): BenchmarkResult {
	const attributeTypeRows = 2;
	const logicalStatementsPerSample = objectReused ? 0 : 4;
	return {
		id,
		description,
		timings: measured.timings,
		sampleCount: configuration.samples,
		sql: {
			logicalStatementsPerSample,
			transactionsPerSample: 0,
			rowAccounting: objectReused
				? "Cache lookup only; repository rows are not read."
				: "Table row + attribute page/count + batched attribute-type rows.",
		},
		rows: {
			tableRowsReturnedPerSample: objectReused ? 0 : 1,
			attributeRowsReturnedPerSample: objectReused
				? 0
				: configuration.attributeFanout,
			attributeTypeRowsReturnedPerSample: objectReused ? 0 : attributeTypeRows,
		},
		invariants: {
			passed: true,
			versionHash,
			attributeSchemaCount: configuration.attributeFanout,
			zeroDiagnostics: true,
			objectReused,
		},
		resources: measured.resources,
	};
}

async function measureOperation(
	fixture: Fixture,
	configuration: BenchmarkConfiguration,
	operation: () => Promise<void>,
): Promise<{ timings: TimingSummary; resources: ResourceDelta }> {
	for (let index = 0; index < configuration.warmupIterations; index++) {
		await operation();
	}

	const before = resourceSnapshot(fixture);
	const samples: number[] = [];
	for (let index = 0; index < configuration.samples; index++) {
		const started = Bun.nanoseconds();
		await operation();
		samples.push(Number(Bun.nanoseconds() - started) / 1_000_000);
	}
	const after = resourceSnapshot(fixture);

	return {
		timings: summarizeSamples(samples),
		resources: {
			before,
			after,
			delta: subtractResources(after, before),
		},
	};
}

function captureSearchQueryPlan(
	database: Database,
	repository: SqliteNodeSearchRepository,
	query: SearchQuery,
	availableAttributes: AttributeTypeInfo[],
): QueryPlanSnapshot {
	const introspection = repository as unknown as SearchRepositoryIntrospection;
	const fullTextIndexAvailable = introspection.hasFullTextIndex();
	const countQuery = introspection.buildNodeQuery(
		SEARCH_TABLE_ID,
		query,
		availableAttributes,
		true,
		fullTextIndexAvailable,
	);
	const pageQuery = introspection.buildNodeQuery(
		SEARCH_TABLE_ID,
		query,
		availableAttributes,
		false,
		fullTextIndexAvailable,
	);

	return {
		count: explain(database, countQuery.query, countQuery.params),
		page: explain(database, pageQuery.query, pageQuery.params),
	};
}

function explain(
	database: Database,
	query: string,
	params: SQLQueryBindings[],
): QueryPlanRow[] {
	return database
		.query<QueryPlanRow, SQLQueryBindings[]>(`EXPLAIN QUERY PLAN ${query}`)
		.all(...params)
		.map((row) => ({
			id: row.id,
			parent: row.parent,
			notused: row.notused,
			detail: row.detail,
		}));
}

function createFixture(configuration: BenchmarkConfiguration): Fixture {
	const temporaryDirectory = mkdtempSync(
		join(tmpdir(), "bun-graph-db-hotpaths-"),
	);
	const databasePath = join(temporaryDirectory, "benchmark.sqlite");
	const database = new Database(databasePath, { create: true });

	try {
		database.exec("PRAGMA journal_mode = WAL");
		database.exec("PRAGMA synchronous = NORMAL");
		database.exec("PRAGMA foreign_keys = ON");
		database.exec(BENCHMARK_SCHEMA_SQL);
		const availableAttributes = seedFixture(database, configuration);
		return {
			database,
			databasePath,
			temporaryDirectory,
			availableAttributes,
		};
	} catch (error) {
		database.close();
		removeFixtureDirectory(temporaryDirectory);
		throw error;
	}
}

function seedFixture(
	database: Database,
	configuration: BenchmarkConfiguration,
): AttributeTypeInfo[] {
	const availableAttributes = Array.from(
		{ length: configuration.attributeFanout },
		(_, index): AttributeTypeInfo => ({
			identifier: `attr_${index}`,
			dataType: index === 2 ? "number" : "string",
		}),
	);
	const random = createSeededRandom(BENCHMARK_SEED);
	const insertNode = database.prepare(`
		INSERT INTO nodes (
			id, table_id, content, title, description, metadata, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`);
	const insertAttribute = database.prepare(`
		INSERT INTO node_attributes (
			node_id, attribute_id, value, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?)
	`);
	const insertRelation = database.prepare(`
		INSERT INTO node_relations (
			table_id, source_node_id, source_external_id, target_node_id,
			target_external_id, relation_type_id, properties, strength,
			confidence, created_at, updated_at
		) VALUES (?, ?, 'internal', ?, 'internal', ?, NULL, 1, 1, ?, ?)
	`);

	database.transaction(() => {
		database
			.query(
				"INSERT INTO tables (id, identifier, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
			)
			.run(
				SEARCH_TABLE_ID,
				"benchmark_nodes",
				"Deterministic hot-path benchmark fixture",
				FIXED_TIMESTAMP,
				FIXED_TIMESTAMP,
			);
		database
			.query(
				"INSERT INTO tables (id, identifier, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
			)
			.run(
				JSONL_TABLE_ID,
				"jsonl_export_nodes",
				"Deterministic multi-page JSONL export fixture",
				FIXED_TIMESTAMP,
				FIXED_TIMESTAMP,
			);
		for (const [id, identifier, jsonType] of [
			["1", "string", "string"],
			["2", "number", "number"],
			["3", "boolean", "boolean"],
		] as const) {
			database
				.query(`
					INSERT INTO attribute_types (
						id, identifier, json_type, description, validation_schema,
						created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?)
				`)
				.run(
					id,
					identifier,
					jsonType,
					`Benchmark ${identifier}`,
					jsonType === "number" ? '{"minimum":0}' : null,
					FIXED_TIMESTAMP,
					FIXED_TIMESTAMP,
				);
		}

		for (let index = 0; index < configuration.attributeFanout; index++) {
			database
				.query(`
					INSERT INTO attributes (
						id, table_id, identifier, name, attribute_type_id,
						description, is_required, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`)
				.run(
					index + 1,
					SEARCH_TABLE_ID,
					`attr_${index}`,
					`Attribute ${index}`,
					index === 2 ? 2 : 1,
					`Deterministic attribute ${index}`,
					index === 0 ? 1 : 0,
					FIXED_TIMESTAMP,
					FIXED_TIMESTAMP,
				);
		}
		const jsonlAttributeId = configuration.attributeFanout + 1;
		database
			.query(`
				INSERT INTO attributes (
					id, table_id, identifier, name, attribute_type_id,
					description, is_required, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`)
			.run(
				jsonlAttributeId,
				JSONL_TABLE_ID,
				"export_status",
				"Export status",
				1,
				"JSONL page-boundary marker",
				1,
				FIXED_TIMESTAMP,
				FIXED_TIMESTAMP,
			);

		for (let index = 0; index < configuration.datasetNodes; index++) {
			const timestamp = new Date(
				Date.parse(FIXED_TIMESTAMP) + index * 1_000,
			).toISOString();
			insertNode.run(
				index + 1,
				SEARCH_TABLE_ID,
				`benchmark node ${String(index).padStart(6, "0")} searchable`,
				`Benchmark ${index}`,
				"Deterministic search fixture",
				JSON.stringify({ seed: BENCHMARK_SEED, index }),
				timestamp,
				timestamp,
			);
			for (
				let attributeIndex = 0;
				attributeIndex < configuration.attributeFanout;
				attributeIndex++
			) {
				const value =
					attributeIndex === 2
						? String(Math.floor(random() * 1_000_000))
						: benchmarkAttributeValue(attributeIndex, index);
				insertAttribute.run(
					index + 1,
					attributeIndex + 1,
					value,
					timestamp,
					timestamp,
				);
			}
		}
		for (let index = 0; index < configuration.jsonlExportNodes; index++) {
			const nodeId = configuration.datasetNodes + index + 1;
			const timestamp = new Date(
				Date.parse(FIXED_TIMESTAMP) + index * 1_000,
			).toISOString();
			insertNode.run(
				nodeId,
				JSONL_TABLE_ID,
				`jsonl export node ${String(index).padStart(6, "0")}`,
				`JSONL export ${index}`,
				"Deterministic multi-page export fixture",
				JSON.stringify({ seed: BENCHMARK_SEED, exportIndex: index }),
				timestamp,
				timestamp,
			);
			insertAttribute.run(
				nodeId,
				jsonlAttributeId,
				index % 2 === 0 ? "active" : "archived",
				timestamp,
				timestamp,
			);
		}

		database
			.query(`
				INSERT INTO relation_types (
					id, identifier, description, category, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?)
			`)
			.run(
				1,
				"depends_on",
				"Deterministic benchmark dependency",
				"structural",
				FIXED_TIMESTAMP,
				FIXED_TIMESTAMP,
			);
		for (let childId = 2; childId <= configuration.datasetNodes; childId++) {
			insertRelation.run(
				SEARCH_TABLE_ID,
				Math.floor(childId / 2),
				childId,
				1,
				FIXED_TIMESTAMP,
				FIXED_TIMESTAMP,
			);
		}
	})();

	return availableAttributes;
}

function benchmarkAttributeValue(
	attributeIndex: number,
	sequence: number,
): string {
	if (attributeIndex === 0) return "common";
	if (attributeIndex === 1) return "active";
	if (attributeIndex === 2) return String((sequence * 7_919) % 1_000_000);
	return `value_${attributeIndex}_${sequence % 17}`;
}

function createSeededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

function resourceSnapshot(fixture: Fixture): ResourceSnapshot {
	const memory = process.memoryUsage();
	const pageCount =
		fixture.database
			.query<{ page_count: number }, []>("PRAGMA page_count")
			.get()?.page_count ?? 0;
	const pageSize =
		fixture.database.query<{ page_size: number }, []>("PRAGMA page_size").get()
			?.page_size ?? 0;
	return {
		rssBytes: memory.rss,
		heapUsedBytes: memory.heapUsed,
		databaseBytes: pageCount * pageSize,
		databaseFileBytes: databaseFileBytes(fixture.databasePath),
	};
}

function databaseFileBytes(databasePath: string): number {
	return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`].reduce(
		(total, path) => total + (existsSync(path) ? statSync(path).size : 0),
		0,
	);
}

function subtractResources(
	after: ResourceSnapshot,
	before: ResourceSnapshot,
): ResourceSnapshot {
	return {
		rssBytes: after.rssBytes - before.rssBytes,
		heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
		databaseBytes: after.databaseBytes - before.databaseBytes,
		databaseFileBytes: after.databaseFileBytes - before.databaseFileBytes,
	};
}

function readCount(database: Database, table: "nodes"): number {
	return (
		database
			.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`)
			.get()?.count ?? 0
	);
}

function percentile(sorted: readonly number[], quantile: number): number {
	const rank = Math.ceil(quantile * sorted.length) - 1;
	return sorted[Math.max(0, rank)] ?? 0;
}

function round(value: number): number {
	return Math.round(value * 1_000_000) / 1_000_000;
}

function arraysEqual(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function assertInvariant(condition: boolean, name: string): asserts condition {
	if (!condition)
		throw new Error(`Benchmark correctness invariant failed: ${name}`);
}

function validateConfiguration(configuration: BenchmarkConfiguration): void {
	for (const [name, value] of Object.entries(configuration)) {
		if (name === "profile") continue;
		if (!Number.isSafeInteger(value) || value <= 0) {
			throw new Error(`${name} must be a positive safe integer`);
		}
	}
	if (configuration.attributeFanout < 3) {
		throw new Error("attributeFanout must be at least 3");
	}
	if (configuration.jsonlExportNodes <= 500) {
		throw new Error("jsonlExportNodes must cross the 500-row page boundary");
	}
	if (
		configuration.searchOffset + configuration.searchLimit >
		configuration.datasetNodes
	) {
		throw new Error("searchOffset + searchLimit must fit inside datasetNodes");
	}
}

function assertComparableReports(
	current: BenchmarkReport,
	baseline: BenchmarkReport,
): void {
	if (
		current.schemaVersion !== baseline.schemaVersion ||
		current.metadata.databaseSchemaVersion !==
			baseline.metadata.databaseSchemaVersion
	) {
		throw new Error("Baseline and current reports do not use the same schema");
	}
	const keys: (keyof BenchmarkConfiguration)[] = [
		"profile",
		"datasetNodes",
		"attributeFanout",
		"warmupIterations",
		"samples",
		"searchLimit",
		"searchOffset",
		"jsonlExportNodes",
	];
	for (const key of keys) {
		if (current.configuration[key] !== baseline.configuration[key]) {
			throw new Error(
				`Baseline configuration mismatch for '${key}': ${baseline.configuration[key]} != ${current.configuration[key]}`,
			);
		}
	}
}

function removeFixtureDirectory(path: string): void {
	const expectedPrefix = join(tmpdir(), "bun-graph-db-hotpaths-");
	if (!path.startsWith(expectedPrefix) || path === expectedPrefix) {
		throw new Error(
			`Refusing to remove unexpected benchmark directory: ${path}`,
		);
	}
	rmSync(path, { recursive: true, force: true });
}

function removeJsonlExportDirectory(root: string, path: string): void {
	const expectedPrefix = join(root, "jsonl-export-");
	if (!path.startsWith(expectedPrefix) || path === expectedPrefix) {
		throw new Error(
			`Refusing to remove unexpected JSONL export directory: ${path}`,
		);
	}
	rmSync(path, { recursive: true, force: true });
}

function parseCliOptions(args: readonly string[]): CliOptions {
	const profile = readOption(args, "--profile") ?? "full";
	if (profile !== "full" && profile !== "ci") {
		throw new Error("--profile must be 'full' or 'ci'");
	}
	const knownOptions = new Set([
		"--profile",
		"--baseline",
		"--output",
		"--enforce",
		"--help",
	]);
	for (const arg of args) {
		if (arg.startsWith("--") && !knownOptions.has(arg)) {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	return {
		configuration: {
			...(profile === "full"
				? DEFAULT_FULL_CONFIGURATION
				: DEFAULT_CI_CONFIGURATION),
		},
		baselinePath: readOption(args, "--baseline"),
		outputPath: readOption(args, "--output"),
		enforce: args.includes("--enforce"),
	};
}

function readOption(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	if (index === -1) return undefined;
	const value = args[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`${name} requires a value`);
	}
	return value;
}

async function readBaseline(path: string): Promise<BenchmarkReport> {
	const parsed = (await Bun.file(path).json()) as BenchmarkReport;
	if (parsed.schemaVersion !== BENCHMARK_REPORT_SCHEMA) {
		throw new Error(
			`Unsupported baseline schema '${String(parsed.schemaVersion)}'`,
		);
	}
	return parsed;
}

async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.includes("--help")) {
		process.stdout.write(`${usage()}\n`);
		return;
	}
	const options = parseCliOptions(args);
	if (options.enforce && !options.baselinePath) {
		throw new Error("--enforce requires --baseline");
	}
	const baseline = options.baselinePath
		? await readBaseline(options.baselinePath)
		: undefined;
	const report = await runHotPathBenchmarks({
		configuration: options.configuration,
		baseline,
		enforce: options.enforce,
	});
	const serialized = `${JSON.stringify(report, null, 2)}\n`;
	if (options.outputPath) {
		mkdirSync(dirname(options.outputPath), { recursive: true });
		await Bun.write(options.outputPath, serialized);
	}
	process.stdout.write(serialized);
	if (
		options.enforce &&
		report.comparison?.status === "warning" &&
		report.comparison.warnings.length > 0
	) {
		process.exitCode = 1;
	}
}

function usage(): string {
	return [
		"Usage: bun run scripts/benchmark-hotpaths.ts [options]",
		"",
		"Options:",
		"  --profile full|ci    full=5 warmups/30 samples; ci is a faster local profile",
		"  --baseline <path>    compare a same-schema JSON report",
		"  --output <path>      also write the JSON report to a file",
		"  --enforce            fail only when baseline regression warnings exist",
		"  --help               show this help",
	].join("\n");
}

const BENCHMARK_SCHEMA_SQL = `
	CREATE TABLE tables (
		id INTEGER PRIMARY KEY,
		identifier TEXT NOT NULL UNIQUE,
		description TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE attribute_types (
		id INTEGER PRIMARY KEY,
		identifier TEXT NOT NULL UNIQUE,
		json_type TEXT NOT NULL,
		format TEXT,
		description TEXT,
		validation_schema TEXT,
		reference_config TEXT,
		default_value TEXT,
		examples TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE attributes (
		id INTEGER PRIMARY KEY,
		table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
		identifier TEXT NOT NULL,
		name TEXT,
		attribute_type_id INTEGER NOT NULL REFERENCES attribute_types(id),
		description TEXT,
		is_required BOOLEAN NOT NULL DEFAULT FALSE,
		metadata TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		UNIQUE(table_id, identifier)
	);
	CREATE TABLE nodes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
		content TEXT NOT NULL,
		title TEXT,
		description TEXT,
		metadata TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		UNIQUE(table_id, content)
	);
	CREATE TABLE node_attributes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		node_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
		attribute_id INTEGER NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
		value TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		UNIQUE(node_id, attribute_id)
	);
	CREATE TABLE relation_types (
		id INTEGER PRIMARY KEY,
		identifier TEXT NOT NULL UNIQUE,
		description TEXT,
		category TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE TABLE node_relations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
		source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
		source_external_id TEXT NOT NULL DEFAULT 'internal',
		target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
		target_external_id TEXT NOT NULL DEFAULT 'internal',
		relation_type_id INTEGER NOT NULL REFERENCES relation_types(id),
		properties TEXT,
		strength INTEGER NOT NULL DEFAULT 1,
		confidence INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		UNIQUE(
			table_id, source_node_id, source_external_id,
			target_node_id, target_external_id, relation_type_id
		)
	);
	CREATE INDEX idx_attributes_type ON attributes(attribute_type_id);
	CREATE INDEX idx_node_attributes_node ON node_attributes(node_id);
	CREATE INDEX idx_node_attributes_attr ON node_attributes(attribute_id);
	CREATE INDEX idx_node_attributes_attr_value_node
		ON node_attributes(attribute_id, value, node_id);
	CREATE INDEX idx_nodes_table_created_id
		ON nodes(table_id, created_at DESC, id);
	CREATE INDEX idx_node_relations_source ON node_relations(source_node_id);
	CREATE INDEX idx_node_relations_target ON node_relations(target_node_id);
	CREATE INDEX idx_node_relations_type ON node_relations(relation_type_id);
	CREATE INDEX idx_node_relations_table ON node_relations(table_id);
	CREATE VIRTUAL TABLE node_search_fts USING fts5(
		node_id UNINDEXED,
		table_id UNINDEXED,
		content,
		tokenize = 'unicode61 remove_diacritics 2'
	);
	CREATE TRIGGER node_search_fts_insert AFTER INSERT ON nodes BEGIN
		INSERT INTO node_search_fts(rowid, node_id, table_id, content)
		VALUES (
			new.rowid,
			new.id,
			new.table_id,
			trim(coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.content, '') || ' ' || coalesce(new.metadata, ''))
		);
	END;
`;

if (import.meta.main) {
	await main();
}
