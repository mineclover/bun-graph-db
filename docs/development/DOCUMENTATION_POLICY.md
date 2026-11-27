---
docType: explanation
sourceLocale: ko
canonical: true
lastVerified: "2026-11-27"
owner: "Bun Graph DB maintainers"
sources:
  - scripts/check-docs.ts
  - scripts/check-codegen.ts
  - scripts/export-oa-sdk-projection-artifacts.ts
tests:
  - tests/unit/check-docs.test.ts
  - tests/contract/oa-sdk-projection-artifacts.test.ts
---

# 구현과 연결되는 문서 관리

문서가 설명하는 대상마다 정본을 하나로 정한다. 새로운 설명 페이지를 추가할 때는
[문서 색인](../README.md)에 연결하고, 과거 보고서의 통과 배지를 현재 보장의 근거로 옮기지 않는다.

| 문서 종류 | 정본과 갱신 방식 | 검증 |
|---|---|---|
| GraphQL 필드/입력/설명 | `src/presentation/graphql/schema/`의 SDL을 먼저 수정하고 `pnpm run codegen`으로 생성한다. | `pnpm run check:codegen` |
| MCP 도구 계약 | `McpToolRegistry`와 projection 구현을 먼저 수정한다. 설명·권한·입력 스키마를 별도로 재작성하지 않는다. | `pnpm run projection:check`, 관련 MCP 계약 테스트 |
| 알고리즘 의미/계층 | canonical reference 또는 explanation에 범위, 구현 경로, 테스트, 남은 제한을 기록한다. | `pnpm run check:docs`, 기능 테스트, 타입 검사 |
| 설계 제안/로드맵 | 제안임을 본문에서 표시하고 수용 여부와 완료 조건을 기록한다. | 구현됨 상태로 바꾸기 전에 구현·테스트 근거 연결 |
| 실행 보고/과거 평가 | 실행일, 명령, 코드 기준, 결과와 실행하지 않은 범위를 남긴다. | 과거 통과 결과를 현재 전체 검증으로 확대하지 않는다. |

이 구분은 Kuzu의 언어별 API 참조 생성 원칙을 참고한다. Kuzu의 고정 snapshot에서는
JSDoc/pdoc/Javadoc/Doxygen을 사용하는 문서 workflow가 수동 실행(`workflow_dispatch`)이므로,
자동으로 매 PR의 문서 freshness가 보장된다고 해석하지 않는다.
Bun Graph DB는 기존 GraphQL codegen/projection 검사에 정본 문서 검사를 더해 같은 변경에서 실행한다.
현재 `check:codegen`은 임시 디렉터리에 생성이 성공하고 출력이 비어 있지 않은지 검증한다.
버전 관리 중인 snapshot과의 byte 단위 freshness 비교를 수행하는 검사는 아니다.

## 정본 표시와 근거

`canonical: true`는 유지보수자가 현재 계약 설명으로 관리하겠다는 선언이다.
`docType`, `sourceLocale`, `lastVerified`를 함께 적는다. `lastVerified`는 실제로 소스를
검토한 날짜이며, 검사 스크립트가 실행될 때마다 자동으로 오늘로 바꾸지 않는다.

새 기능 설명에는 `sources`와 `tests`에 저장소 루트 기준 경로 목록을 적는다.
이 목록은 코드/테스트 이동 시 문서가 남겨지는 것을 찾는 데 사용한다.
검사기는 canonical 문서의 메타데이터, 실재하는 날짜, 로컬 링크, 명시된 `sources`/`tests`의
대상 존재를 검증한다. 기존 canonical 문서에 이 두 목록을 소급 강제하지는 않는다.
경로가 존재한다는 사실은 테스트 통과나 의미 일치를 증명하지 않으므로 기능 검증은 별도 실행한다.

메타데이터가 없는 문서는 이 검사에서 제외되며 자동으로 archive 또는 canonical로 분류하지 않는다.
문서를 옮길 때는 문서 색인과 소비자 링크를 함께 갱신한다. 이전 문서를 유지한다면
새 정본으로 가는 링크와 역사적 상태를 표시한다.

## 변경 완료 절차

1. 계약의 정본에서 변경한다. 설명만 달라졌다면 해당 설명을, API 설명이 달라졌다면 SDL/registry를 수정한다.
2. 알고리즘/서비스/전송 경계 중 변경된 곳을 설명하고, proposal과 구현된 범위를 구별한다.
3. 알려진 정답과 경계 조건을 검증한 뒤 문서의 범위와 `lastVerified`를 갱신한다.
4. `pnpm run check:static`을 실행한다. 이 명령에 canonical 문서 검사와 기존 codegen 검사가 포함된다.
5. 변경된 동작의 테스트를 실행하고 결과를 기록한다. 캐시 검사·정적 검토·실제 실행을 구별한다.

첫 적용 사례는 [GraphQL 필드 탐색 계약](../architecture/graph-traversal.md)이다.
