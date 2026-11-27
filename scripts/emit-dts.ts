#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, posix, relative, resolve, sep } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const TYPES_ROOT = resolve(PROJECT_ROOT, "dist", "types");
const TYPES_SRC_ROOT = resolve(TYPES_ROOT, "src");

interface FacadeEntry {
	outFile: string;
	targetFromOutDir: string;
}

const FACADES: readonly FacadeEntry[] = [
	{ outFile: "dist/index.d.ts", targetFromOutDir: "./types/index.js" },
	{
		outFile: "dist/core/index.d.ts",
		targetFromOutDir: "../types/src/core-sdk.js",
	},
	{
		outFile: "dist/embedded/index.d.ts",
		targetFromOutDir: "../types/src/embedded.js",
	},
	{
		outFile: "dist/mcp-stdio/index.d.ts",
		targetFromOutDir: "../types/src/mcp/stdio/McpStdioServer.js",
	},
	{
		outFile: "dist/cli/index.d.ts",
		targetFromOutDir: "../types/src/cli/index.js",
	},
];

function collectDtsFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectDtsFiles(full));
		} else if (entry.name.endsWith(".d.ts")) {
			files.push(full);
		}
	}
	return files.sort();
}

function toPosixRelative(fromDir: string, targetFile: string): string {
	const rel = relative(fromDir, targetFile).split(sep).join(posix.sep);
	return rel.startsWith(".") ? rel : `./${rel}`;
}

function rewriteSpecifier(fileDir: string, specifier: string): string {
	let updated = specifier;

	if (updated.startsWith("@/") || updated.startsWith("~/")) {
		const subPath = updated.slice(2);
		const target = resolve(TYPES_SRC_ROOT, subPath);
		updated = toPosixRelative(fileDir, target);
	}

	if (
		(updated.startsWith("./") || updated.startsWith("../")) &&
		updated.endsWith(".ts")
	) {
		updated = `${updated.slice(0, -3)}.js`;
	}

	return updated;
}

function rewriteDeclarationContent(filePath: string, source: string): string {
	const fileDir = dirname(filePath);
	const fromRe = /(from\s+)(['"])([^'"]+)\2/g;
	const dynamicImportRe = /(import\(\s*)(['"])([^'"]+)\2(\s*\))/g;

	return source
		.replace(fromRe, (_match, prefix: string, quote: string, spec: string) => {
			return `${prefix}${quote}${rewriteSpecifier(fileDir, spec)}${quote}`;
		})
		.replace(
			dynamicImportRe,
			(_match, prefix: string, quote: string, spec: string, suffix: string) => {
				return `${prefix}${quote}${rewriteSpecifier(fileDir, spec)}${quote}${suffix}`;
			},
		);
}

rmSync(TYPES_ROOT, { recursive: true, force: true });

execFileSync("pnpm", ["exec", "tsc", "--project", "tsconfig.dts.json"], {
	cwd: PROJECT_ROOT,
	stdio: "inherit",
});

const dtsFiles = collectDtsFiles(TYPES_ROOT);
if (dtsFiles.length === 0) {
	throw new Error("Declaration emit produced no .d.ts files in dist/types");
}

const unresolvedErrors: string[] = [];

for (const filePath of dtsFiles) {
	const raw = readFileSync(filePath, "utf8");
	const rewritten = rewriteDeclarationContent(filePath, raw);
	if (rewritten !== raw) {
		writeFileSync(filePath, rewritten, "utf8");
	}

	if (/(['"])(?:@\/|~\/)/.test(rewritten)) {
		unresolvedErrors.push(
			`${relative(PROJECT_ROOT, filePath)}: still contains @/ or ~/ alias`,
		);
	}
	if (/(['"])\.\.?\/[^'"]+\.ts\1/.test(rewritten)) {
		unresolvedErrors.push(
			`${relative(PROJECT_ROOT, filePath)}: still contains relative .ts specifier`,
		);
	}
}

for (const facade of FACADES) {
	const absFacade = resolve(PROJECT_ROOT, facade.outFile);
	mkdirSync(dirname(absFacade), { recursive: true });
	writeFileSync(
		absFacade,
		`export * from '${facade.targetFromOutDir}'\n`,
		"utf8",
	);
}

if (unresolvedErrors.length > 0) {
	throw new Error(
		`Declaration emit validation failed:\n${unresolvedErrors.join("\n")}`,
	);
}

console.log(
	`Emitted ${dtsFiles.length} declaration files and ${FACADES.length} package entry facades.`,
);
