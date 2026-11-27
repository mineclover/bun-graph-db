import { Database } from "../../src/infrastructure/database/sqlite/SqliteAdapter.js";
import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TabularSyncConfigActivationService } from "@/application/services/TabularSyncConfigActivationService.js";
import { TabularSyncConfigStore } from "@/infrastructure/excel/TabularSyncConfigStore.js";

function createStore() {
	const db = new Database(":memory:");
	db.exec(`
    CREATE TABLE tabular_sync_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT NOT NULL UNIQUE,
      config_json TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
	return { db, store: new TabularSyncConfigStore(db) };
}

describe("TabularSyncConfigActivationService", () => {
	test("keeps the current active config when readiness fails", async () => {
		const { db, store } = createStore();
		store.saveConfig("current", { targets: [], routes: [] }, { active: true });
		store.saveConfig(
			"candidate",
			{ targets: [], routes: [] },
			{ active: false },
		);
		const service = new TabularSyncConfigActivationService(store, {
			assertReadyForActivation: async () => {
				throw new Error("destination is unavailable");
			},
		});

		await expect(service.activateConfig("candidate")).rejects.toThrow(
			"destination is unavailable",
		);
		expect(store.getActiveConfigRecord()?.configKey).toBe("current");
		db.close();
	});

	test("activates a valid Excel creation path after writable/read readiness checks", async () => {
		const directory = mkdtempSync(join(tmpdir(), "tabular-sync-activation-"));
		const { db, store } = createStore();
		const service = new TabularSyncConfigActivationService(store);

		try {
			await service.saveConfig(
				"excel",
				{
					targets: [
						{
							id: "excel",
							kind: "excel-file",
							workbookPath: join(directory, "new-workbook.xlsx"),
						},
					],
					routes: [{ tableIdentifier: "users", targetId: "excel" }],
				},
				{ active: true },
			);

			expect(store.getActiveConfigRecord()?.configKey).toBe("excel");
		} finally {
			db.close();
			rmSync(directory, { recursive: true, force: true });
		}
	});

	test("rejects an enabled target without a registered gateway before activation", async () => {
		const { db, store } = createStore();
		store.saveConfig(
			"unsupported",
			{
				targets: [{ id: "unknown", kind: "unsupported-target" }],
				routes: [{ tableIdentifier: "users", targetId: "unknown" }],
			} as never,
			{ active: false },
		);
		const service = new TabularSyncConfigActivationService(store);

		await expect(service.activateConfig("unsupported")).rejects.toThrow(
			"No gateway is registered for target kind 'unsupported-target'",
		);
		expect(store.getActiveConfigRecord()).toBeNull();
		db.close();
	});
});
