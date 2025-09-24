# Table Documentation System Usage Guide

## 개요
테이블 정보 종합 수집 시스템이 성공적으로 구현되었습니다. 이 시스템은 지정된 테이블의 모든 관련 정보를 수집하여 제공합니다.

## 기능
- **문서 수집**: 카테고리별 문서 (usage, guide, example, spec, general)
- **속성 정보**: 테이블의 모든 속성과 메타데이터
- **템플릿 정보**: 해당 테이블 전용 템플릿
- **사용 통계**: 노드 수, 활동 정보
- **자동 생성 문서**: 사용 예제, 모범 사례

## GraphQL 쿼리 예제

### 기본 쿼리
```graphql
query {
  tableDocumentation(tableId: "1") {
    table {
      id
      identifier
      description
    }
    docs {
      docCount
      allDocs {
        id
        category
        content
        isActive
      }
    }
  }
}
```

### 완전한 쿼리 (모든 옵션 포함)
```graphql
query {
  tableDocumentation(
    tableId: "1",
    includeDocs: true,
    includeSampleNodes: true,
    includeRelatedTemplates: true,
    includeUsageStats: true
  ) {
    table {
      id
      identifier
      description
      attributeCount
      tableNodeCount
    }
    docs {
      usage { id category content isActive }
      guide { id category content isActive }
      example { id category content isActive }
      spec { id category content isActive }
      general { id category content isActive }
      allDocs { id category content isActive }
      docCount
    }
    schema {
      attributeCount
      attributes {
        id
        identifier
        name
        description
      }
    }
    sampleNodes {
      id
      content
    }
    relatedTemplates {
      id
      identifier
      name
    }
    usageStats {
      totalNodes
    }
    documentation {
      description
      usageExamples
      bestPractices
    }
    generatedAt
  }
}
```

## cURL 명령어 예제
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { tableDocumentation(tableId: \"1\", includeDocs: true, includeSampleNodes: true, includeRelatedTemplates: true, includeUsageStats: true) { table { id identifier description attributeCount tableNodeCount } docs { usage { id category content isActive } guide { id category content isActive } example { id category content isActive } spec { id category content isActive } general { id category content isActive } allDocs { id category content isActive } docCount } schema { attributeCount attributes { id identifier name description } } sampleNodes { id content } relatedTemplates { id identifier name } usageStats { totalNodes } documentation { description usageExamples bestPractices } generatedAt } }"}'
```

## 출력 구조

### 성공적인 응답 구조
```json
{
  "data": {
    "tableDocumentation": {
      "table": { /* 테이블 기본 정보 */ },
      "docs": { /* 카테고리별 문서 */ },
      "schema": { /* 속성 정보 */ },
      "sampleNodes": [ /* 샘플 노드 */ ],
      "relatedTemplates": [ /* 관련 템플릿 */ ],
      "usageStats": { /* 사용 통계 */ },
      "documentation": { /* 자동 생성 문서 */ },
      "generatedAt": "2025-09-24T05:52:55.595Z"
    }
  }
}
```

## 파라미터 설명
- `tableId` (필수): 조회할 테이블 ID
- `identifier` (선택): 테이블 식별자로도 조회 가능
- `includeDocs`: 문서 포함 여부 (기본값: true)
- `includeSampleNodes`: 샘플 노드 포함 여부 (기본값: false)
- `includeRelatedTemplates`: 관련 템플릿 포함 여부 (기본값: false)
- `includeUsageStats`: 사용 통계 포함 여부 (기본값: false)
- `sampleLimit`: 샘플 노드 개수 제한 (기본값: 3)

## 해결된 이슈
1. ✅ AttributeDto에 `name` 필드 추가
2. ✅ GraphQL 스키마와 DTO 매핑 일치
3. ✅ 문서 카테고리별 정리 기능
4. ✅ 종합적인 테이블 정보 수집

## 사용 시나리오
1. **테이블 분석**: 특정 테이블의 전체 구조 파악
2. **문서 관리**: 테이블별 문서화 상태 확인
3. **스키마 검토**: 속성 정보와 메타데이터 확인
4. **사용량 모니터링**: 테이블 활용도 분석

## 다음 단계
- 템플릿 데이터 추가하여 관련 템플릿 기능 테스트
- 샘플 노드 추가하여 sampleNodes 기능 테스트
- 추가 문서 카테고리 (example, spec, general) 테스트