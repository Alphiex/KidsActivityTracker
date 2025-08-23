# TestFlight Deployment Guide

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at https://developer.apple.com
   - Enroll in the Apple Developer Program

2. **App Store Connect Access**
   - Go to https://appstoreconnect.apple.com
   - Create your app listing

3. **Xcode Configuration**
   - Xcode should be signed in with your Apple ID
   - Automatic signing should be enabled

## Step 1: Configure Your App

### Update Bundle Identifier
1. Choose a unique bundle ID (e.g., `com.yourname.kidsactivitytracker`)
2. Update in Xcode:
   - Open `KidsActivityTracker.xcworkspace`
   - Select the project in navigator
   - Go to "Signing & Capabilities"
   - Update Bundle Identifier

### Set Version and Build Number
- Version: User-facing version (e.g., "1.0.0")
- Build: Internal build number (increment for each upload)

## Step 2: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+"
3. Fill in:
   - Platform: iOS
   - App Name: Kids Activity Tracker
   - Primary Language: English
   - Bundle ID: Select your bundle ID
   - SKU: Something unique (e.g., "KIDSACTIVITYTRACKER001")

## Step 3: Build and Archive

### Option A: Using Our Script
```bash
cd ios
./testflight-deploy.sh
```

### Option B: Using Xcode
1. Open `ios/KidsActivityTracker.xcworkspace`
2. Select "Any iOS Device" as destination
3. Product → Archive
4. Wait for build to complete

## Step 4: Upload to TestFlight

### Using Xcode (Easiest)
1. Window → Organizer
2. Select your archive
3. Click "Distribute App"
4. Choose "App Store Connect"
5. Choose "Upload"
6. Follow the prompts

### Using Transporter App
1. Download from Mac App Store
2. Export IPA from Xcode Organizer
3. Drag IPA to Transporter
4. Click "Deliver"

## Step 5: Configure TestFlight

1. Go to App Store Connect
2. Select your app
3. Go to "TestFlight" tab
4. Wait for processing (5-30 minutes)
5. Once processed:
   - Add test information
   - Add internal testers (up to 100)
   - Create external testing group (up to 10,000)

## Step 6: Invite Testers

### Internal Testing (Your team)
1. TestFlight → Internal Testing
2. Add testers by email
3. They'll receive invitation

### External Testing (Beta users)
1. TestFlight → External Testing
2. Create a group
3. Add build to group
4. Add testers
5. Submit for Beta Review (usually approved within 24h)

## Installing on Your Phone

1. Download TestFlight app from App Store
2. Accept email invitation
3. Or use the TestFlight link
4. Install the app
5. Provide feedback through TestFlight

## Troubleshooting

### "No signing certificate" error
- Xcode → Preferences → Accounts
- Download Manual Profiles
- Or enable Automatic Signing

### "Invalid Bundle ID" error
- Bundle ID must match App Store Connect
- Cannot contain underscores
- Must be unique

### Build processing stuck
- Can take up to 1 hour
- Check email for any issues
- Check App Store Connect for errors

### Missing dSYM files
- Already fixed with Hermes configuration
- Archive should include all dSYMs

## Quick Commands

```bash
# Check current bundle ID
grep PRODUCT_BUNDLE_IDENTIFIER ios/KidsActivityTracker.xcodeproj/project.pbxproj

# Check version
agvtool what-marketing-version

# Increment build number
cd ios
agvtool next-version -all

# Build and archive
cd ios
xcodebuild -workspace KidsActivityTracker.xcworkspace \
           -scheme KidsActivityTracker \
           -configuration Release \
           -archivePath ./build/KidsActivityTracker.xcarchive \
           archive
```

## Important Notes

1. **First Time Setup**: Creating certificates and profiles can take time
2. **Processing Time**: Apple processes builds, which can take 5-60 minutes
3. **Beta Review**: External testing requires Apple review (usually < 24 hours)
4. **Feedback**: TestFlight includes screenshot and feedback tools
5. **Expiration**: Builds expire after 90 days

## Next Steps After TestFlight

1. Gather feedback from testers
2. Fix any reported issues
3. Update version and build number
4. Submit for App Store review when ready

Remember: TestFlight is for testing. When ready for public release, submit for App Store review from App Store Connect.