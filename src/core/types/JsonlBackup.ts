/**
 * JSONL Backup Types
 *
 * Defines types for GitHub-friendly JSONL backup/restore operations
 * - Text-based format for git diff compatibility
 * - Per-table files for granular tracking
 * - Line-by-line format for streaming and partial updates
 */

/** Schema definition for a table */
export interface JsonlSchemaEntry {
  type: 'table'
  id: string
  identifier: string
  description?: string
  createdAt: string
  updatedAt: string
  attributes: JsonlAttributeEntry[]
}

/** Attribute definition within a table schema */
export interface JsonlAttributeEntry {
  id: string
  identifier: string
  name: string
  attributeTypeId: string
  attributeType: string // e.g., "string", "integer", "boolean"
  description?: string
  isRequired: boolean
}

/** Node data entry (one line in JSONL file) */
export interface JsonlNodeEntry {
  _id: string
  _title: string
  _content: string | null
  _createdAt: string
  _updatedAt: string
  [attributeIdentifier: string]: string | number | boolean | null | undefined
}

/** Relation entry */
export interface JsonlRelationEntry {
  id: string
  fromNodeId: string | null
  toNodeId: string | null
  relationTypeId: string
  relationType: string // identifier
  strength: number
  properties?: Record<string, unknown>
  createdAt: string
}

/** Relation type definition */
export interface JsonlRelationTypeEntry {
  id: string
  identifier: string
  description?: string
  category?: string
}

/** Export options */
export interface JsonlExportOptions {
  /** Output directory path (default: ./backups/jsonl) */
  outputDir?: string
  /** Tables to export (default: all) */
  tableIds?: string[]
  /** Include relations (default: true) */
  includeRelations?: boolean
  /** Include schema file (default: true) */
  includeSchema?: boolean
  /** Pretty print JSON (default: false, for git diff use false) */
  prettyPrint?: boolean
}

/** Import options */
export interface JsonlImportOptions {
  /** Input directory path */
  inputDir: string
  /** Tables to import (default: all found) */
  tableIdentifiers?: string[]
  /** Conflict resolution strategy */
  conflictResolution: 'skip' | 'overwrite' | 'merge'
  /** Validate schema before import */
  validateSchema?: boolean
  /** Dry run - validate without importing */
  dryRun?: boolean
}

/** Export result */
export interface JsonlExportResult {
  success: boolean
  outputDir: string
  files: JsonlExportedFile[]
  stats: {
    tablesExported: number
    nodesExported: number
    relationsExported: number
    totalBytes: number
  }
  errors: string[]
  warnings: string[]
}

/** Single exported file info */
export interface JsonlExportedFile {
  path: string
  type: 'schema' | 'table' | 'relations' | 'relation-types'
  tableIdentifier?: string
  lineCount: number
  sizeBytes: number
}

/** Import result */
export interface JsonlImportResult {
  success: boolean
  inputDir: string
  stats: {
    tablesImported: number
    nodesImported: number
    nodesSkipped: number
    nodesUpdated: number
    relationsImported: number
  }
  errors: string[]
  warnings: string[]
}

/** Manifest file structure (backup metadata) */
export interface JsonlBackupManifest {
  version: '1.0'
  createdAt: string
  source: string
  tables: {
    identifier: string
    nodeCount: number
    file: string
  }[]
  hasRelations: boolean
  hasSchema: boolean
}
