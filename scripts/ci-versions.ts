#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const EXPECTED_NODE_MAJOR = 26;
const EXPECTED_PNPM_VERSION = "12.21.0";
const EXPECTED_TYPESCRIPT_VERSION = "7.0.2";
const EXPECTED_BIOME_VERSION = "2.6.9";
const CONTRACT_PACKAGE = "@oa-sdk/openapi-projection-contract";
const CONTRACT_SPECIFIER = "file:../../packages/openapi-projection-contract";
const PROJECT_ROOT = resolve(import.meta.dirname, "..");

interface PackageManifest {
	name?: string;
	packageManager?: string;
	engines?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

const failures: string[] = [];

function expectEqual(
	label: string,
	actual: string | undefined,
	expected: string,
): void {
	if (actual !== expected) {
		failures.push(
			`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
		);
	}
}

async function readJson(path: string): Promise<PackageManifest> {
	return JSON.parse(await readFile(path, "utf8")) as PackageManifest;
}

async function readCommandVersion(
	command: string,
	args: string[],
): Promise<string | undefined> {
	try {
		const { stdout } = await execFileAsync(command, args, {
			cwd: PROJECT_ROOT,
		});
		return stdout.trim();
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		failures.push(`${command} ${args.join(" ")} failed: ${reason}`);
		return undefined;
	}
}

const manifest = await readJson(resolve(PROJECT_ROOT, "package.json"));
expectEqual(
	"packageManager",
	manifest.packageManager,
	`pnpm@${EXPECTED_PNPM_VERSION}`,
);
expectEqual(
	"engines.node",
	manifest.engines?.node,
	`>=${EXPECTED_NODE_MAJOR}.0.0`,
);
expectEqual(
	"engines.pnpm",
	manifest.engines?.pnpm,
	`>=${EXPECTED_PNPM_VERSION} <13`,
);
expectEqual(
	"devDependencies.typescript",
	manifest.devDependencies?.typescript,
	EXPECTED_TYPESCRIPT_VERSION,
);
expectEqual(
	"devDependencies.@biomejs/biome",
	manifest.devDependencies?.["@biomejs/biome"],
	EXPECTED_BIOME_VERSION,
);
expectEqual(
	`devDependencies.${CONTRACT_PACKAGE}`,
	manifest.devDependencies?.[CONTRACT_PACKAGE],
	CONTRACT_SPECIFIER,
);

const nodeMajor = Number.parseInt(
	process.versions.node.split(".")[0] ?? "0",
	10,
);
if (Number.isNaN(nodeMajor) || nodeMajor < EXPECTED_NODE_MAJOR) {
	failures.push(
		`Node runtime: expected >=${EXPECTED_NODE_MAJOR}.0.0, received v${process.versions.node}`,
	);
}

const lockfile = await readFile(
	resolve(PROJECT_ROOT, "pnpm-lock.yaml"),
	"utf8",
);
if (
	!lockfile.includes("'@biomejs/biome':") &&
	!lockfile.includes("@biomejs/biome:")
) {
	failures.push("pnpm-lock.yaml does not record @biomejs/biome");
}
if (!lockfile.includes(`version: ${EXPECTED_BIOME_VERSION}`)) {
	failures.push(
		`pnpm-lock.yaml does not pin @biomejs/biome to ${EXPECTED_BIOME_VERSION}`,
	);
}
if (!lockfile.includes(`version: ${EXPECTED_TYPESCRIPT_VERSION}`)) {
	failures.push(
		`pnpm-lock.yaml does not pin typescript to ${EXPECTED_TYPESCRIPT_VERSION}`,
	);
}
if (!lockfile.includes(`specifier: ${CONTRACT_SPECIFIER}`)) {
	failures.push(
		`pnpm-lock.yaml does not preserve ${CONTRACT_PACKAGE} as ${CONTRACT_SPECIFIER}`,
	);
}

const contractManifestPath = resolve(
	PROJECT_ROOT,
	"../../packages/openapi-projection-contract/package.json",
);
try {
	const contractManifest = await readJson(contractManifestPath);
	expectEqual(
		"local contract package name",
		contractManifest.name,
		CONTRACT_PACKAGE,
	);
} catch (error) {
	const reason = error instanceof Error ? error.message : String(error);
	failures.push(
		`${CONTRACT_PACKAGE} is a parent-layout prerequisite (${reason}). ` +
			"Run this project at <oa-sdk>/references/bun-graph-db so ../../packages/openapi-projection-contract exists; " +
			"a standalone checkout cannot satisfy the intentional file: dependency.",
	);
}

const [pnpmOutput, typescriptOutput, biomeOutput] = await Promise.all([
	readCommandVersion("pnpm", ["--version"]),
	readCommandVersion("pnpm", ["exec", "tsc", "--version"]),
	readCommandVersion("pnpm", ["exec", "biome", "--version"]),
]);
if (pnpmOutput !== undefined) {
	expectEqual("installed pnpm", pnpmOutput, EXPECTED_PNPM_VERSION);
}
if (typescriptOutput !== undefined) {
	expectEqual(
		"installed TypeScript",
		typescriptOutput.replace(/^Version\s+/, ""),
		EXPECTED_TYPESCRIPT_VERSION,
	);
}
if (biomeOutput !== undefined) {
	expectEqual(
		"installed Biome",
		biomeOutput.replace(/^Version:\s*/, ""),
		EXPECTED_BIOME_VERSION,
	);
}

if (failures.length > 0) {
	console.error("Toolchain version contract failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`Toolchain versions verified: Node v${process.versions.node}, pnpm ${EXPECTED_PNPM_VERSION}, TypeScript ${EXPECTED_TYPESCRIPT_VERSION}, Biome ${EXPECTED_BIOME_VERSION}.`,
);
console.log(`Local contract prerequisite verified at ${contractManifestPath}.`);
