#!/bin/bash

echo "🧹 Cleaning React Native build..."

# Clean watchman
echo "Clearing watchman watches..."
watchman watch-del-all 2>/dev/null || echo "Watchman not installed"

# Clean metro cache
echo "Clearing Metro bundler cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null
rm -rf $TMPDIR/haste-map-* 2>/dev/null

# Clean React Native cache
echo "Clearing React Native cache..."
rm -rf $TMPDIR/react-* 2>/dev/null

# Clean node modules and reinstall
echo "Cleaning node_modules..."
rm -rf node_modules
rm -rf package-lock.json
rm -rf yarn.lock

echo "Reinstalling dependencies..."
npm install

# Clean iOS build
echo "Cleaning iOS build..."
cd ios
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/KidsActivityTracker-*
pod deintegrate 2>/dev/null || echo "Cocoapods not installed"
pod clean 2>/dev/null || echo "Cocoapods not installed"
rm -rf Pods/
rm -rf Podfile.lock

echo "Installing iOS dependencies..."
pod install

cd ..

# Clean Android build
echo "Cleaning Android build..."
cd android
./gradlew clean 2>/dev/null || echo "Gradle wrapper not found"
rm -rf .gradle
rm -rf app/build
cd ..

echo "✅ Build cleaned successfully!"
echo ""
echo "Next steps:"
echo "1. For iOS: Open ios/KidsActivityTracker.xcworkspace in Xcode and build"
echo "2. For Android: npx react-native run-android"
echo "3. Start Metro: npx react-native start --reset-cache"