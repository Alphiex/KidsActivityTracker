#!/bin/bash

echo "iOS Setup Fix Script for KidsCampTracker"
echo "========================================"
echo ""

# Check if Xcode is installed
if [ -d "/Applications/Xcode.app" ]; then
    echo "✓ Xcode found at /Applications/Xcode.app"
    echo ""
    echo "To fix the Xcode path, run:"
    echo "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
    echo ""
else
    echo "✗ Xcode not found at /Applications/Xcode.app"
    echo "Please install Xcode from the App Store first."
    exit 1
fi

echo "After fixing Xcode path, run these commands:"
echo ""
echo "1. Install CocoaPods (if not already installed):"
echo "   sudo gem install cocoapods"
echo ""
echo "2. Install iOS dependencies:"
echo "   cd ios"
echo "   pod install"
echo "   cd .."
echo ""
echo "3. Open in Xcode:"
echo "   open ios/KidsCampTracker.xcworkspace"
echo ""
echo "Alternative: Open without CocoaPods (limited functionality):"
echo "   open ios/KidsCampTracker.xcodeproj"