/**
 * Backend Jest Configuration
 * Node.js/Express tests with ts-jest
 */
module.exports = {
  displayName: 'backend',
  preset: 'ts-jest',
  rootDir: '../..',
  testMatch: ['<rootDir>/__tests__/backend/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/backend/setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@server/(.*)$': '<rootDir>/server/src/$1',
    '^@services/(.*)$': '<rootDir>/server/src/services/$1',
    '^@routes/(.*)$': '<rootDir>/server/src/routes/$1',
    '^@middleware/(.*)$': '<rootDir>/server/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/server/src/utils/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/server/tsconfig.json',
      diagnostics: false, // Disable type checking for tests
    }],
  },
  collectCoverageFrom: [
    'server/src/**/*.ts',
    '!server/src/**/*.d.ts',
    '!server/src/**/index.ts',
  ],
  clearMocks: true,
  resetMocks: true,
  testTimeout: 10000,
};
