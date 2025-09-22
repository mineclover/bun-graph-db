# MCP Demo Setup Guide

이 가이드는 Bun Graph DB의 MCP (Model Context Protocol) 서버를 Claude Code와 연결하여 데모하는 방법을 설명합니다.

## 🚀 Quick Start

### 1. 서버 시작

데모용 포트 4200에서 서버를 시작합니다:

```bash
# 포트 4200에서 서버 시작
npm run dev -- --port 4200

# CLI 인수로 커스텀 데이터베이스 경로 지정
npm run dev -- --port 4200 --database-path "/tmp/demo-db/demo.sqlite"

# 또는 환경변수를 사용하여 (기존 방식)
PORT=4200 npm run dev
DATABASE_PATH="/path/to/custom/demo.sqlite" PORT=4200 npm run dev
```

#### 데이터베이스 경로 설정

서버는 CLI 인수 또는 환경변수를 통해 SQLite 데이터베이스 파일의 위치를 지정할 수 있습니다:

```bash
# 기본 경로 (지정하지 않을 경우)
./data/bun-graph-db.sqlite

# CLI 인수로 커스텀 경로 지정 (권장)
npm run dev -- --port 4200 --database-path "/tmp/demo-db/demo.sqlite"
npm run dev -- --port 4200 -d "./custom/path/mydb.sqlite"

# 환경변수로 커스텀 경로 지정 (기존 방식)
DATABASE_PATH="/tmp/demo-db/demo.sqlite" npm run dev -- --port 4200
DATABASE_PATH="./custom/path/mydb.sqlite" PORT=4200 npm run dev
```

**CLI 인수 vs 환경변수 우선순위:**
1. CLI 인수 (`--database-path`) - 최우선
2. 환경변수 (`DATABASE_PATH`) - 두번째
3. 기본 경로 (`./data/bun-graph-db.sqlite`) - 마지막

**참고사항:**
- 데이터베이스 파일이 존재하지 않으면 자동으로 생성됩니다
- 디렉토리가 존재하지 않으면 자동으로 생성됩니다
- 데모용으로는 `/tmp` 경로를 사용하면 시스템 재시작 시 자동 정리됩니다

서버가 성공적으로 시작되면 다음과 같은 메시지가 표시됩니다:

```
🚀 Bun Graph DB Server ready at http://localhost:4200/graphql
📊 GraphiQL available at http://localhost:4200/graphql
🔌 MCP Protocol available at http://localhost:4200/mcp
```

### 2. Claude MCP 연결 설정

Claude Code에서 다음 명령어로 MCP 서버를 추가합니다:

```bash
claude mcp add --transport http graphdb http://localhost:4200/mcp
```

연결이 성공하면 다음과 같은 확인 메시지가 표시됩니다:
- ✅ MCP server 'graphdb' added successfully
- 🔌 Connected to Bun Graph DB MCP Protocol

### 3. 연결 확인

Claude Code에서 다음 명령어로 연결을 테스트할 수 있습니다:

```bash
# 서버 상태 확인
claude mcp list

# MCP 도구 목록 확인
claude mcp tools graphdb
```

## 🛠️ 사용 가능한 MCP 도구

연결이 완료되면 Claude Code에서 다음 도구들을 사용할 수 있습니다:

### 시스템 관리
- `healthCheck`: 시스템 상태 확인
- `systemStats`: 시스템 통계 조회

### 테이블 관리
- `createTable`: 새 테이블 생성
- `searchTables`: 테이블 검색
- `getTables`: 테이블 목록 조회
- `getTableDocs`: 테이블 문서화 정보

### 노드 관리
- `createNode`: 새 노드 생성
- `searchNodes`: 노드 검색

### 관계 관리
- `createRelation`: 노드 간 관계 생성

### 템플릿 시스템
- `createTemplate`: 쿼리 템플릿 생성
- `executeTemplateWithGraphQL`: 템플릿 실행
- `searchTemplates`: 템플릿 검색
- `exportTemplate`: 템플릿 내보내기
- `importTemplate`: 템플릿 가져오기

### 속성 관리
- `createAttribute`: 테이블 속성 정의
- `setNodeAttribute`: 노드 속성 설정

## 📝 데모 시나리오 예시

### 1. 기본 시스템 확인
```bash
# Claude Code에서 실행
/mcp graphdb healthCheck
/mcp graphdb systemStats
```

### 2. 테이블 생성 및 관리
```bash
# 새 테이블 생성
/mcp graphdb createTable --identifier "demo_table" --description "Demo table for testing"

# 테이블 검색
/mcp graphdb searchTables --searchTerm "demo"
```

### 3. 노드 및 데이터 작업
```bash
# 노드 생성
/mcp graphdb createNode --tableId "your_table_id" --content "Sample node data"

# 노드 검색
/mcp graphdb searchNodes --tableId "your_table_id" --search "sample"
```

### 4. 템플릿 시스템 사용
```bash
# 템플릿 생성
/mcp graphdb createTemplate --identifier "demo_template" --name "Demo Template" --query "query { tables { nodes { id identifier } } }"

# 템플릿 실행
/mcp graphdb executeTemplateWithGraphQL --templateIdentifier "demo_template"
```

## 🔧 트러블슈팅

### 연결 문제
- 서버가 포트 4200에서 실행 중인지 확인
- 방화벽 설정 확인
- `curl http://localhost:4200/mcp` 로 MCP 엔드포인트 테스트

### 도구 사용 문제
- Claude Code에서 `/mcp list` 로 연결된 서버 확인
- 도구 실행 시 정확한 파라미터 형식 사용
- 서버 로그에서 에러 메시지 확인

## 🎯 데모 포인트

1. **GraphQL API와 MCP의 통합**: 같은 백엔드 로직을 두 가지 인터페이스로 제공
2. **실시간 데이터 조작**: Claude Code에서 직접 데이터베이스 작업 수행
3. **템플릿 시스템**: 복잡한 쿼리를 재사용 가능한 템플릿으로 관리
4. **타입 안전성**: TypeScript 기반의 안전한 API 호출

## 📚 추가 리소스

- [MCP 도구 전체 목록](./MCP_TOOLS_EXTENSION_REFERENCE.md)
- [API 참조 문서](../api/doc-api-reference.md)
- [GraphQL 스키마](http://localhost:4200/graphql) (서버 실행 후 접근)

---

이 설정으로 Bun Graph DB의 모든 기능을 Claude Code를 통해 직접 사용할 수 있습니다.