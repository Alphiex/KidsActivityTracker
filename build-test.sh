#!/bin/bash
set -e

echo "Testing KidsActivityTracker build..."

# Navigate to project root
cd /Users/mike/Development/KidsActivityTracker

# Clean previous builds
echo "Cleaning previous builds..."
cd ios
xcodebuild clean -workspace KidsActivityTracker.xcworkspace -scheme KidsActivityTracker -quiet
cd ..

# Install dependencies
echo "Installing dependencies..."
npm install

# Pod install
echo "Installing iOS pods..."
cd ios
pod install
cd ..

# Build for simulator
echo "Building for iOS simulator..."
cd ios
xcodebuild -workspace KidsActivityTracker.xcworkspace \
  -scheme KidsActivityTracker \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.4' \
  build 2>&1 | grep -E "(error:|warning:|FAILED|PhaseScriptExecution)" || true

echo "Build test complete."