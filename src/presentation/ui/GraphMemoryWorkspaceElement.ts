import type { HeadlessGraphDb } from "@/core/HeadlessGraphDb.js";
import {
	createLocalHeadlessClient,
	type LocalHeadlessClientOptions,
} from "@/presentation/ui/clients/LocalHeadlessClient.js";
import { createRemoteHttpClient } from "@/presentation/ui/clients/RemoteHttpClient.js";
import type {
	IGraphPlatformClient,
	PlatformMode,
	ViewPluginId,
} from "@/presentation/ui/contracts.js";
import {
	type GraphPlatformWorkspaceHandle,
	mountGraphPlatformWorkspace,
} from "@/presentation/ui/GraphPlatformWorkspace.js";

const BaseHTMLElement: typeof HTMLElement =
	typeof HTMLElement !== "undefined"
		? HTMLElement
		: (class {} as typeof HTMLElement);

export class GraphMemoryWorkspaceElement extends BaseHTMLElement {
	static get observedAttributes(): string[] {
		return ["mode", "endpoint-base", "title", "version", "table", "view"];
	}

	private client: IGraphPlatformClient | null = null;
	private handle: GraphPlatformWorkspaceHandle | null = null;

	connectedCallback(): void {
		if (!this.client) {
			const mode =
				(this.getAttribute("mode") as PlatformMode | null) ?? "remote-http";
			if (mode !== "local-headless") {
				let savedToken = "";
				try {
					if (typeof sessionStorage !== "undefined") {
						savedToken = sessionStorage.getItem("bun_graph_db_token") ?? "";
					}
				} catch {
					savedToken = "";
				}
				this.client = createRemoteHttpClient({
					baseUrl: this.getAttribute("endpoint-base") ?? "",
					token: savedToken,
					mode: mode === "cloudflare-do" ? "cloudflare-do" : "remote-http",
				});
			}
		}
		this.mountWorkspace();
	}

	disconnectedCallback(): void {
		this.handle?.destroy();
		this.handle = null;
	}

	connectClient(client: IGraphPlatformClient): void {
		this.client = client;
		this.mountWorkspace();
	}

	connectHeadlessDb(
		db: HeadlessGraphDb,
		options?: LocalHeadlessClientOptions,
	): IGraphPlatformClient {
		const client = createLocalHeadlessClient(db, options);
		this.connectClient(client);
		return client;
	}

	async refresh(): Promise<void> {
		await this.handle?.refresh();
	}

	private mountWorkspace(): void {
		if (!this.isConnected || !this.client) return;
		this.handle?.destroy();
		this.handle = mountGraphPlatformWorkspace(this, this.client, {
			title: this.getAttribute("title") ?? undefined,
			version: this.getAttribute("version") ?? undefined,
			initialTable: this.getAttribute("table") ?? undefined,
			initialView:
				(this.getAttribute("view") as ViewPluginId | null) ?? undefined,
		});
	}
}

export function registerGraphMemoryWorkspace(
	tagName = "graph-memory-workspace",
): typeof GraphMemoryWorkspaceElement {
	if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
		customElements.define(tagName, GraphMemoryWorkspaceElement);
	}
	return GraphMemoryWorkspaceElement;
}
