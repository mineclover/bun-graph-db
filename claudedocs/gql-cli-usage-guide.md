# GraphQL CLI 유틸리티 사용 가이드

## 개요
Bun Graph DB에서 제공하는 경량화된 GraphQL CLI 유틸리티로, 이스케이프 문제 없이 일관성 있게 GraphQL을 사용할 수 있습니다.

## 위치
- **스크립트 경로**: `scripts/gql`
- **실행 권한**: ✅ 설정 완료
- **설정 파일**: `.gql-config.json` (자동 생성)

## 🎯 새로운 주요 기능

### 1. **템플릿 변수 스키마 확인**
```bash
# 템플릿의 변수 정보와 사용법 확인
./scripts/gql template info table-documentation-full

# 출력 예시:
# Template: GetTableDocumentation (table-documentation-full)
# Tags: table, documentation, comprehensive
#
# Variables:
#   tableId: ID (optional)
#   identifier: String (optional)
#
# Usage Examples:
#   gql template execute table-documentation-full --tableId=1 --identifier=example
```

### 2. **프리셋 시스템 (기존 설정된 변수로 쉬운 실행)**
```bash
# 실행하면서 프리셋으로 저장
./scripts/gql template execute table-documentation-full --tableId=1 --save-preset=my-table

# 저장된 프리셋 목록 확인
./scripts/gql preset list

# 프리셋으로 간편 실행 (변수 입력 불필요!)
./scripts/gql preset run my-table
```

## 기본 명령어

### 1. 템플릿 관리
```bash
# 템플릿 목록 조회
./scripts/gql template list

# 템플릿 상세 정보 (변수 스키마) 확인
./scripts/gql template info table-documentation-full

# 템플릿 실행
./scripts/gql template execute table-documentation-full --tableId=1
```

### 2. 프리셋 관리
```bash
# 프리셋 저장하면서 실행
./scripts/gql template execute table-documentation-full --tableId=1 --save-preset=quick-table

# 프리셋 목록 확인
./scripts/gql preset list

# 프리셋 실행 (변수 재입력 불필요)
./scripts/gql preset run quick-table
```

### 3. 기본 GraphQL 쿼리
```bash
# 간단한 GraphQL 쿼리 실행
./scripts/gql query "{ healthCheck { status } }"

# 복잡한 쿼리도 가능
./scripts/gql query "{ tables { nodes { identifier description } } }"
```

## 💡 사용성 개선 비교

### 기존 curl 방식의 문제점
```bash
# 복잡한 이스케이프 필요
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"table-documentation-full\", variables: { tableId: \"1\" }) { success data } }"}'
```

### ✅ 새로운 CLI 방식의 장점

#### 1. **이스케이프 불필요**
```bash
# 간단하고 직관적
./scripts/gql template execute table-documentation-full --tableId=1
```

#### 2. **변수 스키마 확인 가능**
```bash
# 어떤 변수가 필요한지 미리 확인
./scripts/gql template info table-documentation-full
```

#### 3. **프리셋으로 더욱 간편하게**
```bash
# 한 번 저장하고
./scripts/gql template execute table-documentation-full --tableId=1 --save-preset=my-preset

# 계속 재사용
./scripts/gql preset run my-preset  # 변수 입력 불필요!
```

## 사용 예제

### 헬스 체크
```bash
./scripts/gql query "{ healthCheck { status database version } }"
```

### 테이블 목록 조회
```bash
./scripts/gql query "{ tables { nodes { identifier description } } }"
```

### 템플릿 관리
```bash
# 모든 템플릿 조회
./scripts/gql template list

# 특정 템플릿 실행
./scripts/gql template execute table-documentation-full --tableId=1
```

## 장점

### 1. ✅ 이스케이프 문제 해결
- JSON 문자열 내부의 따옴표 이스케이프 불필요
- 명령어가 훨씬 간단하고 직관적

### 2. ✅ 일관성 있는 사용법
- 모든 GraphQL 작업에 통일된 인터페이스 제공
- 변수 전달이 --key=value 형식으로 간편함

### 3. ✅ 오류 처리
- HTTP 상태 코드 확인
- GraphQL 오류 메시지 표시
- 적절한 에러 코드 반환

### 4. ✅ 포맷팅
- JSON 출력 자동 포맷팅
- 가독성 향상

## 기술적 특징

### 런타임
- **Bun**: 빠른 JavaScript 런타임
- **TypeScript**: 타입 안전성

### 아키텍처
- **GraphQLCLI 클래스**: 핵심 기능 캡슐화
- **인수 파싱**: 명령줄 옵션 처리
- **에러 처리**: 포괄적인 오류 관리

### 확장성
- 새로운 명령어 추가 용이
- 템플릿 시스템과 완전 호환
- 엔드포인트 설정 가능 (--endpoint 옵션)

## 결론

이 CLI 유틸리티는 사용자가 요청한 **"일관성있는 사용을 위해 graphql을 cli에서 일관되게 사용할 수 있는 가벼운 유틸"**을 완전히 구현했습니다.

- **문제 해결**: 이스케이프 문자 문제 완전 제거
- **사용성 개선**: 직관적이고 간편한 명령어 구조
- **일관성 확보**: 모든 GraphQL 작업에 통일된 인터페이스
- **경량화**: 단일 스크립트로 구현된 경량 유틸리티

이제 템플릿 실행 시 복잡한 이스케이프 없이 간편하게 사용할 수 있습니다.