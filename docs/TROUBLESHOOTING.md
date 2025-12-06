# Troubleshooting Guide

## iOS Development Issues

### iOS 18.4 Network Errors
**Problem**: Network requests fail with "Network Error" on iOS 18.4 simulator.

**Solution**: Use iOS 18.6 simulator instead.
```bash
./scripts/ios/run-simulator.sh
# Or specify UDID directly
npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
```

### Pod Install Failures
```bash
cd ios
rm -rf Pods Podfile.lock
pod cache clean --all
pod install
```

### Metro Bundler Issues
```bash
# Clear all caches
watchman watch-del-all
rm -rf node_modules
npm install
cd ios && pod install && cd ..
npx react-native start --reset-cache
```

### Xcode Build Errors

**"Could not compute dependency graph"**
```bash
# Kill Xcode processes
pkill -9 Xcode
pkill -9 xcodebuild

# Clear DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

**"database is locked"**
```bash
pkill -9 xcodebuild
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### Hermes dSYM Warning
For App Store builds, the Podfile includes settings to generate Hermes debug symbols. For archive builds:
```bash
ARCHIVE_BUILD=1 pod install
```

## API Issues

### No Activities Showing

1. Check database:
```bash
psql $DATABASE_URL -c "SELECT isActive, COUNT(*) FROM Activity GROUP BY isActive;"
```

2. Run scraper manually:
```bash
gcloud run jobs execute kids-activity-scraper-job --region=us-central1
```

3. Verify API health:
```bash
curl https://kids-activity-api-205843686007.us-central1.run.app/health
```

### API Returns 500 Error

Check logs:
```bash
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=kids-activity-api \
  AND severity>=ERROR" --limit=20
```

Common causes:
- Database connection timeout
- Missing environment variables
- Memory limit exceeded

### Rate Limiting

Default limits:
- General API: 100 requests/minute
- Auth endpoints: 5 attempts/15 minutes
- Search: 30 requests/minute

## Database Issues

### Connection Errors

```bash
# Verify PostgreSQL is running
pg_ctl status

# Check connection
gcloud sql connect kids-activity-db-dev --user=postgres
```

### Missing Prisma Module

```bash
cd server
npm install
npx prisma generate
```

### Migration Failures

```bash
# Check migration status
npx prisma migrate status

# Force reset (development only!)
npx prisma migrate reset
```

## Scraper Issues

### Scraper Not Running

```bash
# Check last execution
gcloud run jobs executions list \
  --job=kids-activity-scraper-job \
  --region=us-central1 --limit=1

# View logs
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=kids-activity-scraper-job" --limit=50
```

### Scraper Timeout

Increase timeout:
```bash
gcloud run jobs update kids-activity-scraper-job \
  --timeout=3600 --region=us-central1
```

### Browser/Memory Issues

Increase memory:
```bash
gcloud run jobs update kids-activity-scraper-job \
  --memory=4Gi --region=us-central1
```

## Build Issues

### TypeScript Errors

```bash
npm run typecheck
```

### Lint Errors

```bash
npm run lint
npm run lint -- --fix
```

### Bundle Errors

```bash
npx react-native start --reset-cache
```

## Common Error Messages

| Error | Solution |
|-------|----------|
| "No bundle URL present" | Restart Metro: `npm start --reset-cache` |
| "Cannot find module 'prisma'" | Run `npx prisma generate` in server/ |
| "Module not found" | Delete node_modules, reinstall |
| "Port already in use" | Kill process: `lsof -i :3000` then `kill -9 PID` |
| "Network request failed" | Check API URL and network connectivity |

## Health Checks

### Quick System Check
```bash
# API health
curl https://kids-activity-api-205843686007.us-central1.run.app/health

# Activity count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM Activity WHERE isActive = true;"

# Scraper status
gcloud run jobs executions list --job=kids-activity-scraper-job --limit=1
```

### Expected Values
- Active activities: ~2,900
- API response time: < 200ms
- Scraper success rate: > 95%
