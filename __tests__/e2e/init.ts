/**
 * Detox E2E Test Initialization
 * Global setup for all E2E tests
 */
import { device, element, by, expect } from 'detox';

// Increase default timeout for E2E tests
jest.setTimeout(120000);

beforeAll(async () => {
  // Launch app with clean state
  await device.launchApp({
    newInstance: true,
    permissions: {
      location: 'always',
      notifications: 'YES',
    },
  });
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(async () => {
  // Reload app before each test for clean state
  await device.reloadReactNative();
});

afterEach(async () => {
  // Take screenshot on failure (useful for debugging)
  // This is handled by Detox automatically in newer versions
});

// Global test utilities
declare global {
  // eslint-disable-next-line no-var
  var testUser: {
    email: string;
    password: string;
    name: string;
  };
}

// Default test user credentials
global.testUser = {
  email: 'e2e-test@example.com',
  password: 'E2ETest123!',
  name: 'E2E Test User',
};

// Export for use in tests
export const TEST_USER = global.testUser;

// Test configuration
export const E2E_CONFIG = {
  apiBaseUrl: 'https://kids-activity-api-205843686007.us-central1.run.app',
  testTimeoutMs: 120000,
  elementWaitTimeoutMs: 10000,
};
