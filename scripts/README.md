# Project Scripts

All scripts for development, deployment, and maintenance of Kids Activity Tracker.

## Directory Structure

```
scripts/
├── ios/                    # iOS build and simulator scripts
│   ├── run-simulator.sh    # Run app on iOS 18.6 simulator
│   ├── build-archive.sh    # Build for App Store
│   ├── deploy-testflight.sh # Deploy to TestFlight
│   └── fix-hermes-dsym.sh  # Fix Hermes debugging symbols
├── android/                # Android build scripts (planned)
├── deployment/             # Production deployment
│   ├── deploy-api.sh       # Deploy API to Cloud Run
│   ├── deploy-server.sh    # Full server deployment
│   └── deploy-schema.js    # Deploy database schema
├── database/               # Database operations
│   ├── run-migration.js    # Run Prisma migrations
│   ├── seed-database.js    # Seed database with data
│   ├── check-database.js   # Verify database health
│   └── seed-categories.js  # Seed activity categories
└── development/            # Development utilities
    ├── reload-app.js       # Hot reload utility
    ├── create-test-users.js # Create test accounts
    └── fix-all-project-references.sh
```

## iOS Scripts

### run-simulator.sh
Runs the app on iOS 18.6 simulator (avoids iOS 18.4 network issues).

```bash
./scripts/ios/run-simulator.sh
# Also available as symlink: ./run-ios-18-6.sh
```

### build-archive.sh
Builds an archive for App Store submission.

```bash
./scripts/ios/build-archive.sh
```

### deploy-testflight.sh
Deploys to TestFlight for beta testing.

```bash
./scripts/ios/deploy-testflight.sh
```

## Deployment Scripts

### deploy-api.sh
Deploys the backend API to Google Cloud Run.

```bash
./scripts/deployment/deploy-api.sh
```

### deploy-server.sh
Full server deployment with all services.

```bash
./scripts/deployment/deploy-server.sh
```

### deploy-schema.js
Deploys Prisma schema changes to production.

```bash
node scripts/deployment/deploy-schema.js
```

## Database Scripts

### run-migration.js
Runs pending database migrations.

```bash
node scripts/database/run-migration.js
```

### seed-database.js
Seeds the database with initial data.

```bash
node scripts/database/seed-database.js
```

### check-database.js
Verifies database connectivity and health.

```bash
node scripts/database/check-database.js
```

## Development Scripts

### reload-app.js
Hot reloads the React Native app.

```bash
node scripts/development/reload-app.js
```

### create-test-users.js
Creates test user accounts for development.

```bash
node scripts/development/create-test-users.js
```

### fix-all-project-references.sh
Fixes project references after major file moves.

```bash
bash scripts/development/fix-all-project-references.sh
```

## Important Notes

### Before Running Scripts
1. Ensure you're in the project root directory
2. Make scripts executable: `chmod +x scripts/**/*.sh`
3. Have required environment variables set

### Environment Variables
Scripts may require:
- `DATABASE_URL` - PostgreSQL connection string
- `API_URL` - Backend API endpoint
- GCP credentials for deployment scripts

## Related Documentation

- [Development Guide](../docs/DEVELOPMENT.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Troubleshooting](../docs/TROUBLESHOOTING.md)
