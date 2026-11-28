---
docType: navigation
sourceLocale: ko
canonical: true
lastVerified: "2026-11-28"
---

# Bun Graph DB 문서

운영 경계와 완료 조건은 [운영 준비도 명세](../specs/008-production-readiness/spec.md)를 기준으로 한다. 시스템 구성과 선택의 이유는 [아키텍처 개요](./architecture/overview.md)에서 설명하며, 실제 배포·보안·마이그레이션·백업·점검 절차는 [운영 및 관리 가이드](./guides/OPERATIONS_GUIDE.md)에 정리되어 있다.

## 운영과 개발

- [플랫폼 UI · 작성/시각화 워크스페이스 가이드 (`bun-graph-db/ui`)](./guides/PLATFORM_UI_AND_WORKSPACE.md)
- [운영 및 관리 가이드](./guides/OPERATIONS_GUIDE.md)
- [실전 활용 정의 및 기능 성숙도 매트릭스](./guides/USE_CASES_AND_CAPABILITIES.md)
- [Web Embedded · EmbeddingGemma-2 · IA · AI Memory 가이드](./guides/EMBEDDED_WEB_AND_AI_MEMORY.md)
- [운영 준비도 명세](../specs/008-production-readiness/spec.md)
- [아키텍처 개요](./architecture/overview.md)
- [Cloudflare 단일 노드 아키텍처 검토](./architecture/cloudflare-single-node.md)
- [GraphQL 필드 탐색 계약과 계층 경계](./architecture/graph-traversal.md)
- [구현과 연결되는 문서 관리](./development/DOCUMENTATION_POLICY.md)
- [벡터 검색과 대규모 저장소 비교 기준선](./architecture/vector-and-storage-comparison.md)
- [MCP 참조](./mcp/README.md)
- [의존성 업데이트 정책](./development/DEPENDENCY_UPDATE_WAVES.md)
- [테스트 가이드](./development/TESTING.md)
- [골든 테스트 데이터셋](./development/GOLDEN_DATASET.md)
- [개발 환경](./development/DEVELOPMENT_ENVIRONMENT_GUIDE.md)

## API와 데이터 작업

- [API 참조](./api/doc-api-reference.md)
- [GraphQL 스키마](./api/graphql/)
- [Query Template 명세](./api/QUERY_TEMPLATES_SPEC.md)
- [빠른 Import/Export 안내](./guides/QUICK_START_IMPORT_EXPORT.md)
- [Template 시스템 가이드](./templates/template-system-guide.md)

## 기록과 보조 자료

- [과거 GraphQL 로드맵](./development/PRIORITY_DEVELOPMENT_ROADMAP.md)은 역사적 참고 자료다.
- [기존 버그 보고서](./development/graphql-api-bug-report-20250109.md)는 현재 운영 상태를 보장하지 않는다.
- 예제와 샘플은 [samples](./samples/)에서 확인한다.
