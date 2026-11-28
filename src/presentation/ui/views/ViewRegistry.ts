import type { FieldEditorRegistry } from "@/presentation/ui/authoring/FieldEditorRegistry.js";
import type { IVisualizationPlugin } from "@/presentation/ui/contracts.js";
import { createAuditViewPlugin } from "@/presentation/ui/views/AuditViewPlugin.js";
import { createBoardViewPlugin } from "@/presentation/ui/views/BoardViewPlugin.js";
import { createGraphViewPlugin } from "@/presentation/ui/views/GraphViewPlugin.js";
import { createOutlineViewPlugin } from "@/presentation/ui/views/OutlineViewPlugin.js";
import { createTableViewPlugin } from "@/presentation/ui/views/TableViewPlugin.js";
import { createTimelineViewPlugin } from "@/presentation/ui/views/TimelineViewPlugin.js";

export function createDefaultViewRegistry(
	editors: FieldEditorRegistry,
): IVisualizationPlugin[] {
	return [
		createTableViewPlugin(editors),
		createOutlineViewPlugin(),
		createBoardViewPlugin(),
		createGraphViewPlugin(),
		createTimelineViewPlugin(),
		createAuditViewPlugin(),
	];
}
