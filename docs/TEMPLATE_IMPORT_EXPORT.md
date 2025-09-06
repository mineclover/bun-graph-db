# 템플릿 Import/Export 기능 사용 가이드

bun-graph-db의 템플릿 쿼리 시스템에서 제공하는 JSON 기반 Import/Export 기능에 대한 완전한 사용 가이드입니다.

## 📋 목차

1. [기능 개요](#기능-개요)
2. [Export 기능](#export-기능)
3. [Import 기능](#import-기능)
4. [GraphQL API 사용법](#graphql-api-사용법)
5. [Demo 코드 실행](#demo-코드-실행)
6. [고급 사용법](#고급-사용법)
7. [문제 해결](#문제-해결)

## 기능 개요

템플릿 Import/Export 기능은 GraphQL 쿼리 템플릿을 JSON 형태로 내보내고 가져올 수 있는 기능입니다.

### 주요 특징

- ✅ **완전한 템플릿 정보 보존**: 메타데이터, 통계, 변수 스키마 등 모든 정보 포함
- ✅ **버전 호환성**: 내보낸 템플릿의 버전 정보와 호환성 검증
- ✅ **유연한 식별**: ID 또는 식별자 문자열로 템플릿 지정 가능
- ✅ **중복 처리**: 기존 템플릿 덮어쓰기 또는 새 식별자 생성 옵션
- ✅ **통계 정보**: 사용 횟수, 실행 시간 등 선택적 통계 포함

### 지원 형식

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-09-06T00:28:51.024Z",
  "template": {
    "identifier": "my-template",
    "name": "My Template",
    "description": "Template description",
    "query": "query MyQuery { ... }",
    "queryName": "MyQuery",
    "operationType": "query",
    "variables": null,
    "variablesSchema": null,
    "defaultVariables": null,
    "applicableTables": null,
    "complexityScore": 3,
    "version": "1.0.0",
    "tags": ["general"],
    "statistics": {
      "usageCount": 5,
      "avgExecutionTimeMs": 45,
      "lastUsedAt": "2025-09-06T00:25:30.000Z"
    }
  }
}
```

## Export 기능

템플릿을 JSON 형태로 내보내는 기능입니다.

### GraphQL Mutation

```graphql
mutation ExportTemplate(
  $templateId: ID
  $templateIdentifier: String
  $includeStatistics: Boolean
) {
  exportTemplate(
    templateId: $templateId
    templateIdentifier: $templateIdentifier
    includeStatistics: $includeStatistics
  ) {
    success
    exportData
    filename
    errors {
      message
      code
    }
  }
}
```

### 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `templateId` | ID | 선택* | 내보낼 템플릿의 ID |
| `templateIdentifier` | String | 선택* | 내보낼 템플릿의 식별자 |
| `includeStatistics` | Boolean | 선택 | 통계 정보 포함 여부 (기본값: false) |

> *주의: `templateId` 또는 `templateIdentifier` 중 하나는 반드시 제공해야 합니다.

### 사용 예시

#### 1. ID로 템플릿 내보내기 (통계 포함)

```javascript
const exportResult = await client.exportTemplate({
  templateId: "123",
  includeStatistics: true
});

if (exportResult.data.exportTemplate.success) {
  const jsonData = exportResult.data.exportTemplate.exportData;
  const filename = exportResult.data.exportTemplate.filename;
  
  console.log(`템플릿 내보내기 완료: ${filename}`);
  
  // JSON 파일로 저장
  await fs.writeFile(filename, jsonData);
}
```

#### 2. 식별자로 템플릿 내보내기

```javascript
const exportResult = await client.exportTemplate({
  templateIdentifier: "my-custom-template",
  includeStatistics: false
});
```

### 응답 구조

```typescript
interface ExportTemplatePayload {
  success: boolean
  exportData: string | null    // JSON 문자열
  filename: string | null      // 제안된 파일명
  errors: Array<{
    message: string
    code: string
  }>
}
```

## Import 기능

JSON 데이터로부터 템플릿을 복원하는 기능입니다.

### GraphQL Mutation

```graphql
mutation ImportTemplate(
  $jsonData: String!
  $overwriteExisting: Boolean
  $generateNewIdentifier: Boolean
  $newIdentifierPrefix: String
) {
  importTemplate(
    jsonData: $jsonData
    overwriteExisting: $overwriteExisting
    generateNewIdentifier: $generateNewIdentifier
    newIdentifierPrefix: $newIdentifierPrefix
  ) {
    success
    template {
      id
      identifier
      name
      isActive
    }
    errors {
      message
      code
    }
    warnings
  }
}
```

### 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `jsonData` | String | ✅ | Export한 JSON 문자열 데이터 |
| `overwriteExisting` | Boolean | 선택 | 기존 템플릿 덮어쓰기 여부 (기본값: false) |
| `generateNewIdentifier` | Boolean | 선택 | 새로운 식별자 생성 여부 (기본값: false) |
| `newIdentifierPrefix` | String | 선택 | 새 식별자의 접두사 |

### 사용 예시

#### 1. 기본 템플릿 가져오기

```javascript
const jsonData = await fs.readFile('template-backup.json', 'utf8');

const importResult = await client.importTemplate({
  jsonData: jsonData
});

if (importResult.data.importTemplate.success) {
  console.log(`템플릿 가져오기 완료: ${importResult.data.importTemplate.template.identifier}`);
} else {
  console.error('가져오기 실패:', importResult.data.importTemplate.errors);
}
```

#### 2. 중복 처리 - 새 식별자 생성

```javascript
const importResult = await client.importTemplate({
  jsonData: jsonData,
  generateNewIdentifier: true,
  newIdentifierPrefix: "imported"
});

// 결과: "my-template" -> "imported-my-template-1234567890"
```

#### 3. 중복 처리 - 기존 템플릿 덮어쓰기

```javascript
const importResult = await client.importTemplate({
  jsonData: jsonData,
  overwriteExisting: true
});
```

### 응답 구조

```typescript
interface ImportTemplatePayload {
  success: boolean
  template: {
    id: string
    identifier: string
    name: string
    isActive: boolean
  } | null
  errors: Array<{
    message: string
    code: string
  }>
  warnings: string[]
}
```

## GraphQL API 사용법

### 1. GraphQL Playground에서 테스트

서버 실행 후 `http://localhost:4000/graphql`에서 직접 테스트 가능합니다.

#### Export 예시:
```graphql
mutation {
  exportTemplate(templateId: "1", includeStatistics: true) {
    success
    exportData
    filename
    errors {
      message
      code
    }
  }
}
```

#### Import 예시:
```graphql
mutation {
  importTemplate(
    jsonData: "{\"version\":\"1.0.0\",\"template\":{...}}"
    generateNewIdentifier: true
  ) {
    success
    template {
      id
      identifier
      name
    }
    warnings
  }
}
```

### 2. JavaScript/TypeScript 클라이언트

```javascript
import { GraphQLClient } from './utils/graphql-client.js';

const client = new GraphQLClient('http://localhost:4000/graphql');

// Export
const exportResult = await client.exportTemplate({
  templateIdentifier: "my-template",
  includeStatistics: true
});

// Import
const importResult = await client.importTemplate({
  jsonData: exportResult.data.exportTemplate.exportData,
  generateNewIdentifier: true
});
```

### 3. cURL을 사용한 테스트

```bash
# Export
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation($id: ID!) { exportTemplate(templateId: $id, includeStatistics: true) { success exportData filename } }",
    "variables": {"id": "1"}
  }'

# Import
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation($data: String!) { importTemplate(jsonData: $data) { success template { identifier } } }",
    "variables": {"data": "{\"version\":\"1.0.0\",...}"}
  }'
```

## Demo 코드 실행

완전한 Import/Export 데모를 실행하여 기능을 테스트할 수 있습니다.

### 1. 서버 실행

```bash
# 터미널 1: 메인 서버
bun run dev

# 터미널 2: 테스트용 서버 (선택)
PORT=4001 bun run dev
```

### 2. Demo 실행

```bash
# 기본 서버 (localhost:4000)에서 실행
bun run demo/run-import-export-demo.ts

# 다른 서버에서 실행
bun run demo/run-import-export-demo.ts --server http://localhost:4001/graphql
```

### 3. Demo 내용

데모는 다음과 같은 전체 흐름을 테스트합니다:

1. **템플릿 생성**: 테스트용 템플릿 생성
2. **Export (ID)**: 생성된 템플릿을 ID로 내보내기
3. **Export (식별자)**: 동일한 템플릿을 식별자로 내보내기
4. **Import (새 식별자)**: 내보낸 데이터를 새 식별자로 가져오기
5. **실행 테스트**: 가져온 템플릿 실행 확인
6. **중복 처리 테스트**: 다양한 중복 처리 시나리오 테스트

### 4. 예상 출력

```
🚀 서버 http://localhost:4000/graphql에 연결하여 Import/Export 데모를 실행합니다

🎯 템플릿 Import/Export 데모 시작

📝 1. 테스트용 템플릿 생성
✅ 템플릿 생성 완료: export-test-template-1757118530999 (ID: 54)

📤 2. 템플릿 내보내기 (ID로)
✅ 템플릿 내보내기 완료 (ID)
📋 파일명: export-test-template-1757118530999_2025-09-06.json
📊 내보낸 데이터 크기: 731자

📥 4. 템플릿 가져오기 (새 식별자 생성)
✅ 템플릿 가져오기 완료
📋 가져온 템플릿:
   - ID: 55
   - 식별자: imported-export-test-template-1757118530999-1234567890

🎉 Import/Export 데모 완료!
```

## 고급 사용법

### 1. 배치 Export/Import

여러 템플릿을 한번에 처리하는 예시:

```javascript
// 여러 템플릿 Export
const templateIds = ["1", "2", "3", "4"];
const exports = [];

for (const id of templateIds) {
  const result = await client.exportTemplate({
    templateId: id,
    includeStatistics: true
  });
  
  if (result.data.exportTemplate.success) {
    exports.push({
      id,
      filename: result.data.exportTemplate.filename,
      data: result.data.exportTemplate.exportData
    });
  }
}

// 배치 파일로 저장
const batchData = {
  version: "1.0.0",
  exportedAt: new Date().toISOString(),
  templates: exports.map(exp => JSON.parse(exp.data))
};

await fs.writeFile('template-batch.json', JSON.stringify(batchData, null, 2));
```

### 2. 선택적 Import

특정 조건에 맞는 템플릿만 가져오기:

```javascript
const batchData = JSON.parse(await fs.readFile('template-batch.json', 'utf8'));

for (const templateData of batchData.templates) {
  // 특정 태그를 가진 템플릿만 가져오기
  if (templateData.template.tags.includes('production')) {
    await client.importTemplate({
      jsonData: JSON.stringify(templateData),
      generateNewIdentifier: true,
      newIdentifierPrefix: 'prod'
    });
  }
}
```

### 3. 백업 및 복원 스크립트

```javascript
// backup.js
async function backupAllTemplates() {
  const templates = await client.searchTemplates({ limit: 1000 });
  const backups = [];
  
  for (const template of templates.data.searchTemplates.nodes) {
    const exportResult = await client.exportTemplate({
      templateId: template.id,
      includeStatistics: true
    });
    
    if (exportResult.data.exportTemplate.success) {
      backups.push({
        originalId: template.id,
        data: exportResult.data.exportTemplate.exportData,
        filename: exportResult.data.exportTemplate.filename
      });
    }
  }
  
  const backup = {
    createdAt: new Date().toISOString(),
    templates: backups
  };
  
  await fs.writeFile(`backup-${Date.now()}.json`, JSON.stringify(backup, null, 2));
  console.log(`${backups.length}개 템플릿 백업 완료`);
}
```

### 4. Migration 스크립트

```javascript
// migrate.js
async function migrateTemplates(fromServer, toServer) {
  const sourceClient = new GraphQLClient(fromServer);
  const targetClient = new GraphQLClient(toServer);
  
  // Source에서 모든 템플릿 Export
  const templates = await sourceClient.getAllTemplates();
  
  for (const template of templates) {
    const exportResult = await sourceClient.exportTemplate({
      templateId: template.id,
      includeStatistics: false
    });
    
    if (exportResult.data.exportTemplate.success) {
      // Target으로 Import
      await targetClient.importTemplate({
        jsonData: exportResult.data.exportTemplate.exportData,
        generateNewIdentifier: true,
        newIdentifierPrefix: 'migrated'
      });
    }
  }
}
```

## 문제 해결

### 자주 발생하는 오류

#### 1. `Template not found`
```json
{
  "success": false,
  "errors": [{"message": "Template not found", "code": "TEMPLATE_NOT_FOUND"}]
}
```
**해결책**: 올바른 템플릿 ID 또는 식별자인지 확인하세요.

#### 2. `JSON parsing error`
```json
{
  "success": false,
  "errors": [{"message": "Invalid JSON format", "code": "JSON_PARSE_ERROR"}]
}
```
**해결책**: Import할 JSON 데이터가 올바른 형식인지 확인하세요.

#### 3. `Duplicate identifier`
```json
{
  "success": false,
  "errors": [{"message": "Template with identifier already exists", "code": "DUPLICATE_IDENTIFIER"}]
}
```
**해결책**: `overwriteExisting: true` 또는 `generateNewIdentifier: true` 옵션을 사용하세요.

### 디버깅 팁

1. **서버 로그 확인**: 개발 서버에서 상세한 로그를 확인할 수 있습니다.
2. **GraphQL Playground 사용**: 브라우저에서 직접 쿼리를 테스트하세요.
3. **JSON 유효성 검사**: Import 전에 JSON 데이터가 유효한지 확인하세요.
4. **Demo 코드 참조**: `demo/template-queries/import-export-demo.ts`를 참조하세요.

### 성능 최적화

1. **통계 포함 여부 고려**: 필요하지 않다면 `includeStatistics: false`로 설정
2. **배치 처리**: 대량의 템플릿 처리 시 적절한 배치 크기 사용
3. **에러 처리**: 실패한 작업은 재시도 로직 구현

## 관련 파일

- **GraphQL Schema**: `src/presentation/graphql/schema/mutations/template-mutations.graphql`
- **Resolver**: `src/presentation/graphql/mutations/TemplateMutations.ts`
- **Use Cases**: `src/application/use-cases/templates/`
- **Domain Service**: `src/domain/services/TemplateImportExportService.ts`
- **Demo Code**: `demo/template-queries/import-export-demo.ts`
- **GraphQL Client**: `demo/utils/graphql-client.ts`

---

💡 **추가 질문이나 문제가 있다면 GitHub Issues에 문의하거나 Demo 코드를 참조하세요!**