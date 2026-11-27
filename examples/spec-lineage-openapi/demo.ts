import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { getPresetBlueprint } from "../../src/application/blueprints/PresetBlueprints.js";
import { createPortableGraphNode } from "../../src/infrastructure/container/PortableBootstrap.js";
import { Database as SqliteDatabase } from "../../src/infrastructure/database/sqlite/SqliteAdapter.js";

function readFlag(args: readonly string[], name: string): string | undefined {
	for (let i = 0; i < args.length; i += 1) {
		const current = args[i];
		if (!current) continue;
		if (current === name) return args[i + 1];
		if (current.startsWith(`${name}=`)) return current.slice(name.length + 1);
	}
	return undefined;
}

function hasFlag(args: readonly string[], name: string): boolean {
	return args.includes(name);
}

const argv = process.argv.slice(2);
const databasePath = readFlag(argv, "--database-path") ?? ":memory:";
const serveMode = hasFlag(argv, "--serve");
const port = Number(readFlag(argv, "--port") ?? "8412");

if (databasePath !== ":memory:" && !databasePath.startsWith(":")) {
	mkdirSync(dirname(resolve(databasePath)), { recursive: true });
}

const db = new SqliteDatabase(databasePath);
const node = await createPortableGraphNode(db, {
	databaseLabel: databasePath,
	runMigrations: true,
});

try {
	const applied = await node.ia.applyBlueprint(
		getPresetBlueprint("product-spec"),
	);

	// Enrich spec_components with downstream MCP + Studio nodes idempotently
	const specComponentsTableId = applied.tables.spec_components;
	if (!specComponentsTableId) {
		throw new Error("Missing spec_components table after product-spec apply");
	}

	const iaServiceId = applied.nodesByKey.comp_ia_service;
	if (!iaServiceId) {
		throw new Error("Missing comp_ia_service node after product-spec apply");
	}

	await node.executeGraphQL(
		`
		mutation EnsureExtensionComponent($tableId: ID!, $content: String!, $title: String!, $attrs: JSON) {
			createNodeWithAttributes(input: {
				tableId: $tableId
				content: $content
				title: $title
				attributes: $attrs
			}) {
				success
			}
		}
	`,
		{
			tableId: specComponentsTableId,
			content:
				"spec-mcp-adapter: Exposes table-scoped OpenAPI-projected MCP tools",
			title: "McpHttpServer & TableMcpToolCatalog",
			attrs: { layer: "presentation", stability: "stable" },
		},
	);

	const domainOutline = await node.ia.getOutline({
		tableIdentifier: "spec_domains",
	});
	const approvedRequirements = await node.ia.queryStructured({
		tableIdentifier: "spec_requirements",
		facets: { status: "approved" },
	});

	const graphResult = await node.executeGraphQL(
		`
		query SpecImpactAndGraphMetrics($nodeId: ID!, $tableId: ID!) {
			getDependencyChain(input: { nodeId: $nodeId, direction: OUTGOING, maxDepth: 5 }) {
				nodes {
					id
					title
					content
				}
				totalCount
			}
			stronglyConnectedComponents(tableId: $tableId) {
				totalComponents
				largestComponentSize
			}
			pageRank(tableId: $tableId, dampingFactor: 0.85, maxIterations: 15) {
				entries {
					rank
					score
					node { id title }
				}
			}
		}
	`,
		{ nodeId: iaServiceId, tableId: specComponentsTableId },
	);
	if (graphResult.errors?.length) {
		throw new Error(
			`GraphQL impact query failed: ${JSON.stringify(graphResult.errors)}`,
		);
	}

	const openApiRes = await node.fetch(
		new Request("http://localhost/api/openapi"),
	);
	if (openApiRes.status !== 200) {
		throw new Error(`GET /api/openapi returned HTTP ${openApiRes.status}`);
	}
	const openApiJson = (await openApiRes.json()) as {
		openapi?: string;
		paths?: Record<string, unknown>;
	};
	const openApiEtag = openApiRes.headers.get("etag");

	// Table-scoped MCP (/sub/:tableId/mcp) initialization + tools/list
	const scopedMcpUrl = `http://localhost/sub/${encodeURIComponent(specComponentsTableId)}/mcp`;
	const mcpInitRes = await node.fetch(
		new Request(scopedMcpUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "role2-spec-demo", version: "1.0.0" },
				},
			}),
		}),
	);
	if (mcpInitRes.status !== 200) {
		throw new Error(`Scoped MCP init returned ${mcpInitRes.status}`);
	}

	const mcpListRes = await node.fetch(
		new Request(scopedMcpUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				"MCP-Protocol-Version": "2025-11-25",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list",
				params: {},
			}),
		}),
	);
	const mcpListJson = (await mcpListRes.json()) as {
		result?: { tools?: Array<{ name: string }> };
	};
	const scopedTools = mcpListJson.result?.tools?.map((t) => t.name) ?? [];

	const graphData = (graphResult.data ?? {}) as {
		getDependencyChain?: {
			nodes?: Array<{ title?: string }>;
			totalCount?: number;
		};
		stronglyConnectedComponents?: { totalComponents?: number };
		pageRank?: {
			entries?: Array<{ node?: { title?: string }; score?: number }>;
		};
	};

	const summary = {
		role: "2-spec-lineage-and-openapi-projection",
		blueprint: "product-spec",
		tables: applied.tables,
		domainOutlineRoots: domainOutline.roots.length,
		approvedRequirementsCount: approvedRequirements.hits.length,
		iaServiceDependencies:
			graphData.getDependencyChain?.totalCount ??
			graphData.getDependencyChain?.nodes?.length ??
			0,
		sccCount: graphData.stronglyConnectedComponents?.totalComponents ?? 0,
		topPageRankNode: graphData.pageRank?.entries?.[0]?.node?.title ?? null,
		openApiVersion: openApiJson.openapi ?? null,
		openApiPathsCount: Object.keys(openApiJson.paths ?? {}).length,
		openApiEtag,
		scopedMcpEndpoint: `/sub/${specComponentsTableId}/mcp`,
		scopedMcpToolsCount: scopedTools.length,
		hasOpenApiProjectionTool: scopedTools.some((name) =>
			name.includes("openapi-projection"),
		),
	};

	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

	if (serveMode) {
		const httpServer = createServer(async (req, res) => {
			const url = `http://127.0.0.1:${port}${req.url ?? "/"}`;
			const chunks: Buffer[] = [];
			for await (const chunk of req) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}
			const headers = new Headers();
			for (const [k, v] of Object.entries(req.headers)) {
				if (typeof v === "string") headers.set(k, v);
				else if (Array.isArray(v)) headers.set(k, v.join(", "));
			}
			const method = req.method ?? "GET";
			const webReq = new Request(url, {
				method,
				headers,
				body:
					method === "GET" || method === "HEAD"
						? undefined
						: Buffer.concat(chunks),
			});
			const webRes = await node.fetch(webReq);
			res.writeHead(
				webRes.status,
				Object.fromEntries(webRes.headers.entries()),
			);
			const buf = Buffer.from(await webRes.arrayBuffer());
			res.end(buf);
		});

		await new Promise<void>((resolvePromise) => {
			httpServer.listen(port, "127.0.0.1", () => resolvePromise());
		});
		process.stderr.write(
			`Spec Lineage & OpenAPI Demo serving on http://127.0.0.1:${port}/studio (OpenAPI: /api/openapi, GraphQL: /graphql, MCP: /sub/${specComponentsTableId}/mcp)\n`,
		);

		const shutdown = async () => {
			httpServer.close();
			await node.dispose();
			db.close();
			process.exit(0);
		};
		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);
	}
} finally {
	if (!serveMode) {
		await node.dispose();
		db.close();
	}
}
