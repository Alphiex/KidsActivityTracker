# Test Account Information

## Production Test Account

Use this account to test the Kids Activity Tracker app:

```
Email: test@kidsactivitytracker.com
Password: Test123!
```

## Account Details

- **Name**: Test User
- **User ID**: 97c83803-5de9-4a79-967f-0ab4b3254190
- **Email Verified**: Yes (pre-verified)
- **Account Status**: Active
- **Created**: Production database

## Features Available

With the test account, you can:

1. **Authentication**
   - Login/Logout
   - Token refresh (automatic)
   - Session persistence

2. **Activity Discovery**
   - Browse 5000+ activities
   - Search by name, provider, description
   - Filter by category, age, location, price
   - View activity details

3. **Favorites**
   - Add/remove favorites
   - View favorites list
   - Sync across devices

4. **User Preferences**
   - Set age preferences
   - Choose favorite categories
   - Set maximum price
   - Configure notifications

5. **Dark Mode**
   - Toggle between light/dark themes
   - Theme preference saved

## Testing Different Scenarios

### 1. First-Time User Experience
```bash
# Clear app data first
# iOS: Delete app from simulator
# Android: Settings > Apps > Kids Activity Tracker > Clear Data
```

### 2. Search Testing
- Search for "Swimming" - Returns 800+ results
- Search for "Camp" - Returns 200+ results
- Search for "Basketball" - Returns team sports

### 3. Filter Testing
- Age Range: Try 6-12 years
- Price: Set max to $100
- Category: Select "Swimming" or "Camps"
- Location: Filter by recreation center

### 4. Offline Testing
1. Login and browse activities
2. Turn on Airplane Mode
3. App should show offline indicator
4. Previously viewed data remains accessible
5. Turn off Airplane Mode to sync

### 5. Error Handling
- Wrong password: Shows error message
- Network timeout: Shows retry option
- Invalid token: Auto-refreshes

## API Testing

Test the API directly:

```bash
# Login
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@kidsactivitytracker.com","password":"Test123!"}'

# Copy the accessToken from response
ACCESS_TOKEN="your_token_here"

# Get activities
curl https://kids-activity-api-205843686007.us-central1.run.app/api/v1/activities \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Get favorites
curl https://kids-activity-api-205843686007.us-central1.run.app/api/favorites \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Quick Test Script

Use the included test script for comprehensive API testing:

```bash
./TEST_API.sh
```

This script will:
1. Check API health
2. Login with test account
3. Fetch activities
4. Test filtering
5. Check favorites
6. Verify all endpoints

## Creating Additional Test Users

To create more test accounts:

```bash
curl -X POST https://kids-activity-api-205843686007.us-central1.run.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newtest@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

Or use the seed script:
```bash
cd backend
# Edit scripts/seed-test-user.js with new credentials
node scripts/seed-test-user.js
```

## Test Data

The database contains:
- **5000+ Activities**: Real data from NVRC
- **30 Categories**: Swimming, Camps, Sports, etc.
- **Multiple Locations**: Recreation centers across North Vancouver
- **Price Range**: Free to $1000+
- **Age Range**: 0-18 years

## Performance Testing

1. **Load Testing**
   - Search returns 50 results by default
   - Pagination available for large result sets
   - Infinite scroll implemented

2. **Network Conditions**
   - Test on 3G/4G speeds
   - Test with poor connectivity
   - Verify retry mechanisms work

3. **Device Testing**
   - iOS: iPhone 12 and newer
   - Android: API 21+ (Android 5.0+)
   - Tablets: iPad and Android tablets

## Known Test Scenarios

### Happy Path
1. Open app → Login → Browse activities → Search → Add favorites → Logout

### Edge Cases
1. Rapid filter changes
2. Very long search queries
3. Multiple concurrent API requests
4. Token expiry during usage
5. App backgrounding/foregrounding

### Stress Testing
1. Add 100+ favorites
2. Search with all filters active
3. Rapid navigation between screens
4. Pull-to-refresh repeatedly

## Troubleshooting Test Account

If the test account doesn't work:

1. **Check API Health**
   ```bash
   curl https://kids-activity-api-205843686007.us-central1.run.app/health
   ```

2. **Verify Account Exists**
   - Try the login endpoint
   - Check for specific error messages

3. **Reset Password** (if implemented)
   - Use forgot password flow
   - Or create a new test account

## Notes

- This account bypasses email verification since it's pre-verified
- The account has full access to all features
- Password is securely hashed with bcrypt (12 rounds)
- Account preferences are set to default values with onboarding completed
- Tokens expire: Access (15 min), Refresh (7 days)

## Support

For issues with the test account:
1. Check [DEBUG_API.md](./DEBUG_API.md) for troubleshooting
2. Verify API is accessible
3. Create a new test account if needed