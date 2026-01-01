#!/bin/bash

# Setup Custom Domains for Kids Activity Tracker
# Maps kidsactivitytracker.com to Cloud Run services

set -e

PROJECT_ID="kids-activity-tracker-2024"
REGION="us-central1"

echo "========================================"
echo "Setting Up Custom Domains"
echo "========================================"
echo ""

# Ensure we're in the right project
gcloud config set project $PROJECT_ID

echo "Current domain mappings:"
gcloud run domain-mappings list --region $REGION --project $PROJECT_ID 2>/dev/null || echo "No mappings found"
echo ""

# Function to create domain mapping
create_domain_mapping() {
    local domain=$1
    local service=$2

    echo "Creating domain mapping: $domain -> $service"

    # Check if mapping already exists
    if gcloud run domain-mappings describe --domain "$domain" --region $REGION --project $PROJECT_ID >/dev/null 2>&1; then
        echo "  Domain mapping for $domain already exists"
    else
        gcloud run domain-mappings create \
            --service "$service" \
            --domain "$domain" \
            --region $REGION \
            --project $PROJECT_ID
        echo "  Created domain mapping for $domain"
    fi
}

echo "Setting up website domain mappings..."
# Main website
create_domain_mapping "kidsactivitytracker.ca" "kids-activity-website"
create_domain_mapping "www.kidsactivitytracker.ca" "kids-activity-website"

echo ""
echo "Setting up API domain mapping..."
# API subdomain
create_domain_mapping "api.kidsactivitytracker.ca" "kids-activity-api"

echo ""
echo "========================================"
echo "Domain DNS Configuration Required"
echo "========================================"
echo ""
echo "Add the following DNS records to your domain registrar:"
echo ""
echo "For kidsactivitytracker.com and www.kidsactivitytracker.com:"
gcloud run domain-mappings describe --domain kidsactivitytracker.com --region $REGION --format="value(status.resourceRecords)" 2>/dev/null || echo "  Run this script after verifying domain ownership"
echo ""
echo "For api.kidsactivitytracker.com:"
gcloud run domain-mappings describe --domain api.kidsactivitytracker.com --region $REGION --format="value(status.resourceRecords)" 2>/dev/null || echo "  Run this script after verifying domain ownership"
echo ""

echo "Verification status:"
gcloud run domain-mappings list --region $REGION --project $PROJECT_ID --format="table(metadata.name,status.conditions[0].type,status.conditions[0].status)"
echo ""

echo "Once DNS is configured, wait for SSL certificates to be provisioned (can take up to 15 minutes)."
echo ""
echo "Production URLs will be:"
echo "  Website: https://kidsactivitytracker.com"
echo "  API:     https://api.kidsactivitytracker.com"
