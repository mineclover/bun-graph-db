---
docType: reference
sourceLocale: ko
canonical: true
lastVerified: "2026-08-11"
---

# Bun Graph DB MCP 참조

루트 MCP 서버는 `/mcp`, 테이블 범위 MCP 서버는 `/sub/:tableId/mcp`에서 JSON-RPC 2.0 over HTTP로 제공된다. 공개 도구의 이름, 입력 JSON Schema, `read`·`write` 성격, 테이블 범위는 [`McpToolRegistry`](../../src/application/services/McpToolRegistry.ts)의 단일 계약이 기준이다.

운영 모델과 권한 경계는 [아키텍처 개요](../architecture/overview.md), 완료 조건은 [운영 준비도 명세](../../specs/008-production-readiness/spec.md)를 따른다.

## 지원 프로토콜

| 프로토콜 버전 | 요청 모델 |
| --- | --- |
| `2026-07-28` | 요청별 메타데이터를 사용하는 stateless 경로 |
| `2025-06-18` | initialize 기반 호환 경로 |
| `2024-11-05` | initialize 기반 레거시 호환 경로 |

`2026-07-28` 요청은 `MCP-Protocol-Version` 및 `Mcp-Method` 헤더와 `params._meta`의 프로토콜 정보가 일치해야 한다. `tools/call`은 `Mcp-Name` 헤더도 도구 이름과 일치해야 한다.

## 인증과 권한

production에서는 인증이 기본으로 활성화된다. 외부 클라이언트는 `Authorization: Bearer <token>` 또는 `X-API-Key: <token>`을 보낸다.

```bash
export BUN_GRAPH_DB_ACCESS_TOKENS='{
  "reader-token": { "id": "analytics", "role": "reader", "tableIds": ["public"] },
  "writer-token": { "id": "automation", "role": "writer", "tableIds": ["orders"] }
}'
export BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN='at-least-32-characters-of-random-secret'
```

`reader`는 읽기 도구만 발견·실행할 수 있다. `writer`는 허용된 테이블 범위에서 쓰기 작업을 수행할 수 있고, `admin`은 전역 작업을 수행할 수 있다. 범위를 벗어난 테이블·노드 요청은 존재 여부를 노출하지 않는 응답으로 거부된다.

`BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN`은 인증된 서비스에서 필수다. MCP가 내부 GraphQL·REST 브리지를 호출할 때만 일반 Bearer 자격 증명으로 전달하며, 외부 클라이언트용 토큰과 분리해 보관해야 한다.

## 최신 클라이언트 요청 예시

```bash
curl -X POST http://localhost:4000/mcp \
  -H 'Content-Type: application/json' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/list' \
  -d '{
    "jsonrpc": "2.0",
    "id": "list",
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  }'
```

인증된 서버에는 위 요청에 `-H 'Authorization: Bearer <token>'`을 추가한다. 반환된 도구 목록은 호출 주체의 역할과 테이블 범위에 따라 달라질 수 있다.

## 검증 명령

```bash
bun test tests/unit/mcp-modern-protocol.test.ts tests/unit/mcp-tool-contract.test.ts tests/unit/mcp-internal-bridge.test.ts
bun run typecheck
```

과거 프록시 비율·고정 도구 수·성능 수치는 현재 계약의 일부가 아니므로 이 참조 문서에서 다루지 않는다. 새 도구는 GraphQL 구현, 단일 MCP 계약, 권한 메타데이터, 계약 테스트를 같은 변경에서 갱신해야 한다.
