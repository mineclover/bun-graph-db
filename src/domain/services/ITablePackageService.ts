import type {
  TablePackageFormat,
  TablePackageExportOptions,
  TablePackageImportOptions,
  TablePackageExportResult,
  TablePackageImportResult,
  TableDependencyInfo,
  ImportSession,
  TablePackageConflict,
} from '@/core/types/TablePackage.js'

/**
 * Domain service interface for table package export/import operations
 */
export interface ITablePackageService {
  /**
   * Export a single table as a package
   */
  exportTable(
    tableIdentifier: string,
    options?: TablePackageExportOptions
  ): Promise<TablePackageExportResult>

  /**
   * Export multiple related tables with dependency resolution
   */
  exportRelatedTables(
    tableIdentifiers: string[],
    options?: TablePackageExportOptions
  ): Promise<TablePackageExportResult[]>

  /**
   * Import a table package
   */
  importTablePackage(
    packageData: TablePackageFormat,
    options?: TablePackageImportOptions
  ): Promise<TablePackageImportResult>

  /**
   * Import multiple table packages in dependency order
   */
  importTablePackages(
    packages: TablePackageFormat[],
    options?: TablePackageImportOptions
  ): Promise<TablePackageImportResult[]>

  /**
   * Analyze table dependencies
   */
  analyzeDependencies(tableIdentifier: string): Promise<TableDependencyInfo>

  /**
   * Resolve import order for multiple tables
   */
  resolveImportOrder(tableIdentifiers: string[]): Promise<string[]>

  /**
   * Validate table package before import
   */
  validatePackage(
    packageData: TablePackageFormat,
    options?: TablePackageImportOptions
  ): Promise<TablePackageConflict[]>

  /**
   * Create an import session for tracking progress
   */
  createImportSession(packages: TablePackageFormat[]): Promise<ImportSession>

  /**
   * Get import session status
   */
  getImportSession(sessionId: string): Promise<ImportSession | null>

  /**
   * Rollback an import session
   */
  rollbackImportSession(sessionId: string): Promise<void>

  /**
   * Generate auto-templates for a table
   */
  generateTableTemplates(
    tableIdentifier: string,
    options?: {
      includeCreate?: boolean
      includeRead?: boolean
      includeUpdate?: boolean
      includeDelete?: boolean
      includeSearch?: boolean
      includeBatch?: boolean
    }
  ): Promise<{
    success: boolean
    templates: Array<{
      identifier: string
      name: string
      operationType: string
      query: string
    }>
    errors: string[]
  }>
}