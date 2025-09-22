#!/bin/bash

# MCP Tools Extension Test Script
# 이 스크립트는 새로 개발된 MCP 도구들을 테스트합니다.

set -e

echo "🧪 MCP Tools Extension Test Suite"
echo "=================================="

# MCP 서버 엔드포인트
MCP_ENDPOINT="http://localhost:4000/mcp"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 테스트 결과 카운터
PASSED=0
FAILED=0

# 로그 함수
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# MCP 서버 상태 확인
check_mcp_server() {
    log_info "MCP 서버 연결 확인 중..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": "health-check",
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-script",
                    "version": "1.0.0"
                }
            }
        }' || echo "")

    if [[ -n "$response" && "$response" == *"serverInfo"* ]]; then
        log_success "MCP 서버 연결 성공"
        return 0
    else
        log_error "MCP 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요."
        exit 1
    fi
}

# 도구 목록 조회 테스트
test_list_tools() {
    log_info "MCP 도구 목록 조회 테스트..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": "list-tools",
            "method": "tools/list",
            "params": {}
        }')

    if [[ "$response" == *"tools"* && "$response" == *"healthCheck"* ]]; then
        tool_count=$(echo "$response" | grep -o '"name"' | wc -l)
        log_success "도구 목록 조회 성공 (총 $tool_count 개 도구)"
    else
        log_error "도구 목록 조회 실패"
        echo "응답: $response"
    fi
}

# 기본 도구 테스트 함수
test_basic_tool() {
    local tool_name="$1"
    local tool_args="$2"
    local expected_field="$3"

    log_info "$tool_name 도구 테스트..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"id\": \"test-$tool_name\",
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"$tool_name\",
                \"arguments\": $tool_args
            }
        }")

    if [[ "$response" == *"$expected_field"* && "$response" != *"error"* ]]; then
        log_success "$tool_name 도구 실행 성공"
    else
        log_error "$tool_name 도구 실행 실패"
        echo "응답: $response"
    fi
}

# 시스템 건강도 도구 테스트
test_system_health() {
    test_basic_tool "healthCheck" "{}" "status"
    test_basic_tool "systemStats" "{}" "memory"
}

# 테이블 관련 도구 테스트
test_table_operations() {
    # 테이블 생성
    local table_id=""
    log_info "테이블 생성 테스트..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": "create-test-table",
            "method": "tools/call",
            "params": {
                "name": "createTable",
                "arguments": {
                    "identifier": "test_table_'$(date +%s)'",
                    "description": "MCP 확장 도구 테스트용 테이블"
                }
            }
        }')

    if [[ "$response" == *"success"* && "$response" == *"table"* ]]; then
        table_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_success "테이블 생성 성공 (ID: $table_id)"

        # 테이블 목록 조회
        test_basic_tool "getTables" "{}" "tables"

        # 테이블 문서화 테스트 (커스텀 도구)
        if [[ -n "$table_id" ]]; then
            test_basic_tool "getTableDocs" "{\"tableId\": \"$table_id\"}" "documentation"
        fi
    else
        log_error "테이블 생성 실패"
        echo "응답: $response"
    fi
}

# 노드 관련 도구 테스트
test_node_operations() {
    log_info "노드 검색 테스트..."

    # 전체 노드 검색 (빈 검색어로)
    test_basic_tool "searchNodes" "{\"searchTerm\": \"\", \"limit\": 5}" "nodes"
}

# 템플릿 관련 도구 테스트
test_template_operations() {
    test_basic_tool "searchTemplates" "{}" "templates"
}

# 성능 벤치마크 테스트
run_performance_test() {
    log_info "성능 벤치마크 테스트..."

    start_time=$(date +%s%N)

    # 5개의 동시 요청
    for i in {1..5}; do
        curl -s -X POST "$MCP_ENDPOINT" \
            -H "Content-Type: application/json" \
            -d '{
                "jsonrpc": "2.0",
                "id": "perf-test-'$i'",
                "method": "tools/call",
                "params": {
                    "name": "healthCheck",
                    "arguments": {}
                }
            }' &
    done

    wait  # 모든 백그라운드 작업 완료 대기

    end_time=$(date +%s%N)
    duration=$((($end_time - $start_time) / 1000000))  # 밀리초로 변환

    if [[ $duration -lt 1000 ]]; then
        log_success "성능 테스트 통과 (5개 동시 요청: ${duration}ms)"
    else
        log_warning "성능 테스트 주의 (5개 동시 요청: ${duration}ms > 1000ms)"
    fi
}

# 에러 처리 테스트
test_error_handling() {
    log_info "에러 처리 테스트..."

    # 존재하지 않는 도구 호출
    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": "error-test-1",
            "method": "tools/call",
            "params": {
                "name": "nonExistentTool",
                "arguments": {}
            }
        }')

    if [[ "$response" == *"error"* || "$response" == *"Tool not found"* ]]; then
        log_success "존재하지 않는 도구 에러 처리 정상"
    else
        log_error "존재하지 않는 도구 에러 처리 실패"
    fi

    # 잘못된 파라미터 테스트
    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{
            "jsonrpc": "2.0",
            "id": "error-test-2",
            "method": "tools/call",
            "params": {
                "name": "createTable",
                "arguments": {
                    "invalid_field": "invalid_value"
                }
            }
        }')

    if [[ "$response" == *"error"* || "$response" == *"Validation"* ]]; then
        log_success "잘못된 파라미터 에러 처리 정상"
    else
        log_error "잘못된 파라미터 에러 처리 실패"
    fi
}

# 메인 테스트 실행
main() {
    echo
    log_info "테스트 시작: $(date)"
    echo

    # 전제조건 확인
    check_mcp_server
    echo

    # 기본 기능 테스트
    test_list_tools
    test_system_health
    test_table_operations
    test_node_operations
    test_template_operations
    echo

    # 성능 및 안정성 테스트
    run_performance_test
    test_error_handling
    echo

    # 결과 요약
    echo "📊 테스트 결과 요약"
    echo "==================="
    echo -e "통과: ${GREEN}$PASSED${NC}"
    echo -e "실패: ${RED}$FAILED${NC}"
    echo -e "총합: $(($PASSED + $FAILED))"
    echo

    if [[ $FAILED -eq 0 ]]; then
        log_success "모든 테스트가 통과했습니다! 🎉"
        exit 0
    else
        log_error "일부 테스트가 실패했습니다. 로그를 확인하세요."
        exit 1
    fi
}

# 스크립트 실행
main "$@"