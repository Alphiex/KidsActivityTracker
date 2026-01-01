#!/bin/bash

# ============================================================================
# ACTIVITY TYPES MIGRATION DEPLOYMENT TO PRODUCTION
# ============================================================================
# 
# This script deploys the activity types fix to production, ensuring that
# squash activities are correctly categorized under "Racquet Sports"
# instead of "Swimming & Aquatics"
# 
# ============================================================================

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# ============================================================================
# CONFIGURATION
# ============================================================================

configure_production() {
    # Production Cloud SQL configuration - get from GCP
    DB_HOST=$(gcloud sql instances describe kids-activity-db-dev --format='value(ipAddresses[0].ipAddress)' 2>/dev/null)
    DB_PORT="5432"
    DB_NAME="kidsactivity"
    DB_USER="postgres"

    # Get password from GCP Secret Manager or environment variable
    if [ -n "${PRODUCTION_DB_PASSWORD:-}" ]; then
        DB_PASSWORD="$PRODUCTION_DB_PASSWORD"
    else
        DB_PASSWORD=$(gcloud secrets versions access latest --secret=database-url 2>/dev/null | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    fi

    if [ -z "$DB_PASSWORD" ]; then
        error "Could not get database password from PRODUCTION_DB_PASSWORD or GCP Secret Manager"
        echo "Please run: export PRODUCTION_DB_PASSWORD=\"your-password\""
        exit 1
    fi

    if [ -z "$DB_HOST" ]; then
        error "Could not get Cloud SQL IP. Make sure gcloud is configured."
        exit 1
    fi

    export PGPASSWORD="$DB_PASSWORD"

    log "Configured for production database: $DB_HOST:$DB_PORT/$DB_NAME"
}

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================

pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check database connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        error "Cannot connect to production database"
        exit 1
    fi
    success "Production database connectivity verified"
    
    # Check that migration script exists
    if [ ! -f "$SCRIPT_DIR/deploy-activity-types-migration.sql" ]; then
        error "Migration script missing: $SCRIPT_DIR/deploy-activity-types-migration.sql"
        exit 1
    fi
    success "Migration script found"
    
    # Require explicit confirmation for production
    warning "You are about to deploy ACTIVITY TYPES migration to PRODUCTION!"
    warning "This will create ActivityType and ActivitySubtype tables and fix the squash categorization."
    echo ""
    echo -n "Type 'DEPLOY_ACTIVITY_TYPES' to continue: "
    read -r confirmation
    
    if [ "$confirmation" != "DEPLOY_ACTIVITY_TYPES" ]; then
        error "Deployment cancelled"
        exit 1
    fi
}

# ============================================================================
# MIGRATION DEPLOYMENT
# ============================================================================

deploy_migration() {
    log "Deploying activity types migration to production..."
    
    # Run the migration script
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/deploy-activity-types-migration.sql"; then
        success "Activity types migration completed successfully"
    else
        error "Activity types migration failed!"
        exit 1
    fi
}

# ============================================================================
# VERIFICATION
# ============================================================================

verify_deployment() {
    log "Verifying activity types deployment..."
    
    # Check that squash is correctly categorized
    local squash_check=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT at.name 
        FROM \"ActivitySubtype\" ast 
        JOIN \"ActivityType\" at ON ast.\"activityTypeId\" = at.id 
        WHERE ast.code = 'squash';
    " | tr -d ' ')
    
    if [ "$squash_check" = "RacquetSports" ]; then
        success "✅ Squash is correctly categorized under 'Racquet Sports'"
    else
        error "❌ Squash categorization verification failed. Found: '$squash_check'"
        return 1
    fi
    
    # Check activity type counts
    local type_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"ActivityType\";" | tr -d ' ')
    local subtype_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"ActivitySubtype\";" | tr -d ' ')
    
    log "Activity Types created: $type_count"
    log "Activity Subtypes created: $subtype_count"
    
    if [ "$type_count" -ge "22" ] && [ "$subtype_count" -ge "40" ]; then
        success "Activity type and subtype counts look correct"
        return 0
    else
        error "Activity type/subtype counts seem low"
        return 1
    fi
}

# ============================================================================
# CODE DEPLOYMENT
# ============================================================================

deploy_code_to_production() {
    log "Deploying updated backend code to production..."
    
    cd "$PROJECT_ROOT"
    
    # Build and deploy the API
    if [ -f "deploy/deploy-production.sh" ]; then
        log "Running production deployment script..."
        ./deploy/deploy-production.sh
        success "Backend code deployed to production"
    else
        warning "No deploy-production.sh found, running manual deployment..."
        
        # Manual deployment
        log "Building Docker image..."
        docker build -t gcr.io/kids-activity-tracker-2024/kids-activity-api:latest .
        
        log "Pushing to Google Container Registry..."
        docker push gcr.io/kids-activity-tracker-2024/kids-activity-api:latest
        
        log "Deploying to Cloud Run..."
        gcloud run deploy kids-activity-api \
          --image gcr.io/kids-activity-tracker-2024/kids-activity-api:latest \
          --region us-central1 \
          --platform managed \
          --allow-unauthenticated \
          --memory 2Gi \
          --cpu 2 \
          --timeout 3600 \
          --max-instances 10 \
          --set-env-vars NODE_ENV=production \
          --add-cloudsql-instances kids-activity-tracker-2024:us-central1:kids-activity-db-dev \
          --set-secrets DATABASE_URL=DATABASE_URL:latest
        
        success "Manual deployment completed"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "=================================================================="
    echo "🚀 ACTIVITY TYPES MIGRATION DEPLOYMENT TO PRODUCTION"
    echo "=================================================================="
    echo ""
    
    configure_production
    pre_deployment_checks
    deploy_migration
    
    if verify_deployment; then
        success "🎉 Activity types migration COMPLETED successfully!"
        echo ""
        log "NEXT STEPS:"
        log "1. Deploy updated backend code to production"
        log "2. Update frontend if needed"
        log "3. Test API endpoints"
        log "4. Run scrapers to populate with correct categorization"
        echo ""
        
        # Ask if user wants to deploy code now
        echo -n "Deploy updated backend code to production now? (y/N): "
        read -r deploy_code
        
        if [ "$deploy_code" = "y" ] || [ "$deploy_code" = "Y" ]; then
            deploy_code_to_production
        else
            warning "Remember to deploy updated backend code manually later!"
        fi
        
        echo ""
        success "✅ PRODUCTION DEPLOYMENT COMPLETE!"
        echo ""
        log "API URL: https://kids-activity-api-205843686007.us-central1.run.app"
        log "Test endpoint: curl 'https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activity-types/racquet-sports'"
        
    else
        error "Migration verification failed!"
        exit 1
    fi
}

# Handle script interruption
trap 'error "Script interrupted!"; exit 1' INT TERM

# Run main function
main "$@"