# MCP Server Setup Guide
## Claude AI Integration with Bun Graph Database

**Version**: 1.0.0
**Last Updated**: 2025-11-23
**MCP Protocol**: JSON-RPC 2.0

---

## 📋 목차

1. [MCP란 무엇인가?](#mcp란-무엇인가)
2. [사전 준비](#사전-준비)
3. [MCP 서버 설정](#mcp-서버-설정)
4. [Claude와 연결하기](#claude와-연결하기)
5. [MCP 도구 사용하기](#mcp-도구-사용하기)
6. [문제 해결](#문제-해결)
7. [고급 설정](#고급-설정)

---

## MCP란 무엇인가?

**MCP (Model Context Protocol)**는 AI 모델과 외부 데이터 소스를 연결하는 표준 프로토콜입니다.

### 주요 이점

- ✅ **AI 통합**: Claude AI가 데이터베이스에 직접 접근
- ✅ **자동화**: GraphQL 쿼리를 자연어로 실행
- ✅ **실시간**: 최신 데이터로 즉시 작업
- ✅ **타입 안전**: JSON Schema 검증

### 사용 사례

```
사용자: "users 테이블에서 모든 엔지니어를 찾아줘"
Claude: [MCP를 통해 searchNodes 쿼리 자동 실행]
       → 결과: John Doe, Alice Johnson, Bob Smith
```

---

## 사전 준비

### 필수 요구사항

1. **Bun Graph Database 서버 실행 중**
   ```bash
   bun run dev
   # Server: http://localhost:4141/graphql
   # MCP: http://localhost:4141/mcp
   ```

2. **Claude Desktop 또는 Claude Code 설치**
   - [Claude Desktop 다운로드](https://claude.ai/desktop)
   - 또는 VS Code에 Claude Code 설치

3. **서버 접근 가능**
   ```bash
   # 헬스 체크
   curl http://localhost:4141/graphql
   ```

---

## MCP 서버 설정

### 1. 사용 가능한 MCP 엔드포인트

Bun Graph Database는 2가지 유형의 MCP 서버를 제공합니다:

#### A. 글로벌 MCP 서버 (루트)
**URL**: `http://localhost:4141/mcp`
**용도**: 전역 템플릿 관리, 시스템 작업

**제공 기능**:
- 템플릿 생성/수정/삭제
- 템플릿 검색 및 실행
- 시스템 통계 조회
- 배치 작업

#### B. 테이블별 MCP 서버
**URL 패턴**: `http://localhost:4141/sub/{tableId}/mcp`
**용도**: 특정 테이블의 데이터 작업

**제공 기능**:
- 테이블별 노드 CRUD
- 관계 생성/조회
- 속성 관리
- 테이블별 검색

### 2. MCP 엔드포인트 확인

```bash
# 글로벌 MCP 서버 테스트
curl -X POST http://localhost:4141/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# 테이블별 MCP 서버 테스트 (예: tableId=1)
curl -X POST http://localhost:4141/sub/1/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

---

## Claude와 연결하기

### 방법 1: Claude Desktop (권장)

#### 1단계: 설정 파일 찾기

**macOS**:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows**:
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux**:
```bash
~/.config/Claude/claude_desktop_config.json
```

#### 2단계: MCP 서버 추가

파일이 없으면 생성하고, 다음 내용을 추가:

```json
{
  "mcpServers": {
    "bun-graph-root": {
      "type": "http",
      "url": "http://localhost:4141/mcp",
      "description": "Bun Graph DB - Global template management"
    },
    "my-users-table": {
      "type": "http",
      "url": "http://localhost:4141/sub/1/mcp",
      "description": "Users table operations"
    },
    "my-projects-table": {
      "type": "http",
      "url": "http://localhost:4141/sub/2/mcp",
      "description": "Projects table operations"
    }
  }
}
```

#### 3단계: Claude Desktop 재시작

설정 후 Claude Desktop을 완전히 종료하고 다시 시작합니다.

#### 4단계: 연결 확인

Claude Desktop에서:
```
"MCP 서버가 연결되었나요?"
```

Claude가 연결된 MCP 서버 목록을 표시합니다.

### 방법 2: Claude CLI

```bash
# 글로벌 MCP 서버 추가
claude mcp add --transport http bun-graph-root http://localhost:4141/mcp

# 테이블별 MCP 서버 추가
claude mcp add --transport http my-users-table http://localhost:4141/sub/1/mcp

# 연결 확인
claude mcp list
```

### 방법 3: Claude Code (VS Code)

VS Code의 Claude Code 확장 프로그램 설정:

```json
// settings.json
{
  "claude.mcpServers": {
    "bun-graph-root": {
      "type": "http",
      "url": "http://localhost:4141/mcp"
    }
  }
}
```

---

## MCP 도구 사용하기

### 기본 사용법

Claude와 대화하면서 자연어로 데이터베이스 작업을 요청합니다.

#### 예제 1: 데이터 조회

**사용자**:
```
"users 테이블의 모든 노드를 보여줘"
```

**Claude의 동작**:
1. MCP 도구 `searchNodes` 자동 선택
2. 파라미터 구성: `{ tableId: "1", limit: 100 }`
3. MCP 호출 실행
4. 결과를 자연어로 정리하여 표시

#### 예제 2: 데이터 생성

**사용자**:
```
"users 테이블에 '홍길동'이라는 새 노드를 만들어줘"
```

**Claude의 동작**:
1. MCP 도구 `createNode` 선택
2. 파라미터: `{ tableId: "1", title: "홍길동" }`
3. 노드 생성 실행
4. 생성된 노드 ID와 정보 반환

#### 예제 3: 템플릿 실행

**사용자**:
```
"create-user 템플릿을 사용해서 'Jane Doe'를 추가해줘"
```

**Claude의 동작**:
1. MCP 도구 `executeTemplate` 선택
2. 템플릿 식별자와 변수 설정
3. 템플릿 실행
4. 결과 확인 및 보고

### 사용 가능한 MCP 도구

#### 글로벌 MCP 서버 도구

| 도구 이름 | 설명 | 사용 예 |
|----------|------|---------|
| `createTemplate` | 새 템플릿 생성 | "쿼리 템플릿 만들어줘" |
| `searchTemplates` | 템플릿 검색 | "user 관련 템플릿 찾아줘" |
| `executeTemplate` | 템플릿 실행 | "템플릿 실행해줘" |
| `getSystemStats` | 시스템 통계 | "시스템 상태 보여줘" |
| `bulkImportTemplates` | 템플릿 일괄 가져오기 | "템플릿 전부 가져와줘" |

#### 테이블 MCP 서버 도구

| 도구 이름 | 설명 | 사용 예 |
|----------|------|---------|
| `createNode` | 노드 생성 | "새 사용자 추가해줘" |
| `searchNodes` | 노드 검색 | "엔지니어 찾아줘" |
| `updateNode` | 노드 수정 | "이름 변경해줘" |
| `deleteNode` | 노드 삭제 | "이 노드 삭제해줘" |
| `createRelation` | 관계 생성 | "A와 B를 연결해줘" |
| `getConnectedNodes` | 연결된 노드 조회 | "친구들 보여줘" |

### 실전 시나리오

#### 시나리오 1: 지식 그래프 구축

```
사용자: "새 프로젝트 테이블 만들고, 3개의 프로젝트를 추가해줘"

Claude: [MCP를 통해 자동 실행]
1. createTable (identifier: "projects")
2. createNode (title: "Project Alpha")
3. createNode (title: "Project Beta")
4. createNode (title: "Project Gamma")

→ 완료: 테이블 ID 5, 노드 3개 생성됨
```

#### 시나리오 2: 데이터 분석

```
사용자: "users 테이블에서 'engineer' 검색하고, 결과를 요약해줘"

Claude: [MCP 호출]
searchNodes(tableId: "1", textSearch: "engineer")

→ 결과: 5명의 엔지니어 발견
   - Senior: 2명
   - Junior: 3명
```

#### 시나리오 3: 관계 탐색

```
사용자: "John Doe와 연결된 모든 사람을 보여줘"

Claude: [MCP 호출]
node(id: "1") {
  connectedNodes(depth: 2)
}

→ 결과: 직접 연결 3명, 2단계 연결 7명
```

---

## 문제 해결

### 문제 1: MCP 서버에 연결할 수 없음

**증상**:
```
Error: Cannot connect to MCP server at http://localhost:4141/mcp
```

**해결 방법**:
```bash
# 1. 서버 실행 확인
ps aux | grep bun

# 2. 포트 확인
lsof -i :4141

# 3. 서버 재시작
pkill -f "bun.*dev"
bun run dev

# 4. MCP 엔드포인트 테스트
curl http://localhost:4141/mcp
```

### 문제 2: Claude가 MCP 도구를 찾지 못함

**증상**:
```
Claude: "죄송합니다. 해당 작업을 수행할 수 있는 도구가 없습니다."
```

**해결 방법**:

1. **설정 파일 확인**:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **올바른 형식 확인**:
   ```json
   {
     "mcpServers": {
       "bun-graph-root": {
         "type": "http",
         "url": "http://localhost:4141/mcp"
       }
     }
   }
   ```

3. **Claude 재시작**: 완전히 종료 후 재시작

4. **도구 목록 확인**:
   ```bash
   curl -X POST http://localhost:4141/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

### 문제 3: 권한 오류

**증상**:
```
Error: Access denied to MCP endpoint
```

**해결 방법**:

1. **로컬 호스트 확인**: MCP는 localhost에서만 작동
2. **CORS 설정**: 브라우저에서 접근 시 필요
3. **포트 변경**: 방화벽 확인

### 문제 4: 테이블 ID를 모름

**해결 방법**:

Claude에게 물어보기:
```
"모든 테이블 목록과 ID를 보여줘"
```

또는 GraphQL로 직접 조회:
```graphql
query {
  tables {
    nodes {
      id
      identifier
      description
    }
  }
}
```

---

## 고급 설정

### 1. 여러 테이블 MCP 서버 설정

```json
{
  "mcpServers": {
    "bun-graph-root": {
      "type": "http",
      "url": "http://localhost:4141/mcp"
    },
    "users": {
      "type": "http",
      "url": "http://localhost:4141/sub/1/mcp"
    },
    "projects": {
      "type": "http",
      "url": "http://localhost:4141/sub/2/mcp"
    },
    "tasks": {
      "type": "http",
      "url": "http://localhost:4141/sub/3/mcp"
    }
  }
}
```

### 2. 환경별 설정

**개발 환경**:
```json
{
  "mcpServers": {
    "dev-graph": {
      "type": "http",
      "url": "http://localhost:4141/mcp"
    }
  }
}
```

**프로덕션 환경**:
```json
{
  "mcpServers": {
    "prod-graph": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

### 3. 보안 설정 (프로덕션)

프로덕션 환경에서는 인증 토큰 추가:

```json
{
  "mcpServers": {
    "secure-graph": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### 4. MCP 도구 커스터마이징

특정 도구만 활성화하려면 서버 코드에서 설정:

```typescript
// src/presentation/mcp/routes/mcp-routes.ts
const allowedTools = [
  'createNode',
  'searchNodes',
  'createRelation'
];
```

---

## 부록

### A. 설정 파일 템플릿

**최소 설정**:
```json
{
  "mcpServers": {
    "bun-graph": {
      "type": "http",
      "url": "http://localhost:4141/mcp"
    }
  }
}
```

**완전 설정**:
```json
{
  "mcpServers": {
    "bun-graph-root": {
      "type": "http",
      "url": "http://localhost:4141/mcp",
      "description": "Global template and system management"
    },
    "users-table": {
      "type": "http",
      "url": "http://localhost:4141/sub/1/mcp",
      "description": "User profiles and authentication"
    },
    "projects-table": {
      "type": "http",
      "url": "http://localhost:4141/sub/2/mcp",
      "description": "Project management and tracking"
    }
  }
}
```

### B. 유용한 Claude 명령어

```
# MCP 서버 상태 확인
"MCP 서버 목록을 보여줘"

# 사용 가능한 도구 확인
"사용할 수 있는 MCP 도구를 모두 나열해줘"

# 테이블 탐색
"어떤 테이블들이 있는지 보여줘"

# 도움말
"users 테이블로 무엇을 할 수 있는지 설명해줘"
```

### C. MCP vs GraphQL 비교

| 항목 | MCP | GraphQL |
|------|-----|---------|
| 사용 방법 | 자연어 (Claude) | 쿼리 언어 |
| 진입 장벽 | 낮음 | 중간 |
| 유연성 | 제한적 | 높음 |
| 자동화 | 높음 | 낮음 |
| 적합한 사용자 | 비개발자, AI 활용 | 개발자 |

---

## 다음 단계

### 학습 자료
- **[MCP System Architecture](../mcp/MCP_SYSTEM_ARCHITECTURE.md)** - 기술적 세부사항
- **[MCP API Reference](../api/MCP_API_REFERENCE.md)** - API 문서
- **[GraphQL API Guide](./GETTING_STARTED.md)** - GraphQL 사용법

### 실습 과제

1. **기본**: Claude로 테이블 생성 및 노드 추가
2. **중급**: 관계 생성 및 그래프 탐색
3. **고급**: 템플릿 생성 및 배치 작업

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-11-23
**작성자**: Bun Graph DB Team

**피드백**: GitHub Issues에 문의사항을 남겨주세요.
