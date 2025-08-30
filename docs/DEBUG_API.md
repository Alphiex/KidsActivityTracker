# API Debugging Guide

This guide helps troubleshoot common issues with the Kids Activity Tracker API and mobile app integration.

## Production API Status ✅

- **API URL**: https://kids-activity-api-205843686007.us-central1.run.app
- **Status**: Deployed and working
- **Database**: 5000+ activities from NVRC
- **Authentication**: JWT-based with access/refresh tokens
- **Test Account**: Available (see below)

## Test Credentials

```
Email: test@kidsactivitytracker.com
Password: Test123!
```

## Quick API Test

Run the included test script:
```bash
./TEST_API.sh
```

Or test manually:

### 1. Health Check
```bash
curl https://kids-activity-api-205843686007.us-central1.run.app/health
```
Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-08-09T00:00:00.000Z"
}
```

### 2. Login Test
```bash
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@kidsactivitytracker.com","password":"Test123!"}'
```

### 3. Activities Test
```bash
# Get access token from login response first
ACCESS_TOKEN="your_access_token_here"

curl https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=5 \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Common Issues and Solutions

### 1. Network Connection Lost (iOS Simulator)

**Symptoms:**
- "The network connection was lost" error
- Activities don't load
- Login fails

**Solutions:**
1. **Reset iOS Simulator**
   - Device → Erase All Content and Settings
   - Restart the simulator

2. **Check Network in Simulator**
   - Open Safari in simulator
   - Navigate to: https://kids-activity-api-205843686007.us-central1.run.app/health
   - If this fails, the simulator has network issues

3. **Clear Metro Cache**
   ```bash
   npx react-native start --reset-cache
   ```

4. **Rebuild the App**
   ```bash
   cd ios && pod install && cd ..
   npm run ios
   ```

### 2. Authentication Issues

**Symptoms:**
- Login successful but subsequent requests fail
- "Unauthorized" errors
- Token expiry issues

**Solutions:**
1. **Check Token Storage**
   - The app uses MMKV for secure token storage
   - Tokens are stored with expiry timestamps
   
2. **Verify Token Format**
   - Access tokens expire in 15 minutes
   - Refresh tokens expire in 7 days
   - App automatically refreshes tokens

3. **Debug Token Issues**
   ```javascript
   // In activityService.ts, add logging
   console.log('Token:', await AsyncStorage.getItem('@auth_access_token'));
   ```

### 3. API Connection Issues

**Symptoms:**
- Cannot connect to backend
- CORS errors
- SSL certificate errors

**Solutions:**
1. **Check API Configuration**
   ```typescript
   // src/config/api.ts
   const API_CONFIG = {
     BASE_URL: 'https://kids-activity-api-205843686007.us-central1.run.app',
     // ...
   };
   ```

2. **Test with Local Backend**
   ```bash
   # Start local backend
   cd backend && npm run dev
   
   # Update src/config/api.ts
   const FORCE_LOCAL = true; // Use local API
   ```

3. **Check CORS Headers**
   - API allows requests from localhost
   - Check browser console for CORS errors

### 4. Activities Not Loading

**Symptoms:**
- Empty activity lists
- Search returns no results
- Categories not showing

**Solutions:**
1. **Check API Response**
   ```bash
   # Test activities endpoint directly
   curl "https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities?limit=10"
   ```

2. **Verify Query Parameters**
   - Use camelCase: `ageMin`, `ageMax`, `costMax`
   - NOT snake_case: ~~`age_min`~~, ~~`age_max`~~

3. **Check Network Status**
   - App shows offline indicator when no connection
   - Pull to refresh when back online

### 5. Database Issues

**Symptoms:**
- 500 errors from API
- "Database connection failed"

**Solutions:**
1. **Check Cloud SQL Status**
   ```bash
   gcloud sql instances describe kids-activity-db
   ```

2. **Verify Connection String**
   - Check Secret Manager in Google Cloud Console
   - Ensure database URL is correct

3. **Run Migrations**
   ```bash
   cd backend
   npm run db:migrate:prod
   ```

## Debugging Tools

### 1. React Native Debugger
- Press `Cmd + D` (iOS) or `Cmd + M` (Android)
- Enable "Debug with Chrome"
- View network requests and console logs

### 2. Reactotron
- Download Reactotron
- App automatically connects when running
- View Redux state, API calls, and logs

### 3. Xcode Console
- View native iOS logs
- Check for network errors
- Monitor memory usage

### 4. Cloud Logging
```bash
# View backend logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### 5. API Testing Tools
- **Postman**: Import the API collection
- **curl**: Use the test script examples
- **httpie**: `http GET kids-activity-api-205843686007.us-central1.run.app/health`

## Performance Optimization

### 1. Slow API Responses
- Check Cloud Run metrics
- Review database query performance
- Enable Redis caching

### 2. App Performance
- Use pagination (limit 20-50 items)
- Implement image lazy loading
- Enable Hermes for Android

### 3. Network Optimization
- API implements response compression
- Use conditional requests with ETags
- Cache responses locally

## Error Codes Reference

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Login or refresh token |
| 403 | Forbidden | Check user permissions |
| 404 | Not Found | Verify endpoint URL |
| 429 | Too Many Requests | Wait for rate limit reset |
| 500 | Server Error | Check backend logs |

## Monitoring

### 1. API Health
- Uptime monitoring: https://kids-activity-api-205843686007.us-central1.run.app/health
- Response time: Should be < 500ms
- Error rate: Should be < 1%

### 2. Mobile App Analytics
- Crash reports in App Center
- Performance monitoring
- User analytics

### 3. Backend Monitoring
- Cloud Run metrics
- Database performance
- Error tracking with Sentry

## Getting Help

1. **Check Logs First**
   - Mobile: React Native Debugger
   - Backend: Cloud Logging
   - Database: Cloud SQL logs

2. **Common Fixes**
   - Clear cache and restart
   - Update dependencies
   - Check network connection

3. **Still Stuck?**
   - Open GitHub issue with:
     - Error message
     - Steps to reproduce
     - Device/OS version
     - API endpoint tested