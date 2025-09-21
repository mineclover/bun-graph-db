#!/bin/bash

# MCP Tools Extension Test Scripts
# executeTemplateWithGraphQL 기반 확장 도구 테스트

set -e

# Configuration
MCP_ENDPOINT="http://localhost:4000/mcp"
CONTENT_TYPE="Content-Type: application/json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test if server is running
test_server_health() {
    log_info "Testing MCP server health..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "$CONTENT_TYPE" \
        -d '{
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": true
                }
            },
            "id": 1
        }')

    if echo "$response" | jq -e '.result.serverInfo' > /dev/null 2>&1; then
        log_success "MCP server is running"
        return 0
    else
        log_error "MCP server is not responding properly"
        echo "Response: $response"
        return 1
    fi
}

# Test existing executeTemplateWithGraphQL tool
test_execute_template() {
    log_info "Testing executeTemplateWithGraphQL..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "$CONTENT_TYPE" \
        -d '{
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "executeTemplateWithGraphQL",
                "arguments": {
                    "templateIdentifier": "system-health-check_v1-0-0",
                    "variables": {}
                }
            },
            "id": 2
        }')

    if echo "$response" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
        log_success "executeTemplateWithGraphQL is working"
        echo "Response data:"
        echo "$response" | jq '.result.content[0].text | fromjson' 2>/dev/null || echo "$response"
    else
        log_error "executeTemplateWithGraphQL failed"
        echo "Response: $response"
        return 1
    fi
}

# Test tools list
test_tools_list() {
    log_info "Testing tools list..."

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "$CONTENT_TYPE" \
        -d '{
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 3
        }')

    tool_count=$(echo "$response" | jq '.result.tools | length' 2>/dev/null || echo "0")

    if [[ "$tool_count" -gt 0 ]]; then
        log_success "Found $tool_count MCP tools"
        echo "Available tools:"
        echo "$response" | jq '.result.tools[].name' 2>/dev/null || echo "Could not parse tools"
    else
        log_error "No tools found or tools/list failed"
        echo "Response: $response"
        return 1
    fi
}

# Test example extension tool: getAnalytics
test_get_analytics() {
    log_info "Testing hypothetical getAnalytics tool..."
    log_warning "This is a demonstration of how the extension would work"

    # This would work if the tool was actually implemented
    cat << 'EOF'
Expected request format:
{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
        "name": "getAnalytics",
        "arguments": {
            "timeRange": "24h",
            "includePerformance": true
        }
    },
    "id": 4
}

Expected GraphQL operation:
query getAnalytics($timeRange: String, $includePerformance: Boolean) {
    getAnalytics(timeRange: $timeRange, includePerformance: $includePerformance) {
        totalNodes
        totalRelations
        tableMetrics {
            tableId
            nodeCount
            relationCount
            avgQueryTime
        }
        performanceMetrics {
            queriesPerSecond
            avgResponseTime
            memoryUsage
        }
    }
}
EOF
}

# Test example extension tool: advancedSearch
test_advanced_search() {
    log_info "Testing hypothetical advancedSearch tool..."
    log_warning "This is a demonstration of how the extension would work"

    cat << 'EOF'
Expected request format:
{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
        "name": "advancedSearch",
        "arguments": {
            "query": "machine learning",
            "tableIds": ["research-papers", "projects"],
            "maxDepth": 2,
            "limit": 20,
            "rankBy": "RELEVANCE"
        }
    },
    "id": 5
}

Expected GraphQL operation:
query advancedSearch($query: String!, $tableIds: [String!], $maxDepth: Int, $limit: Int, $rankBy: SearchRankingType) {
    advancedSearch(query: $query, tableIds: $tableIds, maxDepth: $maxDepth, limit: $limit, rankBy: $rankBy) {
        nodes {
            id
            content
            tableId
            relevanceScore
        }
        relations {
            fromNodeId
            toNodeId
            relationshipType
            strength
        }
        totalCount
        searchTime
        ranking {
            nodeId
            score
            explanation
        }
    }
}
EOF
}

# Validate JSON Schema for extension tools
validate_extension_schema() {
    log_info "Validating extension tool schemas..."

    # Check if sample extension file exists
    if [[ -f "sample-tools-extension.json" ]]; then
        if jq empty sample-tools-extension.json 2>/dev/null; then
            log_success "Extension schema is valid JSON"

            # Check required fields
            if jq -e '.tools[].name and .tools[].inputSchema and .tools[].graphqlOperation' sample-tools-extension.json > /dev/null 2>&1; then
                log_success "All required fields are present"
            else
                log_error "Missing required fields in extension schema"
                return 1
            fi
        else
            log_error "Extension schema is not valid JSON"
            return 1
        fi
    else
        log_warning "sample-tools-extension.json not found in current directory"
    fi
}

# Performance test
performance_test() {
    log_info "Running performance test..."

    start_time=$(date +%s%N)

    # Run multiple health check requests
    for i in {1..5}; do
        curl -s -X POST "$MCP_ENDPOINT" \
            -H "$CONTENT_TYPE" \
            -d '{
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "healthCheck",
                    "arguments": {}
                },
                "id": '$i'
            }' > /dev/null
    done

    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    avg_time=$(( duration / 5 ))

    log_success "Performance test completed"
    echo "  Total time: ${duration}ms"
    echo "  Average time per request: ${avg_time}ms"

    if [[ $avg_time -lt 100 ]]; then
        log_success "Performance is excellent (< 100ms)"
    elif [[ $avg_time -lt 500 ]]; then
        log_success "Performance is good (< 500ms)"
    else
        log_warning "Performance could be improved (> 500ms)"
    fi
}

# Load test extension tools (simulation)
load_extension_demo() {
    log_info "Demonstrating extension tool loading process..."

    cat << 'EOF'

Extension Tool Loading Process:
================================

1. First, extend GraphQL schema:
   - Add new types, queries, and mutations
   - Define input/output schemas
   - Implement resolvers

2. Define MCP tool in contract:
   - Add tool definition to graphql-tools.json
   - Map to GraphQL operation
   - Define input validation schema

3. Reload tool registry:
   await registry.loadFromContract();

4. Validate all tools:
   const validation = registry.validateAllTools();

5. Test through MCP endpoint:
   POST /mcp with tools/call method

The executeTemplateWithGraphQL engine automatically:
- Validates input against JSON schema
- Executes corresponding GraphQL operation
- Transforms result to MCP format
- Returns structured response

EOF
}

# Integration test workflow
integration_test() {
    log_info "Running integration test workflow..."

    # Test basic functionality
    test_server_health || return 1
    test_tools_list || return 1
    test_execute_template || return 1

    # Validate extension patterns
    validate_extension_schema

    # Performance check
    performance_test

    # Show extension demos
    test_get_analytics
    echo
    test_advanced_search
    echo
    load_extension_demo

    log_success "Integration test completed successfully!"
}

# Error handling test
error_handling_test() {
    log_info "Testing error handling..."

    # Test invalid tool name
    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "$CONTENT_TYPE" \
        -d '{
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "nonexistentTool",
                "arguments": {}
            },
            "id": 99
        }')

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        log_success "Error handling works for invalid tool"
    else
        log_warning "Error handling might not be working properly"
    fi

    # Test invalid JSON-RPC
    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "$CONTENT_TYPE" \
        -d '{
            "invalid": "json-rpc"
        }')

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        log_success "Error handling works for invalid JSON-RPC"
    else
        log_warning "JSON-RPC validation might not be working"
    fi
}

# Main execution
main() {
    echo "================================================"
    echo "MCP Tools Extension Test Suite"
    echo "executeTemplateWithGraphQL-based Extensions"
    echo "================================================"
    echo

    case "${1:-all}" in
        "health")
            test_server_health
            ;;
        "tools")
            test_tools_list
            ;;
        "template")
            test_execute_template
            ;;
        "performance")
            performance_test
            ;;
        "errors")
            error_handling_test
            ;;
        "demo")
            test_get_analytics
            echo
            test_advanced_search
            echo
            load_extension_demo
            ;;
        "integration" | "all")
            integration_test
            ;;
        *)
            echo "Usage: $0 [health|tools|template|performance|errors|demo|integration|all]"
            echo
            echo "Commands:"
            echo "  health      - Test server health"
            echo "  tools       - Test tools list"
            echo "  template    - Test executeTemplateWithGraphQL"
            echo "  performance - Run performance test"
            echo "  errors      - Test error handling"
            echo "  demo        - Show extension examples"
            echo "  integration - Run full integration test (default)"
            echo "  all         - Same as integration"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"