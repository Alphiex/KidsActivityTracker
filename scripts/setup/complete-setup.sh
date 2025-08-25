#!/bin/bash

# Complete setup script after resources are created
# Run this after Cloud SQL and Redis are ready

set -e

echo "========================================"
echo "Completing Kids Activity Tracker Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="kids-activity-tracker-2024"

# Set project
gcloud config set project $PROJECT_ID

# Check Cloud SQL status
echo -e "\n${YELLOW}Checking Cloud SQL status...${NC}"
SQL_STATE=$(gcloud sql instances describe kids-activity-db-dev --format="value(state)")
if [ "$SQL_STATE" != "RUNNABLE" ]; then
    echo -e "${RED}Cloud SQL is not ready yet. State: $SQL_STATE${NC}"
    echo "Please wait for Cloud SQL to finish creating and run this script again."
    exit 1
fi
echo -e "${GREEN}✓ Cloud SQL is ready${NC}"

# Create database
echo -e "\n${YELLOW}Creating database...${NC}"
gcloud sql databases create kidsactivity --instance=kids-activity-db-dev || echo "Database might already exist"

# Set password
echo -e "\n${YELLOW}Setting database password${NC}"
read -s -p "Enter password for postgres user: " DB_PASSWORD
echo
gcloud sql users set-password postgres \
    --instance=kids-activity-db-dev \
    --password=$DB_PASSWORD

# Check Redis status
echo -e "\n${YELLOW}Checking Redis status...${NC}"
REDIS_STATE=$(gcloud redis instances describe kids-activity-redis-dev --region=us-central1 --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
if [ "$REDIS_STATE" != "READY" ]; then
    echo -e "${YELLOW}Redis is not ready yet. State: $REDIS_STATE${NC}"
    echo "Continuing without Redis (optional for basic operation)..."
    REDIS_HOST="redis-not-available"
else
    REDIS_HOST=$(gcloud redis instances describe kids-activity-redis-dev --region=us-central1 --format="value(host)")
    echo -e "${GREEN}✓ Redis is ready at $REDIS_HOST${NC}"
fi

# Update secrets
echo -e "\n${YELLOW}Updating secrets...${NC}"

# Get Cloud SQL connection name
SQL_CONNECTION=$(gcloud sql instances describe kids-activity-db-dev --format="value(connectionName)")

# Update database URL secret
DATABASE_URL="postgresql://postgres:$DB_PASSWORD@/kidsactivity?host=/cloudsql/$SQL_CONNECTION"
echo -n "$DATABASE_URL" | gcloud secrets versions add database-url --data-file=-

# Update Redis URL secret if Redis is ready
if [ "$REDIS_HOST" != "redis-not-available" ]; then
    REDIS_URL="redis://$REDIS_HOST:6379"
    echo -n "$REDIS_URL" | gcloud secrets versions add redis-url --data-file=-
fi

echo -e "${GREEN}✓ Secrets updated${NC}"

# Check Cloud Run deployment
echo -e "\n${YELLOW}Checking Cloud Run deployment...${NC}"
SERVICE_URL=$(gcloud run services describe kids-activity-api --region=us-central1 --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$SERVICE_URL" ]; then
    echo -e "${YELLOW}Cloud Run service not deployed yet. Deploying now...${NC}"
    cd backend
    gcloud builds submit --config cloudbuild-dev.yaml
    cd ..
    SERVICE_URL=$(gcloud run services describe kids-activity-api --region=us-central1 --format="value(status.url)")
fi

echo -e "${GREEN}✓ Service deployed at: $SERVICE_URL${NC}"

# Update configuration files
echo -e "\n${YELLOW}Updating configuration files...${NC}"

# Update .env
sed -i.bak "s|API_URL=.*|API_URL=$SERVICE_URL|" .env

# Update src/config/api.ts
sed -i.bak "s|PRODUCTION: 'https://kids-activity-api-.*'|PRODUCTION: '$SERVICE_URL'|" src/config/api.ts

echo -e "${GREEN}✓ Configuration updated${NC}"

# Initialize database
echo -e "\n${YELLOW}Initializing database...${NC}"
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

# Generate Prisma client
npx prisma generate

# Run migrations
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy

# Run seed
echo -e "\n${YELLOW}Seeding database...${NC}"
DATABASE_URL="$DATABASE_URL" npm run db:seed

cd ..

# Test the API
echo -e "\n${YELLOW}Testing API...${NC}"
curl -s "$SERVICE_URL/health" | jq . || echo "API test failed"

# Summary
echo -e "\n${GREEN}========================================"
echo "Setup Complete!"
echo "========================================${NC}"
echo
echo "Service URL: $SERVICE_URL"
echo "Project: $PROJECT_ID"
echo
echo "The API has been deployed and the database has been seeded with:"
echo "- NVRC provider configuration"
echo "- Test locations"
echo "- Test user (test@example.com)"
echo
echo "Next steps:"
echo "1. Update the mobile app with the new API URL"
echo "2. Test authentication: curl -X POST $SERVICE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"test123\"}'"
echo "3. Run the app: npm start"
echo
echo "To save costs when not developing:"
echo "- Run: ./scripts/dev-stop.sh"