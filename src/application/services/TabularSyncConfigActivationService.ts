import type { TabularSyncConfig } from "@/infrastructure/excel/TabularSyncConfig.js";
import type {
	TabularSyncConfigRecord,
	TabularSyncConfigStore,
} from "@/infrastructure/excel/TabularSyncConfigStore.js";
import { TabularSyncConnectionInspector } from "@/infrastructure/excel/TabularSyncConnectionInspector.js";

export interface TabularSyncActivationReadiness {
	assertReadyForActivation(config: TabularSyncConfig): Promise<void>;
}

/**
 * The asynchronous boundary for publishing a tabular-sync configuration.
 *
 * The store deliberately remains synchronous and owns durable state.  This
 * service performs side-effecting destination checks first, so a failed check
 * cannot replace the currently active config.
 */
export class TabularSyncConfigActivationService {
	constructor(
		private readonly store: TabularSyncConfigStore,
		private readonly readiness: TabularSyncActivationReadiness = new TabularSyncConnectionInspector(),
	) {}

	async saveConfig(
		configKey: string,
		config: TabularSyncConfig,
		options: { active?: boolean } = {},
	): Promise<TabularSyncConfigRecord | null> {
		if (options.active === true) {
			await this.readiness.assertReadyForActivation(config);
		}

		this.store.saveConfig(configKey, config, options);
		return this.store.getConfigRecordByKey(configKey);
	}

	async activateConfig(
		configKey: string,
	): Promise<TabularSyncConfigRecord | null> {
		const config = this.store.getConfigByKey(configKey);
		if (!config) {
			throw new Error(`Tabular sync config '${configKey}' not found.`);
		}

		await this.readiness.assertReadyForActivation(config);
		this.store.activateConfig(configKey);
		return this.store.getActiveConfigRecord();
	}
}
