#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED_BUN_VERSION = "1.3.9";
const EXPECTED_TYPESCRIPT_VERSION = "7.0.2";
const EXPECTED_BIOME_VERSION = "2.5.7";
const CONTRACT_PACKAGE = "@oa-sdk/openapi-projection-contract";
const CONTRACT_SPECIFIER = "file:../../packages/openapi-projection-contract";
const PROJECT_ROOT = resolve(import.meta.dir, "..");

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
	command: string[],
): Promise<string | undefined> {
	const child = Bun.spawn(command, {
		cwd: PROJECT_ROOT,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	if (exitCode !== 0) {
		failures.push(
			`${command.join(" ")} exited with ${exitCode}: ${stderr.trim()}`,
		);
		return undefined;
	}

	return stdout.trim();
}

const manifest = await readJson(resolve(PROJECT_ROOT, "package.json"));
expectEqual(
	"packageManager",
	manifest.packageManager,
	`bun@${EXPECTED_BUN_VERSION}`,
);
expectEqual("engines.bun", manifest.engines?.bun, EXPECTED_BUN_VERSION);
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

expectEqual("Bun runtime", Bun.version, EXPECTED_BUN_VERSION);
expectEqual(
	".bun-version",
	(await readFile(resolve(PROJECT_ROOT, ".bun-version"), "utf8")).trim(),
	EXPECTED_BUN_VERSION,
);

const lockfile = await readFile(resolve(PROJECT_ROOT, "bun.lock"), "utf8");
if (!lockfile.includes(`"@biomejs/biome": "${EXPECTED_BIOME_VERSION}"`)) {
	failures.push(
		`bun.lock does not pin @biomejs/biome to ${EXPECTED_BIOME_VERSION}`,
	);
}
if (!lockfile.includes(`"typescript": "${EXPECTED_TYPESCRIPT_VERSION}"`)) {
	failures.push(
		`bun.lock does not pin typescript to ${EXPECTED_TYPESCRIPT_VERSION}`,
	);
}
if (!lockfile.includes(`"${CONTRACT_PACKAGE}": "${CONTRACT_SPECIFIER}"`)) {
	failures.push(
		`bun.lock does not preserve ${CONTRACT_PACKAGE} as ${CONTRACT_SPECIFIER}`,
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

const [typescriptOutput, biomeOutput] = await Promise.all([
	readCommandVersion(["bun", "run", "tsc", "--version"]),
	readCommandVersion(["bun", "run", "biome", "--version"]),
]);
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
	`Toolchain versions verified: Bun ${EXPECTED_BUN_VERSION}, TypeScript ${EXPECTED_TYPESCRIPT_VERSION}, Biome ${EXPECTED_BIOME_VERSION}.`,
);
console.log(`Local contract prerequisite verified at ${contractManifestPath}.`);
