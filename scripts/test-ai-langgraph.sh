#!/bin/bash

# Test script for LangGraph AI capabilities
# Run with: bash scripts/test-ai-langgraph.sh

API_URL="${API_URL:-http://localhost:3000}"
echo "🧪 Testing LangGraph AI Capabilities"
echo "📍 API URL: $API_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -X GET "$API_URL$endpoint" -H "Content-Type: application/json" 2>&1)
    else
        response=$(curl -s -X POST "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data" 2>&1)
    fi
    
    # Check if response contains expected field
    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "   Response: $(echo "$response" | head -c 200)"
        ((FAILED++))
        return 1
    fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  AI Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "AI Health" "GET" "/api/v1/ai/recommendations/health" "" "success"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Natural Language Search Parsing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test NL parsing
test_endpoint "Parse NL query" "POST" "/api/v1/ai/parse-search" \
    '{"query": "swimming lessons for my 5 year old on Saturdays near downtown"}' \
    "parsed_filters"

test_endpoint "Parse simple query" "POST" "/api/v1/ai/parse-search" \
    '{"query": "dance classes for kids"}' \
    "success"

test_endpoint "Parse with age" "POST" "/api/v1/ai/parse-search" \
    '{"query": "soccer for my 8 year old"}' \
    "detected_intent"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  AI Recommendations (via LangGraph)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test recommendations - should go through the LangGraph
test_endpoint "Basic recommendations" "POST" "/api/v1/ai/recommendations" \
    '{"search_intent": "swimming activities", "filters": {"ageMin": 5, "ageMax": 10}}' \
    "recommendations"

test_endpoint "NL recommendations" "POST" "/api/v1/ai/recommendations" \
    '{"search_intent": "dance classes for my 7 year old on weekends"}' \
    "success"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Activity Explanations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# First get an activity ID
echo "Fetching a sample activity..."
sample_activity=$(curl -s "$API_URL/api/v1/activities?limit=1" 2>&1)
activity_id=$(echo "$sample_activity" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"\([^"]*\)"/\1/')

if [ -n "$activity_id" ]; then
    echo "Using activity ID: $activity_id"
    test_endpoint "Activity explanation" "POST" "/api/v1/ai/explain" \
        "{\"activity_id\": \"$activity_id\"}" \
        "explanations"
else
    echo -e "${YELLOW}⚠️  Could not fetch sample activity, skipping explanation test${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Weekly Schedule Planning"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Note: This requires authentication, so we test the error response
test_endpoint "Weekly planner (auth required)" "POST" "/api/v1/ai/plan-week" \
    '{"week_start": "2025-01-06"}' \
    "Authentication\|error\|schedule"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Edge Cases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test validation
test_endpoint "Parse - empty query error" "POST" "/api/v1/ai/parse-search" \
    '{"query": ""}' \
    "error\|Query"

test_endpoint "Parse - short query error" "POST" "/api/v1/ai/parse-search" \
    '{"query": "ab"}' \
    "error\|3 characters"

test_endpoint "Explain - missing activity_id error" "POST" "/api/v1/ai/explain" \
    '{}' \
    "error\|activity_id"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
