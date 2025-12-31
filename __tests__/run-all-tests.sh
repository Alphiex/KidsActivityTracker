#!/bin/bash
#
# Kids Activity Tracker - Complete Test Suite Runner
# Runs all automated tests: unit, integration, and E2E
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Kids Activity Tracker - Full Test Suite${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Track start time
START_TIME=$(date +%s)

# Function to run test with status
run_test() {
    local name="$1"
    local command="$2"

    echo -e "${YELLOW}Running: ${name}...${NC}"
    if eval "$command"; then
        echo -e "${GREEN}✓ ${name} passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${name} failed${NC}"
        return 1
    fi
}

# Run tests
FAILED=0

echo -e "\n${BLUE}[1/6] Frontend Unit Tests${NC}"
run_test "Frontend Unit Tests" "npm run test:frontend -- --testPathPattern='unit' --passWithNoTests" || FAILED=1

echo -e "\n${BLUE}[2/6] Frontend Screen Tests${NC}"
run_test "Frontend Screen Tests" "npm run test:frontend -- --testPathPattern='screens' --passWithNoTests" || FAILED=1

echo -e "\n${BLUE}[3/6] Frontend Integration Tests${NC}"
run_test "Frontend Integration Tests" "npm run test:frontend -- --testPathPattern='integration' --passWithNoTests" || FAILED=1

echo -e "\n${BLUE}[4/6] Backend Unit Tests${NC}"
run_test "Backend Unit Tests" "npm run test:backend -- --testPathPattern='unit' --passWithNoTests" || FAILED=1

echo -e "\n${BLUE}[5/6] Backend Route Tests${NC}"
run_test "Backend Route Tests" "npm run test:backend -- --testPathPattern='routes' --passWithNoTests" || FAILED=1

echo -e "\n${BLUE}[6/6] E2E Tests (Detox)${NC}"
if [ "$SKIP_E2E" = "true" ]; then
    echo -e "${YELLOW}Skipping E2E tests (SKIP_E2E=true)${NC}"
else
    run_test "E2E Tests" "npm run test:e2e" || FAILED=1
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${BLUE}==========================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  All tests completed successfully!${NC}"
else
    echo -e "${RED}  Some tests failed. Please check above.${NC}"
fi
echo -e "${BLUE}  Duration: ${DURATION}s${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

exit $FAILED
