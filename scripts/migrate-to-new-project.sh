#!/bin/bash

# Migration script for kids-activity-tracker-dev project
# This script helps automate the migration process

set -e

echo "========================================"
echo "Kids Activity Tracker Migration Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it with: brew install google-cloud-sdk"
    exit 1
fi

# Function to prompt for confirmation
confirm() {
    read -p "$1 (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

# Step 1: Create project
echo -e "\n${YELLOW}Step 1: Creating Google Cloud Project${NC}"
PROJECT_ID="kids-activity-tracker-dev"
if confirm "Create new project '$PROJECT_ID'?"; then
    gcloud projects create $PROJECT_ID --name="Kids Activity Tracker Dev" || echo "Project might already exist"
    gcloud config set project $PROJECT_ID
    echo -e "${GREEN}✓ Project created/selected${NC}"
else
    gcloud config set project $PROJECT_ID
    echo "Using existing project"
fi

# Step 2: Link billing
echo -e "\n${YELLOW}Step 2: Billing Account${NC}"
echo "Available billing accounts:"
gcloud beta billing accounts list
echo
read -p "Enter your billing account ID: " BILLING_ACCOUNT_ID
if [ ! -z "$BILLING_ACCOUNT_ID" ]; then
    gcloud beta billing projects link kids-activity-tracker-dev --billing-account=$BILLING_ACCOUNT_ID
    echo -e "${GREEN}✓ Billing account linked${NC}"
fi

# Step 3: Enable APIs
echo -e "\n${YELLOW}Step 3: Enabling Required APIs${NC}"
if confirm "Enable all required Google Cloud APIs?"; then
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
fi

# Step 4: Create Cloud SQL
echo -e "\n${YELLOW}Step 4: Cloud SQL Instance${NC}"
if confirm "Create minimal Cloud SQL instance (db-f1-micro)?"; then
    echo "Creating Cloud SQL instance..."
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
    read -s -p "Enter password for postgres user: " DB_PASSWORD
    echo
    gcloud sql users set-password postgres \
        --instance=kids-activity-db-dev \
        --password=$DB_PASSWORD
    
    echo -e "${GREEN}✓ Cloud SQL instance created${NC}"
fi

# Step 5: Create Redis
echo -e "\n${YELLOW}Step 5: Redis Instance${NC}"
if confirm "Create minimal Redis instance?"; then
    gcloud redis instances create kids-activity-redis-dev \
        --size=1 \
        --region=us-central1 \
        --redis-version=redis_7_0 \
        --tier=basic
    echo -e "${GREEN}✓ Redis instance created${NC}"
fi

# Step 6: Create Service Account
echo -e "\n${YELLOW}Step 6: Service Account${NC}"
if confirm "Create service account and grant permissions?"; then
    # Create service account
    gcloud iam service-accounts create kids-activity-cloud-run \
        --display-name="Kids Activity Cloud Run Service Account"
    
    # Grant permissions
    SA_EMAIL="kids-activity-cloud-run@kids-activity-tracker-dev.iam.gserviceaccount.com"
    
    gcloud projects add-iam-policy-binding kids-activity-tracker-dev \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/cloudsql.client"
    
    gcloud projects add-iam-policy-binding kids-activity-tracker-dev \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/redis.editor"
    
    gcloud projects add-iam-policy-binding kids-activity-tracker-dev \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/secretmanager.secretAccessor"
    
    echo -e "${GREEN}✓ Service account created${NC}"
fi

# Step 7: Get connection info and create secrets
echo -e "\n${YELLOW}Step 7: Creating Secrets${NC}"
if confirm "Create secrets in Secret Manager?"; then
    # Get Cloud SQL connection name
    SQL_CONNECTION=$(gcloud sql instances describe kids-activity-db-dev --format="value(connectionName)")
    
    # Get Redis host
    REDIS_HOST=$(gcloud redis instances describe kids-activity-redis-dev --region=us-central1 --format="value(host)")
    
    # Create database URL
    if [ -z "$DB_PASSWORD" ]; then
        read -s -p "Enter postgres password: " DB_PASSWORD
        echo
    fi
    
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
fi

# Step 8: Deploy backend
echo -e "\n${YELLOW}Step 8: Deploy Backend${NC}"
if confirm "Deploy backend to Cloud Run?"; then
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
    echo -e "${GREEN}✓ .env file updated${NC}"
fi

# Step 9: Initialize database
echo -e "\n${YELLOW}Step 9: Database Initialization${NC}"
if confirm "Initialize database with Prisma migrations?"; then
    cd backend
    
    # Update DATABASE_URL for local access
    export DATABASE_URL="$DATABASE_URL"
    
    # Run migrations
    npx prisma migrate deploy
    
    cd ..
    echo -e "${GREEN}✓ Database initialized${NC}"
fi

# Summary
echo -e "\n${GREEN}========================================"
echo "Migration Complete!"
echo "========================================${NC}"
echo
echo "Next steps:"
echo "1. Update src/config/api.ts with the new service URL"
echo "2. Test the API: curl $SERVICE_URL/health"
echo "3. Update any CI/CD pipelines"
echo
echo "To save costs when not developing:"
echo "- Stop Cloud SQL: gcloud sql instances patch kids-activity-db-dev --activation-policy=NEVER"
echo "- Start Cloud SQL: gcloud sql instances patch kids-activity-db-dev --activation-policy=ALWAYS"
echo
echo -e "${YELLOW}Remember: The old services in murmanspicks remain untouched.${NC}"