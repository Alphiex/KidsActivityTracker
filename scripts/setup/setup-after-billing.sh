#!/bin/bash

# Setup script to run after billing is enabled
# Run this after you've enabled billing for the kids-activity-tracker-2024 project

set -e

echo "========================================"
echo "Kids Activity Tracker Post-Billing Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="kids-activity-tracker-2024"

# Set project
echo -e "\n${YELLOW}Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable APIs
echo -e "\n${YELLOW}Enabling Required APIs${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    compute.googleapis.com \
    artifactregistry.googleapis.com

echo -e "${GREEN}✓ APIs enabled${NC}"

# Create Cloud SQL
echo -e "\n${YELLOW}Creating Cloud SQL Instance${NC}"
gcloud sql instances create kids-activity-db-dev \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --network=default \
    --no-backup \
    --database-flags=max_connections=25

# Create database
gcloud sql databases create kidsactivity \
    --instance=kids-activity-db-dev

# Set password
echo -e "\n${YELLOW}Setting database password${NC}"
read -s -p "Enter password for postgres user: " DB_PASSWORD
echo
gcloud sql users set-password postgres \
    --instance=kids-activity-db-dev \
    --password=$DB_PASSWORD

echo -e "${GREEN}✓ Cloud SQL instance created${NC}"

# Create Redis
echo -e "\n${YELLOW}Creating Redis Instance${NC}"
gcloud redis instances create kids-activity-redis-dev \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_7_0 \
    --tier=basic

echo -e "${GREEN}✓ Redis instance created${NC}"

# Create Service Account
echo -e "\n${YELLOW}Creating Service Account${NC}"
gcloud iam service-accounts create kids-activity-cloud-run \
    --display-name="Kids Activity Cloud Run Service Account"

SA_EMAIL="kids-activity-cloud-run@$PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/redis.editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

echo -e "${GREEN}✓ Service account created${NC}"

# Create Secrets
echo -e "\n${YELLOW}Creating Secrets${NC}"

# Get Cloud SQL connection name
SQL_CONNECTION=$(gcloud sql instances describe kids-activity-db-dev --format="value(connectionName)")

# Get Redis host
REDIS_HOST=$(gcloud redis instances describe kids-activity-redis-dev --region=us-central1 --format="value(host)")

# Create database URL
DATABASE_URL="postgresql://postgres:$DB_PASSWORD@/kidsactivity?host=/cloudsql/$SQL_CONNECTION"
echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=-

# Create Redis URL
REDIS_URL="redis://$REDIS_HOST:6379"
echo -n "$REDIS_URL" | gcloud secrets create redis-url --data-file=-

# Create JWT secrets
JWT_ACCESS_SECRET="jwt-access-$(openssl rand -hex 32)"
echo -n "$JWT_ACCESS_SECRET" | gcloud secrets create jwt-access-secret --data-file=-

JWT_REFRESH_SECRET="jwt-refresh-$(openssl rand -hex 32)"
echo -n "$JWT_REFRESH_SECRET" | gcloud secrets create jwt-refresh-secret --data-file=-

# Create session secret
SESSION_SECRET="session-$(openssl rand -hex 32)"
echo -n "$SESSION_SECRET" | gcloud secrets create session-secret --data-file=-

echo -e "${GREEN}✓ Secrets created${NC}"

# Deploy backend
echo -e "\n${YELLOW}Deploying Backend${NC}"
cd backend
gcloud builds submit --config cloudbuild-dev.yaml
cd ..

# Get the service URL
SERVICE_URL=$(gcloud run services describe kids-activity-api --region=us-central1 --format="value(status.url)")

echo -e "${GREEN}✓ Backend deployed${NC}"
echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"

# Update .env file
echo -e "\n${YELLOW}Updating .env file...${NC}"
sed -i.bak "s|API_URL=.*|API_URL=$SERVICE_URL|" .env

# Update src/config/api.ts
echo -e "\n${YELLOW}Updating API configuration...${NC}"
sed -i.bak "s|PRODUCTION: '.*'|PRODUCTION: '$SERVICE_URL'|" src/config/api.ts

echo -e "${GREEN}✓ Configuration updated${NC}"

# Initialize database
echo -e "\n${YELLOW}Initializing Database${NC}"
cd backend

# Export for Prisma
export DATABASE_URL="$DATABASE_URL"

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

cd ..
echo -e "${GREEN}✓ Database initialized${NC}"

# Summary
echo -e "\n${GREEN}========================================"
echo "Setup Complete!"
echo "========================================${NC}"
echo
echo "Service URL: $SERVICE_URL"
echo
echo "Next steps:"
echo "1. Run the data population script: cd backend && npm run seed"
echo "2. Test the API: curl $SERVICE_URL/health"
echo "3. Build and test the mobile app"
echo
echo "To save costs when not developing:"
echo "- Run: ./scripts/dev-stop.sh"