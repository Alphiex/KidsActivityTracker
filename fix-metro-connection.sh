#!/bin/bash

echo "Fixing React Native Metro bundler connection..."

# Kill any existing Metro processes
echo "Killing existing Metro processes..."
pkill -f "react-native.*metro" || true
pkill -f "node.*metro" || true

# Clear Metro cache
echo "Clearing Metro cache..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*

# Clear React Native cache
echo "Clearing React Native cache..."
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clear any cached IP addresses in iOS simulator
echo "Resetting iOS Simulator..."
xcrun simctl shutdown all
xcrun simctl erase all

echo "Done! Now follow these steps:"
echo ""
echo "1. Start Metro bundler with reset cache:"
echo "   npx react-native start --reset-cache"
echo ""
echo "2. In another terminal, run the iOS app:"
echo "   npx react-native run-ios"
echo ""
echo "3. If you're using a physical device, shake the device and:"
echo "   - Go to 'Settings' in the debug menu"
echo "   - Update 'Debug server host & port' to your machine's IP:8081"
echo "   - You can find your IP with: ifconfig | grep 'inet ' | grep -v 127.0.0.1"