# Backup & Restore System Architecture

**개발자를 위한 기술 설계 문서** - 백업 시스템의 아키텍처, API, 구현 세부사항

> 💡 **이 문서는 누가 읽어야 하나요?**
> - ✅ 백업 시스템을 개발/수정해야 하는 개발자
> - ✅ GraphQL/MCP API를 통해 백업 기능을 통합하려는 개발자
> - ✅ 시스템 아키텍처와 성능 최적화를 이해하고 싶은 아키텍트
>
> 📖 **실제로 백업/복원을 수행하시나요?**
> → [Backup & Restore Guide](../guides/BACKUP_RESTORE_GUIDE.md) 참고

## 📋 Overview

Complete backup and restore system for Bun Graph Database with three levels of granularity:
1. **File-Level**: Full SQLite database backup (완료 ✅)
2. **Table-Level**: Individual table backup/restore (완료 ✅)
3. **Template-Level**: Template export/import (완료 ✅)

## 🎯 Design Goals

- **Zero Downtime**: Backup operations without stopping the server
- **Data Integrity**: Transaction-safe operations with rollback capability
- **Performance**: Optimized for large datasets (100K+ nodes)
- **Portability**: Cross-platform backup files (JSON/SQL formats)
- **Automation**: CLI and MCP tools for easy integration

## 🏗️ Architecture Layers

### Layer 1: File-Level Backup (SQLite)

**Use Case**: Complete database backup for disaster recovery

```typescript
interface SQLiteBackupOptions {
  outputPath?: string           // Default: ./backups/db_{timestamp}.sqlite
  compress?: boolean            // gzip compression
  validate?: boolean            // Verify backup integrity
  includeWAL?: boolean         // Include Write-Ahead Log
}

interface SQLiteBackupResult {
  success: boolean
  backupPath: string
  sizeBytes: number
  duration: number
  checksum?: string            // SHA-256 hash
  errors: string[]
}
```

**Implementation Strategy**:
- Use SQLite `.backup` command for online backup
- Support incremental backups via WAL mode
- Compression using Bun's native compression APIs

### Layer 2: Table-Level Backup (JSON Package)

**Use Case**: Export/import individual tables with dependencies

**Current Implementation**: `TablePackageService` ✅

```typescript
interface TablePackageFormat {
  version: '1.0.0'
  exportedAt: string
  sourceTable: {
    identifier: string
    description: string
  }
  dependencies: string[]        // Dependent table identifiers
  package: {
    schema: TableSchemaExport
    dataset: TableDataExport
    relations: TableRelationsExport
    templates: TableTemplatesExport
  }
}
```

**Optimization Strategies**:
1. **Streaming Export**: For tables >10K nodes, use streaming JSON
2. **Parallel Processing**: Export attributes and relations in parallel
3. **Incremental Export**: Export only changed nodes since last backup
4. **Compression**: Automatic gzip for packages >1MB

### Layer 3: Template-Level Backup

**Current Implementation**: `TemplateImportExportService` ✅

Already optimized with version control and conflict resolution.

## 🔄 Backup Workflow

### File-Level Backup

```
1. [Trigger] User requests full DB backup
    ↓
2. [Lock] Acquire read lock (allow reads, block writes)
    ↓
3. [Backup] SQLite .backup to temporary file
    ↓
4. [Validate] Verify backup integrity (checksum)
    ↓
5. [Compress] Optional gzip compression
    ↓
6. [Move] Move to final backup location
    ↓
7. [Unlock] Release lock
    ↓
8. [Cleanup] Remove old backups (retention policy)
```

**Performance**: ~50ms per 100MB database

### Table-Level Backup

```
1. [Analyze] Resolve dependencies and export order
    ↓
2. [Export Schema] Table definition + attributes
    ↓
3. [Export Data] Nodes + node attributes (streaming for large tables)
    ↓
4. [Export Relations] Relation types + node relations
    ↓
5. [Export Templates] Associated templates
    ↓
6. [Package] Create TablePackageFormat JSON
    ↓
7. [Validate] Schema validation
    ↓
8. [Save] Write to file with versioned name
```

**Performance**: ~200ms per 10K nodes

## 🔧 Restore Workflow

### File-Level Restore

```
1. [Validate] Verify backup file integrity
    ↓
2. [Decompress] If compressed
    ↓
3. [Stop Server] Shutdown GraphQL server
    ↓
4. [Backup Current] Safety backup of current DB
    ↓
5. [Replace] Atomic file replacement
    ↓
6. [Start Server] Restart GraphQL server
    ↓
7. [Verify] Health check queries
```

**Performance**: ~100ms per 100MB database

### Table-Level Restore

```
1. [Validate Package] Schema validation
    ↓
2. [Conflict Detection] Check for existing table
    ↓
3. [Resolve Conflicts] Rename/Overwrite/Merge
    ↓
4. [Import Schema] Create table + attributes
    ↓
5. [Import Data] Bulk insert nodes + attributes
    ↓
6. [Import Relations] Create relations
    ↓
7. [Import Templates] Create templates
    ↓
8. [Verify] Integrity checks
```

**Performance**: ~300ms per 10K nodes

## 📊 GraphQL Interface

### Mutations

```graphql
# File-Level Backup
mutation BackupDatabase($options: BackupDatabaseInput) {
  backupDatabase(options: $options) {
    success
    backupPath
    sizeBytes
    duration
    checksum
    errors { message }
  }
}

# Table-Level Backup
mutation ExportTable($tableIdentifier: String!, $options: TableExportInput) {
  exportTable(tableIdentifier: $tableIdentifier, options: $options) {
    success
    exportPath
    packageFormat
    dependencyOrder
    errors
    warnings
  }
}

# Table-Level Restore
mutation ImportTable($packagePath: String!, $options: TableImportInput) {
  importTable(packagePath: $packagePath, options: $options) {
    success
    importedTable {
      id
      identifier
      originalIdentifier
    }
    generatedTemplates {
      id
      identifier
      name
    }
    resolvedConflicts {
      type
      originalName
      resolvedName
      action
    }
    errors
    warnings
  }
}

# List Backups
query ListBackups($type: BackupType) {
  listBackups(type: $type) {
    fileBackups {
      path
      sizeBytes
      createdAt
      checksum
    }
    tableBackups {
      path
      tableIdentifier
      sizeBytes
      createdAt
      nodeCount
    }
  }
}
```

### Input Types

```graphql
input BackupDatabaseInput {
  outputPath: String
  compress: Boolean
  validate: Boolean
  includeWAL: Boolean
}

input TableExportInput {
  includeData: Boolean
  includeRelations: Boolean
  includeTemplates: Boolean
  includeStatistics: Boolean
  resolveDependencies: Boolean
  compress: Boolean
}

input TableImportInput {
  conflictResolution: ConflictResolution!  # skip, rename, overwrite, merge
  newTablePrefix: String
  importData: Boolean
  importRelations: Boolean
  importTemplates: Boolean
  generateTemplates: Boolean
  validateSchema: Boolean
}

enum ConflictResolution {
  SKIP
  RENAME
  OVERWRITE
  MERGE
}
```

## 🔌 MCP Tools (Not Implemented)

> ⚠️ **참고**: 사용자 요청에 따라 백업/복원 기능은 MCP 도구로 제공하지 않습니다.
>
> **이유**: CLI 명령어가 더 직관적이고 사용하기 쉬우며, 대부분의 백업/복원 시나리오에 충분합니다.
>
> **대신 사용하세요**:
> - CLI 명령어: `bun run db:backup`, `bun run db:restore`
> - GraphQL API: `backupDatabase`, `restoreDatabase` mutations

### CLI 명령어 (권장)

```bash
# 백업 생성
bun run db:backup --compress --validate

# 백업 복원
bun run db:restore ./backups/database/db_2025-01-19.sqlite.gz

# 백업 목록
bun run db:list-backups

# 백업 정리
bun run db:cleanup --max-backups 10 --max-age-days 30

# 통계 확인
bun run db:stats
```

자세한 사용법은 [Backup & Restore Guide](../guides/BACKUP_RESTORE_GUIDE.md) 참고

## 💾 Storage Organization

```
backups/
├── database/                    # File-level backups
│   ├── db_2025-01-19_14-30-00.sqlite
│   ├── db_2025-01-19_14-30-00.sqlite.gz
│   └── checksums.json
├── tables/                      # Table-level backups
│   ├── users_v1-0-0_2025-01-19.json
│   ├── products_v1-0-0_2025-01-19.json.gz
│   └── manifest.json
└── incremental/                 # Incremental backups
    ├── users_delta_2025-01-19.json
    └── manifest.json
```

## 🎯 Performance Optimizations

### 1. Streaming Export/Import

For tables with >10K nodes:
```typescript
async function* streamTableNodes(tableId: string) {
  const batchSize = 1000
  let offset = 0

  while (true) {
    const batch = await nodeRepository.findByTableId(tableId, { offset, limit: batchSize })
    if (batch.length === 0) break

    yield batch
    offset += batchSize
  }
}
```

### 2. Parallel Processing

```typescript
const [schema, templates] = await Promise.all([
  exportTableSchema(tableId),
  exportTableTemplates(tableIdentifier)
])
```

### 3. Compression

```typescript
import { gzipSync, gunzipSync } from 'bun'

const compressed = gzipSync(JSON.stringify(tablePackage))
// 60-80% size reduction for typical data
```

### 4. Incremental Backups

Track changes with `updated_at` timestamps:
```typescript
interface IncrementalBackupOptions {
  since: Date                   // Only export changes since this date
  includeDeleted: boolean       // Track deletions
}
```

## 🔒 Security Considerations

1. **Access Control**: Backup/restore requires admin privileges
2. **Encryption**: Optional AES-256 encryption for backups
3. **Audit Trail**: Log all backup/restore operations
4. **Validation**: Checksum verification for file integrity
5. **Isolation**: Each table backup is self-contained

## 📈 Monitoring & Metrics

```typescript
interface BackupMetrics {
  totalBackups: number
  lastBackupTime: Date
  averageBackupDuration: number
  totalBackupSize: number
  successRate: number
  failedBackups: Array<{
    timestamp: Date
    tableIdentifier: string
    error: string
  }>
}
```

## 🧪 Testing Strategy

1. **Unit Tests**: Individual service methods
2. **Integration Tests**: End-to-end backup/restore workflows
3. **Performance Tests**: Large dataset handling (100K+ nodes)
4. **Failure Tests**: Rollback and error recovery
5. **Compatibility Tests**: Cross-version backup restoration

## 📋 Implementation Status

### ✅ Completed (Phase 1)
- [x] **SQLiteBackupService** - 파일 레벨 백업/복원 서비스
- [x] **GraphQL Mutations** - backupDatabase, restoreDatabase, applyRetentionPolicy
- [x] **GraphQL Queries** - listBackups, backupMetrics
- [x] **CLI Commands** - backup, restore, list-backups, cleanup, stats
- [x] **TypeScript Types** - DatabaseBackup.ts 타입 정의
- [x] **Compression** - gzip 압축/해제 지원
- [x] **Validation** - SHA-256 체크섬 검증
- [x] **Retention Policies** - 자동 백업 정리
- [x] **Metrics Tracking** - 백업 통계 및 모니터링
- [x] **Unit Tests** - backup-service.test.ts
- [x] **Documentation** - 사용자 가이드 + 아키텍처 문서
- [x] **TablePackageService** - 테이블 레벨 백업/복원 (기존)
- [x] **TemplateImportExportService** - 템플릿 import/export (기존)

### ⏭️ Not Implemented (사용자 요청에 따라 제외)
- [ ] ~~MCP tool definitions~~ - CLI로 충분, MCP 불필요
- [ ] ~~Automated backup scheduling~~ - 사용자가 필요시 수동 실행

### 🔮 Future Enhancements (Phase 2+)
- [ ] StreamingExportService - 대용량 테이블 최적화
- [ ] IncrementalBackupService - 증분 백업
- [ ] Encryption - AES-256 암호화 지원
- [ ] Cloud Storage Integration - S3, Azure Blob 연동

## 🚀 Implementation Journey

### ✅ Phase 1: Core File-Level Backup (완료)
- [x] SQLiteBackupService 구현
- [x] 백업/복원 기본 기능
- [x] GraphQL mutations/queries
- [x] CLI 명령어 (backup, restore, list-backups, cleanup, stats)
- [x] 압축 및 검증 기능
- [x] Retention policies
- [x] 메트릭 추적
- [x] 단위 테스트
- [x] 사용자 가이드 문서

**결과**: 사용자가 언제든지 수동으로 백업/복원할 수 있는 완전한 시스템

### 🔮 Phase 2: Optimizations (향후 계획)
- [ ] Streaming export/import - 대용량 테이블 최적화
- [ ] Incremental backups - 변경된 데이터만 백업
- [ ] Parallel processing - 병렬 처리로 성능 향상

### 🔮 Phase 3: Advanced Features (향후 계획)
- [ ] Encryption - 민감한 데이터 암호화
- [ ] Cloud storage integration - S3, Azure Blob 등
- [ ] Cross-region replication - 지역 간 복제

### ❌ Phase 4: Not Planned
- ~~MCP tool definitions~~ - 사용자 요청으로 제외
- ~~Automated scheduling~~ - 사용자가 필요시 수동 실행으로 충분

## 📊 Expected Performance

| Operation | Dataset Size | Duration | Notes |
|-----------|-------------|----------|-------|
| File Backup | 100MB DB | ~50ms | Using SQLite .backup |
| Table Export | 10K nodes | ~200ms | With compression |
| Table Import | 10K nodes | ~300ms | With validation |
| Streaming Export | 100K nodes | ~2s | Batched processing |
| Incremental Backup | 1K changes | ~50ms | Delta only |

## 🔗 Related Documentation

### 사용자 문서
- **[Backup & Restore Guide](../guides/BACKUP_RESTORE_GUIDE.md)** ⭐ - 백업/복원 실무 가이드 (먼저 읽으세요!)
- [Quick Start Guide](../../CLAUDE.md#quick-start) - 프로젝트 시작 가이드
- [Table Import/Export Guide](../guides/QUICK_START_IMPORT_EXPORT.md) - 테이블 패키지 가이드

### 개발자 문서
- [API Reference](../api/doc-api-reference.md) - GraphQL API 전체 문서
- [GraphQL Schema](../../src/presentation/graphql/schema/database-backup.graphql) - 백업 스키마 정의

### 구현 파일
- [SQLiteBackupService.ts](../../src/domain/services/SQLiteBackupService.ts) - 백업 서비스 구현
- [BackupCommands.ts](../../src/application/cli/commands/BackupCommands.ts) - CLI 명령어
- [DatabaseBackup.ts](../../src/core/types/DatabaseBackup.ts) - 타입 정의

---

**Version**: 1.0.0
**Last Updated**: 2025-01-19
**Status**: ✅ Phase 1 Complete - Production Ready
