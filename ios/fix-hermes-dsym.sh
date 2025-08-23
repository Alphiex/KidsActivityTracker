#!/bin/bash

# Script to fix missing Hermes dSYM files

echo "🔧 Fixing Hermes dSYM issues..."

# Clean build folders
echo "📁 Cleaning build folders..."
cd "$(dirname "$0")"
rm -rf ~/Library/Developer/Xcode/DerivedData/KidsActivityTracker-*
rm -rf build/

# Clean Pods
echo "🧹 Cleaning CocoaPods..."
cd ios
rm -rf Pods Podfile.lock

# Reinstall Pods
echo "📦 Reinstalling CocoaPods..."
pod install

# If using React Native 0.70+, ensure Hermes is properly configured
echo "⚙️  Checking Hermes configuration..."

# Check if Hermes is enabled in Podfile
if grep -q "hermes_enabled => true" Podfile; then
    echo "✅ Hermes is enabled in Podfile"
else
    echo "⚠️  Hermes might not be properly configured in Podfile"
    echo "Add this to your Podfile target:"
    echo "  :hermes_enabled => true"
fi

echo "

🎯 Next steps to build with proper dSYMs:

1. Open Xcode:
   open KidsActivityTracker.xcworkspace

2. In Xcode, go to:
   Product → Scheme → Edit Scheme → Archive → Build Configuration
   Make sure it's set to 'Release'

3. Clean the build:
   Product → Clean Build Folder (Cmd+Shift+K)

4. Archive:
   Product → Archive

5. If the error persists, try these in Build Settings:
   - Debug Information Format: DWARF with dSYM File
   - Generate Debug Symbols: Yes
   - Strip Debug Symbols During Copy: Yes (for Release only)

Alternative command-line build:
   xcodebuild -workspace KidsActivityTracker.xcworkspace \\
              -scheme KidsActivityTracker \\
              -configuration Release \\
              -archivePath ./build/KidsActivityTracker.xcarchive \\
              archive \\
              -UseModernBuildSystem=YES
"