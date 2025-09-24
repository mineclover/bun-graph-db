# Template Usage Improvement Suggestions

## 현재 문제점
- JSON 내부에서 GraphQL 쿼리 작성 시 이스케이프 문자가 많아서 가독성이 떨어짐
- `\"` 이스케이프로 인해 실수 발생 가능성 증가

## 개선 방안

### 1. 현재 사용법 (이스케이프 필요)
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"table-documentation-full\", variables: { tableId: \"1\" }) { success data } }"}'
```

### 2. 파일 기반 쿼리 (추천 방안)
```bash
# query.graphql 파일 생성
echo 'mutation ExecuteTemplate($templateId: String!, $vars: JSON!) {
  executeTemplateWithGraphQL(
    templateIdentifier: $templateId,
    variables: $vars
  ) {
    success
    data
    errors { message }
  }
}' > query.graphql

# 변수 파일 생성
echo '{
  "templateId": "table-documentation-full",
  "vars": { "tableId": "1" }
}' > variables.json

# 실행 (이스케이프 불필요)
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  --data-binary @- <<EOF
{
  "query": "$(cat query.graphql)",
  "variables": $(cat variables.json)
}
EOF
```

### 3. REST API 대안 제안
현재 MCP-to-REST 아키텍처를 활용하여 더 간단한 REST 엔드포인트 추가:

```bash
# 제안: REST API 엔드포인트
POST /api/templates/execute
Content-Type: application/json

{
  "templateIdentifier": "table-documentation-full",
  "variables": {
    "tableId": "1"
  }
}

# 또는 더 간단한 URL 기반
GET /api/templates/table-documentation-full/execute?tableId=1
```

### 4. 템플릿 숏코드 시스템
```bash
# 숏코드로 간단하게 실행
POST /api/execute/tdf  # table-documentation-full 의 줄임말
```

### 5. CLI 도구 제안
```bash
# 전용 CLI 도구 (선택사항)
bun-graph execute table-documentation-full --tableId=1
bun-graph execute tdf --tableId=1  # 숏코드 버전
```

## 즉시 적용 가능한 개선책

### A. HEREDOC 사용 (bash/zsh)
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d "$(cat <<'EOF'
{
  "query": "mutation { executeTemplateWithGraphQL(templateIdentifier: \"table-documentation-full\", variables: { tableId: \"1\" }) { success data } }"
}
EOF
)"
```

### B. 환경 변수 활용
```bash
# 환경 변수로 템플릿 ID 설정
export TEMPLATE_ID="table-documentation-full"
export TABLE_ID="1"

curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"mutation { executeTemplateWithGraphQL(templateIdentifier: \\\"$TEMPLATE_ID\\\", variables: { tableId: \\\"$TABLE_ID\\\" }) { success data } }\"}"
```

### C. jq를 활용한 JSON 생성
```bash
# jq로 안전한 JSON 생성
jq -n --arg template "table-documentation-full" --arg tableId "1" '{
  query: "mutation { executeTemplateWithGraphQL(templateIdentifier: \($template), variables: { tableId: \($tableId) }) { success data } }"
}' | curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d @-
```

## 권장사항
1. **단기**: 파일 기반 쿼리 사용 (가장 깔끔함)
2. **중기**: REST API 엔드포인트 추가
3. **장기**: 전용 CLI 도구 개발 (선택사항)

이 중에서 파일 기반 접근법이 가장 실용적이고 즉시 사용 가능한 해결책입니다.