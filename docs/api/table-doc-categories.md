# Table Documentation Categories

테이블별 문서(Doc) 시스템에서 지원하는 카테고리별 가이드라인과 사용 방법을 설명합니다.

## 📋 개요

각 테이블은 5가지 카테고리의 문서를 작성할 수 있으며, 카테고리별로 다중 버전을 지원합니다. 동일한 카테고리 내에서는 하나의 문서만 활성화(active) 상태를 가질 수 있습니다.

## 🏷️ 지원되는 Doc 카테고리

### 1. `usage` - 사용법 문서
**용도**: 테이블의 기본 사용 방법과 활용 가이드
- **권장 내용**:
  - 테이블의 주요 용도와 목적
  - 기본 CRUD 연산 방법
  - 일반적인 사용 시나리오
  - 주의사항 및 제약사항
- **예시**: "이 테이블은 사용자 정보를 저장하며, 회원가입/로그인 시스템에서 활용됩니다."

### 2. `guide` - 단계별 가이드
**용도**: 구체적이고 단계별 작업 지침
- **권장 내용**:
  - Step-by-step 튜토리얼
  - 복잡한 워크플로우 설명
  - 통합 가이드 및 설정 방법
  - 모범 사례(Best Practices)
- **예시**: "1. 사용자 생성 → 2. 권한 설정 → 3. 프로필 업데이트 → 4. 활성화"

### 3. `example` - 예제 코드/데이터
**용도**: 실제 사용 예제와 샘플 코드
- **권장 내용**:
  - 실행 가능한 코드 예제
  - 샘플 데이터 및 쿼리
  - API 호출 예제
  - GraphQL mutation/query 예제
- **예시**:
  ```graphql
  mutation CreateUser {
    createNode(input: {
      tableId: "users"
      content: "John Doe"
      title: "사용자 생성"
    }) {
      success
      node { id }
    }
  }
  ```

### 4. `spec` - 기술 사양서
**용도**: 테이블의 기술적 명세와 스키마 정보
- **권장 내용**:
  - 테이블 스키마 정의
  - 속성(Attribute) 상세 설명
  - 관계(Relation) 정의
  - 데이터 타입 및 제약조건
  - 인덱스 및 성능 고려사항
- **예시**: "users 테이블: id(integer), name(text), email(email), created_at(datetime)"

### 5. `general` - 일반 정보
**용도**: 분류하기 어려운 기타 정보나 메모
- **권장 내용**:
  - 개발 노트 및 메모
  - 변경 이력 (Change Log)
  - 알려진 이슈 및 해결 방법
  - 팀 내부 커뮤니케이션
  - 임시 메모 및 아이디어
- **예시**: "2024-01-15: 성능 최적화를 위해 인덱스 추가 필요"

## 🔄 버전 관리 시스템

### 버전 규칙
- **기본 버전**: 1부터 시작
- **증가 방식**: 정수형 순차 증가 (1, 2, 3, ...)
- **고유성**: `(table_id, category, version)` 조합이 고유해야 함

### 활성화 정책
- **카테고리별 단일 활성화**: 동일 카테고리 내에서는 하나의 문서만 활성화
- **자동 활성화**: 새 버전 생성 시 자동으로 활성화되고 기존 버전은 비활성화
- **수동 활성화**: `activateDoc` mutation으로 특정 버전을 활성화 가능

## 🛠️ 사용 예제

### 1. 문서 생성
```graphql
mutation CreateUsageDoc {
  createDoc(input: {
    tableId: "1"
    category: usage
    content: "이 테이블은 프로젝트 정보를 관리하는 테이블입니다."
  }) {
    success
    doc {
      id
      category
      version
      isActive
    }
  }
}
```

### 2. 문서 버전 업데이트
```graphql
mutation CreateNewVersion {
  createDoc(input: {
    tableId: "1"
    category: usage
    content: "업데이트된 사용법: API 키 관리 기능이 추가되었습니다."
    version: 2
  }) {
    success
    doc { id version isActive }
  }
}
```

### 3. 문서 조회
```graphql
query GetTableDocs {
  getDocs(tableId: "1") {
    docs {
      id
      category
      version
      content
      isActive
    }
    totalCount
  }
}
```

### 4. 특정 카테고리만 조회
```graphql
query GetUsageDocs {
  searchDocs(filter: {
    tableId: "1"
    category: usage
  }) {
    docs {
      id
      version
      content
      isActive
    }
  }
}
```

## 📊 카테고리별 사용 권장 사항

| 카테고리 | 권장 용도 | 업데이트 빈도 | 버전 관리 |
|---------|-----------|--------------|-----------|
| `usage` | 기본 사용법, 개요 | 낮음 | 주요 변경 시만 |
| `guide` | 단계별 튜토리얼 | 보통 | 프로세스 변경 시 |
| `example` | 코드 예제, 샘플 | 높음 | 새 기능 추가 시 |
| `spec` | 기술 명세서 | 낮음 | 스키마 변경 시만 |
| `general` | 메모, 이슈 추적 | 높음 | 자유롭게 |

## 🎯 모범 사례

### ✅ 권장사항
1. **명확한 카테고리 분류**: 각 문서는 적절한 카테고리에 배치
2. **버전 관리**: 중요한 변경사항은 새 버전으로 관리
3. **활성화 상태 관리**: 최신 버전을 활성화 상태로 유지
4. **구조화된 내용**: Markdown 형식으로 가독성 높게 작성
5. **정기적 업데이트**: 테이블 변경 시 관련 문서도 함께 업데이트

### ❌ 피해야 할 사항
1. **카테고리 오남용**: 잘못된 카테고리에 문서 작성
2. **중복 내용**: 동일한 내용을 여러 카테고리에 중복 작성
3. **outdated 문서**: 오래된 정보를 활성화 상태로 방치
4. **과도한 버전 생성**: 사소한 수정마다 새 버전 생성

## 🔍 관련 쿼리 및 뮤테이션

### 문서 관리 쿼리
- `getDocs(tableId)`: 테이블의 모든 문서 조회
- `getDoc(id)`: 특정 문서 조회
- `getActiveDoc(tableId, category)`: 특정 카테고리의 활성 문서 조회
- `getDocVersions(tableId, category)`: 특정 카테고리의 모든 버전 조회
- `searchDocs(filter)`: 필터 조건으로 문서 검색

### 문서 관리 뮤테이션
- `createDoc(input)`: 새 문서 생성
- `updateDoc(id, input)`: 문서 내용 수정
- `deleteDoc(id)`: 문서 삭제
- `activateDoc(id)`: 문서 활성화

## 📈 활용 시나리오

### 시나리오 1: 새 테이블 문서화
1. `spec` 카테고리로 테이블 스키마 정의
2. `usage` 카테고리로 기본 사용법 설명
3. `example` 카테고리로 실제 사용 예제 제공
4. `guide` 카테고리로 상세 튜토리얼 작성

### 시나리오 2: 기능 업데이트 시
1. 기존 `usage` 문서의 새 버전 생성
2. 새 기능 예제를 `example` 카테고리에 추가
3. 변경 사항을 `general` 카테고리에 기록

### 시나리오 3: 팀 협업
1. 개발자는 `spec`과 `example` 관리
2. 기획자는 `usage`와 `guide` 관리
3. QA는 `general` 카테고리에 테스트 노트 작성

이 문서 시스템을 통해 각 테이블의 목적, 사용법, 예제를 체계적으로 관리하고 팀 간 효율적인 소통을 도모할 수 있습니다.