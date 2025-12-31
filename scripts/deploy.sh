#!/bin/bash
# =============================================================================
# Kids Activity Tracker - Unified Deployment Script
# =============================================================================
#
# Usage:
#   ./scripts/deploy.sh <command> [options]
#
# Commands:
#   api          Deploy API service
#   website      Deploy website
#   scrapers     Deploy all scraper jobs
#   all          Deploy everything (api + website)
#   status       Show deployment status
#   logs         View service logs
#   rollback     Rollback to previous revision
#   health       Check health of all services
#
# Options:
#   --production   Deploy with production settings (default)
#   --staging      Deploy with staging settings
#   --dry-run      Show what would be deployed without deploying
#
# Examples:
#   ./scripts/deploy.sh api
#   ./scripts/deploy.sh all --production
#   ./scripts/deploy.sh logs api
#   ./scripts/deploy.sh rollback api
#
# =============================================================================

set -e

# Configuration
PROJECT_ID="kids-activity-tracker-2024"
REGION="us-central1"
API_SERVICE="kids-activity-api"
WEBSITE_SERVICE="kids-activity-website"
API_URL="https://kids-activity-api-205843686007.us-central1.run.app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default settings
ENVIRONMENT="production"
DRY_RUN=false

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Kids Activity Tracker - Deployment${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check gcloud authentication
    if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null | grep -q "@"; then
        log_error "Not authenticated with gcloud. Run 'gcloud auth login'"
        exit 1
    fi
    log_success "gcloud authenticated"
    
    # Check project
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
        log_warning "Switching project from $CURRENT_PROJECT to $PROJECT_ID"
        gcloud config set project $PROJECT_ID
    fi
    log_success "Project: $PROJECT_ID"
    
    # Check required secrets exist
    local required_secrets=("database-url" "jwt-access-secret" "jwt-refresh-secret" "openai-api-key")
    for secret in "${required_secrets[@]}"; do
        if ! gcloud secrets describe "$secret" --project=$PROJECT_ID &>/dev/null; then
            log_error "Required secret '$secret' not found"
            exit 1
        fi
    done
    log_success "All required secrets exist"
    
    echo ""
}

# =============================================================================
# Deployment Functions
# =============================================================================

deploy_api() {
    log_info "Deploying API service..."
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN: Would deploy API from server/Dockerfile"
        return 0
    fi
    
    # Navigate to server directory
    cd "$(dirname "$0")/../server"
    
    # Build and push image
    local IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${API_SERVICE}:latest"
    log_info "Building image: $IMAGE"
    gcloud builds submit --tag "$IMAGE" .
    
    # Deploy to Cloud Run with VPC connector
    log_info "Deploying to Cloud Run..."
    gcloud run deploy $API_SERVICE \
        --image "$IMAGE" \
        --region $REGION \
        --platform managed \
        --allow-unauthenticated \
        --memory 2Gi \
        --cpu 2 \
        --timeout 300 \
        --concurrency 100 \
        --min-instances 0 \
        --max-instances 20 \
        --vpc-connector kids-activity-connector \
        --vpc-egress private-ranges-only \
        --set-env-vars "NODE_ENV=$ENVIRONMENT" \
        --set-secrets "DATABASE_URL=database-url:latest,JWT_ACCESS_SECRET=jwt-access-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,OPENAI_API_KEY=openai-api-key:latest"
    
    # Health check
    log_info "Running health check..."
    sleep 5
    if curl -sf "$API_URL/health" | grep -q '"status":"healthy"'; then
        log_success "API deployed and healthy!"
    else
        log_warning "API deployed but health check inconclusive"
    fi
    
    cd - > /dev/null
}

deploy_website() {
    log_info "Deploying website..."
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN: Would deploy website from website/Dockerfile"
        return 0
    fi
    
    # Navigate to website directory
    cd "$(dirname "$0")/../website"
    
    # Build and deploy using cloudbuild.yaml
    local IMAGE="gcr.io/${PROJECT_ID}/website:latest"
    log_info "Building image using Cloud Build..."
    
    # Use the cloudbuild.yaml which handles build args properly
    gcloud builds submit --config=cloudbuild.yaml .
    
    log_success "Website deployed!"
    
    cd - > /dev/null
}

deploy_scrapers() {
    log_info "Deploying scraper jobs..."
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN: Would update scraper job images"
        return 0
    fi
    
    # Navigate to server directory
    cd "$(dirname "$0")/../server"
    
    # Build scraper image
    local IMAGE="gcr.io/${PROJECT_ID}/kids-activity-scraper:latest"
    log_info "Building scraper image: $IMAGE"
    docker build -f scrapers/Dockerfile -t "$IMAGE" .
    docker push "$IMAGE"
    
    # Update main scraper job
    log_info "Updating scraper job..."
    gcloud run jobs update kids-activity-scraper-job \
        --region $REGION \
        --image "$IMAGE" \
        --cpu 4 \
        --memory 4Gi \
        --max-retries 1 \
        --task-timeout 30m \
        --set-env-vars "NODE_ENV=production,HEADLESS=true" \
        --set-secrets "DATABASE_URL=database-url:latest"
    
    log_success "Scraper jobs updated!"
    
    cd - > /dev/null
}

deploy_all() {
    log_info "Deploying all services..."
    deploy_api
    deploy_website
    log_success "All services deployed!"
}

# =============================================================================
# Status and Monitoring
# =============================================================================

show_status() {
    print_header
    log_info "Service Status"
    echo ""
    
    echo -e "${CYAN}Cloud Run Services:${NC}"
    gcloud run services list --region=$REGION --project=$PROJECT_ID \
        --format="table(metadata.name,status.url,spec.template.spec.containers[0].resources.limits)"
    
    echo ""
    echo -e "${CYAN}Recent Scraper Jobs:${NC}"
    gcloud run jobs list --region=$REGION --project=$PROJECT_ID --limit=5 \
        --format="table(metadata.name,status.latestCreatedExecution.completionTime,status.latestCreatedExecution.succeededCount)"
    
    echo ""
    echo -e "${CYAN}Database Instance:${NC}"
    gcloud sql instances describe kids-activity-db-dev --project=$PROJECT_ID \
        --format="table(name,settings.tier,state,settings.dataDiskSizeGb)"
}

view_logs() {
    local service=$1
    if [ -z "$service" ]; then
        log_error "Usage: deploy.sh logs <api|website|scraper>"
        exit 1
    fi
    
    case $service in
        api)
            gcloud run services logs read $API_SERVICE --region=$REGION --project=$PROJECT_ID --limit=100
            ;;
        website)
            gcloud run services logs read $WEBSITE_SERVICE --region=$REGION --project=$PROJECT_ID --limit=100
            ;;
        scraper)
            gcloud run jobs executions list --job=kids-activity-scraper-job --region=$REGION --project=$PROJECT_ID --limit=5
            ;;
        *)
            log_error "Unknown service: $service"
            exit 1
            ;;
    esac
}

rollback() {
    local service=$1
    if [ -z "$service" ]; then
        log_error "Usage: deploy.sh rollback <api|website>"
        exit 1
    fi
    
    local service_name
    case $service in
        api) service_name=$API_SERVICE ;;
        website) service_name=$WEBSITE_SERVICE ;;
        *)
            log_error "Unknown service: $service"
            exit 1
            ;;
    esac
    
    log_info "Available revisions for $service_name:"
    gcloud run revisions list --service=$service_name --region=$REGION --project=$PROJECT_ID --limit=5
    
    echo ""
    read -p "Enter revision name to rollback to: " revision
    
    if [ -n "$revision" ]; then
        log_info "Rolling back to $revision..."
        gcloud run services update-traffic $service_name \
            --region=$REGION \
            --project=$PROJECT_ID \
            --to-revisions=$revision=100
        log_success "Rollback complete!"
    fi
}

check_health() {
    print_header
    log_info "Health Check"
    echo ""
    
    # API health
    echo -n "API: "
    if curl -sf "$API_URL/health" 2>/dev/null | grep -q '"status":"healthy"'; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy${NC}"
    fi
    
    # AI health
    echo -n "AI Service: "
    if curl -sf "$API_URL/api/v1/ai/recommendations/health" 2>/dev/null | grep -q '"status":"healthy"'; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${YELLOW}⚠ Unavailable${NC}"
    fi
    
    # Database health
    echo -n "Database: "
    local db_state=$(gcloud sql instances describe kids-activity-db-dev --project=$PROJECT_ID --format="value(state)" 2>/dev/null)
    if [ "$db_state" = "RUNNABLE" ]; then
        echo -e "${GREEN}✓ Running${NC}"
    else
        echo -e "${RED}✗ State: $db_state${NC}"
    fi
    
    echo ""
}

show_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  api          Deploy API service"
    echo "  website      Deploy website"
    echo "  scrapers     Deploy scraper jobs"
    echo "  all          Deploy everything"
    echo "  status       Show deployment status"
    echo "  logs <svc>   View service logs (api|website|scraper)"
    echo "  rollback     Rollback to previous revision"
    echo "  health       Check health of all services"
    echo ""
    echo "Options:"
    echo "  --production   Deploy with production settings (default)"
    echo "  --staging      Deploy with staging settings"
    echo "  --dry-run      Show what would be deployed"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

# Parse options
while [[ $# -gt 0 ]]; do
    case $1 in
        --production)
            ENVIRONMENT="production"
            shift
            ;;
        --staging)
            ENVIRONMENT="staging"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            break
            ;;
    esac
done

# Get command
COMMAND=$1
shift || true

# Execute command
case $COMMAND in
    api)
        print_header
        preflight_checks
        deploy_api
        ;;
    website)
        print_header
        preflight_checks
        deploy_website
        ;;
    scrapers)
        print_header
        preflight_checks
        deploy_scrapers
        ;;
    all)
        print_header
        preflight_checks
        deploy_all
        ;;
    status)
        show_status
        ;;
    logs)
        view_logs "$1"
        ;;
    rollback)
        rollback "$1"
        ;;
    health)
        check_health
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
