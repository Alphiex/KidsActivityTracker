#!/bin/bash

# Script to run the app on iOS 18.6 simulator to avoid network issues
# The iOS 18.4 simulator has known network connectivity issues

echo "🚀 Starting React Native app on iOS 18.6 simulator..."
echo "📱 Using iPhone 16 Pro (iOS 18.6) to avoid network issues"

# iOS 18.6 simulator UDID for iPhone 16 Pro
IOS_18_6_UDID="A8661E75-FE3E-483F-8F13-AC87110E8EE2"

# Check if simulator is already running
if xcrun simctl list devices | grep -q "$IOS_18_6_UDID.*Booted"; then
    echo "✅ iOS 18.6 simulator is already running"
else
    echo "🔧 Starting iOS 18.6 simulator..."
    xcrun simctl boot "$IOS_18_6_UDID"
    # Open the Simulator app
    open -a Simulator
    # Give it time to boot
    sleep 3
fi

# Run the React Native app
echo "📦 Building and installing app..."
npx react-native run-ios --udid="$IOS_18_6_UDID"