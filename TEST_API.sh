#!/bin/bash

API_URL="https://kids-activity-api-44042034457.us-central1.run.app"
ACCESS_TOKEN=""

echo "=== Kids Activity Tracker API Test ==="
echo "API URL: $API_URL"
echo ""

# Test Health Check
echo "1. Testing Health Check..."
curl -s "$API_URL/health" | jq '.'
echo ""

# Test Login
echo "2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@kidsactivitytracker.com","password":"Test123!"}')
echo "$LOGIN_RESPONSE" | jq '.'

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.tokens.accessToken')
echo "Access token obtained: ${ACCESS_TOKEN:0:20}..."
echo ""

# Test Activities Search
echo "3. Testing Activities Search..."
curl -s "$API_URL/api/v1/activities?limit=2" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.activities[].name'
echo ""

# Test Activities with Filter
echo "4. Testing Activities with Category Filter..."
curl -s "$API_URL/api/v1/activities?category=Team%20Sports&limit=2" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.activities[].name'
echo ""

# Test Categories
echo "5. Testing Categories Endpoint..."
curl -s "$API_URL/api/v1/categories" | jq '.categories[:5]'
echo ""

# Test Locations
echo "6. Testing Locations Endpoint..."
curl -s "$API_URL/api/v1/locations" | jq '.locations[:2]'
echo ""

# Test Favorites (GET)
echo "7. Testing Get Favorites..."
curl -s "$API_URL/api/favorites" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

# Test Activity Stats
echo "8. Testing Activity Stats..."
curl -s "$API_URL/api/v1/activities/stats/summary" | jq '.'
echo ""

# Test Auth Check
echo "9. Testing Auth Check..."
curl -s "$API_URL/api/auth/check" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
echo ""

echo "=== API Test Complete ===
"