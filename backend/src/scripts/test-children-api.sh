#!/bin/bash

# Test script for Children Profile Management API
# This script tests the main functionality of the children API

API_BASE="http://localhost:3000/api"
EMAIL="test-parent-$(date +%s)@example.com"
PASSWORD="TestPassword123!"

echo "Testing Children Profile Management API..."
echo "========================================="

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            ${data:+-d "$data"} \
            "$API_BASE$endpoint"
    else
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"} \
            "$API_BASE$endpoint"
    fi
}

# 1. Register user
echo "1. Registering user..."
REGISTER_RESPONSE=$(api_call POST "/auth/register" "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Test Parent\"}")
echo "Response: $REGISTER_RESPONSE"

# 2. Login
echo -e "\n2. Logging in..."
LOGIN_RESPONSE=$(api_call POST "/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "Logged in successfully. Token: ${TOKEN:0:20}..."

# 3. Create children
echo -e "\n3. Creating child profiles..."
CHILD1_RESPONSE=$(api_call POST "/children" '{"name":"Emma Test","dateOfBirth":"2018-05-15","gender":"female","interests":["swimming","art"]}' "$TOKEN")
CHILD1_ID=$(echo "$CHILD1_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Child 1 created. ID: $CHILD1_ID"

CHILD2_RESPONSE=$(api_call POST "/children" '{"name":"Liam Test","dateOfBirth":"2020-08-22","gender":"male","interests":["music","sports"]}' "$TOKEN")
CHILD2_ID=$(echo "$CHILD2_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Child 2 created. ID: $CHILD2_ID"

# 4. Get all children
echo -e "\n4. Getting all children..."
CHILDREN_RESPONSE=$(api_call GET "/children" "" "$TOKEN")
echo "Children list: $CHILDREN_RESPONSE"

# 5. Get children with stats
echo -e "\n5. Getting children with statistics..."
STATS_RESPONSE=$(api_call GET "/children/stats" "" "$TOKEN")
echo "Children stats: $STATS_RESPONSE"

# 6. Update child interests
echo -e "\n6. Updating child interests..."
UPDATE_RESPONSE=$(api_call PATCH "/children/$CHILD1_ID/interests" '{"interests":["swimming","dance","gymnastics"]}' "$TOKEN")
echo "Updated interests response: $UPDATE_RESPONSE"

# 7. Search children
echo -e "\n7. Searching children..."
SEARCH_RESPONSE=$(api_call GET "/children/search?q=Emma" "" "$TOKEN")
echo "Search results: $SEARCH_RESPONSE"

# 8. Get age-appropriate recommendations (assuming some activities exist)
echo -e "\n8. Getting activity recommendations for child..."
RECOMMENDATIONS=$(api_call GET "/child-activities/$CHILD1_ID/recommendations" "" "$TOKEN")
echo "Recommendations: $RECOMMENDATIONS"

# 9. Get calendar data
echo -e "\n9. Getting calendar data..."
CALENDAR_RESPONSE=$(api_call GET "/child-activities/calendar?view=month" "" "$TOKEN")
echo "Calendar events: $CALENDAR_RESPONSE"

# 10. Get activity statistics
echo -e "\n10. Getting activity statistics..."
ACTIVITY_STATS=$(api_call GET "/child-activities/stats" "" "$TOKEN")
echo "Activity stats: $ACTIVITY_STATS"

echo -e "\n========================================="
echo "Test completed!"
echo "Created test user: $EMAIL"
echo "Child IDs: $CHILD1_ID, $CHILD2_ID"