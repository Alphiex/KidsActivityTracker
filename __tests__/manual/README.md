# Manual Test Plan

This directory contains the manual test plan for Kids Activity Tracker.

## Files

- `MANUAL-TEST-PLAN.csv` - Comprehensive test cases spreadsheet (120+ test cases)

## Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| AUTH | 15 | Authentication: login, registration, password reset |
| SEARCH | 25 | Search and filter functionality |
| CHILD | 12 | Child profile management |
| FAV | 8 | Favorites functionality |
| CAL | 10 | Calendar views and navigation |
| PREF | 14 | User preferences across 7 screens |
| SUBS | 8 | Subscription and paywall |
| NOTIFY | 10 | Notification preferences and waitlist |
| SHARE | 6 | Family sharing functionality |
| ADMIN | 10 | Admin portal functions |
| E2E | 6 | End-to-end user journeys |

**Total: 124 test cases**

## CSV Structure

| Column | Description |
|--------|-------------|
| Test ID | Unique identifier (e.g., AUTH-001) |
| Category | Major category (AUTH, SEARCH, etc.) |
| Subcategory | Specific feature area |
| Test Name | Brief description of what's being tested |
| Preconditions | Required state before test |
| Steps | Numbered steps to execute |
| Expected Result | What should happen |
| Priority | High/Medium/Low |
| Status | Pending/Pass/Fail/Blocked |
| Tested By | Tester name |
| Test Date | Date tested |
| Notes | Additional observations |

## How to Use

### Importing to Spreadsheet

1. Open Google Sheets, Excel, or Numbers
2. Import `MANUAL-TEST-PLAN.csv`
3. Adjust column widths as needed
4. Add conditional formatting for Status column:
   - Green: Pass
   - Red: Fail
   - Yellow: Blocked
   - Gray: Pending

### Running Manual Tests

1. **Before Testing**
   - Install latest app build
   - Have test accounts ready
   - Clear app data for clean state tests

2. **During Testing**
   - Follow steps exactly as written
   - Update Status column immediately
   - Add Notes for any observations
   - Take screenshots for failures

3. **After Testing**
   - Review all failed tests
   - Create bug tickets for failures
   - Calculate pass rate

## Test Environments

| Environment | Purpose |
|-------------|---------|
| iOS Simulator | Primary development testing |
| iOS Device | Real device validation |
| Android Emulator | Android development testing |
| Android Device | Real device validation |

## Test Accounts

| Account Type | Email | Purpose |
|--------------|-------|---------|
| Demo User | demo@kidsactivity.com | General testing |
| Premium User | premium@test.com | Subscription features |
| Admin | admin@kidsactivity.com | Admin portal testing |

## Priority Levels

- **High**: Critical user flows, must pass for release
- **Medium**: Important features, should pass
- **Low**: Nice-to-have, can proceed with known issues

## Regression Testing

For each release, at minimum test:
- All HIGH priority tests
- Any tests related to changed features
- At least 50% of MEDIUM priority tests

## Reporting

After test execution, report:
- Total tests executed
- Pass/Fail counts
- Pass rate percentage
- Critical failures list
- Recommendations
