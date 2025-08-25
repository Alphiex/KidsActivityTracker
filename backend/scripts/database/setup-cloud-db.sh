#!/bin/bash

echo "🔧 Kids Activity Tracker - Cloud Database Setup"
echo "=============================================="

# Check if DATABASE_URL is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your cloud database URL"
    echo "Usage: ./setup-cloud-db.sh 'postgresql://username:password@host:port/database'"
    exit 1
fi

DATABASE_URL=$1

echo "📊 Setting up database with provided URL..."

# Export DATABASE_URL for this session
export DATABASE_URL="$DATABASE_URL"

# Run Prisma migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔄 Generating Prisma client..."
npx prisma generate

# Seed initial data
echo "🌱 Seeding initial data..."
npx prisma db seed

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env.production with your DATABASE_URL"
echo "2. Deploy your API using ./deploy-api.sh"
echo "3. Update src/config/api.ts with your deployed API URL"
echo "4. Test the connection!"