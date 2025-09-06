#!/bin/bash

# Modern TestFlight deployment script using Xcode 15+ tools
set -e

echo "🚀 TestFlight Deployment Script"
echo "==============================="

# Configuration - UPDATE THESE!
BUNDLE_ID="com.yourdomain.kidsactivitytracker"  # Change to your bundle ID
APP_NAME="Kids Activity Tracker"
VERSION="1.0.0"
BUILD_NUMBER="1"

cd "$(dirname "$0")"

# Function to update project settings
update_project_settings() {
    echo "📝 Updating project settings..."
    
    # Update bundle identifier
    /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" KidsActivityTracker/Info.plist
    
    # Update version and build number
    agvtool new-marketing-version "$VERSION"
    agvtool new-version -all "$BUILD_NUMBER"
    
    echo "✅ Project settings updated"
}

# Function to check signing
check_signing() {
    echo "🔐 Checking code signing..."
    
    # List available signing identities
    security find-identity -v -p codesigning | grep -E "iPhone (Developer|Distribution)"
    
    echo ""
    echo "📱 Available provisioning profiles:"
    ls ~/Library/MobileDevice/Provisioning\ Profiles/*.mobileprovision 2>/dev/null | wc -l | xargs echo "Found profiles:"
}

# Main deployment process
main() {
    echo "Starting deployment process..."
    echo ""
    
    # Step 1: Update settings
    update_project_settings
    
    # Step 2: Check signing
    check_signing
    
    # Step 3: Clean
    echo "🧹 Cleaning..."
    xcodebuild clean -workspace KidsActivityTracker.xcworkspace -scheme KidsActivityTracker
    
    # Step 4: Archive
    echo "📦 Creating archive..."
    xcodebuild archive \
        -workspace KidsActivityTracker.xcworkspace \
        -scheme KidsActivityTracker \
        -configuration Release \
        -archivePath ./build/KidsActivityTracker.xcarchive \
        -destination 'generic/platform=iOS' \
        -allowProvisioningUpdates \
        CODE_SIGN_STYLE=Automatic
    
    # Step 5: Export for App Store
    echo "📤 Exporting for App Store..."
    
    # Create export options
    cat > ./build/ExportOptions.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>destination</key>
    <string>export</string>
    <key>method</key>
    <string>app-store</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>generateAppStoreInformation</key>
    <true/>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>teamID</key>
    <string>AUTOMATIC</string>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
EOF
    
    xcodebuild -exportArchive \
        -archivePath ./build/KidsActivityTracker.xcarchive \
        -exportPath ./build \
        -exportOptionsPlist ./build/ExportOptions.plist \
        -allowProvisioningUpdates
    
    echo "✅ Export complete!"
    echo ""
    echo "📱 IPA location: ./build/KidsActivityTracker.ipa"
    echo ""
    echo "🚀 To upload to TestFlight:"
    echo ""
    echo "Option 1: Use Xcode (Recommended)"
    echo "  1. Open Xcode"
    echo "  2. Window → Organizer"
    echo "  3. Select your archive"
    echo "  4. Click 'Distribute App'"
    echo "  5. Follow the wizard"
    echo ""
    echo "Option 2: Use Transporter app"
    echo "  1. Download Transporter from Mac App Store"
    echo "  2. Sign in with your Apple ID"
    echo "  3. Drag the .ipa file into Transporter"
    echo "  4. Click Deliver"
    echo ""
    echo "Option 3: Use command line (requires API key)"
    echo "  See: https://developer.apple.com/documentation/appstoreconnectapi"
}

# Run main function
main

echo ""
echo "🎉 Build complete! Ready for TestFlight upload."