#!/usr/bin/env bun

import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse } from "yaml";

const PROJECT_ROOT = resolve(import.meta.dir, "..");

interface CodegenConfig {
	overwrite?: boolean;
	schema?: unknown;
	documents?: unknown;
	generates?: Record<string, unknown>;
	[key: string]: unknown;
}

function isPathInside(parent: string, candidate: string): boolean {
	const pathFromParent = relative(parent, candidate);
	return (
		pathFromParent !== "" &&
		pathFromParent !== ".." &&
		!pathFromParent.startsWith(`..${sep}`) &&
		!isAbsolute(pathFromParent)
	);
}

function absoluteConfigPath(value: unknown): unknown {
	if (typeof value === "string") {
		return resolve(PROJECT_ROOT, value);
	}
	if (Array.isArray(value)) {
		return value.map(absoluteConfigPath);
	}
	return value;
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "bun-graph-db-codegen-"));

try {
	const sourceConfig = parse(
		await readFile(resolve(PROJECT_ROOT, "codegen.yml"), "utf8"),
	) as CodegenConfig;
	if (
		sourceConfig.generates === undefined ||
		Object.keys(sourceConfig.generates).length === 0
	) {
		throw new Error(
			"codegen.yml must declare at least one output under generates",
		);
	}

	const temporaryOutputs: Record<string, unknown> = {};
	const outputPaths: string[] = [];
	for (const [configuredOutput, outputConfig] of Object.entries(
		sourceConfig.generates,
	)) {
		const projectOutput = resolve(PROJECT_ROOT, configuredOutput);
		if (!isPathInside(PROJECT_ROOT, projectOutput)) {
			throw new Error(
				`codegen output must stay inside the project: ${configuredOutput}`,
			);
		}

		const temporaryOutput = resolve(
			temporaryRoot,
			relative(PROJECT_ROOT, projectOutput),
		);
		if (!isPathInside(temporaryRoot, temporaryOutput)) {
			throw new Error(
				`temporary codegen output escaped its isolated directory: ${configuredOutput}`,
			);
		}

		temporaryOutputs[temporaryOutput] = outputConfig;
		outputPaths.push(temporaryOutput);
	}

	const temporaryConfigPath = resolve(temporaryRoot, "codegen.json");
	await writeFile(
		temporaryConfigPath,
		JSON.stringify(
			{
				...sourceConfig,
				overwrite: true,
				schema: absoluteConfigPath(sourceConfig.schema),
				documents: absoluteConfigPath(sourceConfig.documents),
				generates: temporaryOutputs,
			},
			null,
			2,
		),
	);

	const child = Bun.spawn(
		["bun", "run", "graphql-codegen", "--config", temporaryConfigPath],
		{
			cwd: PROJECT_ROOT,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	if (stdout.trim() !== "") {
		console.log(stdout.trim());
	}
	if (stderr.trim() !== "") {
		console.error(stderr.trim());
	}
	if (exitCode !== 0) {
		throw new Error(`GraphQL code generation exited with ${exitCode}`);
	}

	for (const outputPath of outputPaths) {
		const output = await stat(outputPath);
		if (!output.isFile() || output.size === 0) {
			throw new Error(
				`GraphQL code generation produced an empty or non-file output: ${outputPath}`,
			);
		}
	}

	console.log(
		`GraphQL code generation verified ${outputPaths.length} output(s) in an isolated temporary directory.`,
	);
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}
