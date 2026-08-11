#!/usr/bin/env bun

import { readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawn } from "bun";

export const TEST_LANES = [
	"parallel-safe",
	"serial-only",
	"e2e",
	"stress",
] as const;

export type TestLane = (typeof TEST_LANES)[number];

export interface ClassifiedTestFile {
	path: string;
	lane: TestLane;
}

export interface TestLaneAudit {
	files: ClassifiedTestFile[];
	byLane: Record<TestLane, string[]>;
	errors: string[];
}

interface RunResult {
	path: string;
	success: boolean;
	durationMs: number;
	output: string;
}

const SERIAL_UNIT_TESTS = new Set([
	// These suites mutate process/global state or install module-level mocks.
	"tests/unit/benchmark-hotpaths.test.ts",
	"tests/unit/google-tools-http-sheets-adapter.test.ts",
	"tests/unit/mcp-internal-bridge.test.ts",
	"tests/unit/rest-api-controllers.test.ts",
	"tests/unit/table-packages/integration.test.ts",
]);

const SERIAL_DIRECTORIES = [
	"tests/contract/",
	"tests/integration/",
	"tests/system-queries/",
	"tests/template-indexing/",
	"tests/unified-template-execution/",
] as const;

const SERIAL_PRIORITY = [
	"tests/integration/mcp-rest-proxy-improved.test.ts",
	"tests/integration/server-independence-validation.test.ts",
	"tests/contract/table-isolation-contract.test.ts",
	"tests/integration/mcp-table-integration.test.ts",
] as const;

export function collectTestFiles(testDirectory: string): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(testDirectory).sort()) {
		const fullPath = resolve(testDirectory, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			files.push(...collectTestFiles(fullPath));
			continue;
		}

		if (isTestFile(entry)) files.push(fullPath);
	}

	return files.sort();
}

export function matchingTestLanes(path: string): TestLane[] {
	const normalized = normalizeTestPath(path);
	const matches: TestLane[] = [];

	if (
		normalized.startsWith("tests/unit/") &&
		!SERIAL_UNIT_TESTS.has(normalized)
	) {
		matches.push("parallel-safe");
	}

	if (
		SERIAL_UNIT_TESTS.has(normalized) ||
		SERIAL_DIRECTORIES.some((directory) => normalized.startsWith(directory)) ||
		/^tests\/[^/]+\.(?:test|spec)\.ts$/.test(normalized)
	) {
		matches.push("serial-only");
	}

	if (normalized.startsWith("tests/e2e/")) matches.push("e2e");
	if (normalized.startsWith("tests/comprehensive/")) matches.push("stress");

	return matches;
}

export function auditTestFiles(paths: readonly string[]): TestLaneAudit {
	const byLane: Record<TestLane, string[]> = {
		"parallel-safe": [],
		"serial-only": [],
		e2e: [],
		stress: [],
	};
	const files: ClassifiedTestFile[] = [];
	const errors: string[] = [];

	for (const path of [...paths].map(normalizeTestPath).sort()) {
		const lanes = matchingTestLanes(path);
		if (lanes.length === 0) {
			errors.push(`Unclassified test file: ${path}`);
			continue;
		}
		if (lanes.length > 1) {
			errors.push(
				`Test file belongs to multiple lanes (${lanes.join(", ")}): ${path}`,
			);
			continue;
		}

		const lane = lanes[0];
		if (!lane) continue;
		files.push({ path, lane });
		byLane[lane].push(path);
	}

	for (const lane of TEST_LANES) byLane[lane].sort();
	return { files, byLane, errors };
}

export function auditRepositoryTests(root = process.cwd()): TestLaneAudit {
	const testDirectory = resolve(root, "tests");
	const paths = collectTestFiles(testDirectory).map((path) =>
		toRepositoryPath(root, path),
	);
	const audit = auditTestFiles(paths);
	for (const lane of TEST_LANES) {
		if (audit.byLane[lane].length === 0) {
			audit.errors.push(`Required test lane is empty: ${lane}`);
		}
	}
	return audit;
}

export function serializeTestLaneAudit(audit: TestLaneAudit): string {
	return `${JSON.stringify(
		{
			schemaVersion: "bun-graph-db.test-lanes.v1",
			total: audit.files.length,
			lanes: Object.fromEntries(
				TEST_LANES.map((lane) => [lane, audit.byLane[lane]]),
			),
			errors: audit.errors,
		},
		null,
		2,
	)}\n`;
}

async function runCommand(
	args: string[],
	label: string,
	root: string,
): Promise<RunResult> {
	const started = performance.now();
	const proc = spawn(args, {
		cwd: root,
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return {
		path: label,
		success: exitCode === 0,
		durationMs: Math.round(performance.now() - started),
		output: `${stdout}${stderr}`.trim(),
	};
}

async function runLane(
	lane: TestLane,
	files: readonly string[],
	root: string,
): Promise<RunResult[]> {
	if (files.length === 0) return [];

	if (lane === "parallel-safe") {
		return [await runCommand(["bun", "test", ...files], lane, root)];
	}

	const results: RunResult[] = [];
	const ordered = [...files].sort((left, right) => {
		const priority = serialPriority(left) - serialPriority(right);
		return priority === 0 ? left.localeCompare(right) : priority;
	});

	for (const path of ordered) {
		console.log(` - ${path}`);
		results.push(await runCommand(["bun", "test", path], path, root));
	}
	return results;
}

async function main(
	args = process.argv.slice(2),
	root = process.cwd(),
): Promise<void> {
	const lane = readLaneOption(args);
	const match = readOption(args, "--match");
	const listOnly = args.includes("--list");
	const json = args.includes("--json");
	const auditOnly = args.includes("--audit");
	const audit = auditRepositoryTests(root);

	if (audit.errors.length > 0) {
		if (json) process.stdout.write(serializeTestLaneAudit(audit));
		else for (const error of audit.errors) console.error(error);
		throw new Error(
			`Test lane audit failed with ${audit.errors.length} error(s)`,
		);
	}

	const selectedLanes = lane ? [lane] : [...TEST_LANES];
	const selected = selectedLanes.flatMap((selectedLane) =>
		audit.byLane[selectedLane]
			.filter((path) => !match || path.includes(match))
			.map((path) => ({ path, lane: selectedLane })),
	);

	if (json) {
		const filteredAudit = auditTestFiles(selected.map((file) => file.path));
		process.stdout.write(serializeTestLaneAudit(filteredAudit));
	} else {
		console.log(`Discovered ${audit.files.length} test files`);
		for (const testLane of TEST_LANES) {
			console.log(`${testLane}: ${audit.byLane[testLane].length}`);
		}
	}

	if (auditOnly || listOnly) {
		if (listOnly && !json) {
			for (const file of selected) console.log(`${file.lane}\t${file.path}`);
		}
		return;
	}

	const results: RunResult[] = [];
	for (const selectedLane of selectedLanes) {
		const files = selected
			.filter((file) => file.lane === selectedLane)
			.map((file) => file.path);
		if (files.length === 0) continue;
		console.log(`\nRunning ${selectedLane} lane...`);
		results.push(...(await runLane(selectedLane, files, root)));
	}

	const failed = results.filter((result) => !result.success);
	console.log("\nLane summary");
	for (const result of results) {
		console.log(
			`${result.success ? "PASS" : "FAIL"} ${result.path} (${result.durationMs}ms)`,
		);
	}

	if (failed.length > 0) {
		console.log("\nFailures");
		for (const result of failed) {
			console.log(`\n# ${result.path}`);
			console.log(result.output);
		}
		throw new Error(`${failed.length} test lane command(s) failed`);
	}
}

function readLaneOption(args: readonly string[]): TestLane | undefined {
	const value = readOption(args, "--lane");
	if (value === undefined) return undefined;
	if (!TEST_LANES.includes(value as TestLane)) {
		throw new Error(
			`Invalid --lane '${value}'. Expected one of: ${TEST_LANES.join(", ")}`,
		);
	}
	return value as TestLane;
}

function readOption(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	if (index === -1) return undefined;
	const value = args[index + 1];
	if (!value || value.startsWith("--"))
		throw new Error(`${name} requires a value`);
	return value;
}

function serialPriority(path: string): number {
	const index = SERIAL_PRIORITY.indexOf(
		path as (typeof SERIAL_PRIORITY)[number],
	);
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function isTestFile(name: string): boolean {
	return name.endsWith(".test.ts") || name.endsWith(".spec.ts");
}

function normalizeTestPath(path: string): string {
	return path.replaceAll("\\", "/").split(sep).join("/").replace(/^\.\//, "");
}

function toRepositoryPath(root: string, path: string): string {
	return normalizeTestPath(relative(resolve(root), resolve(path)));
}

if (import.meta.main) {
	await main();
}
