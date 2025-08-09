# Kids Activity Tracker - Integration Test Scenarios

## Overview

This document outlines comprehensive integration test scenarios for the Kids Activity Tracker application. These tests verify that all components work together correctly across the full stack.

## Test Environment Setup

### Prerequisites
- Backend API running on `http://localhost:3000`
- PostgreSQL database with test data
- Mobile app running on simulator/device
- Test user credentials:
  - Email: `test@example.com`
  - Password: `password123`

### Test Data
Run the test data generation script:
```bash
cd backend
node scripts/generate-test-data.js
```

## Integration Test Scenarios

### 1. User Registration and Authentication Flow

#### Test Case 1.1: New User Registration
**Steps:**
1. Open mobile app
2. Navigate to Register screen
3. Enter user details:
   - Name: "New Test User"
   - Email: "newuser@example.com"
   - Password: "SecurePass123!"
4. Submit registration
5. Check email for verification link
6. Click verification link
7. Login with new credentials

**Expected Results:**
- User created in database
- Verification email sent
- Email verification updates user status
- Login returns JWT tokens
- User redirected to dashboard

#### Test Case 1.2: User Login and Token Refresh
**Steps:**
1. Login with test credentials
2. Make authenticated API call
3. Wait for access token to expire (or force expiration)
4. Make another API call
5. Verify token refresh happens automatically
6. Continue using app

**Expected Results:**
- Initial login successful
- API calls work with valid token
- Expired token triggers refresh
- New tokens obtained seamlessly
- User experience uninterrupted

### 2. Children Management Flow

#### Test Case 2.1: Create Child Profile
**Steps:**
1. Login as test user
2. Navigate to Children screen
3. Tap "Add Child"
4. Enter child details:
   - Name: "Test Child"
   - Age: 8
   - Gender: Female
   - Interests: Swimming, Arts
5. Save child profile
6. Verify child appears in list

**Expected Results:**
- Child profile created in database
- Avatar generated automatically
- Child appears in children list
- Interests saved correctly

#### Test Case 2.2: Edit Child Profile
**Steps:**
1. Select existing child from list
2. Tap edit button
3. Update age to 9
4. Add "Music" to interests
5. Save changes
6. Verify updates reflected

**Expected Results:**
- Changes saved to database
- UI updates immediately
- Activity recommendations update based on new age/interests

### 3. Activity Search and Discovery

#### Test Case 3.1: Search Activities by Type
**Steps:**
1. Navigate to Search screen
2. Select activity type "Swimming"
3. Set age range 6-10
4. Set max cost $200
5. Submit search
6. Review results

**Expected Results:**
- Only swimming activities shown
- All activities within age range
- All activities under $200
- Results sorted by relevance

#### Test Case 3.2: Location-Based Search
**Steps:**
1. Enable location permissions
2. Search for activities
3. Sort by distance
4. Select activity to view details
5. Check map view

**Expected Results:**
- Activities sorted by proximity
- Distance displayed correctly
- Map shows activity location
- Directions available

### 4. Activity Registration Flow

#### Test Case 4.1: Register Child for Activity
**Steps:**
1. Search and select an activity
2. View activity details
3. Select child to register
4. Tap "Register"
5. Review registration details
6. Confirm registration

**Expected Results:**
- Child linked to activity
- Status shows "registered"
- Activity appears in child's schedule
- Remaining spots updated

#### Test Case 4.2: Manage Waitlist
**Steps:**
1. Select fully-booked activity
2. Add child to waitlist
3. Check waitlist position
4. Receive notification when spot opens
5. Confirm registration

**Expected Results:**
- Child added to waitlist
- Position displayed
- Notification sent when available
- Can convert to registration

### 5. Favorites and Recommendations

#### Test Case 5.1: Save Favorite Activities
**Steps:**
1. Browse activities
2. Tap heart icon to favorite
3. Navigate to Favorites screen
4. Verify favorites listed
5. Remove a favorite

**Expected Results:**
- Favorites saved to database
- Heart icon shows active state
- Favorites screen shows all saved
- Can remove favorites

#### Test Case 5.2: Get Personalized Recommendations
**Steps:**
1. Ensure child has interests set
2. Navigate to child's profile
3. View recommendations section
4. Verify recommendations match interests
5. Register for recommended activity

**Expected Results:**
- Recommendations based on interests
- Age-appropriate activities shown
- Similar activities suggested
- Easy registration from recommendations

### 6. Activity Sharing Flow

#### Test Case 6.1: Share Child's Schedule
**Steps:**
1. Navigate to child's profile
2. Tap "Share Schedule"
3. Enter co-parent's email
4. Set permission level (view/manage)
5. Send invitation
6. Co-parent accepts invitation

**Expected Results:**
- Invitation created in database
- Email sent to co-parent
- Co-parent can view after accepting
- Permissions enforced correctly

#### Test Case 6.2: Manage Shared Access
**Steps:**
1. View shared children list
2. Check shared activities
3. Update activity (if permitted)
4. Revoke sharing access
5. Verify access removed

**Expected Results:**
- Shared children visible
- Can view all activities
- Updates require permission
- Revocation immediate

### 7. End-to-End User Journey

#### Test Case 7.1: Complete User Flow
**Steps:**
1. Register new user
2. Verify email
3. Login
4. Create 2 child profiles
5. Search for swimming activities
6. Register first child
7. Add activity to favorites
8. Share child with co-parent
9. Search for music activities
10. Register second child
11. View family calendar
12. Logout

**Expected Results:**
- All steps complete successfully
- Data persists correctly
- No errors or crashes
- Performance acceptable
- User experience smooth

### 8. Error Handling and Edge Cases

#### Test Case 8.1: Network Failures
**Steps:**
1. Login successfully
2. Disable network
3. Try to search activities
4. Re-enable network
5. Retry search

**Expected Results:**
- Appropriate error messages
- Cached data still accessible
- Graceful degradation
- Auto-retry when connected

#### Test Case 8.2: Concurrent Updates
**Steps:**
1. Login on two devices
2. Update child profile on device 1
3. Update same profile on device 2
4. Check final state
5. Verify conflict resolution

**Expected Results:**
- Last update wins
- No data corruption
- User notified of conflicts
- Can manually resolve

## Performance Tests

### Test Case P1: Load Testing
**Steps:**
1. Generate 100 test users
2. Each user has 2-3 children
3. Simulate concurrent activity searches
4. Monitor API response times
5. Check database performance

**Metrics:**
- API response time < 200ms
- Database queries < 50ms
- No memory leaks
- CPU usage stable

### Test Case P2: Data Volume Testing
**Steps:**
1. Load 10,000 activities
2. Search with various filters
3. Load user with 10 children
4. View monthly calendar
5. Generate reports

**Metrics:**
- Search returns < 1 second
- Calendar loads < 2 seconds
- Smooth scrolling
- No UI freezes

## Security Tests

### Test Case S1: Authentication Security
**Steps:**
1. Try accessing protected endpoints without token
2. Use expired token
3. Use malformed token
4. Try SQL injection in search
5. Test XSS in user inputs

**Expected Results:**
- 401 errors for unauthorized
- No data leakage
- Inputs sanitized
- Injection attempts blocked

### Test Case S2: Data Privacy
**Steps:**
1. Create two separate users
2. Try to access other user's children
3. Try to modify other user's data
4. Check API responses for data leaks
5. Verify shared access controls

**Expected Results:**
- Users isolated completely
- No unauthorized access
- Shared access respects permissions
- No sensitive data in logs

## Automated Test Scripts

### Running Integration Tests
```bash
# Backend integration tests
cd backend
npm run test:integration

# Mobile app E2E tests
cd ..
npm run test:e2e
```

### Sample Test Script
```javascript
// backend/tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/server');

describe('Authentication Flow', () => {
  test('User can register, verify, and login', async () => {
    // Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    
    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.tokens).toBeDefined();
  });
});
```

## Test Reporting

### Test Coverage Goals
- Unit Tests: 80% coverage
- Integration Tests: All critical paths
- E2E Tests: Major user journeys
- Performance: All endpoints < 200ms
- Security: OWASP Top 10 covered

### Reporting Template
```
Test Run Date: _______
Environment: _______
Total Tests: _______
Passed: _______
Failed: _______
Skipped: _______

Critical Issues:
1. _______
2. _______

Performance Metrics:
- Average API Response: _______ms
- Database Query Time: _______ms
- App Launch Time: _______s

Recommendations:
1. _______
2. _______
```

## Continuous Integration

### CI Pipeline
```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm run test:all
      - name: Upload coverage
        uses: codecov/codecov-action@v1
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL
   - Verify PostgreSQL running
   - Check network connectivity

2. **Authentication Failures**
   - Verify JWT secrets match
   - Check token expiration
   - Clear token cache

3. **Mobile App API Errors**
   - Verify API_URL in config
   - Check CORS settings
   - Ensure backend running

4. **Test Data Issues**
   - Re-run test data script
   - Check for duplicate emails
   - Reset database if needed

## Next Steps

1. Implement automated test suite
2. Set up CI/CD pipeline
3. Add performance monitoring
4. Create user acceptance tests
5. Document test results