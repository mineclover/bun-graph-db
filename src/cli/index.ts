import { mkdirSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	getPresetBlueprint,
	type PresetBlueprintName,
} from "@/application/blueprints/PresetBlueprints.js";
import { LogLevel } from "@/application/ports/ILogger.js";
import { BUN_GRAPH_DB_API_VERSION } from "@/core/contracts/RestRouteContract.js";
import { createHeadlessGraphDb } from "@/core/HeadlessGraphDb.js";
import { JsonlBackupService } from "@/domain/services/JsonlBackupService.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import { ConsoleLogger } from "@/infrastructure/logging/ConsoleLogger.js";
import { startMcpStdioServer } from "@/mcp/stdio/McpStdioServer.js";

export interface CliIo {
	stdout?: (text: string) => void;
	stderr?: (text: string) => void;
}

const VALID_PRESETS = new Set<PresetBlueprintName>([
	"knowledge",
	"product-spec",
	"decision-log",
]);

function readFlag(
	args: string[],
	names: readonly string[],
): string | undefined {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;
		for (const name of names) {
			if (arg === name) {
				return args[i + 1];
			}
			if (arg.startsWith(`${name}=`)) {
				return arg.slice(name.length + 1);
			}
		}
	}
	return undefined;
}

function hasFlag(args: string[], names: readonly string[]): boolean {
	return args.some((arg) => names.includes(arg));
}

function resolveDatabasePath(args: string[]): string {
	return (
		readFlag(args, ["--database-path", "-d"]) ??
		process.env.DATABASE_PATH ??
		"./data/graph-memory.sqlite"
	);
}

function ensureParentDir(filePath: string): void {
	if (filePath === ":memory:" || filePath.startsWith(":")) return;
	mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

function formatHelpText(): string {
	return `graph-memory / bun-graph-db v${BUN_GRAPH_DB_API_VERSION}

Usage:
  graph-memory <command> [options]

Commands:
  init      Initialize SQLite database and optional IA preset blueprint
  inspect   Inspect tables, columns, IA audit health, and AI memory stats
  mcp       Run stdio JSON-RPC 2.0 MCP server (Claude Desktop / Cursor)
  serve     Run HTTP / GraphQL / REST / MCP / Studio server
  backup    Export portable JSONL backup from SQLite database
  restore   Restore JSONL backup directory into SQLite database
  help      Show this help message

Common Options:
  -d, --database-path <path>  SQLite database path (default: ./data/graph-memory.sqlite)
  --preset <name>             IA blueprint preset (knowledge | product-spec | decision-log)
  --table <id>                Scope MCP stdio endpoint to /sub/:tableId/mcp
  --dir <path>                Backup directory for backup/restore (default: ./backups/jsonl)
  --json                      Output machine-readable JSON
  -p, --port <port>           Server HTTP port (for serve)
  -h, --host <host>           Server bind host (for serve)
  -v, --version               Print version information
`;
}

export async function runCli(argv: string[], io: CliIo = {}): Promise<number> {
	const stdout =
		io.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
	const stderr =
		io.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));

	const first = argv[0];
	const command =
		!first || first.startsWith("-")
			? hasFlag(argv, ["--help"])
				? "help"
				: hasFlag(argv, ["--version", "-v"])
					? "version"
					: "serve"
			: first;
	const restArgs = first && !first.startsWith("-") ? argv.slice(1) : argv;

	if (command === "help" || hasFlag(argv, ["--help"])) {
		stdout(formatHelpText());
		return 0;
	}

	if (command === "version" || hasFlag(argv, ["--version", "-v"])) {
		stdout(
			`graph-memory v${BUN_GRAPH_DB_API_VERSION} (Node ${process.version})`,
		);
		return 0;
	}

	if (command === "serve") {
		const { startStandaloneServer } = await import(
			"@/presentation/http/StandaloneServer.js"
		);
		await startStandaloneServer(restArgs);
		return 0;
	}

	if (command === "mcp") {
		const dbPath = resolveDatabasePath(restArgs);
		ensureParentDir(dbPath);
		const presetRaw = readFlag(restArgs, ["--preset", "-p"]);
		if (presetRaw && !VALID_PRESETS.has(presetRaw as PresetBlueprintName)) {
			stderr(
				`Invalid preset '${presetRaw}'. Expected one of: knowledge, product-spec, decision-log`,
			);
			return 1;
		}
		const tableId = readFlag(restArgs, ["--table", "-t"]);
		const handle = await startMcpStdioServer({
			databasePath: dbPath,
			tableId,
			preset: presetRaw as PresetBlueprintName | undefined,
		});
		const stop = async () => {
			await handle.close();
			process.exit(0);
		};
		process.on("SIGINT", stop);
		process.on("SIGTERM", stop);
		return 0;
	}

	if (command === "init") {
		const dbPath = resolveDatabasePath(restArgs);
		ensureParentDir(dbPath);
		const presetRaw = readFlag(restArgs, ["--preset", "-p"]);
		if (presetRaw && !VALID_PRESETS.has(presetRaw as PresetBlueprintName)) {
			stderr(
				`Invalid preset '${presetRaw}'. Expected one of: knowledge, product-spec, decision-log`,
			);
			return 1;
		}
		const asJson = hasFlag(restArgs, ["--json"]);
		const adapter = new SqliteDatabase(dbPath);
		const db = await createHeadlessGraphDb({
			database: adapter,
			databaseLabel: dbPath,
			runMigrations: true,
		});

		try {
			let appliedSummary: Record<string, unknown> | undefined;
			if (presetRaw) {
				const result = await db.ia.applyBlueprint(
					getPresetBlueprint(presetRaw as PresetBlueprintName),
				);
				appliedSummary = {
					preset: presetRaw,
					tablesCount: Object.keys(result.tables).length,
					nodesCount: Object.keys(result.nodesByKey).length,
					relationsCreated: result.relationsCreated,
				};
			}
			const inspection = await db.ia.inspectArchitecture();
			const mcpConfigSnippet = {
				mcpServers: {
					"graph-memory": {
						command: "npx",
						args: [
							"-y",
							"graph-memory",
							"mcp",
							"--database-path",
							dbPath,
							...(presetRaw ? ["--preset", presetRaw] : []),
						],
					},
				},
			};
			if (asJson) {
				stdout(
					JSON.stringify(
						{
							initialized: true,
							databasePath: dbPath,
							tablesCount: inspection.totalTables,
							...(appliedSummary ? { blueprint: appliedSummary } : {}),
							mcpConfig: mcpConfigSnippet,
						},
						null,
						2,
					),
				);
			} else {
				stdout(
					`Initialized Graph DB at ${dbPath} (tables: ${inspection.totalTables})`,
				);
				if (appliedSummary) {
					stdout(
						`Applied preset '${presetRaw}': ${String(appliedSummary.tablesCount)} tables, ${String(appliedSummary.nodesCount)} keyed nodes`,
					);
				}
				stdout(
					`MCP config snippet:\n${JSON.stringify(mcpConfigSnippet, null, 2)}`,
				);
			}
			return 0;
		} finally {
			await db.dispose();
		}
	}

	if (command === "inspect") {
		const dbPath = resolveDatabasePath(restArgs);
		const asJson = hasFlag(restArgs, ["--json"]);
		const adapter = new SqliteDatabase(dbPath);
		const db = await createHeadlessGraphDb({
			database: adapter,
			databaseLabel: dbPath,
			runMigrations: true,
		});

		try {
			const inspection = await db.ia.inspectArchitecture();
			const audit = await db.ia.auditArchitecture();
			const memoryStats = await db.aiMemory.getStats();
			const summary = {
				databasePath: dbPath,
				totalTables: inspection.totalTables,
				tables: inspection.tables.map((table) => ({
					id: table.id,
					identifier: table.identifier,
					nodeCount: table.nodeCount,
				})),
				auditHealthy: audit.healthy,
				auditIssueCount: audit.issues.length,
				memoryStats,
			};
			if (asJson) {
				stdout(JSON.stringify(summary, null, 2));
			} else {
				stdout(`Database: ${dbPath}`);
				stdout(
					`Tables (${summary.totalTables}): ${summary.tables.map((t) => `${t.identifier}(${t.nodeCount})`).join(", ") || "none"}`,
				);
				stdout(
					`IA Audit: ${summary.auditHealthy ? "healthy" : `${summary.auditIssueCount} issue(s)`}`,
				);
				stdout(`AI Memory total: ${memoryStats.total}`);
			}
			return 0;
		} finally {
			await db.dispose();
		}
	}

	if (command === "backup" || command === "restore") {
		const dbPath = resolveDatabasePath(restArgs);
		if (command === "backup") ensureParentDir(dbPath);
		const dir = readFlag(restArgs, ["--dir"]) ?? "./backups/jsonl";
		const asJson = hasFlag(restArgs, ["--json"]);
		const logger = new ConsoleLogger(LogLevel.ERROR, false);
		const adapter = new SqliteDatabase(dbPath);
		const db = await createHeadlessGraphDb({
			database: adapter,
			databaseLabel: dbPath,
			runMigrations: true,
			logger,
		});

		try {
			const backupService = new JsonlBackupService(
				db.repositories.tables,
				db.repositories.attributes,
				db.repositories.attributeTypes,
				db.repositories.nodes,
				db.repositories.nodeAttributes,
				db.repositories.nodeRelations,
				db.repositories.relationTypes,
				logger,
				{ execute: (input) => db.createNode(input) },
				db.schemaGate,
				db.repositories.nodeEmbeddings,
				db.repositories.nodeMutations,
			);
			const conflictRaw = readFlag(restArgs, ["--conflict"]);
			const conflictResolution =
				conflictRaw === "skip" ||
				conflictRaw === "overwrite" ||
				conflictRaw === "merge"
					? conflictRaw
					: "merge";
			const result =
				command === "backup"
					? await backupService.export({ outputDir: dir })
					: await backupService.import({ inputDir: dir, conflictResolution });

			stdout(
				asJson
					? JSON.stringify(result, null, 2)
					: `${command} completed (${dir}): success=${String(result.success)}`,
			);
			return result.success ? 0 : 1;
		} finally {
			await db.dispose();
		}
	}

	stderr(`Unknown command '${command}'. Run 'graph-memory --help' for usage.`);
	return 1;
}

const isDirectEntry =
	typeof process !== "undefined" &&
	typeof process.argv?.[1] === "string" &&
	(() => {
		try {
			return (
				realpathSync(fileURLToPath(import.meta.url)) ===
				realpathSync(process.argv[1])
			);
		} catch {
			return import.meta.url === pathToFileURL(process.argv[1]).href;
		}
	})();

if (isDirectEntry) {
	const exitCode = await runCli(process.argv.slice(2));
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}
