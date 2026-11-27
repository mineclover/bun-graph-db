import {
	createHeadlessGraphDb,
	IndexedDbSnapshotStorage,
	type SqlJsDatabaseLike,
} from "../../src/core-sdk.js";

export async function runWebEmbeddedDemo(sqlJsDb: SqlJsDatabaseLike) {
	const snapshots = new IndexedDbSnapshotStorage({
		databaseName: "ai-agent-knowledge-demo",
	});

	const db = await createHeadlessGraphDb({
		database: sqlJsDb,
		databaseLabel: "browser:knowledge",
		snapshotStorage: snapshots,
	});

	// 1. Apply zero-embedding Information Architecture blueprint
	await db.applyPresetBlueprint("knowledge");

	// 2. Store structured AI Agent Memories (no vector embedding required)
	await db.aiMemory.remember({
		content:
			"Offline web clients persist SQLite snapshots to IndexedDB after knowledge updates.",
		kind: "semantic",
		topicPath: ["web-embedded", "indexeddb"],
		importance: 0.9,
	});

	// 3. Query via zero-embedding structured facets and 5-signal recall
	const outline = await db.ia.getOutline({ tableIdentifier: "ia_topics" });
	const recalled = await db.aiMemory.recall({
		query: "IndexedDB snapshot",
		topicPath: ["web-embedded"],
	});

	// 4. Persist full SQLite state cleanly to browser IndexedDB
	await db.saveSnapshot("latest");

	return { outline, recalled };
}
