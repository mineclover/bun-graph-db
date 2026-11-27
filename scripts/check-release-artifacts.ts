#!/usr/bin/env node

import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

interface ExportTarget {
	types?: string;
	import?: string;
}

interface PackageJsonShape {
	name: string;
	version?: string;
	description?: string;
	license?: string;
	type?: string;
	main?: string;
	types?: string;
	private?: boolean;
	bin?: Record<string, string>;
	exports?: Record<string, string | ExportTarget>;
	files?: string[];
	keywords?: string[];
	engines?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	peerDependenciesMeta?: Record<string, { optional?: boolean }>;
	optionalDependencies?: Record<string, string>;
	[key: string]: unknown;
}

function walkBundleGraph(entryRelPath: string): {
	filesWalked: number;
	nodeImports: string[];
	externalImports: string[];
} {
	const seen = new Set<string>();
	const nodeImports = new Set<string>();
	const externalImports = new Set<string>();

	function walk(file: string): void {
		const resolved = resolve(file);
		if (seen.has(resolved) || !existsSync(resolved)) return;
		seen.add(resolved);
		const code = readFileSync(resolved, "utf8");
		const specMatches = code.matchAll(
			/(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g,
		);
		for (const match of specMatches) {
			const spec = match[1];
			if (!spec) continue;
			if (spec.startsWith("node:")) {
				nodeImports.add(`${relative(PROJECT_ROOT, resolved)} -> ${spec}`);
			} else if (spec.startsWith(".")) {
				walk(resolve(dirname(resolved), spec));
			} else {
				externalImports.add(spec);
			}
		}
	}

	walk(resolve(PROJECT_ROOT, entryRelPath));
	return {
		filesWalked: seen.size,
		nodeImports: [...nodeImports].sort(),
		externalImports: [...externalImports].sort(),
	};
}

function buildPublishableManifest(pkg: PackageJsonShape): PackageJsonShape {
	const nextDeps = { ...(pkg.dependencies ?? {}) };
	delete nextDeps.xlsx;

	const publishable: PackageJsonShape = {
		name: pkg.name,
		version: pkg.version ?? "1.0.0",
		description: pkg.description,
		license: pkg.license ?? "MIT",
		type: pkg.type ?? "module",
		main: "./dist/index.js",
		types: "./dist/index.d.ts",
		bin: pkg.bin,
		exports: pkg.exports,
		files: pkg.files ?? ["dist", "LICENSE", "README.md", "CHANGELOG.md"],
		keywords: pkg.keywords,
		engines: pkg.engines,
		dependencies: nextDeps,
		peerDependencies: {
			...(pkg.peerDependencies ?? {}),
			xlsx: "^0.20.3",
		},
		peerDependenciesMeta: {
			...(pkg.peerDependenciesMeta ?? {}),
			xlsx: { optional: true },
		},
	};

	return publishable;
}

function main(): void {
	const args = process.argv.slice(2);
	const emitManifestIndex = args.indexOf("--emit-manifest");
	const emitManifestPath =
		emitManifestIndex >= 0 ? args[emitManifestIndex + 1] : undefined;

	const pkgPath = resolve(PROJECT_ROOT, "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJsonShape;

	const failures: string[] = [];

	if (!existsSync(resolve(PROJECT_ROOT, "LICENSE"))) {
		failures.push("Missing LICENSE file at package root");
	}
	if (!pkg.version) {
		failures.push("package.json must declare a semver version");
	}
	if (!pkg.license) {
		failures.push("package.json must declare a license");
	}

	for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
		if (typeof target === "string") {
			if (!existsSync(resolve(PROJECT_ROOT, target))) {
				failures.push(`Missing export target ${subpath}: ${target}`);
			}
			continue;
		}
		if (target.import && !existsSync(resolve(PROJECT_ROOT, target.import))) {
			failures.push(
				`Missing import build artifact for ${subpath}: ${target.import}`,
			);
		}
		if (target.types) {
			const absTypes = resolve(PROJECT_ROOT, target.types);
			if (!existsSync(absTypes)) {
				failures.push(
					`Missing declaration artifact for ${subpath}: ${target.types}`,
				);
			} else {
				const dts = readFileSync(absTypes, "utf8");
				if (/(['"])(?:@\/|~\/)/.test(dts)) {
					failures.push(`Unresolved path alias in ${target.types}`);
				}
			}
		}
	}

	for (const [binName, binTarget] of Object.entries(pkg.bin ?? {})) {
		const absBin = resolve(PROJECT_ROOT, binTarget);
		if (!existsSync(absBin)) {
			failures.push(`Missing bin artifact for ${binName}: ${binTarget}`);
			continue;
		}
		const firstLine = readFileSync(absBin, "utf8").split(/\r?\n/, 1)[0] ?? "";
		if (!firstLine.startsWith("#!/usr/bin/env node")) {
			failures.push(
				`Bin ${binName} (${binTarget}) missing #!/usr/bin/env node shebang`,
			);
		}
	}

	const coreGraph = walkBundleGraph("dist/core/index.js");
	if (coreGraph.filesWalked === 0) {
		failures.push("dist/core/index.js does not exist");
	}
	if (coreGraph.nodeImports.length > 0) {
		failures.push(
			`dist/core/index.js must have 0 node:* imports: ${coreGraph.nodeImports.join(", ")}`,
		);
	}
	if (coreGraph.externalImports.length > 0) {
		failures.push(
			`dist/core/index.js must have 0 external npm imports: ${coreGraph.externalImports.join(", ")}`,
		);
	}

	const embeddedGraph = walkBundleGraph("dist/embedded/index.js");
	if (embeddedGraph.filesWalked === 0) {
		failures.push("dist/embedded/index.js does not exist");
	}
	if (embeddedGraph.nodeImports.length > 0) {
		failures.push(
			`dist/embedded/index.js must have 0 node:* imports: ${embeddedGraph.nodeImports.join(", ")}`,
		);
	}
	if (
		embeddedGraph.externalImports.includes(
			"@oa-sdk/openapi-projection-contract",
		)
	) {
		failures.push(
			"dist/embedded/index.js must bundle @oa-sdk/openapi-projection-contract instead of keeping an external workspace import",
		);
	}

	const indexGraph = walkBundleGraph("dist/index.js");
	if (
		indexGraph.externalImports.includes("@oa-sdk/openapi-projection-contract")
	) {
		failures.push(
			"dist/index.js must bundle @oa-sdk/openapi-projection-contract",
		);
	}

	if (failures.length > 0) {
		throw new Error(
			`Release artifact check failed:\n- ${failures.join("\n- ")}`,
		);
	}

	const coreBytes = statSync(resolve(PROJECT_ROOT, "dist/core/index.js")).size;
	const embeddedBytes = statSync(
		resolve(PROJECT_ROOT, "dist/embedded/index.js"),
	).size;

	if (emitManifestPath) {
		const outPath = resolve(PROJECT_ROOT, emitManifestPath);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(
			outPath,
			`${JSON.stringify(buildPublishableManifest(pkg), null, 2)}\n`,
			"utf8",
		);
	}

	console.log(
		JSON.stringify(
			{
				status: "ok",
				version: pkg.version,
				license: pkg.license,
				coreBundle: {
					bytes: coreBytes,
					filesWalked: coreGraph.filesWalked,
					nodeImports: coreGraph.nodeImports,
					externalImports: coreGraph.externalImports,
				},
				embeddedBundle: {
					bytes: embeddedBytes,
					filesWalked: embeddedGraph.filesWalked,
					nodeImports: embeddedGraph.nodeImports,
					externalImports: embeddedGraph.externalImports,
				},
			},
			null,
			2,
		),
	);
}

main();
