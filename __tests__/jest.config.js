/**
 * Root Jest Configuration
 * Kids Activity Tracker - Comprehensive Test Suite
 */
module.exports = {
  projects: [
    '<rootDir>/frontend/jest.config.js',
    '<rootDir>/backend/jest.config.js',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'server/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageDirectory: '<rootDir>/../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
