---
docType: reference
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
---

# Bun Graph DB MCP 참조

루트 MCP 서버는 `/mcp`, 테이블 범위 MCP 서버는 `/sub/:tableId/mcp`에서 JSON-RPC 2.0 over HTTP로 제공된다. 공개 도구의 이름, 입력·출력 JSON Schema, `ToolAnnotations`, `read`·`write` 성격, 테이블 범위는 [`McpToolRegistry`](../../src/application/services/McpToolRegistry.ts)의 단일 계약이 기준이다.

운영 모델과 권한 경계는 [아키텍처 개요](../architecture/overview.md), 완료 조건은 [운영 준비도 명세](../../specs/008-production-readiness/spec.md)를 따른다.

## 지원 프로토콜

| 프로토콜 버전 | 요청 모델 | 주요 규약 |
| --- | --- | --- |
| `2026-07-28` | 요청별 메타데이터를 사용하는 stateless 기본 경로 | `server/discover`, `ping`, `202 Accepted` 알림, `structuredContent`, `isError` 도구 검증 오류, SEP-2243 `Mcp-Name` Base64 sentinel, SEP-414 추적 메타 통과 |
| `2025-11-25` | initialize 기반 LTS 호환 경로 | `ping`, `202 Accepted` 알림, `structuredContent`, `isError` 도구 검증 오류, JSON Schema 2020-12 출력 스키마 |
| `2025-06-18` | initialize 기반 호환 경로 | 기존 `-32602` 스키마 오류 및 `200` 빈 알림 호환 |
| `2025-03-26` | initialize 기반 호환 경로 | HTTP Streamable 초기 호환 |
| `2024-11-05` | initialize 기반 레거시 호환 경로 | 초기 MCP 호환 |

`2026-07-28` 요청은 `MCP-Protocol-Version`, `Mcp-Method` 헤더(RFC 9110 OWS 트림)와 `params._meta`의 프로토콜 정보가 일치해야 하며, `tools/call`은 `Mcp-Name` 헤더(`=?base64?...?=` Web Standard UTF-8 디코딩 지원)도 도구 이름과 일치해야 한다. 루트(`/mcp`)와 테이블(`/sub/:tableId/mcp`) 모두 동일하게 `Origin` 검증(로컬 루프백 + `BUN_GRAPH_DB_ALLOWED_ORIGINS` -> 불일치 시 `403`), 미지원 HTTP 메서드 `405 Method Not Allowed` (`Allow: POST, GET`), 비-JSON `Content-Type` POST `415 Unsupported Media Type`, JSON-RPC 배치 배열 `400` (`-32600 Invalid Request`) 규칙을 적용한다. 또한 `McpHttpServer`·`TableMcpServer`는 독립 실행 서버(`index.ts`)·`PortableBootstrap`·`CloudflareSingleNodeWorker` 모두에서 `aiMemoryService`·`iaService` 포함 동일한 경로·권한 경계로 제공된다.

모든 `tools/list` 항목에는 `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)가 포함되며, 스키마 계약 도구(`healthCheck`, `get-root-openapi-projection`, `get-openapi-projection-{tableId}`)는 JSON Schema 2020-12 `outputSchema`를 선언한다. `tools/call` 결과는 기존 `content`와 함께 파싱된 JSON 객체 `structuredContent`(SEP-2106)를 병행 반환한다.

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

`BUN_GRAPH_DB_INTERNAL_BRIDGE_TOKEN`은 인증된 서비스에서 필수다. MCP가 프로세스 내 `FetchLike` 브리지(또는 외부 URL 브리지)로 GraphQL·REST 핸들러를 호출할 때 일반 Bearer 자격 증명으로 전달하며, 외부 클라이언트용 토큰과 분리해 보관해야 한다. 노드 임베딩(`set-node-embedding`, `get-node-embedding`, `remove-node-embedding`)과 4-신호 하이브리드 검색(`hybrid-search-nodes`, 테이블 MCP의 `hybrid-search-table-{tableId}-nodes`) 역시 테이블 범위 도구로 분류되어 대상 테이블·노드·`graph.anchorNodeIds` 소유권을 모두 검증한다.

## 최신 클라이언트 요청 예시

```bash
curl -X POST http://localhost:4141/mcp \
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
        "io.modelcontextprotocol/clientCapabilities": {},
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      }
    }
  }'
```

인증된 서버에는 위 요청에 `-H 'Authorization: Bearer <token>'`을 추가한다. 반환된 도구 목록은 호출 주체의 역할과 테이블 범위에 따라 달라질 수 있다.

## 검증 명령

```bash
pnpm exec vitest run tests/unit/mcp-modern-protocol.test.ts tests/unit/mcp-tool-contract.test.ts tests/unit/mcp-internal-bridge.test.ts
pnpm run typecheck
```

과거 프록시 비율·고정 도구 수·성능 수치는 현재 계약의 일부가 아니므로 이 참조 문서에서 다루지 않는다. 새 도구는 GraphQL 구현, 단일 MCP 계약, 권한 메타데이터, 계약 테스트를 같은 변경에서 갱신해야 한다.
