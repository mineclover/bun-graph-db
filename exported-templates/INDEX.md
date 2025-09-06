# 전체 템플릿 Export 결과

**생성일**: 2025-09-06T06:45:52.488Z
**총 템플릿 수**: 11개
**Export 성공**: 11개

## 📁 새로운 폴더 구조 (Automated Templates)

아래는 새로운 자동화된 템플릿 시스템입니다. 각 템플릿이 독립적인 폴더에 있습니다:

```
templates/
├── create-table/           # 테이블 생성 템플릿
│   ├── template_v1-0-0.json
│   └── dataset.json
└── get-table/             # 테이블 조회 템플릿
    ├── template_v1-0-0.json
    └── dataset.json
```

**생성 방법**: `bun run demo:template-generation`

---

## 템플릿 목록 (사용량 순)

| 순위 | 파일명 | 템플릿명 | 사용횟수 | 카테고리 |
|------|--------|----------|----------|----------|
| 1 | `00-test-health-check_v1-0-0.json` | System Health Check | 161회 | system |
| 2 | `00-test-testquery1_v1-0-0.json` | TestQuery1 | 96회 | test |
| 3 | `00-test-list-tables_v1-0-0.json` | List All Tables | 80회 | table |
| 4 | `00-test-testmutation1_v1-0-0.json` | TestMutation1 | 76회 | test |
| 5 | `00-test-testquery2_v1-0-0.json` | TestQuery2 | 40회 | test |
| 6 | `00-test-get-table_v1-0-0.json` | Get Table Information | 32회 | table |
| 7 | `00-test-search-nodes_v1-0-0.json` | Search Nodes | 27회 | node |
| 8 | `00-test-create-table_v1-0-0.json` | Create New Table | 25회 | table |
| 9 | `00-test-get-node_v1-0-0.json` | Get Node Information | 21회 | node |
| 10 | `00-test-create-node_v1-0-0.json` | Create New Node | 20회 | node |
| 11 | `00-create-table_v1-0-0.json` | Create Table | 9회 | table |

## 사용 방법

각 JSON 파일은 완전한 템플릿 정보를 포함하고 있습니다:
- GraphQL 쿼리/뮤테이션
- 변수 스키마
- 사용량 통계
- 메타데이터

```bash
# 템플릿 가져오기 예시
curl -X POST -H "Content-Type: application/json" \
  -d @01-template-name.json \
  http://localhost:4000/graphql/import
```

---
*자동 생성됨 by export-all-templates.ts*
