import { describe, expect, test } from "bun:test";
import {
	BENCHMARK_DATABASE_SCHEMA,
	BENCHMARK_REPORT_SCHEMA,
	type BenchmarkConfiguration,
	type BenchmarkReport,
	compareBenchmarkReports,
	runHotPathBenchmarks,
	summarizeSamples,
} from "../../scripts/benchmark-hotpaths";

const TEST_CONFIGURATION: BenchmarkConfiguration = {
	profile: "test",
	datasetNodes: 80,
	attributeFanout: 4,
	warmupIterations: 1,
	samples: 3,
	searchLimit: 10,
	searchOffset: 60,
	jsonlExportNodes: 501,
};

describe("hot-path benchmark harness", () => {
	test("reports deterministic workload contracts and correctness evidence", async () => {
		const report = await runHotPathBenchmarks({
			configuration: TEST_CONFIGURATION,
		});

		expect(report.schemaVersion).toBe(BENCHMARK_REPORT_SCHEMA);
		expect(report.metadata.databaseSchemaVersion).toBe(
			BENCHMARK_DATABASE_SCHEMA,
		);
		expect(report.metadata.concurrencyClaim).toBe("none");
		expect(report.configuration).toEqual(TEST_CONFIGURATION);
		expect(report.invariants).toEqual({ passed: true, benchmarkCount: 6 });
		expect(report.benchmarks.map((benchmark) => benchmark.id)).toEqual([
			"search.eav-fanout-fts-deep-offset",
			"graph.outgoing-dependency-tree",
			"persistence.jsonl-multi-page-export",
			"write.atomic-node-with-attributes",
			"projection.cache-miss",
			"projection.cache-hit",
		]);
		expect(
			report.benchmarks.every(
				(benchmark) =>
					benchmark.sampleCount === TEST_CONFIGURATION.samples &&
					benchmark.invariants.passed,
			),
		).toBe(true);

		const search = report.benchmarks[0];
		expect(search?.queryPlan?.count.length).toBeGreaterThan(0);
		expect(search?.queryPlan?.page.length).toBeGreaterThan(0);
		expect(search?.rows.uniqueNodesReturnedPerSample).toBe(10);
		expect(search?.invariants.completeAttributeFanout).toBe(true);
		expect(search?.invariants).toEqual(
			expect.objectContaining({
				correlatedSubqueryCount: 0,
				attributeCompositeIndexUsed: true,
				setIntersectionUsed: true,
			}),
		);

		const jsonl = report.benchmarks.find(
			(benchmark) => benchmark.id === "persistence.jsonl-multi-page-export",
		);
		expect(jsonl?.rows.nodesExportedPerSample).toBe(501);
		expect(jsonl?.rows.exportPagesPerSample).toBe(2);
		expect(jsonl?.rows.totalExportBytesPerSample).toBeGreaterThan(0);
		expect(jsonl?.invariants).toEqual(
			expect.objectContaining({
				physicalLineCount: 501,
				uniqueNodeCount: 501,
				pageBoundaryCrossed: true,
				noTruncation: true,
			}),
		);

		const projectionMiss = report.benchmarks.find(
			(benchmark) => benchmark.id === "projection.cache-miss",
		);
		const projectionHit = report.benchmarks.find(
			(benchmark) => benchmark.id === "projection.cache-hit",
		);
		expect(projectionMiss?.sql.logicalStatementsPerSample).toBe(4);
		expect(projectionHit?.sql.logicalStatementsPerSample).toBe(0);
		expect(projectionHit?.rows).toEqual(
			expect.objectContaining({
				tableRowsReturnedPerSample: 0,
				attributeRowsReturnedPerSample: 0,
				attributeTypeRowsReturnedPerSample: 0,
			}),
		);
	});

	test("uses nearest-rank median, p95, and p99 summaries", () => {
		expect(summarizeSamples([9, 1, 3, 7, 5])).toEqual({
			minMs: 1,
			maxMs: 9,
			meanMs: 5,
			medianMs: 5,
			p95Ms: 9,
			p99Ms: 9,
		});
	});

	test("warns only beyond both percentage thresholds and the 5ms floor", async () => {
		const measured = await runHotPathBenchmarks({
			configuration: TEST_CONFIGURATION,
		});
		const baseline = cloneReport(measured);
		const regressed = cloneReport(measured);
		for (const benchmark of baseline.benchmarks) {
			benchmark.timings.medianMs = 10;
			benchmark.timings.p95Ms = 10;
		}
		for (const benchmark of regressed.benchmarks) {
			benchmark.timings.medianMs = 16;
			benchmark.timings.p95Ms = 17;
		}

		const warning = compareBenchmarkReports(regressed, baseline, false);
		expect(warning.status).toBe("warning");
		expect(warning.enforced).toBe(false);
		expect(warning.warnings).toHaveLength(12);

		for (const benchmark of regressed.benchmarks) {
			benchmark.timings.medianMs = 14;
			benchmark.timings.p95Ms = 14;
		}
		expect(compareBenchmarkReports(regressed, baseline).warnings).toEqual([]);
	});

	test("rejects baseline comparisons with different fixture configuration", async () => {
		const measured = await runHotPathBenchmarks({
			configuration: TEST_CONFIGURATION,
		});
		const mismatched = cloneReport(measured);
		mismatched.configuration.datasetNodes += 1;

		expect(() => compareBenchmarkReports(measured, mismatched)).toThrow(
			"Baseline configuration mismatch for 'datasetNodes'",
		);
	});
});

function cloneReport(report: BenchmarkReport): BenchmarkReport {
	return structuredClone(report);
}
