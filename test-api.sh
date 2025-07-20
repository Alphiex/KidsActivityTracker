#!/bin/bash

echo "Testing Kids Camp Tracker API..."
echo ""

# Test the scrape endpoint
echo "1. Testing /api/scrape/nvrc endpoint:"
curl -s http://localhost:3000/api/scrape/nvrc | jq '{
  success: .success,
  totalFound: .totalFound,
  cached: .cached,
  firstCamp: .camps[0] | {
    name: .name,
    provider: .provider,
    cost: .cost,
    location: .location.name
  }
}'

echo ""
echo "2. Testing search endpoint with filters:"
curl -s "http://localhost:3000/api/camps/search?activityTypes=swimming,camps&maxCost=200" | jq '{
  success: .success,
  totalFound: .totalFound,
  camps: .camps | length
}'

echo ""
echo "Done!"