# Template Testing Datasets

템플릿 테스트를 위한 데이터셋 관리 시스템입니다.

## 데이터셋 구조

각 데이터셋은 다음 정보를 포함합니다:

```typescript
interface TemplateDataset {
  // 데이터셋 메타데이터
  name: string                    // 데이터셋 이름
  description: string             // 데이터셋 설명
  domain: string                  // 도메인 (ecommerce, project_management 등)
  category: string                // 카테고리 (basic, advanced, edge_case 등)
  
  // 템플릿 정보
  templateSpec: {
    identifier: string            // 템플릿 식별자
    name: string                  // 템플릿 이름
    description: string           // 템플릿 설명
    query: string                 // GraphQL 쿼리
    operationType: 'query' | 'mutation' // 오퍼레이션 타입
  }
  
  // 실행 데이터
  variables?: Record<string, any> // 변수값들
  expectedResult?: {              // 예상 결과
    success: boolean
    dataShape?: Record<string, any>
    errorPatterns?: string[]
  }
  
  // 테스트 설정
  testConfig: {
    shouldExport: boolean         // 성공시 export 여부
    retryOnFailure: boolean       // 실패시 재시도 여부
    skipCreation?: boolean        // 템플릿 생성 스킵 (이미 존재하는 경우)
  }
}
```

## 디렉토리 구조

```
datasets/
├── basic/                      # 기본 쿼리 데이터셋
│   ├── health-check.json
│   ├── list-templates.json
│   └── search-nodes.json
├── advanced/                   # 고급 기능 데이터셋
│   ├── complex-queries.json
│   ├── mutations.json
│   └── relations.json
├── edge-cases/                 # 엣지 케이스 데이터셋
│   ├── error-handling.json
│   ├── large-data.json
│   └── performance.json
└── domains/                    # 도메인별 데이터셋
    ├── ecommerce.json
    ├── project-management.json
    └── knowledge-graph.json
```

## 사용법

```bash
# 특정 데이터셋으로 테스트 실행
bun run demo:test-dataset basic/health-check.json

# 디렉토리 전체 테스트
bun run demo:test-datasets basic/

# 모든 데이터셋 테스트
bun run demo:test-all-datasets
```