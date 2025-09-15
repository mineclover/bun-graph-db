# Fixed 카테고리 템플릿 Export 결과

**생성일**: 2025-09-15T15:20:50.651Z
**Fixed 템플릿 수**: 46개
**Export 성공**: 46개

## Fixed 템플릿 목록 (사용량 순)

| 파일명 | 템플릿명 | 사용횟수 | 카테고리 | 운영타입 |
|--------|----------|----------|----------|----------|
| `get-system-health-status_v1-0-0.json` | GetSystemHealthStatus | 1회 | system | QUERY |
| `create-table_v1-0-0.json` | CreateTable | 0회 | table | MUTATION |
| `test-health-check_v1-0-0.json` | HealthCheck | 0회 | system | QUERY |
| `search-templates-advanced_v1-0-0.json` | SearchTemplatesAdvanced | 0회 | general | QUERY |
| `list-tables-with-pagination_v1-0-0.json` | ListTablesWithPagination | 0회 | table | QUERY |
| `create-template-basic_v1-0-0.json` | CreateTemplate | 0회 | mutation | MUTATION |
| `bulk-data-import_v1-0-0.json` | BulkImport | 0회 | mutation | MUTATION |
| `real-time-monitoring_v1-0-0.json` | SystemMonitoring | 0회 | table | SUBSCRIPTION |
| `data-validation_v1-0-0.json` | ValidateDataIntegrity | 0회 | table | QUERY |
| `advanced-analytics_v1-0-0.json` | GraphAnalytics | 0회 | node | QUERY |
| `data-export_v1-0-0.json` | ExportData | 0회 | table | MUTATION |
| `query-optimization_v1-0-0.json` | OptimizeQueries | 0회 | table | QUERY |
| `template-lifecycle-management_v1-0-0.json` | TemplateLifecycleManagement | 0회 | relation | QUERY |
| `get-table-by-id_v1-0-0.json` | GetTableById | 0회 | table | QUERY |
| `list-tables-with-filter_v1-0-0.json` | ListTablesWithFilter | 0회 | table | QUERY |
| `get-node-by-id_v1-0-0.json` | GetNodeById | 0회 | table | QUERY |
| `search-nodes-with-filter_v1-0-0.json` | SearchNodesWithFilter | 0회 | table | QUERY |
| `get-attribute-by-id_v1-0-0.json` | GetAttributeById | 0회 | table | QUERY |
| `list-attributes-with-filter_v1-0-0.json` | ListAttributesWithFilter | 0회 | table | QUERY |
| `get-template-by-identifier_v1-0-0.json` | GetTemplateByIdentifier | 0회 | general | QUERY |
| `search-templates-with-filter_v1-0-0.json` | SearchTemplatesWithFilter | 0회 | general | QUERY |
| `create-table-with-params_v1-0-0.json` | CreateTableWithParams | 0회 | table | MUTATION |
| `update-table-with-params_v1-0-0.json` | UpdateTableWithParams | 0회 | table | MUTATION |
| `create-node-with-params_v1-0-0.json` | CreateNodeWithParams | 0회 | table | MUTATION |
| `update-node-with-params_v1-0-0.json` | UpdateNodeWithParams | 0회 | node | MUTATION |
| `delete-node-with-params_v1-0-0.json` | DeleteNodeWithParams | 0회 | node | MUTATION |
| `create-attribute-with-params_v1-0-0.json` | CreateAttributeWithParams | 0회 | table | MUTATION |
| `search-related-nodes-with-params_v1-0-0.json` | SearchRelatedNodesWithParams | 0회 | table | QUERY |
| `find-paths-between-nodes-with-params_v1-0-0.json` | FindPathsBetweenNodesWithParams | 0회 | node | QUERY |
| `create-template-with-params_v1-0-0.json` | CreateTemplateWithParams | 0회 | mutation | MUTATION |
| `update-template-with-params_v1-0-0.json` | UpdateTemplateWithParams | 0회 | mutation | MUTATION |
| `get-detailed-system-metrics_v1-0-0.json` | GetDetailedSystemMetrics | 0회 | general | QUERY |
| `bulk-create-nodes-with-params_v1-0-0.json` | BulkCreateNodesWithParams | 0회 | table | MUTATION |
| `analyze-table-relationships-with-params_v1-0-0.json` | AnalyzeTableRelationshipsWithParams | 0회 | table | QUERY |
| `generate-table-report-with-params_v1-0-0.json` | GenerateTableReportWithParams | 0회 | table | QUERY |
| `validate-data-quality-with-params_v1-0-0.json` | ValidateDataQualityWithParams | 0회 | general | QUERY |
| `analyze-query-performance-with-params_v1-0-0.json` | AnalyzeQueryPerformanceWithParams | 0회 | table | QUERY |
| `schedule-maintenance-tasks-with-params_v1-0-0.json` | ScheduleMaintenanceTasksWithParams | 0회 | table | MUTATION |
| `migrate-data-with-params_v1-0-0.json` | MigrateDataWithParams | 0회 | table | MUTATION |
| `track-changes-with-params_v1-0-0.json` | TrackChangesWithParams | 0회 | table | QUERY |
| `smart-search-with-params_v1-0-0.json` | SmartSearchWithParams | 0회 | table | QUERY |
| `create-relation-type-working_v1-0-0.json` | CreateRelationType | 0회 | mutation | MUTATION |
| `create-node-relation-working_v1-0-0.json` | CreateRelation | 0회 | table | MUTATION |
| `search-related-nodes-working_v1-0-0.json` | SearchRelatedNodes | 0회 | table | QUERY |
| `find-node-paths-working_v1-0-0.json` | FindPathsBetweenNodes | 0회 | table | QUERY |
| `get-dependency-chain-working_v1-0-0.json` | GetDependencyChain | 0회 | table | QUERY |

## 카테고리별 분포

- **table**: 29개
- **general**: 5개
- **mutation**: 5개
- **node**: 4개
- **system**: 2개
- **relation**: 1개

## 사용 방법

각 JSON 파일은 완전한 Fixed 템플릿 정보를 포함하고 있습니다:
- ✅ 완전한 GraphQL 쿼리/뮤테이션
- ✅ 변수 스키마 및 기본값
- ✅ 메타데이터 및 태그 (fixed 태그 포함)
- ✅ 사용량 통계
- ✅ Import 호환 형태

```bash
# 개별 Fixed 템플릿 import
bun run scripts/template-import.ts exported-templates/template-name.json

# 전체 Fixed 템플릿 import
bun run scripts/import-all-exported.ts
```

## Fixed 카테고리란?

Fixed 카테고리는 검증되고 안정적인 템플릿들을 의미합니다:
- 🔍 충분히 테스트된 템플릿
- ✅ 품질이 보장된 템플릿
- 🚀 프로덕션 환경에서 사용 가능한 템플릿

---
*자동 생성됨 by export-all-templates-fixed.ts*
