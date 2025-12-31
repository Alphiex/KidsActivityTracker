/**
 * Detox E2E Jest Configuration
 */
module.exports = {
  rootDir: '../..',
  testMatch: ['<rootDir>/__tests__/e2e/**/*.e2e.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testEnvironment: 'detox/runners/jest/testEnvironment',
  reporters: ['detox/runners/jest/reporter'],
  verbose: true,
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
