import { describe, expect, test } from "bun:test";
import {
	auditRepositoryTests,
	auditTestFiles,
	matchingTestLanes,
	serializeTestLaneAudit,
	TEST_LANES,
} from "../../scripts/test-lanes";

describe("test lane audit", () => {
	test("assigns every repository test to exactly one lane", () => {
		const audit = auditRepositoryTests();

		expect(audit.errors).toEqual([]);
		expect(audit.files.length).toBeGreaterThan(0);
		expect(Object.keys(audit.byLane)).toEqual([...TEST_LANES]);
		for (const lane of TEST_LANES) {
			expect(audit.byLane[lane].length).toBeGreaterThan(0);
		}
	});

	test("keeps stateful unit tests out of the parallel lane", () => {
		expect(matchingTestLanes("tests/unit/benchmark-hotpaths.test.ts")).toEqual([
			"serial-only",
		]);
		expect(matchingTestLanes("tests/unit/mcp-internal-bridge.test.ts")).toEqual(
			["serial-only"],
		);
		expect(
			matchingTestLanes("tests/unit/schema/table-schema-projection.test.ts"),
		).toEqual(["parallel-safe"]);
	});

	test("uses dedicated lanes for end-to-end and stress suites", () => {
		expect(matchingTestLanes("tests/e2e/doc-system-e2e.test.ts")).toEqual([
			"e2e",
		]);
		expect(
			matchingTestLanes(
				"tests/comprehensive/performance-stress-comprehensive.test.ts",
			),
		).toEqual(["stress"]);
	});

	test("reports new unclassified directories instead of silently running them", () => {
		const audit = auditTestFiles(["tests/new-suite/new-behavior.test.ts"]);

		expect(audit.files).toEqual([]);
		expect(audit.errors).toEqual([
			"Unclassified test file: tests/new-suite/new-behavior.test.ts",
		]);
	});

	test("requires every repository lane to retain at least one test", () => {
		const audit = auditRepositoryTests();

		for (const lane of TEST_LANES) {
			expect(audit.errors).not.toContain(`Required test lane is empty: ${lane}`);
		}
	});

	test("serializes stable machine-readable audit evidence", () => {
		const first = serializeTestLaneAudit(auditRepositoryTests());
		const second = serializeTestLaneAudit(auditRepositoryTests());

		expect(first).toBe(second);
		expect(JSON.parse(first)).toEqual(
			expect.objectContaining({
				schemaVersion: "bun-graph-db.test-lanes.v1",
				errors: [],
			}),
		);
	});
});
