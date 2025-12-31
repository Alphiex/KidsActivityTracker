/**
 * Frontend Jest Configuration
 * React Native tests with react-native preset
 */
module.exports = {
  displayName: 'frontend',
  preset: 'react-native',
  rootDir: '../..',
  testMatch: ['<rootDir>/__tests__/frontend/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/frontend/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|@react-native-community|react-redux|@reduxjs)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  clearMocks: true,
  resetMocks: true,
};
