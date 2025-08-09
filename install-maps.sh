#!/bin/bash

echo "📍 Installing react-native-maps..."

# Install the package
npm install react-native-maps

# For iOS
cd ios
pod install
cd ..

echo "✅ react-native-maps installed!"
echo ""
echo "To enable maps in the app:"
echo "1. Uncomment the MapView import in ActivityDetailScreenEnhanced.tsx"
echo "2. Replace the map placeholder with the actual MapView component"
echo "3. For iOS: Add your Google Maps API key to ios/KidsActivityTracker/AppDelegate.m"
echo "4. For Android: Add your Google Maps API key to android/app/src/main/AndroidManifest.xml"