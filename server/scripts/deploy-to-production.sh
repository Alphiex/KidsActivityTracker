#!/bin/bash

# ============================================================================
# PRODUCTION DATABASE SCHEMA NORMALIZATION DEPLOYMENT SCRIPT
# ============================================================================
# 
# This script safely deploys the database schema normalization to production.
# 
# USAGE: ./deploy-to-production.sh [environment]
# 
# ENVIRONMENTS:
#   - local: Deploy to local development database
#   - staging: Deploy to staging database  
#   - production: Deploy to production database
# 
# ============================================================================

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default environment
ENVIRONMENT="${1:-local}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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
# ENVIRONMENT CONFIGURATION
# ============================================================================

configure_environment() {
    case $ENVIRONMENT in
        "local")
            DB_HOST="localhost"
            DB_PORT="5432"
            DB_NAME="kids_activity_tracker"
            DB_USER="postgres"
            DB_PASSWORD="postgres"
            ;;
        "staging")
            error "Staging environment not configured"
            exit 1
            ;;
        "production")
            # Production Cloud SQL configuration
            DB_HOST="34.42.149.102"  # Cloud SQL public IP (kids-activity-db-dev)
            DB_PORT="5432"
            DB_NAME="kidsactivity"
            DB_USER="postgres"
            DB_PASSWORD="${PRODUCTION_DB_PASSWORD:-}"
            
            if [ -z "$DB_PASSWORD" ]; then
                error "PRODUCTION_DB_PASSWORD environment variable not set"
                exit 1
            fi
            ;;
        *)
            error "Invalid environment: $ENVIRONMENT"
            echo "Valid environments: local, staging, production"
            exit 1
            ;;
    esac
    
    export PGPASSWORD="$DB_PASSWORD"
    
    log "Configured for environment: $ENVIRONMENT"
    log "Database: $DB_HOST:$DB_PORT/$DB_NAME"
}

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================

pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check database connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        error "Cannot connect to database"
        exit 1
    fi
    success "Database connectivity verified"
    
    # Check that required scripts exist
    local required_scripts=(
        "$SCRIPT_DIR/pre-migration-backup.sql"
        "$SCRIPT_DIR/deploy-normalized-schema.sql"
        "$SCRIPT_DIR/verify-normalized-schema.sql"
        "$SCRIPT_DIR/rollback-normalized-schema.sql"
    )
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "$script" ]; then
            error "Required script missing: $script"
            exit 1
        fi
    done
    success "All required scripts found"
    
    # For production, require explicit confirmation
    if [ "$ENVIRONMENT" = "production" ]; then
        warning "You are about to deploy to PRODUCTION database!"
        warning "This will modify the database schema and consolidate location data."
        echo -n "Type 'DEPLOY_TO_PRODUCTION' to continue: "
        read -r confirmation
        
        if [ "$confirmation" != "DEPLOY_TO_PRODUCTION" ]; then
            error "Deployment cancelled"
            exit 1
        fi
    fi
}

# ============================================================================
# BACKUP PHASE
# ============================================================================

create_backup() {
    log "Creating pre-migration backup..."
    
    # Create timestamped backup
    local backup_file="$PROJECT_ROOT/backups/pre_normalization_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$(dirname "$backup_file")"
    
    # Full database backup
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$backup_file"
    success "Full database backup created: $backup_file"
    
    # Run backup script for detailed backup
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/pre-migration-backup.sql"
    success "Detailed backup tables created"
}

# ============================================================================
# MIGRATION PHASE
# ============================================================================

run_migration() {
    log "Running database schema normalization migration..."
    
    # Run the main migration script
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/deploy-normalized-schema.sql"; then
        success "Migration completed successfully"
    else
        error "Migration failed!"
        warning "You may need to run the rollback script: $SCRIPT_DIR/rollback-normalized-schema.sql"
        exit 1
    fi
}

# ============================================================================
# VERIFICATION PHASE
# ============================================================================

verify_migration() {
    log "Verifying migration results..."
    
    # Run verification script
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/verify-normalized-schema.sql"
    
    # Check migration status from verification
    local migration_status=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        WITH counts AS (
            SELECT 
                (SELECT COUNT(*) FROM \"City\") as total_cities,
                (SELECT COUNT(*) FROM \"Location\" WHERE \"cityId\" IS NOT NULL) as locations_with_city,
                (SELECT COUNT(*) FROM \"Activity\" WHERE \"locationId\" IS NOT NULL) as activities_with_location
        )
        SELECT 
            CASE 
                WHEN total_cities > 0 AND locations_with_city > 0 AND activities_with_location > 0
                THEN 'SUCCESS'
                ELSE 'FAILED'
            END
        FROM counts;
    " | tr -d ' ')
    
    if [ "$migration_status" = "SUCCESS" ]; then
        success "Migration verification PASSED"
        return 0
    else
        error "Migration verification FAILED"
        return 1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    log "Starting database schema normalization deployment"
    log "Environment: $ENVIRONMENT"
    echo ""
    
    configure_environment
    pre_deployment_checks
    create_backup
    run_migration
    
    if verify_migration; then
        success "🎉 Database schema normalization deployment COMPLETED successfully!"
        echo ""
        log "NEXT STEPS:"
        log "1. Update application code to use new schema structure"
        log "2. Deploy updated application code"
        log "3. Restart scrapers with updated location logic"
        log "4. Monitor application for any issues"
        echo ""
        log "If issues occur, run rollback: $SCRIPT_DIR/rollback-normalized-schema.sql"
    else
        error "Migration verification failed!"
        warning "Consider running rollback script"
        exit 1
    fi
}

# Handle script interruption
trap 'error "Script interrupted! Database may be in inconsistent state."; exit 1' INT TERM

# Run main function
main "$@"