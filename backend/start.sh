#!/bin/sh
# Startup script for backend

echo "Starting Kids Activity Tracker backend..."
echo "Node version: $(node --version)"
echo "Environment: $NODE_ENV"

# Run database migrations if needed
echo "Running database migrations..."
npx prisma migrate deploy || echo "Migration failed or not needed"

# Start the TypeScript server
echo "Starting server with ts-node..."
exec npx ts-node src/server.ts