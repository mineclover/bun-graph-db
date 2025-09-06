#!/bin/bash

echo "🎯 Sequential Query Testing Workflow"
echo "===================================="
echo "Testing each query one by one, stopping on failure"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Success counter
success_count=0
total_count=0

# Function to test a single dataset with detailed output
test_query() {
    local category="$1"
    local dataset="$2"
    local description="$3"
    
    total_count=$((total_count + 1))
    
    echo -e "${BLUE}[$total_count]${NC} Testing: ${YELLOW}$category/$dataset${NC}"
    echo "    📝 $description"
    
    if bun run demo:test-dataset "$category/$dataset" 2>/dev/null; then
        echo -e "    ${GREEN}✅ SUCCESS${NC} - Template executed and exported"
        success_count=$((success_count + 1))
        echo ""
        return 0
    else
        echo -e "    ${RED}❌ FAILED${NC} - Stopping sequential test"
        echo ""
        echo -e "${YELLOW}📊 Final Results:${NC} $success_count/$total_count datasets completed"
        echo "Fix the issue and rerun from this point."
        exit 1
    fi
}

# Test in order: Basic → Advanced → Mutations → Edge Cases

echo -e "${BLUE}=== Phase 1: Basic Queries (Simple, no variables) ===${NC}"
test_query "basic" "health-check.json" "System health status check"
test_query "basic" "test-query1.json" "Basic test query 1"
test_query "basic" "test-query2.json" "Basic test query 2"
test_query "basic" "list-tables.json" "List all tables"
test_query "basic" "search-nodes.json" "Search nodes with basic filter"

echo -e "${BLUE}=== Phase 2: Advanced Queries (Complex with variables) ===${NC}"
test_query "advanced" "get-node-by-id.json" "Get specific node by ID"
test_query "advanced" "get-table-by-id.json" "Get specific table by ID"
test_query "advanced" "get-table-by-id-alt.json" "Alternative table lookup by ID"
test_query "advanced" "list-tables-with-pagination.json" "Paginated table listing"
test_query "advanced" "search-nodes-with-table.json" "Search nodes within specific table"

echo -e "${BLUE}=== Phase 3: Mutations (Data modification) ===${NC}"
test_query "mutations" "test-mutation1.json" "Basic test mutation"
test_query "mutations" "create-table.json" "Create new table"
test_query "mutations" "create-node.json" "Create new node"

echo -e "${BLUE}=== Phase 4: Edge Cases (Expected failures) ===${NC}"
echo -e "${YELLOW}Note: These are expected to fail as error test cases${NC}"

if bun run demo:test-dataset "edge-cases/invalid-query.json" 2>/dev/null; then
    echo -e "    ${YELLOW}⚠️ UNEXPECTED SUCCESS${NC} - This should have failed"
else
    echo -e "    ${GREEN}✅ EXPECTED FAILURE${NC} - Nonexistent template correctly rejected"
fi

if bun run demo:test-dataset "edge-cases/malformed-query.json" 2>/dev/null; then
    echo -e "    ${YELLOW}⚠️ UNEXPECTED SUCCESS${NC} - This should have failed"
else
    echo -e "    ${GREEN}✅ EXPECTED FAILURE${NC} - Malformed query correctly rejected"
fi

echo ""
echo -e "${GREEN}🎉 All Sequential Tests Completed Successfully!${NC}"
echo -e "${BLUE}📊 Results:${NC} $success_count/$total_count working datasets"
echo -e "${BLUE}📄 Templates Exported:${NC} $(find demo/templates -name "*.json" | wc -l | tr -d ' ') files"
echo -e "${BLUE}📈 Results Saved:${NC} $(find demo/results -name "*.json" | wc -l | tr -d ' ') files"
echo ""
echo "Ready for production use! 🚀"