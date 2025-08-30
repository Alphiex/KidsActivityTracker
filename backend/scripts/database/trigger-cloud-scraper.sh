#!/bin/bash

echo "🕷️ Triggering NVRC Scraper on Cloud Run"
echo "========================================"

API_URL="https://kids-activity-api-205843686007.us-central1.run.app"

echo "🔍 Getting NVRC provider ID..."
provider_id=$(curl -s "$API_URL/api/v1/providers" | jq -r '.providers[] | select(.name=="NVRC") | .id')
echo "Provider ID: $provider_id"

echo ""
echo "🔄 Triggering scraper..."
response=$(curl -s -X POST "$API_URL/api/v1/scraper/trigger" \
  -H "Content-Type: application/json" \
  -d "{\"providerId\": \"$provider_id\"}")

echo "$response" | jq .

echo ""
echo "📊 Checking current activity count..."
curl -s "$API_URL/api/v1/activities/stats/summary" | jq .

echo ""
echo "🔍 Check scraper status:"
echo "curl $API_URL/api/v1/scraper/jobs | jq ."
echo ""
echo "📱 Your app should now connect to: $API_URL"
echo "✅ Activities will appear after scraping completes (~3-5 minutes)"