/**
 * Database Backup Types
 *
 * Type definitions for file-level and table-level backup operations
 */

export interface SQLiteBackupOptions {
  /** Output file path (default: ./backups/db_{timestamp}.sqlite) */
  outputPath?: string
  /** Enable gzip compression */
  compress?: boolean
  /** Validate backup integrity after creation */
  validate?: boolean
  /** Include Write-Ahead Log (WAL) file */
  includeWAL?: boolean
  /** Create safety backup before destructive operations */
  safetyBackup?: boolean
}

export interface SQLiteBackupResult {
  /** Operation success status */
  success: boolean
  /** Path to the backup file */
  backupPath: string
  /** Backup file size in bytes */
  sizeBytes: number
  /** Operation duration in milliseconds */
  duration: number
  /** SHA-256 checksum of the backup file */
  checksum?: string
  /** List of error messages */
  errors: string[]
  /** List of warning messages */
  warnings: string[]
}

export interface SQLiteRestoreOptions {
  /** Path to the backup file to restore from */
  backupPath: string
  /** Create safety backup before restore */
  safetyBackup?: boolean
  /** Validate backup integrity before restore */
  validateBeforeRestore?: boolean
  /** Perform verification after restore */
  verifyAfterRestore?: boolean
}

export interface SQLiteRestoreResult {
  /** Operation success status */
  success: boolean
  /** Path to the restored database */
  restoredPath: string
  /** Path to safety backup (if created) */
  safetyBackupPath?: string
  /** Verification results */
  verification?: {
    tablesCount: number
    nodesCount: number
    relationsCount: number
    checksumMatch: boolean
  }
  /** Operation duration in milliseconds */
  duration: number
  /** List of error messages */
  errors: string[]
  /** List of warning messages */
  warnings: string[]
}

export interface BackupListItem {
  /** Backup file path */
  path: string
  /** File size in bytes */
  sizeBytes: number
  /** Creation timestamp */
  createdAt: Date
  /** Backup type (file or table) */
  type: 'file' | 'table'
  /** SHA-256 checksum */
  checksum?: string
  /** Table identifier (for table backups) */
  tableIdentifier?: string
  /** Node count (for table backups) */
  nodeCount?: number
  /** Compression status */
  compressed: boolean
}

export interface BackupListResult {
  /** List of file-level backups */
  fileBackups: BackupListItem[]
  /** List of table-level backups */
  tableBackups: BackupListItem[]
  /** Total number of backups */
  totalCount: number
  /** Total size in bytes */
  totalSizeBytes: number
}

export interface BackupRetentionPolicy {
  /** Maximum number of backups to keep */
  maxBackups?: number
  /** Maximum age in days */
  maxAgeDays?: number
  /** Minimum free disk space in bytes */
  minFreeSpaceBytes?: number
}

export interface IncrementalBackupOptions {
  /** Only export changes since this timestamp */
  since: Date
  /** Include deleted entities tracking */
  includeDeleted?: boolean
  /** Base backup reference */
  baseBackupPath?: string
}

export interface BackupMetrics {
  /** Total number of backups created */
  totalBackups: number
  /** Timestamp of last backup */
  lastBackupTime?: Date
  /** Average backup duration in milliseconds */
  averageBackupDuration: number
  /** Total size of all backups in bytes */
  totalBackupSize: number
  /** Success rate percentage */
  successRate: number
  /** List of recent failed backups */
  failedBackups: Array<{
    timestamp: Date
    tableIdentifier?: string
    error: string
  }>
}
