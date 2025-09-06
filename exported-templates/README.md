# GraphQL Template Management System

## 📁 Directory Structure

```
exported-templates/
├── templates/              # Individual template folders
│   ├── create-table/
│   │   ├── template_v1-0-0.json  # Template definition
│   │   └── dataset.json          # Template-specific dataset
│   └── get-table/
│       ├── template_v1-0-0.json
│       └── dataset.json
├── results/                # Execution results
│   └── execution-results.json
└── docs/                   # Documentation
    └── README-TEMPLATE-DEMO.md
```

## 🎯 Overview

This is an automated GraphQL template management system for the bun-graph-db project. It provides:

- **Template Organization**: Each template has its own folder with definition and dataset
- **Version Control**: Semantic versioning for templates (v1-0-0)
- **Automated Generation**: Script-driven template creation and testing
- **1:1 Mapping**: Each template paired with its specific dataset
- **Execution Tracking**: Performance metrics and result validation

## 📋 Template Structure

### Template Definition (`template_v1-0-0.json`)
```json
{
  "version": "1.0.0",
  "exportedAt": "2025-09-06T08:00:15.365Z",
  "template": {
    "identifier": "create-table",
    "name": "Create Table",
    "description": "Create a new table with identifier",
    "query": "mutation CreateTable($input: String!) {...}",
    "variables": { "input": "example_table" },
    "variablesSchema": { /* JSON Schema validation */ },
    "tags": ["table-creation", "mutation"]
  }
}
```

### Dataset File (`dataset.json`)
```json
{
  "template": {
    "identifier": "create-table",
    "file": "template_v1-0-0.json",
    "name": "Create Table"
  },
  "execution": {
    "status": "SUCCESS",
    "executionTime": 2,
    "inputVariables": { "input": "demo_table_..." }
  },
  "resources": {
    "created": [...],
    "count": 1
  },
  "sampleInputs": [...],
  "usageExample": { /* curl and JavaScript examples */ }
}
```

## 🚀 Getting Started

### Generate Templates
```bash
# Run the automated template generation
bun run demo:template-generation

# Or run directly
bun scripts/generate-template-demo.ts
```

### Available Templates

| Template | Type | Purpose | Location |
|----------|------|---------|----------|
| create-table | mutation | Create new table | `templates/create-table/` |
| get-table | query | Retrieve table by identifier | `templates/get-table/` |

## 📊 Template Naming Convention

### File Naming
- **Templates**: `template_v{major}-{minor}-{patch}.json`
- **Datasets**: `dataset.json` (per template folder)
- **Results**: `execution-results.json`

### Folder Structure
```
templates/{operation}-{entity}/
├── template_v1-0-0.json    # Template definition
└── dataset.json             # Template dataset
```

## 🔧 Adding New Templates

1. **Update Script**: Add template definition to `TEMPLATE_DEFINITIONS` in `generate-template-demo.ts`
2. **Define Schema**: Add variable schema in `generateVariablesSchema()` function
3. **Add Samples**: Define sample inputs in `generateSampleInputsForTemplate()`
4. **Run Generation**: Execute `bun run demo:template-generation`

### Example Template Addition
```typescript
{
  identifier: 'create-node',
  name: 'Create Node',
  description: 'Create a new node in a table',
  query: `mutation CreateNode($tableId: ID!, $input: NodeInput!) {
    createNode(tableId: $tableId, input: $input) {
      success
      node { id identifier }
      errors { message }
    }
  }`,
  variables: { 
    tableId: "1",
    input: { identifier: "example_node" }
  },
  operationType: 'mutation',
  tags: ['node-creation', 'mutation']
}
```

## 📈 Performance Metrics

Each template execution tracks:
- **Execution Time**: Time to complete operation
- **Success Rate**: Percentage of successful executions
- **Resource Creation**: Entities created per template
- **Error Tracking**: Failed operations and reasons

## 🔍 Template Features

### Variables & Schema
- **Simple Variables**: `{ "input": "table_name" }` format
- **JSON Schema Validation**: Pattern matching, length limits
- **Default Values**: Pre-configured example values
- **Type Safety**: GraphQL type validation

### Usage Examples
Each template includes:
- **cURL Examples**: Direct HTTP requests
- **JavaScript Examples**: Fetch API implementation
- **Sample Inputs**: Multiple pre-configured examples
- **Error Handling**: Common error scenarios

## 📝 Script Features

The `generate-template-demo.ts` script provides:

1. **Template Management**
   - Create/Update templates in database
   - Export templates to JSON files
   - Version management

2. **Execution & Testing**
   - Execute templates with sample data
   - Collect performance metrics
   - Validate results

3. **Documentation**
   - Auto-generate README files
   - Create usage examples
   - Update folder structure

4. **Data Generation**
   - Create test datasets
   - Generate sample inputs
   - Track created resources

## 🌟 Benefits

- **Modularity**: Each template is self-contained
- **Reusability**: Templates can be shared across projects
- **Automation**: Fully automated generation and testing
- **Documentation**: Auto-generated docs stay in sync
- **Version Control**: Track template evolution
- **Performance**: Monitor and optimize execution

## 🛠️ Maintenance

### Cleanup Old Templates
```bash
# Remove outdated templates
bun run cleanup:templates

# Dry run to see what would be removed
bun run cleanup:templates-dry-run
```

### Export All Templates
```bash
# Export all templates from database
bun run export:all-templates
```

---

## 템플릿 분류

### 📊 **HIGH Priority** (사용량 50+ 회)
| 파일 | 템플릿명 | 사용횟수 | 카테고리 | 설명 |
|------|----------|----------|----------|------|
| `01-test-health-check_v1-0-0.json` | System Health Check | 161회 | system | 시스템 상태 확인 |
| `02-test-list-tables_v1-0-0.json` | List All Tables | 80회 | table | 테이블 목록 조회 |

### 🔧 **MEDIUM Priority** (사용량 10-50회)
| 파일 | 템플릿명 | 사용횟수 | 카테고리 | 설명 |
|------|----------|----------|----------|------|
| `03-test-get-table_v1-0-0.json` | Get Table Information | 32회 | table | 테이블 상세 정보 |
| `04-test-search-nodes_v1-0-0.json` | Search Nodes | 27회 | node | 노드 검색 기능 |
| `05-test-create-table_v1-0-0.json` | Create New Table | 25회 | mutation | 새 테이블 생성 |
| `06-test-get-node_v1-0-0.json` | Get Node Information | 21회 | node | 노드 기본 정보 |
| `07-test-create-node_v1-0-0.json` | Create New Node | 20회 | mutation | 새 노드 생성 |
| `08-test-full-table-info_v1-0-0.json` | Complete Table Information | 14회 | table | 테이블 종합 정보 |

### 🔍 **LOW Priority** (사용량 10회 미만)
| 파일 | 템플릿명 | 사용횟수 | 카테고리 | 설명 |
|------|----------|----------|----------|------|
| `09-test-get-node-relations_v1-0-0.json` | Get Node Relations | 9회 | relation | 노드 관계 조회 |
| `10-test-get-node-attributes_v1-0-0.json` | Get Node Attributes | 5회 | attribute | 노드 속성 조회 |

## 템플릿 구조

각 JSON 파일은 다음과 같은 표준 구조를 따릅니다:

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-09-06T06:16:XX.XXXZ",
  "template": {
    "identifier": "template-name",
    "name": "Display Name",
    "description": "템플릿 설명",
    "query": "GraphQL 쿼리 문자열",
    "operationType": "query|mutation",
    "complexityScore": 1,
    "version": "1.0.0",
    "tags": ["general"],
    "isActive": true,
    "usageStats": {
      "usageCount": 숫자,
      "priority": "HIGH|MEDIUM|LOW",
      "category": "system|table|node|mutation|relation|attribute",
      "notes": "개선 사항 또는 특이 사항"
    }
  }
}
```

## 주요 개선 포인트

### 🔧 **발견된 문제점들**
1. **스키마 일관성**: `first/after` → `limit/offset` 페이지네이션 통합 필요
2. **에러 처리**: 대부분 템플릿에 에러 핸들링 부족
3. **오분류**: 일부 mutation이 operationType: "query"로 잘못 분류됨
4. **부족한 관계 데이터**: 노드/테이블 관계 정보 부족

### 🚀 **권장 개선사항**
- Schema consistency improvements (limit/offset pagination)
- Enhanced error handling with success/errors response structure  
- Rich data inclusion (relations, attributes, node samples)
- Proper operation type classification

## 사용법

### 1. 템플릿 가져오기
```bash
# GraphQL 서버로 템플릿 가져오기
curl -X POST \
  -H "Content-Type: application/json" \
  -d @01-test-health-check_v1-0-0.json \
  http://localhost:4000/graphql/import
```

### 2. 템플릿 실행
```bash
# 템플릿 실행
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation ExecuteTemplate { 
      executeTemplate(templateIdentifier: \"test-health-check\") { 
        success result errors { message } 
      } 
    }"
  }' \
  http://localhost:4000/graphql
```

### 3. 템플릿 관리
각 템플릿의 `usageStats.notes`를 확인하여 개선 필요 사항을 파악할 수 있습니다.

## 연관 문서

- **소스 디렉토리**: `/demo/templates/` - 원본 템플릿 파일들
- **개선된 템플릿**: ID 166-170 (list-tables-improved-2025, create-table-enhanced-2025 등)
- **GraphQL 스키마**: `http://localhost:4000/schema`

---

**업데이트**: 이 컬렉션은 시스템의 템플릿 사용 통계를 기반으로 지속적으로 업데이트됩니다.