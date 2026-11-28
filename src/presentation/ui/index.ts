export { EMBEDDED_STUDIO_CSS as PLATFORM_UI_CSS } from "@/generated/embedded-assets.js";
export {
	AuthoringCommandStack,
	type AuthoringHistoryState,
} from "@/presentation/ui/authoring/AuthoringController.js";
export {
	createDefaultFieldEditorRegistry,
	type FieldEditorRegistry,
} from "@/presentation/ui/authoring/FieldEditorRegistry.js";
export {
	createLocalHeadlessClient,
	type LocalHeadlessClientOptions,
} from "@/presentation/ui/clients/LocalHeadlessClient.js";
export {
	createRemoteHttpClient,
	type RemoteHttpClientOptions,
} from "@/presentation/ui/clients/RemoteHttpClient.js";
export {
	buildFallbackColumnProfile,
	computeGraphAnalytics,
	UI_VIEWS_TABLE_IDENTIFIER,
	validateRowDraft,
} from "@/presentation/ui/clients/sharedHelpers.js";
export type {
	AuthoringCommand,
	ChangeScope,
	CreateRowCommand,
	DependencyGraphQuery,
	FieldEditorContext,
	FieldEditorSpec,
	GraphSubgraph,
	GraphSubgraphEdge,
	GraphSubgraphNode,
	IGraphPlatformClient,
	IVisualizationPlugin,
	MoveHierarchyCommand,
	PlatformMode,
	PlatformRelation,
	PlatformRelationType,
	PlatformRow,
	PlatformSignalBreakdown,
	PlatformTableSummary,
	PlatformValidationIssue,
	PlatformValidationReport,
	RelationCommand,
	SavedViewConfig,
	UpdateRowCommand,
	ViewDataSlice,
	ViewIntent,
	ViewPluginId,
} from "@/presentation/ui/contracts.js";
export {
	GraphMemoryWorkspaceElement,
	registerGraphMemoryWorkspace,
} from "@/presentation/ui/GraphMemoryWorkspaceElement.js";
export {
	type GraphPlatformWorkspaceHandle,
	type MountGraphPlatformWorkspaceOptions,
	mountGraphPlatformWorkspace,
} from "@/presentation/ui/GraphPlatformWorkspace.js";
export { createAuditViewPlugin } from "@/presentation/ui/views/AuditViewPlugin.js";
export { createBoardViewPlugin } from "@/presentation/ui/views/BoardViewPlugin.js";
export { createGraphViewPlugin } from "@/presentation/ui/views/GraphViewPlugin.js";
export { createOutlineViewPlugin } from "@/presentation/ui/views/OutlineViewPlugin.js";
export { createTableViewPlugin } from "@/presentation/ui/views/TableViewPlugin.js";
export { createTimelineViewPlugin } from "@/presentation/ui/views/TimelineViewPlugin.js";
export { createDefaultViewRegistry } from "@/presentation/ui/views/ViewRegistry.js";
