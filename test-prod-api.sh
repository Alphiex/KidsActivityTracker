#!/bin/bash

# First login
echo "Logging in..."
TOKEN=$(curl -s -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@kidsactivity.com","password":"Test123!"}' | jq -r '.tokens.accessToken')

echo "Token: ${TOKEN:0:30}..."

# Try to create a child
echo ""
echo "Creating child..."
curl -s -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/children \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Child","dateOfBirth":"2022-02-20T00:00:00.000Z"}' | jq .

# Try to get children
echo ""
echo "Getting children..."
curl -s -X GET https://kids-activity-api-205843686007.us-central1.run.app/api/children \
  -H "Authorization: Bearer $TOKEN" | jq .