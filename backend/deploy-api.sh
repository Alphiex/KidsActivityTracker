#!/bin/bash

echo "🚀 Deploying Kids Activity Tracker API"
echo "====================================="

# Check if we have a cloud provider specified
PROVIDER=${1:-"railway"}

if [ "$PROVIDER" = "railway" ]; then
    echo "📦 Deploying to Railway..."
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo "❌ Railway CLI not found. Installing..."
        npm install -g @railway/cli
    fi
    
    # Deploy to Railway
    railway up --detach
    
    echo "✅ Deployment initiated on Railway"
    echo "🔗 Visit https://railway.app to view your deployment"
    
elif [ "$PROVIDER" = "heroku" ]; then
    echo "📦 Deploying to Heroku..."
    
    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        echo "❌ Heroku CLI not found. Please install it first."
        exit 1
    fi
    
    # Create app if it doesn't exist
    heroku create kids-activity-api --buildpack heroku/nodejs || true
    
    # Set environment variables
    heroku config:set NODE_ENV=production
    heroku config:set NPM_CONFIG_PRODUCTION=false
    
    # Deploy
    git push heroku main
    
    echo "✅ Deployment complete on Heroku"
    echo "🔗 Visit https://kids-activity-api.herokuapp.com"
    
elif [ "$PROVIDER" = "render" ]; then
    echo "📦 Setting up for Render deployment..."
    
    # Create render.yaml if it doesn't exist
    if [ ! -f "render.yaml" ]; then
        cat > render.yaml << EOF
services:
  - type: web
    name: kids-activity-api
    runtime: node
    buildCommand: npm install && npx prisma generate
    startCommand: node api/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
    healthCheckPath: /api/v1/health
EOF
    fi
    
    echo "✅ Render configuration created"
    echo "📋 Next steps:"
    echo "1. Push this code to GitHub"
    echo "2. Connect your GitHub repo to Render"
    echo "3. Add your DATABASE_URL in Render dashboard"
    echo "4. Deploy!"
    
else
    echo "❌ Unknown provider: $PROVIDER"
    echo "Supported providers: railway, heroku, render"
    exit 1
fi

echo ""
echo "📝 Post-deployment checklist:"
echo "1. Set DATABASE_URL environment variable"
echo "2. Run database migrations: npx prisma migrate deploy"
echo "3. Update app API URL to your deployment URL"
echo "4. Test the API endpoints"