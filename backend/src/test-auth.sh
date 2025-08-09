#!/bin/bash

# Test script for authentication system
# Make sure the server is running before executing this script

BASE_URL="http://localhost:3000/api"
EMAIL="test@example.com"
PASSWORD="TestPass123!"
NAME="Test User"

echo "=== Kids Activity Tracker Authentication Test ==="
echo ""

# Function to pretty print JSON
pretty_json() {
    echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

# 1. Test Registration
echo "1. Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"name\": \"$NAME\"
  }")

echo "Response:"
pretty_json "$REGISTER_RESPONSE"
echo ""

# Extract tokens
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"refreshToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Registration failed. Trying login instead..."
    echo ""
fi

# 2. Test Login
echo "2. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "Response:"
pretty_json "$LOGIN_RESPONSE"
echo ""

# Extract tokens if not already set
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
    REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"refreshToken":"[^"]*' | grep -o '[^"]*$')
fi

# 3. Test Protected Route
echo "3. Testing Protected Route..."
PROTECTED_RESPONSE=$(curl -s -X GET "$BASE_URL/protected" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
pretty_json "$PROTECTED_RESPONSE"
echo ""

# 4. Test Profile Endpoint
echo "4. Testing Profile Endpoint..."
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
pretty_json "$PROFILE_RESPONSE"
echo ""

# 5. Test Token Refresh
echo "5. Testing Token Refresh..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "Response:"
pretty_json "$REFRESH_RESPONSE"
echo ""

# 6. Test Password Reset Request
echo "6. Testing Password Reset Request..."
RESET_REQUEST_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\"
  }")

echo "Response:"
pretty_json "$RESET_REQUEST_RESPONSE"
echo ""

# 7. Test Invalid Login
echo "7. Testing Invalid Login (should fail)..."
INVALID_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"WrongPassword123!\"
  }")

echo "Response:"
pretty_json "$INVALID_LOGIN_RESPONSE"
echo ""

# 8. Test Logout
echo "8. Testing Logout..."
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
pretty_json "$LOGOUT_RESPONSE"
echo ""

echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "- Access Token: ${ACCESS_TOKEN:0:20}..."
echo "- Refresh Token: ${REFRESH_TOKEN:0:20}..."
echo ""
echo "Note: Check your email for verification link if this is a new registration."
echo "Some tests may fail if email verification is required but not completed."