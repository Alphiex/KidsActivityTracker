# Troubleshooting Guide

Common issues and solutions for Kids Activity Tracker development.

## iOS Development

### Network Errors on iOS 18.4

**Problem**: API requests fail with "Network Error" on iOS 18.4 simulator.

**Solution**: Use iOS 18.6 simulator instead.

```bash
# Use the run script (recommended)
./scripts/ios/run-simulator.sh

# Or specify UDID directly
npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
```

**Available iOS 18.6 Simulators**:
| Device | UDID |
|--------|------|
| iPhone 16 Pro | A8661E75-FE3E-483F-8F13-AC87110E8EE2 |
| iPhone 16 Pro Max | 9F3BA117-5391-4064-9FAF-8A7CA82CE93C |
| iPhone 16 | 6558E69E-75D4-4088-B42B-DBD7F5FDFAFA |

### Pod Install Failures

```bash
cd ios
rm -rf Pods Podfile.lock
pod cache clean --all
pod install --repo-update
```

### Metro Bundler Issues

```bash
# Full cache clear
watchman watch-del-all
rm -rf node_modules
npm install
cd ios && pod install && cd ..
npx react-native start --reset-cache
```

### Xcode Build Errors

**"Could not compute dependency graph"**
```bash
pkill -9 Xcode
pkill -9 xcodebuild
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

**"database is locked"**
```bash
pkill -9 xcodebuild
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

**Build fails after React Native upgrade**
```bash
cd ios
rm -rf Pods Podfile.lock build
pod deintegrate
pod setup
pod install
cd ..
npx react-native run-ios
```

### Simulator Won't Start

```bash
# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase all
```

## Backend Issues

### Database Connection Errors

**"Connection refused"**
1. Verify PostgreSQL is running: `pg_isready`
2. Check connection string in `.env`
3. Verify IP allowlist for Cloud SQL

**"Authentication failed"**
1. Verify password in connection string
2. Check user permissions in database

### Prisma Errors

**"Schema drift detected"**
```bash
cd server
npx prisma migrate dev
```

**"Cannot find module '@prisma/client'"**
```bash
cd server
npx prisma generate
```

**"Migration failed"**
```bash
# View status
npx prisma migrate status

# Reset (development only!)
npx prisma migrate reset
```

### API Errors

**401 Unauthorized**
- Token expired - refresh tokens
- Token missing - check auth header
- Token invalid - re-login

**429 Too Many Requests**
- Rate limited - wait 15 minutes
- Reduce request frequency

**500 Internal Server Error**
- Check server logs
- Verify database connection
- Check environment variables

## Scraper Issues

### Scraper Timeout

**Symptoms**: Job fails after 30 minutes

**Solutions**:
1. Check target website availability
2. Increase timeout in provider config
3. Reduce concurrent requests
4. Check for website changes

### Missing Activities

**Symptoms**: Fewer activities than expected

**Solutions**:
1. Verify entry points in config
2. Check if website structure changed
3. Review scraper logs for errors
4. Test locally with debug mode

```bash
DEBUG=scraper:* node scrapers/scraperJob.js --provider=vancouver
```

### Rate Limiting (429 from target site)

**Solutions**:
1. Reduce `requestsPerMinute` in config
2. Increase delay between requests
3. Reduce `concurrentRequests`

## TypeScript Issues

### Type Errors After Schema Change

```bash
cd server
npx prisma generate
```

### Module Not Found

```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Verify tsconfig paths
npm run typecheck
```

### Type Mismatches

1. Check import paths
2. Verify interface definitions
3. Update type definitions if schema changed

## Redux/State Issues

### State Not Persisting

1. Check MMKV storage initialization
2. Verify persist configuration
3. Check for storage errors in logs

### Stale Data

```typescript
// Force refresh
dispatch(activitiesSlice.actions.clearCache());
await dispatch(fetchActivities());
```

## Network/API Issues

### CORS Errors

**Browser development only**:
1. Verify origin in server CORS config
2. Check request headers
3. Ensure credentials mode matches

### Request Timeout

1. Check network connectivity
2. Verify API is running
3. Check for rate limiting
4. Increase timeout in axios config

### SSL/Certificate Errors

**Development**:
- Use HTTP for local development
- Configure proxy for HTTPS

**Production**:
- Verify SSL certificate is valid
- Check certificate chain

## Build/Deploy Issues

### Cloud Build Failures

```bash
# View build logs
gcloud builds list --limit 5
gcloud builds log BUILD_ID
```

**Common causes**:
- Missing dependencies in package.json
- TypeScript compilation errors
- Dockerfile issues

### Cloud Run Deployment Failures

```bash
# Check service status
gcloud run services describe kids-activity-api --region us-central1

# View error logs
gcloud run services logs read kids-activity-api \
  --region us-central1 \
  --filter "severity>=ERROR"
```

### App Store Submission Rejected

**Privacy manifest missing**:
- Update `ios/PrivacyInfo.xcprivacy`
- Include required API declarations

**Missing screenshots**:
- Provide all required device sizes
- Follow App Store guidelines

## Debug Commands

### Check System Status

```bash
# iOS simulator list
xcrun simctl list devices

# Metro bundler status
lsof -i :8081

# Backend server status
lsof -i :3000

# PostgreSQL status
pg_isready
```

### View Logs

```bash
# Metro bundler logs (in terminal running Metro)

# Backend logs (in terminal running server)

# Cloud Run logs
gcloud run services logs read kids-activity-api \
  --region us-central1 \
  --limit 100

# Xcode build logs
# Open Xcode > View > Navigators > Reports
```

### Clear All Caches

```bash
# React Native caches
watchman watch-del-all
rm -rf node_modules
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

# iOS caches
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData

# npm cache
npm cache clean --force

# Reinstall
npm install
cd ios && pod install && cd ..
```

## Getting Help

1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Review recent commits for breaking changes
4. Check Cloud Run logs for backend issues
5. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details
   - Relevant logs

---

**Document Version**: 4.0
**Last Updated**: December 2024
