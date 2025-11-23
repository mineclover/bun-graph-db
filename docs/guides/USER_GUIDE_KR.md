# Bun Graph Database 사용자 가이드

**버전**: 1.0.0
**최종 업데이트**: 2025-11-23
**테스트 커버리지**: 100% (60/60 기능 작동)

---

## 📋 목차

1. [시작하기 전에](#시작하기-전에)
2. [설치하기](#설치하기)
3. [서버 실행](#서버-실행)
4. [기본 사용법](#기본-사용법)
5. [GraphQL 쿼리 예제](#graphql-쿼리-예제)
6. [문제 해결](#문제-해결)
7. [다음 단계](#다음-단계)

---

## 시작하기 전에

### 시스템 요구사항

#### 필수 요구사항
- **Bun**: 1.0.0 이상 ([설치 방법](https://bun.sh))
- **운영체제**: Linux, macOS, WSL2 (Windows)
- **메모리**: 512MB 이상
- **디스크**: 100MB 이상의 여유 공간

#### 선택 사항
- **Node.js**: 18.0.0 이상 (호환성 확인용)
- **Git**: 버전 관리용
- **GraphQL 클라이언트**: Postman, Insomnia, 또는 curl

### Bun 설치 확인

```bash
# Bun 설치 여부 확인
bun --version

# 설치되지 않은 경우
curl -fsSL https://bun.sh/install | bash

# 설치 후 버전 확인
bun --version  # 1.0.0 이상이어야 함
```

---

## 설치하기

### 1. 저장소 복제

```bash
# Git을 이용한 복제
git clone https://github.com/your-username/bun-graph-db.git
cd bun-graph-db

# 또는 ZIP 다운로드 후 압축 해제
# https://github.com/your-username/bun-graph-db/archive/refs/heads/main.zip
```

### 2. 의존성 설치

```bash
# Bun을 이용한 패키지 설치
bun install

# 설치 확인 (node_modules 디렉토리 생성됨)
ls -la node_modules
```

**설치 시간**: 약 30초 ~ 1분

### 3. 데이터베이스 초기화

```bash
# 데이터 디렉토리 생성 (자동)
# 서버 첫 실행 시 자동으로 생성됩니다
```

**데이터베이스 위치**: `./data/bun-graph-db.sqlite`

---

## 서버 실행

### 기본 실행

```bash
# 개발 서버 시작
bun run dev

# 출력 예시:
# 🚀 Bun Graph DB Server ready at http://localhost:4141/graphql
# 📊 GraphiQL available at http://localhost:4141/graphql
# 🔌 MCP Protocol available at http://localhost:4141/mcp
```

### 포트 변경하기

```bash
# 사용자 지정 포트로 실행
bun run dev --port 3000

# 확인
# Server ready at http://localhost:3000/graphql
```

### 서버 상태 확인

```bash
# 1. 브라우저에서 확인
# http://localhost:4141/graphql 접속

# 2. curl을 이용한 헬스 체크
curl -X POST http://localhost:4141/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { healthCheck { status database version } }"}'

# 예상 출력:
# {"data":{"healthCheck":{"status":"healthy","database":"connected","version":"1.0.0"}}}
```

### 서버 종료

```bash
# Ctrl + C 또는 Cmd + C
# 또는 백그라운드 실행 중인 경우:
pkill -f "bun.*dev"
```

---

## 기본 사용법

### 1. GraphQL Playground 접속

**브라우저에서 접속**:
```
http://localhost:4141/graphql
```

**GraphQL Playground 화면**:
- 왼쪽: 쿼리 입력 영역
- 오른쪽: 결과 표시 영역
- 상단: 실행 버튼 (▶)
- 우측: Schema 탭 (스키마 확인)

### 2. 첫 번째 쿼리 실행

**헬스 체크 쿼리**:
```graphql
query {
  healthCheck {
    status
    database
    version
  }
}
```

**실행 방법**:
1. 위 쿼리를 왼쪽 영역에 복사
2. 실행 버튼(▶) 클릭
3. 오른쪽에서 결과 확인

**예상 결과**:
```json
{
  "data": {
    "healthCheck": {
      "status": "healthy",
      "database": "connected",
      "version": "1.0.0"
    }
  }
}
```

### 3. 테이블 생성하기

**쿼리**:
```graphql
mutation {
  createTable(input: {
    identifier: "my-first-table"
    description: "내 첫 번째 테이블"
  }) {
    success
    table {
      id
      identifier
      description
    }
    errors {
      message
    }
  }
}
```

**결과**:
```json
{
  "data": {
    "createTable": {
      "success": true,
      "table": {
        "id": "1",
        "identifier": "my-first-table",
        "description": "내 첫 번째 테이블"
      },
      "errors": []
    }
  }
}
```

### 4. 노드(데이터) 생성하기

**테이블 ID 확인 후**:
```graphql
mutation {
  createNode(input: {
    tableId: "1"
    title: "첫 번째 노드"
    content: "안녕하세요, Bun Graph DB입니다!"
  }) {
    success
    node {
      id
      title
      content
      createdAt
    }
  }
}
```

### 5. 데이터 조회하기

**모든 테이블 조회**:
```graphql
query {
  tables {
    nodes {
      id
      identifier
      description
      nodeCount
      createdAt
    }
  }
}
```

**특정 테이블의 노드 조회**:
```graphql
query {
  table(id: "1") {
    id
    identifier
    tableNodes {
      nodes {
        id
        title
        content
      }
    }
  }
}
```

---

## GraphQL 쿼리 예제

### 기본 CRUD 작업

#### 1. Create (생성)

**테이블 생성**:
```graphql
mutation CreateTable {
  createTable(input: {
    identifier: "users"
    description: "사용자 테이블"
  }) {
    success
    table {
      id
      identifier
    }
  }
}
```

**노드 생성**:
```graphql
mutation CreateNode {
  createNode(input: {
    tableId: "1"
    title: "홍길동"
    content: "소프트웨어 엔지니어"
  }) {
    success
    node {
      id
      title
    }
  }
}
```

#### 2. Read (조회)

**단일 노드 조회**:
```graphql
query GetNode {
  node(id: "1") {
    id
    title
    content
    createdAt
    updatedAt
  }
}
```

**검색**:
```graphql
query SearchNodes {
  searchNodes(
    tableId: "1"
    searchQuery: {
      textSearch: "엔지니어"
      limit: 10
    }
  ) {
    nodes {
      node {
        id
        title
        content
      }
    }
    totalCount
  }
}
```

#### 3. Update (수정)

**노드 업데이트**:
```graphql
mutation UpdateNode {
  updateNode(input: {
    id: "1"
    title: "홍길동 (수정됨)"
    content: "시니어 소프트웨어 엔지니어"
  }) {
    success
    node {
      id
      title
      content
      updatedAt
    }
  }
}
```

#### 4. Delete (삭제)

**노드 삭제**:
```graphql
mutation DeleteNode {
  deleteNode(id: "1") {
    success
    message
  }
}
```

### 고급 기능

#### 관계(Relation) 생성

**1. 관계 타입 생성**:
```graphql
mutation CreateRelationType {
  createRelationType(input: {
    identifier: "knows"
    description: "알고 있는 관계"
  }) {
    success
    relationType {
      id
      identifier
    }
  }
}
```

**2. 노드 간 관계 생성**:
```graphql
mutation CreateRelation {
  createRelation(input: {
    fromNodeId: "1"
    toNodeId: "2"
    relationshipType: "knows"
    strength: 3
    confidence: 4
  }) {
    success
    relation {
      id
      sourceNode { title }
      targetNode { title }
    }
  }
}
```

#### 그래프 탐색

**연결된 노드 찾기**:
```graphql
query FindConnected {
  node(id: "1") {
    id
    title
    connectedNodes(depth: 2, direction: BOTH) {
      id
      title
      content
    }
  }
}
```

**최단 경로 찾기**:
```graphql
query ShortestPath {
  node(id: "1") {
    title
    shortestPath(targetNodeId: "5", maxDepth: 10) {
      id
      title
    }
  }
}
```

#### 템플릿 시스템

**1. 템플릿 생성**:
```graphql
mutation CreateTemplate {
  createTemplate(input: {
    identifier: "create-user-v1"
    name: "사용자 생성 템플릿"
    query: """
      mutation CreateUser($name: String!, $role: String!) {
        createNode(input: {
          tableId: "1"
          title: $name
          content: $role
        }) {
          success
          node { id title }
        }
      }
    """
    tags: ["user", "create"]
  }) {
    success
    template {
      id
      identifier
    }
  }
}
```

**2. 템플릿 실행**:
```graphql
mutation ExecuteUserTemplate {
  executeTemplateWithGraphQL(
    templateIdentifier: "create-user-v1"
    variables: {
      name: "김철수"
      role: "프로젝트 매니저"
    }
  ) {
    success
    data
    errors { message }
  }
}
```

---

## 문제 해결

### 자주 발생하는 문제

#### 1. 서버가 시작되지 않음

**증상**:
```
Error: Port 4141 already in use
```

**해결 방법**:
```bash
# 포트를 사용 중인 프로세스 확인
lsof -i :4141

# 프로세스 종료
kill -9 <PID>

# 또는 다른 포트 사용
bun run dev --port 3000
```

#### 2. 데이터베이스 연결 오류

**증상**:
```
Database connection failed
```

**해결 방법**:
```bash
# 데이터 디렉토리 확인
ls -la ./data

# 권한 확인
chmod 755 ./data
chmod 644 ./data/bun-graph-db.sqlite

# 데이터베이스 재생성 (주의: 데이터 삭제됨)
rm ./data/bun-graph-db.sqlite
bun run dev  # 자동으로 새로 생성됨
```

#### 3. GraphQL 쿼리 오류

**증상**:
```json
{
  "errors": [
    {
      "message": "Cannot query field 'xxx' on type 'Query'"
    }
  ]
}
```

**해결 방법**:
1. GraphQL Playground의 Schema 탭에서 사용 가능한 필드 확인
2. 필드 이름 철자 확인
3. 필수 인자가 모두 제공되었는지 확인

#### 4. 메모리 부족

**증상**:
```
JavaScript heap out of memory
```

**해결 방법**:
```bash
# Bun 메모리 제한 증가
NODE_OPTIONS="--max-old-space-size=4096" bun run dev
```

### 로그 확인

**서버 로그**:
- 서버 실행 중인 터미널에서 실시간 확인
- 중요한 정보는 `[INFO]`, 오류는 `[ERROR]` 태그로 표시

**디버깅 모드**:
```bash
# 상세 로그 활성화
DEBUG=* bun run dev
```

### 성능 문제

**느린 쿼리 최적화**:
1. 필요한 필드만 선택
2. `limit` 파라미터 사용
3. 인덱스 확인 (대용량 데이터의 경우)

**예시**:
```graphql
# ❌ 비효율적
query {
  tables {
    nodes {
      # 모든 필드와 관계를 가져옴
      ...
      tableNodes {
        nodes {
          ...  # 수천 개의 노드
        }
      }
    }
  }
}

# ✅ 효율적
query {
  tables {
    nodes {
      id
      identifier
      nodeCount  # 개수만 확인
    }
  }
}
```

---

## 다음 단계

### 학습 자료

1. **API 문서**: [docs/api/doc-api-reference.md](../../api/doc-api-reference.md)
2. **템플릿 가이드**: [docs/templates/template-system-guide.md](../../templates/template-system-guide.md)
3. **테스트 커버리지 보고서**: [claudedocs/test-coverage-report.md](../../claudedocs/test-coverage-report.md)

### 추가 기능 탐색

#### 1. MCP 프로토콜 통합
```bash
# MCP 엔드포인트
http://localhost:4141/mcp

# Claude AI와 통합하여 사용 가능
```

#### 2. 스키마 내보내기/가져오기
```graphql
# 테이블 스키마 내보내기
query ExportTable {
  exportTable(tableId: "1") {
    success
    package {
      table { identifier }
      attributes { identifier name }
    }
  }
}
```

#### 3. 배치 작업
```graphql
# 여러 노드 한 번에 생성
mutation BatchCreate {
  # 템플릿을 사용한 배치 작업
  executeTemplateWithGraphQL(
    templateIdentifier: "batch-create-users"
    variables: { users: [...] }
  ) {
    success
  }
}
```

### 프로덕션 배포

**준비 사항**:
1. ✅ 환경 변수 설정
2. ✅ 데이터베이스 백업 계획
3. ✅ 모니터링 설정
4. ✅ 보안 설정 (방화벽, 인증)

**권장 사항**:
- HTTPS 사용
- 정기적인 백업
- 로그 모니터링
- 성능 측정

---

## 도움말 및 지원

### 커뮤니티

- **GitHub Issues**: 버그 리포트 및 기능 요청
- **Discussions**: 질문 및 토론

### 문서

- **CLAUDE.md**: 프로젝트 개요 및 주요 기능
- **docs/**: 상세 문서
- **claudedocs/**: 개발 관련 문서

### 버전 정보

```graphql
query {
  healthCheck {
    version  # 현재 버전 확인
  }
}
```

---

## 부록

### 유용한 GraphQL 쿼리 모음

**시스템 통계**:
```graphql
query SystemStats {
  systemStats {
    memory {
      used
      total
      percentage
    }
    process {
      pid
      cpu
      platform
    }
  }
}
```

**모든 테이블 목록**:
```graphql
query AllTables {
  tables {
    nodes {
      id
      identifier
      description
      nodeCount
      attributeCount
    }
    totalCount
  }
}
```

**템플릿 검색**:
```graphql
query FindTemplates {
  searchTemplates {
    templates {
      identifier
      name
      tags
      usageCount
    }
  }
}
```

### 단축키 (GraphQL Playground)

- `Ctrl/Cmd + Enter`: 쿼리 실행
- `Ctrl/Cmd + Space`: 자동완성
- `Ctrl/Cmd + Shift + P`: Prettier 포맷팅
- `Ctrl/Cmd + F`: 검색

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-11-23
**작성자**: Bun Graph DB Team

**피드백**: 이 가이드에 대한 의견이나 개선 사항이 있으시면 GitHub Issues에 남겨주세요.
