import { AccessControl } from "../../src/application/security/AccessControl.js";
import type { CloudflareR2BucketLike } from "../../src/domain/ports/ISnapshotStoragePort.js";
import type { DoStorageLike } from "../../src/infrastructure/database/sqlite/DoSqliteAdapter.js";
import {
	type CloudflareDurableObjectNode,
	createCloudflareDurableObjectNode,
	type DurableObjectNamespaceLike,
	routeSingleNodeRequest,
} from "../../src/presentation/cloudflare/CloudflareSingleNodeWorker.js";

export interface WorkerEnv {
	GRAPH_NODE: DurableObjectNamespaceLike;
	SNAPSHOT_BUCKET?: CloudflareR2BucketLike;
	DEFAULT_NODE_KEY?: string;
	GRAPH_NODE_HEADER?: string;
	BUN_GRAPH_DB_ACCESS_TOKENS?: string;
	BUN_GRAPH_DB_AUTH_REQUIRED?: string;
	BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN?: string;
	NODE_ENV?: string;
}

interface DurableObjectStateLike {
	storage: DoStorageLike;
	id: { toString(): string; name?: string };
}

export class GraphNodeDurableObject {
	private readonly node: CloudflareDurableObjectNode;

	constructor(state: DurableObjectStateLike, env: WorkerEnv) {
		const accessControl = AccessControl.fromEnvironment({
			NODE_ENV: env.NODE_ENV ?? "production",
			BUN_GRAPH_DB_AUTH_REQUIRED: env.BUN_GRAPH_DB_AUTH_REQUIRED,
			BUN_GRAPH_DB_ACCESS_TOKENS: env.BUN_GRAPH_DB_ACCESS_TOKENS,
			BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN:
				env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN,
		});

		this.node = createCloudflareDurableObjectNode(state.storage, {
			snapshotBucket: env.SNAPSHOT_BUCKET,
			nodeKey: state.id.name ?? state.id.toString(),
			accessControl,
			internalBridgeToken: env.BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN,
		});
	}

	async fetch(request: Request): Promise<Response> {
		return await this.node.fetch(request);
	}
}

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		return await routeSingleNodeRequest(request, env);
	},
};
