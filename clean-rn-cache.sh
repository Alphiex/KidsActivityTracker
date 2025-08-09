#!/bin/bash

echo "Cleaning React Native cache..."

# Clean watchman cache
watchman watch-del-all 2>/dev/null || echo "Watchman not installed"

# Delete metro cache
rm -rf $TMPDIR/metro-* 2>/dev/null
rm -rf $TMPDIR/haste-map-* 2>/dev/null

# Clean React Native cache
cd ios
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf build/
pod cache clean --all 2>/dev/null || echo "CocoaPods cache clean skipped"
cd ..

# Clean node modules and reinstall
rm -rf node_modules
npm install

# Clean iOS build
cd ios
pod install
cd ..

echo "Cache cleaning complete!"
echo "Next steps:"
echo "1. Open Xcode and clean build folder (Cmd+Shift+K)"
echo "2. Restart Metro bundler: npx react-native start --reset-cache"
echo "3. Run the app: npx react-native run-ios"