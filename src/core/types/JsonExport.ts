/**
 * JSON Export Types
 *
 * Supports two export formats:
 * 1. Flat JSON - Simple array of nodes with flattened attributes
 * 2. HFI Protocol - Full graph structure compatible with @packages/hfiflow
 */

// =============================================================================
// HFI Protocol Types (Compatible with @packages/hfiflow)
// =============================================================================

export const HFI_PROTOCOL_VERSION = 'HFI/1.1' as const

/**
 * Value reference types for dynamic conditions
 */
export interface PathRef {
  $path: string
}

export interface ExprRef {
  $expr: string
}

export type ValueRef<T = unknown> = T | PathRef | ExprRef

/**
 * Branch metadata - defines possible outcomes and next steps
 */
export interface BranchMetadata {
  /** Branch identifier - matches return value case */
  case: string
  /** Human-readable label for UI */
  label?: string
  /** Description of this branch outcome */
  description?: string
  /** Next node(s) to connect to */
  next?: string | string[]
  /** Visual color for this branch (hex) */
  color?: string
  /** Condition for this branch (optional) */
  condition?: Condition
  /** Additional metadata */
  meta?: Record<string, unknown>
}

/**
 * Condition types for branch evaluation
 */
export interface CompareCondition {
  type: 'compare'
  left: ValueRef
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  right: ValueRef
}

export interface RangeCondition {
  type: 'range'
  value: ValueRef<number>
  min?: ValueRef<number>
  max?: ValueRef<number>
}

export interface ExistsCondition {
  type: 'exists'
  path: string
  negated?: boolean
}

export interface InCondition {
  type: 'in'
  value: ValueRef
  list: unknown[] | PathRef
  negated?: boolean
}

export interface AndCondition {
  type: 'and'
  conditions: Condition[]
}

export interface OrCondition {
  type: 'or'
  conditions: Condition[]
}

export interface NotCondition {
  type: 'not'
  condition: Condition
}

export type SimpleCondition = CompareCondition | RangeCondition | ExistsCondition | InCondition
export type CompoundCondition = AndCondition | OrCondition | NotCondition
export type Condition = SimpleCondition | CompoundCondition

/**
 * Payload field type
 */
export type PayloadFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object'

/**
 * Payload field - represents an input/output field in a node
 */
export interface PayloadField {
  key: string
  type: PayloadFieldType
  value: string | number | boolean | unknown[] | Record<string, unknown>
  default?: string | number | boolean | unknown[] | Record<string, unknown>
  required?: boolean
  enum?: string[] | number[] | boolean[]
  min?: number
  max?: number
  step?: number
  pattern?: string
  widget?: 'color' | 'date' | 'time' | 'range'
  direction?: 'input' | 'output'
  stateFrom?: {
    nodeId: string
    field: string
  }
}

/**
 * Node position for visualization
 */
export interface NodePosition {
  x: number
  y: number
}

/**
 * Base node structure
 */
export interface BaseFlowNode {
  id: string
  type: 'query' | 'effect'
  target: string
  title: string
  position?: NodePosition
  flowContext?: string
  category?: string
  tags?: string[]
  style?: NodeStyle
}

/**
 * Query node - has branches (decision point)
 */
export interface QueryNode extends BaseFlowNode {
  type: 'query'
  branches: BranchMetadata[]
  payload: PayloadField[]
}

/**
 * Effect node - single action (execution point)
 */
export interface EffectNode extends BaseFlowNode {
  type: 'effect'
  description?: string
  payload: PayloadField[]
}

export type FlowNode = QueryNode | EffectNode

/**
 * Node visual style
 */
export interface NodeStyle {
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  width?: number
  height?: number
  zIndex?: number
}

/**
 * Edge metadata for visual styling
 */
export interface FlowEdge {
  id: string
  label?: string
  animated?: boolean
  style?: EdgeStyle
}

export interface EdgeStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
}

/**
 * State connection - data flow between nodes
 */
export interface StateConnection {
  from: string
  fromField: string
  to: string
  toField: string
}

/**
 * Viewport state for canvas
 */
export interface ViewportState {
  x: number
  y: number
  zoom: number
}

/**
 * Node theme configuration
 */
export interface NodeTheme {
  border?: string
  background?: string
  headerBackground?: string
}

/**
 * Context-level theme configuration
 */
export interface ContextTheme {
  queryNode?: NodeTheme
  effectNode?: NodeTheme
  defaultEdgeColor?: string
  categories?: Record<string, string>
}

/**
 * HFI Protocol - Full graph export format
 */
export interface HFIProtocolExport {
  protocol: typeof HFI_PROTOCOL_VERSION
  context: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  stateConnections?: StateConnection[]
  viewport?: ViewportState
  themes?: Record<string, ContextTheme>
  metadata?: {
    createdAt?: string
    updatedAt?: string
    author?: string
    description?: string
    version?: string
    tags?: string[]
    sourceTable?: {
      id: string
      identifier: string
    }
  }
}

// =============================================================================
// Flat JSON Types
// =============================================================================

/**
 * Flat node - simple structure with flattened attributes
 */
export interface FlatNode {
  id: string
  title: string
  content?: string
  type?: string
  [key: string]: unknown // Dynamic attributes
}

/**
 * Flat JSON export - simple array format
 */
export interface FlatJsonExport {
  version: string
  exportedAt: string
  table: {
    id: string
    identifier: string
    description?: string
  }
  nodes: FlatNode[]
}

// =============================================================================
// Export Options & Results
// =============================================================================

export type JsonExportFormat = 'flat' | 'hfi'

export interface JsonExportOptions {
  /** Export format */
  format: JsonExportFormat
  /** Include relations as branches (HFI only) */
  includeRelations?: boolean
  /** Include node positions (HFI only) */
  includePositions?: boolean
  /** Include visual themes (HFI only) */
  includeThemes?: boolean
  /** Include state connections (HFI only) */
  includeStateConnections?: boolean
  /** Pretty print JSON */
  prettyPrint?: boolean
  /** Filter by node IDs (optional) */
  nodeIds?: string[]
  /** Filter by tags (optional) */
  tags?: string[]
}

export interface JsonExportResult {
  success: boolean
  format: JsonExportFormat
  data?: FlatJsonExport | HFIProtocolExport
  json?: string
  nodeCount: number
  errors: string[]
  warnings: string[]
}

// =============================================================================
// Patch/Update Types (Format-specific mutation types)
// =============================================================================

/**
 * Flat JSON node patch - for updating individual node fields
 */
export interface FlatNodePatch {
  /** Target node ID (required for identification) */
  id: string
  /** Update title */
  title?: string
  /** Update content */
  content?: string
  /** Update dynamic attributes by key */
  attributes?: Record<string, unknown>
}

/**
 * Flat JSON batch patch request
 */
export interface FlatJsonPatchRequest {
  format: 'flat'
  tableId: string
  patches: FlatNodePatch[]
}

/**
 * HFI node patch - for updating flow nodes
 */
export interface HFINodePatch {
  /** Target node ID (required for identification) */
  id: string
  /** Update title */
  title?: string
  /** Update description (effect nodes only) */
  description?: string
  /** Update payload fields */
  payload?: PayloadFieldPatch[]
  /** Update tags */
  tags?: string[]
  /** Update position */
  position?: NodePosition
  /** Update style */
  style?: Partial<NodeStyle>
}

/**
 * Payload field patch
 */
export interface PayloadFieldPatch {
  /** Field key to update */
  key: string
  /** New value */
  value?: PayloadField['value']
  /** Update required flag */
  required?: boolean
}

/**
 * HFI branch patch - for updating query node branches
 */
export interface HFIBranchPatch {
  /** Target node ID */
  nodeId: string
  /** Branch case to update */
  case: string
  /** Update label */
  label?: string
  /** Update description */
  description?: string
  /** Update next targets */
  next?: string | string[]
  /** Update color */
  color?: string
}

/**
 * HFI relation patch - for updating relations
 */
export interface HFIRelationPatch {
  /** Add new relation */
  add?: {
    sourceNodeId: string
    targetNodeId: string
    relationTypeIdentifier: string
  }
  /** Remove existing relation */
  remove?: {
    sourceNodeId: string
    targetNodeId: string
    relationTypeIdentifier?: string
  }
}

/**
 * HFI state connection patch
 */
export interface HFIStateConnectionPatch {
  /** Add new state connection */
  add?: StateConnection
  /** Remove state connection by from/to node IDs */
  remove?: {
    from: string
    to: string
  }
}

/**
 * HFI Protocol batch patch request
 */
export interface HFIProtocolPatchRequest {
  format: 'hfi'
  context: string
  /** Node patches */
  nodes?: HFINodePatch[]
  /** Branch patches (for query nodes) */
  branches?: HFIBranchPatch[]
  /** Relation patches */
  relations?: HFIRelationPatch[]
  /** State connection patches */
  stateConnections?: HFIStateConnectionPatch[]
}

/**
 * Union type for format-specific patch requests
 */
export type JsonPatchRequest = FlatJsonPatchRequest | HFIProtocolPatchRequest

/**
 * Patch result for individual operation
 */
export interface PatchOperationResult {
  success: boolean
  targetId: string
  operation: 'update' | 'add' | 'remove'
  error?: string
}

/**
 * Batch patch result
 */
export interface JsonPatchResult {
  success: boolean
  format: JsonExportFormat
  totalOperations: number
  successCount: number
  failureCount: number
  results: PatchOperationResult[]
  errors: string[]
  warnings: string[]
}

// =============================================================================
// Type Guards
// =============================================================================

export function isPathRef(value: unknown): value is PathRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$path' in value &&
    typeof (value as PathRef).$path === 'string'
  )
}

export function isExprRef(value: unknown): value is ExprRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$expr' in value &&
    typeof (value as ExprRef).$expr === 'string'
  )
}

export function isQueryNode(node: FlowNode): node is QueryNode {
  return node.type === 'query'
}

export function isEffectNode(node: FlowNode): node is EffectNode {
  return node.type === 'effect'
}

export function isHFIProtocol(data: unknown): data is HFIProtocolExport {
  return (
    typeof data === 'object' &&
    data !== null &&
    'protocol' in data &&
    (data as HFIProtocolExport).protocol === HFI_PROTOCOL_VERSION
  )
}

export function isFlatJsonExport(data: unknown): data is FlatJsonExport {
  return (
    typeof data === 'object' &&
    data !== null &&
    'version' in data &&
    'nodes' in data &&
    Array.isArray((data as FlatJsonExport).nodes) &&
    !('protocol' in data)
  )
}

export function isFlatJsonPatchRequest(request: JsonPatchRequest): request is FlatJsonPatchRequest {
  return request.format === 'flat'
}

export function isHFIProtocolPatchRequest(
  request: JsonPatchRequest
): request is HFIProtocolPatchRequest {
  return request.format === 'hfi'
}
