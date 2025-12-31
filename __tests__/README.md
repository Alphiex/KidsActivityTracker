# Kids Activity Tracker - Test Suite

Comprehensive automated testing for the Kids Activity Tracker app.

## Test Statistics

| Category | Count |
|----------|-------|
| Backend Tests | ~70 |
| Frontend Tests | ~100 |
| E2E Tests | ~12 |
| Integration Tests | ~18 |
| **Total Automated** | **~200** |
| Manual Test Cases | 120+ |

## Quick Start

```bash
# Run all unit tests
npm test

# Run frontend tests only
npm run test:frontend

# Run backend tests only
npm run test:backend

# Run E2E tests
npm run test:e2e

# Run complete test suite
npm run test:all
```

## Directory Structure

```
__tests__/
├── frontend/                 # React Native tests
│   ├── unit/                 # Unit tests
│   │   ├── services/         # Service tests
│   │   ├── components/       # Component tests
│   │   └── store/            # Redux slice tests
│   ├── screens/              # Screen tests
│   ├── integration/          # Integration flow tests
│   └── mocks/                # Frontend mocks
│
├── backend/                  # Express/Node.js tests
│   ├── unit/                 # Unit tests
│   │   ├── services/         # Service tests
│   │   └── middleware/       # Middleware tests
│   ├── routes/               # API endpoint tests
│   ├── integration/          # Database integration tests
│   └── mocks/                # Backend mocks
│
├── e2e/                      # Detox E2E tests
│   └── flows/                # User flow tests
│
└── manual/                   # Manual test plan
    ├── MANUAL-TEST-PLAN.csv  # Test cases spreadsheet
    └── README.md             # Manual testing guide
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests |
| `npm run test:frontend` | Frontend tests only |
| `npm run test:backend` | Backend tests only |
| `npm run test:e2e` | Detox E2E tests |
| `npm run test:unit` | All unit tests |
| `npm run test:integration` | Integration tests |
| `npm run test:screens` | Screen component tests |
| `npm run test:routes` | API route tests |
| `npm run test:coverage` | Run with coverage report |
| `npm run test:watch` | Watch mode |
| `npm run test:all` | Complete test suite |

## Writing Tests

### Frontend Tests

```typescript
// Example screen test
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../../src/screens/LoginScreen';

describe('LoginScreen', () => {
  it('should render login form', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);

    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });
});
```

### Backend Tests

```typescript
// Example route test
import request from 'supertest';
import app from '../../server/src/server';

describe('POST /api/auth/login', () => {
  it('should return 200 with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### E2E Tests

```typescript
// Example E2E test
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

- **Minimum**: 60% across all modules
- **Target**: 80% for critical paths (auth, search, payments)

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Nightly scheduled runs

## Manual Testing

See `manual/MANUAL-TEST-PLAN.csv` for comprehensive manual test cases.

The CSV includes 120+ test cases across:
- Authentication (15 cases)
- Search & Filters (25 cases)
- Child Management (12 cases)
- Favorites (8 cases)
- Calendar (10 cases)
- Preferences (14 cases)
- Subscriptions (8 cases)
- Notifications (10 cases)
- Sharing (6 cases)
- Admin Functions (10 cases)
