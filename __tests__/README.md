# Kids Activity Tracker - Test Suite

Comprehensive testing infrastructure for the Kids Activity Tracker application, covering frontend (React Native), backend (Node.js/Express), and end-to-end testing with Detox.

## Test Statistics

| Category | Count | Description |
|----------|-------|-------------|
| Backend Route Tests | ~70 | API endpoint testing |
| Backend Unit Tests | ~25 | Services & middleware |
| Frontend Screen Tests | ~100 | Component rendering & interaction |
| Frontend Unit Tests | ~30 | Services & Redux store |
| Frontend Integration | ~15 | Multi-component flows |
| E2E Tests (Detox) | ~50 | Full user flow testing |
| **Total Automated** | **~290** | |
| Manual Test Cases | 124 | Structured CSV spreadsheet |

## Quick Start

```bash
# Run all unit tests
npm test

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend

# Run E2E tests (requires Detox build first)
npm run test:e2e:build
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run complete test suite
npm run test:all
```

## Directory Structure

```
__tests__/
├── README.md                          # This file
├── run-all-tests.sh                   # Master test runner
├── jest.config.js                     # Root Jest configuration
│
├── frontend/
│   ├── jest.config.js                 # Frontend Jest config
│   ├── setup.ts                       # Test setup & mocks
│   ├── mocks/                         # Shared mock utilities
│   │   ├── services.ts                # API & service mocks
│   │   ├── navigation.ts              # Navigation mocks
│   │   ├── redux.ts                   # Redux store mocks
│   │   └── testData.ts                # Test fixtures
│   ├── screens/                       # Screen-level tests
│   │   ├── auth/                      # Login, Register, ForgotPassword
│   │   ├── dashboard/                 # Dashboard screen
│   │   ├── search/                    # Search, Results, Filters
│   │   ├── activities/                # Detail, Calendar
│   │   ├── children/                  # List, Profile, AddEdit
│   │   ├── preferences/               # All preference screens
│   │   ├── profile/                   # Profile, Settings, Notifications
│   │   └── subscription/              # Paywall
│   ├── unit/
│   │   ├── services/                  # Service unit tests
│   │   └── store/                     # Redux slice tests
│   └── integration/                   # Multi-component flows
│
├── backend/
│   ├── jest.config.js                 # Backend Jest config
│   ├── setup.ts                       # Backend test setup
│   ├── mocks/                         # Backend mocks
│   │   ├── prisma.ts                  # Prisma client mock
│   │   ├── emailService.ts            # Email service mock
│   │   ├── testData.ts                # Backend test data
│   │   └── fixtures/                  # Data fixtures
│   ├── routes/                        # API endpoint tests
│   │   ├── auth.test.ts
│   │   ├── activities.test.ts
│   │   ├── children.test.ts
│   │   ├── favorites.test.ts
│   │   ├── notifications.test.ts
│   │   ├── admin/
│   │   └── vendor/
│   └── unit/
│       ├── services/
│       └── middleware/
│
├── e2e/
│   ├── .detoxrc.js                    # Detox configuration
│   ├── jest.config.js                 # E2E Jest config
│   ├── init.ts                        # Global setup
│   ├── flows/                         # User flow tests
│   │   ├── auth.e2e.ts
│   │   ├── search.e2e.ts
│   │   ├── childManagement.e2e.ts
│   │   ├── favorites.e2e.ts
│   │   ├── calendar.e2e.ts
│   │   └── onboarding.e2e.ts
│   └── utils/
│       ├── testHelpers.ts
│       └── testIds.ts
│
└── manual/
    ├── MANUAL-TEST-PLAN.csv           # 124 test cases
    └── README.md                      # Manual testing guide
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests |
| `npm run test:frontend` | Frontend tests only |
| `npm run test:backend` | Backend tests only |
| `npm run test:e2e` | Detox E2E tests |
| `npm run test:e2e:build` | Build app for E2E tests |
| `npm run test:unit` | All unit tests |
| `npm run test:integration` | Integration tests |
| `npm run test:screens` | Screen component tests |
| `npm run test:routes` | API route tests |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:watch` | Watch mode |
| `npm run test:all` | Complete test suite |

## Writing Tests

### Frontend Screen Test

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { createMockStore } from '../../mocks/redux';
import { mockActivityService } from '../../mocks/services';

import SearchScreen from '../../../../src/screens/SearchScreen';

describe('SearchScreen', () => {
  it('should search on text input', async () => {
    const { getByPlaceholderText } = render(
      <Provider store={createMockStore()}>
        <SearchScreen />
      </Provider>
    );

    fireEvent.changeText(getByPlaceholderText(/search/i), 'swimming');

    await waitFor(() => {
      expect(mockActivityService.searchActivities).toHaveBeenCalled();
    });
  });
});
```

### Backend Route Test

```typescript
import request from 'supertest';
import app from '../../../../server/src/app';
import { prismaMock } from '../../mocks/prisma';

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

### E2E Test

```typescript
import { device, element, by, expect } from 'detox';

describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should login successfully', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();

    await expect(element(by.id('dashboard-screen'))).toBeVisible();
  });
});
```

## Coverage Requirements

| Threshold | Target |
|-----------|--------|
| Branches | 60% |
| Functions | 60% |
| Lines | 60% |
| Statements | 60% |

Run `npm run test:coverage` to generate a detailed coverage report.

## CI/CD Integration

Tests are designed for CI/CD pipelines:

```yaml
# GitHub Actions example
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Manual Testing

See `manual/README.md` for detailed instructions.

The CSV file (`MANUAL-TEST-PLAN.csv`) contains 124 test cases:

| Category | Count | Description |
|----------|-------|-------------|
| AUTH | 15 | Login, registration, password reset |
| SEARCH | 25 | Search and filter functionality |
| CHILD | 12 | Child profile management |
| FAV | 8 | Favorites functionality |
| CAL | 10 | Calendar views |
| PREF | 14 | User preferences (7 screens) |
| SUBS | 8 | Subscription and paywall |
| NOTIFY | 10 | Notifications |
| SHARE | 6 | Family sharing |
| ADMIN | 10 | Admin portal |
| E2E | 6 | End-to-end journeys |

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase Jest timeout in config
2. **Mock not working**: Ensure mock imports before component
3. **Detox app not found**: Run `npm run test:e2e:build` first
4. **Prisma mock issues**: Clear cache with `jest --clearCache`

### Debug Mode

```bash
# Verbose output
npm test -- --verbose

# Single file
npm test -- path/to/test.ts

# Debug with inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```
