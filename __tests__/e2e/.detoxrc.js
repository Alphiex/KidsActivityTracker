/**
 * Detox E2E Configuration
 * iOS Simulator testing for Kids Activity Tracker
 */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: '__tests__/e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/KidsActivityTracker.app',
      build: 'xcodebuild -workspace ios/KidsActivityTracker.xcworkspace -scheme KidsActivityTracker -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/KidsActivityTracker.app',
      build: 'xcodebuild -workspace ios/KidsActivityTracker.xcworkspace -scheme KidsActivityTracker -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 16 Pro' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
};
