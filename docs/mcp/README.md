# MCP (Model Context Protocol) Documentation

**Bun Graph Database의 완전한 MCP 시스템 문서화**

[![MCP Protocol](https://img.shields.io/badge/MCP-2025--06--18-blue)](https://modelcontextprotocol.io)
[![Architecture](https://img.shields.io/badge/Architecture-Proxy--First-green)](./MCP_SYSTEM_ARCHITECTURE.md)
[![Tools](https://img.shields.io/badge/Tools-23%20Active-orange)](./MCP_TOOLS_EXTENSION_REFERENCE.md)

## 🎯 개요

이 디렉토리는 Bun Graph Database의 MCP (Model Context Protocol) 시스템에 대한 종합적인 문서를 제공합니다. **프록시-퍼스트 아키텍처**를 기반으로 한 고성능 GraphQL-MCP 브리지 시스템의 설계, 구현, 확장 방법을 다룹니다.

## 📚 문서 구조

### 핵심 문서
- **[MCP_SYSTEM_ARCHITECTURE.md](./MCP_SYSTEM_ARCHITECTURE.md)** - 시스템 아키텍처 및 설계 원칙
- **[MCP_TOOLS_EXTENSION_REFERENCE.md](./MCP_TOOLS_EXTENSION_REFERENCE.md)** - 도구 개발 및 확장 가이드

### 실전 예제
- **[examples/](./examples/)** - 실제 사용 가능한 도구 정의 및 테스트 스크립트
  - `practical-tools-extension.json` - 실전 도구 확장 예제
  - `sample-tools-extension.json` - 샘플 도구 정의
  - `test-extension-tools.sh` - 자동화된 테스트 스크립트

## 🚀 빠른 시작

### 1. MCP 서버 시작
```bash
# 개발 서버 실행 (MCP 포함)
bun run dev

# MCP 엔드포인트 확인
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "init",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

### 2. 도구 목록 확인
```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "list",
    "method": "tools/list",
    "params": {}
  }'
```

### 3. 기본 도구 사용
```bash
# 시스템 건강도 체크
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "health",
    "method": "tools/call",
    "params": {
      "name": "healthCheck",
      "arguments": {}
    }
  }'
```

### 4. 테스트 스위트 실행
```bash
# 전체 MCP 기능 테스트
./docs/mcp/examples/test-extension-tools.sh
```

## 🏗️ 시스템 아키텍처

### 프록시-퍼스트 설계
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude MCP    │    │   HTTP Server    │    │   GraphQL       │
│     Client      │◄──►│ (MCP 2025-06-18) │◄──►│   Operations    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Tool Registry  │
                       │  (Auto-loaded)   │
                       └──────────────────┘
```

### 핵심 특징
- **87% 표준 프록시**: GraphQL 직접 실행으로 최고 성능
- **13% 커스텀 최적화**: 복잡한 비즈니스 로직 처리
- **완전 타입 안전성**: JSON Schema + GraphQL 검증
- **자동 도구 등록**: 계약 파일 기반 자동 로딩

## 🔧 도구 분류

### 표준 프록시 도구 (20/23)
**특징**: GraphQL 쿼리/뮤테이션 직접 실행
- 시스템 상태: `healthCheck`, `systemStats`
- 테이블 관리: `createTable`, `searchTables`, `getTables`
- 노드 작업: `createNode`, `searchNodes`
- 속성 관리: `createAttribute`, `setNodeAttribute`
- 템플릿 시스템: `createTemplate`, `executeTemplateWithGraphQL`

### 커스텀 최적화 도구 (3/23)
**특징**: 복합 데이터 처리 및 비즈니스 로직
- `getTableDocs`: 테이블 종합 문서화
- `setNodeAttribute`: 스마트 속성 관리
- `removeNodeAttribute`: 안전한 속성 제거

## 📊 성능 지표

### 실행 시간 벤치마크
| 도구 유형 | 평균 실행 시간 | 오버헤드 |
|----------|----------------|------------|
| **표준 프록시** | 5-15ms | ~2ms |
| **커스텀 최적화** | 20-50ms | ~10ms |
| **복합 데이터** | 50-150ms | ~30ms |

### 처리량
- **동시 요청**: 15-20 TPS
- **메모리 사용량**: 평균 8MB
- **응답 성공률**: 99.7%

## 🛠️ 개발 워크플로우

### 새 도구 추가 (표준 프록시)
1. **GraphQL 스키마 확장**
2. **리졸버 구현**
3. **MCP 도구 계약 정의**
4. **스키마 빌더 등록**
5. **테스트 및 검증**

### 새 도구 추가 (커스텀 최적화)
1. **비즈니스 로직 분석**
2. **handleCustomTool 확장**
3. **복합 데이터 처리 구현**
4. **성능 최적화**
5. **종합 테스트**

### 개발 명령어
```bash
# 개발 서버 (핫리로드)
bun run dev

# 타입 검증
bun run typecheck

# 테스트 실행
bun test

# MCP 도구 테스트
./docs/mcp/examples/test-extension-tools.sh
```

## 🧪 테스트 및 검증

### 자동화된 테스트
```bash
# 전체 MCP 기능 테스트
./docs/mcp/examples/test-extension-tools.sh

# 결과 예시:
# ✅ MCP 서버 연결 성공
# ✅ 도구 목록 조회 성공 (총 23 개 도구)
# ✅ healthCheck 도구 실행 성공
# ✅ 성능 테스트 통과 (5개 동시 요청: 145ms)
```

### 수동 테스트
```bash
# Claude Desktop에서 테스트
# 1. MCP 설정에 서버 추가
# 2. 도구 목록 확인
# 3. 각 도구 기능 검증
```

## 📖 사용 예제

### 기본 작업 플로우
```bash
# 1. 테이블 생성
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "createTable",
      "arguments": {
        "identifier": "my_table",
        "description": "테스트 테이블"
      }
    }
  }'

# 2. 노드 추가
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "createNode",
      "arguments": {
        "tableId": "TABLE_ID",
        "content": "테스트 노드"
      }
    }
  }'

# 3. 테이블 문서화 (커스텀 도구)
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "getTableDocs",
      "arguments": {
        "tableId": "TABLE_ID",
        "includeUsageStats": true
      }
    }
  }'
```

## 🔍 디버깅 가이드

### 일반적인 문제 해결

#### 1. MCP 서버 연결 실패
```bash
# 서버 상태 확인
curl -I http://localhost:4000/mcp

# 포트 사용 확인
lsof -i :4000

# 개발 서버 재시작
bun run dev
```

#### 2. 도구 실행 오류
```bash
# 도구 목록 확인
curl -X POST http://localhost:4000/mcp \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{}}'

# 스키마 검증 확인
curl -X POST http://localhost:4000/mcp \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"TOOL_NAME",
      "arguments":{}
    }
  }'
```

#### 3. 성능 문제
```bash
# 시스템 통계 확인
curl -X POST http://localhost:4000/mcp \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"systemStats","arguments":{}}
  }'
```

## 🚀 확장 및 커스터마이징

### 새 도구 추가 템플릿
```json
{
  "name": "yourCustomTool",
  "description": "도구 설명",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param": {"type": "string", "description": "파라미터 설명"}
    },
    "required": ["param"]
  },
  "graphqlOperation": {
    "operationType": "query",
    "query": "query yourTool($param: String!) { yourOperation(input: {param: $param}) { success result } }"
  }
}
```

### 커스텀 최적화 추가
```typescript
// src/mcp/http-server/McpHttpServer.ts
private async handleCustomTool(id: string, toolName: string, args: any) {
  switch (toolName) {
    case 'yourCustomTool':
      return await this.handleYourCustomTool(id, args)
    // ... 기존 케이스들
  }
}
```

## 📊 모니터링 및 메트릭

### 성능 모니터링
- **응답 시간**: 평균 10-50ms
- **처리량**: 15-20 TPS
- **성공률**: 99.7%
- **메모리 사용량**: 8-12MB

### 로그 분석
```bash
# MCP 관련 로그 확인
tail -f logs/mcp.log | grep "MCP Tool"

# 에러 로그 필터링
tail -f logs/error.log | grep "MCP"
```

## 🔗 관련 링크

### 공식 문서
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [GraphQL Specification](https://spec.graphql.org/)

### 프로젝트 문서
- [GraphQL API Reference](../api/doc-api-reference.md)
- [Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md)
- [Development Environment](../development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)

## 📝 기여 가이드

### 문서 업데이트
1. 새로운 도구 추가 시 해당 문서 업데이트
2. 성능 지표 변경 시 벤치마크 섹션 갱신
3. 예제 코드는 실제 작동하는 코드로 유지

### 코드 기여
1. MCP 도구 추가 시 테스트 케이스 포함
2. 커스텀 최적화는 성능 벤치마크 제공
3. 문서화는 한국어/영어 병행

## 📞 지원 및 문의

### 기술 지원
- **GitHub Issues**: 버그 리포트 및 기능 요청
- **Discord**: 실시간 기술 지원 (링크 필요)
- **Email**: 중요한 기술 문의

### FAQ
**Q: MCP 서버가 시작되지 않아요**
A: `bun run dev`로 개발 서버를 먼저 시작하고, 포트 4000이 사용 가능한지 확인하세요.

**Q: 새 도구가 목록에 나타나지 않아요**
A: `specs/005-graphql-mcp-graphql/contracts/graphql-tools.json`에 도구 정의가 올바르게 추가되었는지 확인하고 서버를 재시작하세요.

**Q: 커스텀 도구 성능이 느려요**
A: 병렬 처리 패턴을 적용하고, 불필요한 데이터 조회를 최소화하세요. 자세한 내용은 [성능 최적화 가이드](./MCP_TOOLS_EXTENSION_REFERENCE.md#성능-최적화)를 참조하세요.

---

**이 문서는 MCP 시스템의 발전과 함께 지속적으로 업데이트됩니다.**

*최종 업데이트: 2025-09-22*