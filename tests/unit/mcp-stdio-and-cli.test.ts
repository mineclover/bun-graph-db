import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, test } from "vitest";
import { runCli } from "@/cli/index.js";
import { createHeadlessGraphDb } from "@/core/HeadlessGraphDb.js";
import { Database as SqliteDatabase } from "@/infrastructure/database/sqlite/SqliteAdapter.js";
import { startMcpStdioServer } from "@/mcp/stdio/McpStdioServer.js";

function createJsonRpcLineReader(stream: PassThrough) {
	let buffer = "";
	const queue: unknown[] = [];
	const waiters: Array<(msg: unknown) => void> = [];

	stream.on("data", (chunk: Buffer) => {
		buffer += chunk.toString("utf8");
		let idx = buffer.indexOf("\n");
		while (idx >= 0) {
			const line = buffer.slice(0, idx).trim();
			buffer = buffer.slice(idx + 1);
			if (line) {
				const parsed = JSON.parse(line) as unknown;
				const waiter = waiters.shift();
				if (waiter) waiter(parsed);
				else queue.push(parsed);
			}
			idx = buffer.indexOf("\n");
		}
	});

	return {
		nextMessage(timeoutMs = 5000): Promise<Record<string, unknown>> {
			if (queue.length > 0) {
				return Promise.resolve(queue.shift() as Record<string, unknown>);
			}
			return new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("Timed out waiting for stdio MCP response")),
					timeoutMs,
				);
				waiters.push((msg) => {
					clearTimeout(timer);
					resolve(msg as Record<string, unknown>);
				});
			});
		},
	};
}

describe("MCP Stdio Transport & Product CLI", () => {
	test("serves MCP 2026-07-28 + legacy initialize, IA, AI Memory, and parse errors over stdio", async () => {
		const input = new PassThrough();
		const output = new PassThrough();
		const reader = createJsonRpcLineReader(output);

		const server = await startMcpStdioServer({
			databasePath: ":memory:",
			preset: "knowledge",
			input,
			output,
		});

		try {
			// 1. Invalid JSON -> -32700 Parse error
			input.write("{not-valid-json\n");
			const parseErr = await reader.nextMessage();
			expect((parseErr.error as { code?: number })?.code).toBe(-32700);

			// 2. Modern MCP 2026-07-28 initialize
			input.write(
				`${JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: {
						protocolVersion: "2026-07-28",
						capabilities: {},
						clientInfo: { name: "stdio-test", version: "1.0.0" },
					},
				})}\n`,
			);
			const initRes = await reader.nextMessage();
			expect(initRes.id).toBe(1);
			expect(
				(initRes.result as { protocolVersion?: string })?.protocolVersion,
			).toBe("2026-07-28");

			// 3. tools/call healthCheck & memory-remember
			input.write(
				`${JSON.stringify({
					jsonrpc: "2.0",
					id: 2,
					method: "tools/call",
					params: {
						name: "memory-remember",
						arguments: {
							content: "Stdio MCP remembers across sessions",
							kind: "semantic",
							topicPath: ["stdio-test"],
						},
					},
				})}\n`,
			);
			const remRes = await reader.nextMessage();
			expect(remRes.id).toBe(2);
			expect((remRes.result as { isError?: boolean })?.isError).not.toBe(true);
			expect(
				(remRes.result as { content?: Array<{ text?: string }> })?.content?.[0]
					?.text,
			).toContain("Stdio MCP remembers across sessions");

			// 4. notifications/initialized emits nothing on stdout; verify next request id=3 comes directly
			input.write(
				`${JSON.stringify({
					jsonrpc: "2.0",
					method: "notifications/initialized",
				})}\n`,
			);
			input.write(
				`${JSON.stringify({
					jsonrpc: "2.0",
					id: 3,
					method: "tools/call",
					params: {
						name: "ia-audit",
						arguments: {},
					},
				})}\n`,
			);
			const auditRes = await reader.nextMessage();
			expect(auditRes.id).toBe(3);
			expect((auditRes.result as { isError?: boolean })?.isError).not.toBe(
				true,
			);
		} finally {
			await server.close();
		}
	});

	test("supports table-scoped stdio mode (/sub/:tableId/mcp)", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "bgdb-stdio-table-"));
		const dbPath = join(tmpDir, "scoped.sqlite");
		const db = new SqliteDatabase(dbPath);
		const headless = await createHeadlessGraphDb({
			database: db,
			databaseLabel: dbPath,
		});
		const created = await headless.createTable({
			identifier: "tasks",
			description: "Scoped tasks",
		});
		const tableId = created.table.id;
		await headless.dispose();

		const input = new PassThrough();
		const output = new PassThrough();
		const reader = createJsonRpcLineReader(output);

		const server = await startMcpStdioServer({
			databasePath: dbPath,
			tableId,
			input,
			output,
		});

		try {
			input.write(
				`${JSON.stringify({
					jsonrpc: "2.0",
					id: 10,
					method: "initialize",
					params: {
						protocolVersion: "2025-11-25",
						capabilities: {},
						clientInfo: { name: "legacy-client", version: "1.0.0" },
					},
				})}\n`,
			);
			const initRes = await reader.nextMessage();
			expect(initRes.id).toBe(10);

			input.write(
				`${JSON.stringify({
					jsonrpc: "2.0",
					id: 11,
					method: "tools/list",
					params: {},
				})}\n`,
			);
			const listRes = await reader.nextMessage();
			const tools = (
				(listRes.result as { tools?: Array<{ name: string }> })?.tools ?? []
			).map((t) => t.name);
			expect(tools.some((name) => name.includes(`table-${tableId}`))).toBe(
				true,
			);
		} finally {
			await server.close();
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("runs unified CLI help, version, init, inspect, backup, and restore commands", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "bgdb-cli-"));
		const dbPath = join(tmpDir, "graph-memory.sqlite");
		const restoredDbPath = join(tmpDir, "restored.sqlite");
		const backupDir = join(tmpDir, "jsonl-backup");

		try {
			const helpLines: string[] = [];
			expect(
				await runCli(["--help"], { stdout: (s) => helpLines.push(s) }),
			).toBe(0);
			expect(helpLines.join("\n")).toContain("graph-memory");

			const verLines: string[] = [];
			expect(
				await runCli(["--version"], { stdout: (s) => verLines.push(s) }),
			).toBe(0);
			expect(verLines.join("\n")).toContain("1.0.0");

			const initLines: string[] = [];
			const initCode = await runCli(
				["init", "--database-path", dbPath, "--preset", "knowledge", "--json"],
				{ stdout: (s) => initLines.push(s) },
			);
			expect(initCode).toBe(0);
			const initPayload = JSON.parse(initLines.join("\n")) as {
				initialized: boolean;
				tablesCount: number;
				blueprint?: { preset: string };
			};
			expect(initPayload.initialized).toBe(true);
			expect(initPayload.blueprint?.preset).toBe("knowledge");
			expect(initPayload.tablesCount).toBeGreaterThanOrEqual(2);

			const inspectLines: string[] = [];
			const inspectCode = await runCli(
				["inspect", "--database-path", dbPath, "--json"],
				{
					stdout: (s) => inspectLines.push(s),
				},
			);
			expect(inspectCode).toBe(0);
			const inspectPayload = JSON.parse(inspectLines.join("\n")) as {
				auditHealthy: boolean;
				totalTables: number;
			};
			expect(inspectPayload.auditHealthy).toBe(true);
			expect(inspectPayload.totalTables).toBeGreaterThanOrEqual(2);

			const backupLines: string[] = [];
			expect(
				await runCli(
					["backup", "--database-path", dbPath, "--dir", backupDir, "--json"],
					{
						stdout: (s) => backupLines.push(s),
					},
				),
			).toBe(0);
			const backupPayload = JSON.parse(backupLines.join("\n")) as {
				success: boolean;
			};
			expect(backupPayload.success).toBe(true);

			const restoreLines: string[] = [];
			expect(
				await runCli(
					[
						"restore",
						"--database-path",
						restoredDbPath,
						"--dir",
						backupDir,
						"--json",
					],
					{ stdout: (s) => restoreLines.push(s) },
				),
			).toBe(0);
			const restorePayload = JSON.parse(restoreLines.join("\n")) as {
				success: boolean;
			};
			expect(restorePayload.success).toBe(true);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	test("keeps stdout pure JSON-RPC and restores console when stdio logger intercepts startup logs", async () => {
		const originalConsoleLog = console.log;
		const capturedLogs: string[] = [];
		const input = new PassThrough();
		const server = await startMcpStdioServer({
			databasePath: ":memory:",
			input,
			output: process.stdout,
			logger: (line) => capturedLogs.push(line),
		});

		try {
			expect(
				capturedLogs.some((line) =>
					line.includes("Enhanced AI metadata system initialized"),
				),
			).toBe(true);
			console.log("smoke-stdio-log-intercept");
			expect(
				capturedLogs.some((line) => line.includes("smoke-stdio-log-intercept")),
			).toBe(true);
		} finally {
			await server.close();
		}

		expect(console.log).toBe(originalConsoleLog);
	});
});
