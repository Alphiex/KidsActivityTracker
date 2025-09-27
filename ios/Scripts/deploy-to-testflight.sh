#!/bin/bash

# Script to build and deploy to TestFlight
set -e

echo "🚀 Deploying to TestFlight"
echo "=========================="

# Configuration
SCHEME="KidsActivityTracker"
CONFIGURATION="Release"
BUNDLE_ID="com.kidsactivitytracker.app"  # Update this to your actual bundle ID
TEAM_ID=""  # Will be auto-detected if not set
EXPORT_PATH="./build"

cd "$(dirname "$0")"

# 1. Check prerequisites
echo "📋 Checking prerequisites..."

# Check if logged in to App Store Connect
if ! xcrun altool --list-providers -u fake@email.com -p fake 2>&1 | grep -q "authentication credentials"; then
    echo "⚠️  Not logged in to App Store Connect"
    echo "You need to create an app-specific password:"
    echo "1. Go to https://appleid.apple.com/account/manage"
    echo "2. Sign in and go to 'App-Specific Passwords'"
    echo "3. Generate a new password for 'Xcode'"
    echo ""
    echo "Then run: xcrun altool --store-password-in-keychain-item 'AC_PASSWORD' -u YOUR_APPLE_ID -p APP_SPECIFIC_PASSWORD"
    echo ""
fi

# Get the team ID if not set
if [ -z "$TEAM_ID" ]; then
    echo "🔍 Detecting Team ID..."
    TEAM_ID=$(security find-identity -v -p codesigning | grep "Developer ID" | head -1 | awk -F'"' '{print $2}' | awk '{print $NF}' | tr -d '()')
    if [ -z "$TEAM_ID" ]; then
        echo "❌ Could not detect Team ID. Please set TEAM_ID in this script."
        exit 1
    fi
    echo "✅ Found Team ID: $TEAM_ID"
fi

# 2. Update bundle identifier
echo "📱 Updating bundle identifier to $BUNDLE_ID..."
sed -i '' "s/PRODUCT_BUNDLE_IDENTIFIER = .*/PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE_ID;/g" KidsActivityTracker.xcodeproj/project.pbxproj

# 3. Clean build folder
echo "🧹 Cleaning build folder..."
rm -rf "$EXPORT_PATH"
mkdir -p "$EXPORT_PATH"

# 4. Archive the app
echo "📦 Building archive..."
xcodebuild -workspace KidsActivityTracker.xcworkspace \
           -scheme "$SCHEME" \
           -configuration "$CONFIGURATION" \
           -destination 'generic/platform=iOS' \
           -archivePath "$EXPORT_PATH/$SCHEME.xcarchive" \
           archive \
           DEVELOPMENT_TEAM="$TEAM_ID" \
           -allowProvisioningUpdates

# 5. Check if archive was created
if [ ! -d "$EXPORT_PATH/$SCHEME.xcarchive" ]; then
    echo "❌ Archive creation failed"
    exit 1
fi

echo "✅ Archive created successfully"

# 6. Create export options plist
echo "📝 Creating export options..."
cat > "$EXPORT_PATH/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>$TEAM_ID</string>
    <key>uploadBitcode</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF

# 7. Export IPA
echo "📤 Exporting IPA..."
xcodebuild -exportArchive \
           -archivePath "$EXPORT_PATH/$SCHEME.xcarchive" \
           -exportPath "$EXPORT_PATH" \
           -exportOptionsPlist "$EXPORT_PATH/ExportOptions.plist" \
           -allowProvisioningUpdates

# 8. Check if IPA was created
if [ ! -f "$EXPORT_PATH/$SCHEME.ipa" ]; then
    echo "❌ IPA export failed"
    exit 1
fi

echo "✅ IPA exported successfully"

# 9. Upload to TestFlight
echo "☁️  Uploading to TestFlight..."
echo ""
echo "⚠️  You'll need to provide your Apple ID credentials"
echo "For security, use an app-specific password from https://appleid.apple.com"
echo ""

# Using xcrun altool (deprecated but still works)
# For newer Xcode versions, use 'xcrun notarytool' instead
xcrun altool --upload-app \
             --type ios \
             --file "$EXPORT_PATH/$SCHEME.ipa" \
             --apiKey "$API_KEY" \
             --apiIssuer "$API_ISSUER" \
             2>&1 | tee "$EXPORT_PATH/upload.log"

# Alternative: Use App Store Connect API
# Requires API key setup from https://appstoreconnect.apple.com/access/api

echo ""
echo "✅ Upload complete!"
echo ""
echo "📱 Next steps:"
echo "1. Go to https://appstoreconnect.apple.com"
echo "2. Select your app"
echo "3. Go to TestFlight tab"
echo "4. Wait for processing to complete (usually 5-15 minutes)"
echo "5. Add internal or external testers"
echo "6. Testers will receive an email invitation to install via TestFlight app"
echo ""
echo "📊 Build artifacts saved to: $EXPORT_PATH"