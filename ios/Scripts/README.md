# iOS Build and Deployment Scripts

Scripts for building, archiving, and deploying the iOS application.

## 📱 Scripts

### build-and-archive.sh
Builds and archives the iOS app for distribution.

Usage: `bash ios/scripts/build-and-archive.sh`

### deploy-to-testflight.sh
Deploys the app to Apple TestFlight for beta testing.

Usage: `bash ios/scripts/deploy-to-testflight.sh`

### fix-hermes-dsym.sh
Fixes Hermes debugging symbols for crash reporting.

Usage: `bash ios/scripts/fix-hermes-dsym.sh`

### start-packager.sh
Starts the Metro bundler for development.

Usage: `bash ios/scripts/start-packager.sh`

### debug-bundle-script.sh
Debugging script for bundle issues.

Usage: `bash ios/scripts/debug-bundle-script.sh`

### minimal-bundle-script.sh
Creates minimal bundle for testing.

Usage: `bash ios/scripts/minimal-bundle-script.sh`

## ⚠️ Prerequisites

- Xcode installed
- Valid Apple Developer account
- Provisioning profiles configured
- CocoaPods installed (`gem install cocoapods`)

## 📚 Related Documentation

- [iOS Build Guide](../../docs/guides/ios-build.md)
- [Deployment Guide](../../docs/guides/DEPLOYMENT.md)

**Last Updated:** 2025-09-26
