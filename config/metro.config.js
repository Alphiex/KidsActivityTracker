const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = path.resolve(__dirname, '..');

const config = {
  projectRoot,
  server: {
    port: 8081,
  },
  resolver: {
    assetExts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
  },
  resetCache: true,
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
