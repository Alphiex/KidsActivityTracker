#!/bin/bash

# ============================================================================
# Search Filter Validation Test Script
# ============================================================================
# This script tests the search API to verify all filter combinations work
# correctly with AND logic. Each returned result is validated against the
# filter criteria.
# ============================================================================

set -e

API_BASE="https://kids-activity-api-205843686007.us-central1.run.app/api/v1"
LIMIT=20  # Number of results to validate per test

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ============================================================================
# Python validation script (embedded)
# ============================================================================

PYTHON_VALIDATOR=$(cat << 'PYEOF'
import sys
import json
import re

def validate_activity(activity, validators):
    """Validate a single activity against all validators."""
    failures = []
    
    for validator_name, validator_func in validators.items():
        try:
            result = validator_func(activity)
            if not result:
                failures.append(validator_name)
        except Exception as e:
            failures.append(f"{validator_name}: {str(e)}")
    
    return failures

def contains_text(activity, search_term):
    """Check if search term is in name, description, category, or location."""
    search_lower = search_term.lower()
    fields = [
        activity.get('name', ''),
        activity.get('description', ''),
        activity.get('category', ''),
        activity.get('subcategory', ''),
        activity.get('location', {}).get('name', '') if activity.get('location') else ''
    ]
    return any(search_lower in (f or '').lower() for f in fields)

def in_location(activity, location_term):
    """Check if activity is in specified location."""
    location_lower = location_term.lower()
    loc = activity.get('location', {}) or {}
    city = (loc.get('city', '') or '').lower()
    name = (loc.get('name', '') or '').lower()
    return location_lower in city or location_lower in name

def has_activity_type(activity, type_code):
    """Check if activity has specified type code."""
    act_type = activity.get('activityType', {}) or {}
    return act_type.get('code') == type_code

def age_in_range(activity, age_min=None, age_max=None):
    """Check if activity age range overlaps with specified range."""
    act_min = activity.get('ageMin') or 0
    act_max = activity.get('ageMax') or 100
    
    if age_min is not None and act_max < age_min:
        return False
    if age_max is not None and act_min > age_max:
        return False
    return True

def cost_in_range(activity, cost_max=None):
    """Check if activity cost is within range."""
    cost = activity.get('cost') or 0
    if cost_max is not None and cost > cost_max:
        return False
    return True

def run_validation(query_params, validator_config):
    """Run validation on API response."""
    data = json.load(sys.stdin)
    
    if not data.get('success', True):
        print(f"FAIL|API error: {data.get('error', 'unknown')}")
        return
    
    activities = data.get('activities', [])
    total = data.get('total', 0)
    
    if len(activities) == 0:
        print(f"PASS|0 results (total: {total})")
        return
    
    failed_activities = []
    
    for activity in activities:
        name = activity.get('name', 'Unknown')
        failures = []
        
        for check_name, check_func in validator_config.items():
            if not check_func(activity):
                failures.append(check_name)
        
        if failures:
            failed_activities.append((name, failures))
    
    if failed_activities:
        fail_count = len(failed_activities)
        fail_details = "; ".join([f"{n}: {','.join(f)}" for n, f in failed_activities[:3]])
        print(f"FAIL|{fail_count}/{len(activities)} failed - {fail_details}")
    else:
        print(f"PASS|{len(activities)} activities validated (total: {total})")

# Parse arguments and run
if __name__ == "__main__":
    test_type = sys.argv[1] if len(sys.argv) > 1 else ""
    
    validators = {}
    
    if test_type == "search":
        search_term = sys.argv[2]
        validators["contains_search"] = lambda a: contains_text(a, search_term)
    
    elif test_type == "activity_type":
        type_code = sys.argv[2]
        validators["has_type"] = lambda a: has_activity_type(a, type_code)
    
    elif test_type == "age":
        age_min = int(sys.argv[2]) if len(sys.argv) > 2 else None
        age_max = int(sys.argv[3]) if len(sys.argv) > 3 else None
        validators["age_range"] = lambda a: age_in_range(a, age_min, age_max)
    
    elif test_type == "cost":
        cost_max = float(sys.argv[2])
        validators["cost_max"] = lambda a: cost_in_range(a, cost_max)
    
    elif test_type == "location":
        location = sys.argv[2]
        validators["in_location"] = lambda a: in_location(a, location)
    
    elif test_type == "search_location":
        search_term = sys.argv[2]
        location = sys.argv[3]
        validators["contains_search"] = lambda a: contains_text(a, search_term)
        validators["in_location"] = lambda a: in_location(a, location)
    
    elif test_type == "search_type":
        search_term = sys.argv[2]
        type_code = sys.argv[3]
        validators["contains_search"] = lambda a: contains_text(a, search_term)
        validators["has_type"] = lambda a: has_activity_type(a, type_code)
    
    elif test_type == "search_age_cost":
        search_term = sys.argv[2]
        age_max = int(sys.argv[3])
        cost_max = float(sys.argv[4])
        validators["contains_search"] = lambda a: contains_text(a, search_term)
        validators["age_range"] = lambda a: age_in_range(a, None, age_max)
        validators["cost_max"] = lambda a: cost_in_range(a, cost_max)
    
    elif test_type == "type_location":
        type_code = sys.argv[2]
        location = sys.argv[3]
        validators["has_type"] = lambda a: has_activity_type(a, type_code)
        validators["in_location"] = lambda a: in_location(a, location)
    
    elif test_type == "all_filters":
        search_term = sys.argv[2]
        type_code = sys.argv[3]
        location = sys.argv[4]
        age_min = int(sys.argv[5])
        age_max = int(sys.argv[6])
        cost_max = float(sys.argv[7])
        validators["contains_search"] = lambda a: contains_text(a, search_term)
        validators["has_type"] = lambda a: has_activity_type(a, type_code)
        validators["in_location"] = lambda a: in_location(a, location)
        validators["age_range"] = lambda a: age_in_range(a, age_min, age_max)
        validators["cost_max"] = lambda a: cost_in_range(a, cost_max)
    
    elif test_type == "zero_results":
        # Just check that we got 0 results
        data = json.load(sys.stdin)
        total = data.get('total', 0)
        if total == 0:
            print("PASS|0 results as expected")
        else:
            print(f"FAIL|Expected 0 results, got {total}")
        sys.exit(0)
    
    else:
        print(f"FAIL|Unknown test type: {test_type}")
        sys.exit(1)
    
    run_validation(test_type, validators)
PYEOF
)

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local query_params="$2"
    local validation_type="$3"
    shift 3
    local validation_args=("$@")
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Test: $test_name"
    log_info "Query: $query_params"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Make API call and validate
    local result
    result=$(curl -s "${API_BASE}/activities?${query_params}&limit=${LIMIT}" | \
        python3 -c "$PYTHON_VALIDATOR" "$validation_type" "${validation_args[@]}")
    
    local status="${result%%|*}"
    local details="${result#*|}"
    
    if [ "$status" == "PASS" ]; then
        log_success "$details"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_fail "$details"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# ============================================================================
# Single Filter Tests
# ============================================================================

run_single_filter_tests() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║              PART 1: SINGLE FILTER TESTS                           ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    
    run_test "Text Search: skating" \
        "search=skating" \
        "search" "skating"
    
    run_test "Activity Type: skating-wheels" \
        "categories=skating-wheels" \
        "activity_type" "skating-wheels"
    
    run_test "Age Range: 5-10 years" \
        "ageMin=5&ageMax=10" \
        "age" "5" "10"
    
    run_test "Cost Range: max \$50" \
        "costMax=50" \
        "cost" "50"
    
    run_test "Location: Vancouver" \
        "location=Vancouver" \
        "location" "Vancouver"
    
    run_test "Activity Type: team-sports" \
        "categories=team-sports" \
        "activity_type" "team-sports"
}

# ============================================================================
# Multi-Filter Combination Tests (AND Logic)
# ============================================================================

run_multi_filter_tests() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║         PART 2: MULTI-FILTER COMBINATION TESTS (AND LOGIC)         ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    
    run_test "Search + Location: skating in Vancouver" \
        "search=skating&location=Vancouver" \
        "search_location" "skating" "Vancouver"
    
    run_test "Search + Activity Type: swim + swimming-aquatics" \
        "search=swim&categories=swimming-aquatics" \
        "search_type" "swim" "swimming-aquatics"
    
    run_test "Search + Age + Cost: dance, age<=8, cost<=100" \
        "search=dance&ageMax=8&costMax=100" \
        "search_age_cost" "dance" "8" "100"
    
    run_test "Activity Type + Location: team-sports in Toronto" \
        "categories=team-sports&location=Toronto" \
        "type_location" "team-sports" "Toronto"
    
    run_test "All Filters: swim + swimming-aquatics + Vancouver + age 4-12 + cost<=200" \
        "search=swim&categories=swimming-aquatics&location=Vancouver&ageMin=4&ageMax=12&costMax=200" \
        "all_filters" "swim" "swimming-aquatics" "Vancouver" "4" "12" "200"
    
    run_test "Search + Location: hockey in Toronto" \
        "search=hockey&location=Toronto" \
        "search_location" "hockey" "Toronto"
}

# ============================================================================
# Edge Case Tests
# ============================================================================

run_edge_case_tests() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                    PART 3: EDGE CASE TESTS                         ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    
    run_test "Filters Only (no search text): team-sports in Toronto" \
        "categories=team-sports&location=Toronto" \
        "type_location" "team-sports" "Toronto"
    
    run_test "Case Insensitivity: SKATING (uppercase)" \
        "search=SKATING" \
        "search" "skating"
    
    run_test "Case Insensitivity: SwImMiNg (mixed case)" \
        "search=SwImMiNg" \
        "search" "swimming"
    
    # Note: "Zero results" for ageMin=100&ageMax=200 is NOT expected because
    # activities with null age fields (all-ages) will still be returned.
    # This is correct behavior. Instead, test a valid edge case.
    run_test "Edge Case: Very narrow age range (exactly 7)" \
        "ageMin=7&ageMax=7" \
        "age" "7" "7"
    
    run_test "Special Characters: arts crafts" \
        "search=arts%20crafts" \
        "search" "arts"
}

# ============================================================================
# Generate Report
# ============================================================================

generate_report() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║                      TEST RESULTS SUMMARY                          ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Total Tests:  $TOTAL_TESTS"
    echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        echo ""
        return 1
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════╗"
    echo "║         SEARCH FILTER VALIDATION TEST SUITE                        ║"
    echo "╚════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "API: $API_BASE"
    echo "Started: $(date)"
    echo ""
    
    # Check if python3 is installed
    if ! command -v python3 &> /dev/null; then
        echo "Error: python3 is required but not installed"
        exit 1
    fi
    
    # Run all test categories
    run_single_filter_tests
    run_multi_filter_tests
    run_edge_case_tests
    
    # Generate final report
    generate_report
    
    exit $?
}

# Run main
main "$@"
