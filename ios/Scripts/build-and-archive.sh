#!/bin/bash

# Script to build and archive iOS app with proper Hermes support

echo "🔨 Building iOS Archive with Hermes Support"
echo "=========================================="

cd "$(dirname "$0")"

# Clean build folder
echo "🧹 Cleaning build folder..."
rm -rf build/

# Build archive
echo "📱 Building archive..."
xcodebuild -workspace KidsActivityTracker.xcworkspace \
           -scheme KidsActivityTracker \
           -configuration Release \
           -destination 'generic/platform=iOS' \
           -archivePath ./build/KidsActivityTracker.xcarchive \
           archive \
           DEVELOPMENT_TEAM=AUTOMATIC \
           -UseModernBuildSystem=YES \
           GCC_GENERATE_DEBUGGING_SYMBOLS=YES \
           DEBUG_INFORMATION_FORMAT=dwarf-with-dsym \
           2>&1 | tee build.log

# Check if archive was created
if [ -d "./build/KidsActivityTracker.xcarchive" ]; then
    echo "✅ Archive created successfully!"
    
    # Check for Hermes dSYM
    echo "🔍 Checking for Hermes dSYM..."
    if ls ./build/KidsActivityTracker.xcarchive/dSYMs/*hermes* 1> /dev/null 2>&1; then
        echo "✅ Hermes dSYM found!"
        ls -la ./build/KidsActivityTracker.xcarchive/dSYMs/*hermes*
    else
        echo "❌ Hermes dSYM not found"
        echo "📋 Available dSYMs:"
        ls -la ./build/KidsActivityTracker.xcarchive/dSYMs/
    fi
else
    echo "❌ Archive creation failed"
    echo "Check build.log for errors"
fi