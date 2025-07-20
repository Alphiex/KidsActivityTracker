cd# Quick Setup Guide for iOS Development

## Current Status
The React Native project is created but needs Xcode configuration to run on iOS.

## Steps to Get Running:

### 1. Fix Xcode Path (Required)
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### 2. Install CocoaPods Dependencies
```bash
cd /Users/mike/Development/KidsCampTracker/ios
pod install
cd ..
```

### 3. Open in Xcode
```bash
open ios/KidsCampTracker.xcworkspace
```

### 4. Run the App
- In Xcode, select an iPhone simulator (e.g., iPhone 15)
- Press `Cmd + R` to build and run

## If CocoaPods Fails

Try these alternatives:

### Option A: Use the Minimal Podfile
```bash
cd ios
mv Podfile Podfile.backup
mv Podfile.minimal Podfile
pod install
```

### Option B: Remove Pods and Open Project Directly
1. Open `ios/KidsCampTracker.xcodeproj` in Xcode
2. Remove any red (missing) Pod references
3. Try to build

## What's Working in the App

- ✅ Navigation structure (Home, Search, Favorites, Profile)
- ✅ Camp listing with mock data
- ✅ Favorite camps functionality
- ✅ Data persistence
- ✅ TypeScript support

## Next Development Steps

1. Set up backend API for web scraping
2. Implement search and filtering
3. Add user authentication
4. Complete camp detail views
5. Add push notifications

## Troubleshooting

If you see "Unable to open base configuration reference file" errors:
- This means CocoaPods hasn't been properly installed
- Follow the steps above to fix Xcode path and run `pod install`

If Xcode can't find React Native modules:
- Make sure you've run `npm install` in the project root
- Ensure CocoaPods installation completed successfully
