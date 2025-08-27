# Kids Camp Tracker - MVP

A cross-platform mobile app for discovering and automating kids' camp registrations.

## Project Overview

This MVP app helps parents:
- Browse and search kids' camps from various providers
- Filter by activity type, date, location, and cost
- Save favorite camps
- Get notifications when new camps are available
- Automate registration process

## Tech Stack

- **Framework**: React Native with TypeScript
- **State Management**: Zustand
- **Storage**: react-native-mmkv
- **Navigation**: React Navigation
- **Web Scraping**: Backend API required (not implemented in mobile)
- **Notifications**: Notifee

## Project Structure

```
KidsCampTracker/
├── src/
│   ├── components/     # Reusable UI components
│   ├── screens/        # App screens
│   ├── services/       # Business logic & API services
│   ├── navigation/     # Navigation configuration
│   ├── store/          # State management
│   ├── types/          # TypeScript interfaces
│   └── utils/          # Helper functions
├── ios/                # iOS specific code
└── android/            # Android specific code
```

## Setup Instructions

### Prerequisites
- macOS (for iOS development)
- Xcode 14+ installed
- Node.js 18+
- CocoaPods installed

### Installation

1. Install dependencies:
```bash
npm install
```

2. iOS setup:
```bash
cd ios
pod install
cd ..
```

### Running the App

#### iOS (Recommended for testing)
```bash
npx react-native run-ios
```

Or open `ios/KidsCampTracker.xcworkspace` in Xcode and run from there.

#### Android
```bash
npx react-native run-android
```

## Current Features Implemented

✅ Project structure and navigation
✅ Data models and types
✅ State management with persistence
✅ Basic UI components
✅ Home screen with camp listings
✅ Favorites functionality
✅ Navigation between screens

## Next Steps for Development

1. **Backend API Setup**
   - Create a backend service for web scraping
   - Implement NVRC site scraper
   - Add more camp providers

2. **Enhanced Features**
   - Complete search and filter functionality
   - User authentication
   - Children profile management
   - Site account management
   - Push notifications

3. **Automation**
   - Implement automated signup flow
   - Add booking confirmation tracking

## Important Notes

- Web scraping cannot be done directly from the mobile app due to CORS restrictions
- You'll need to set up a backend API to handle the scraping
- The current implementation uses mock data for development

## Testing in Xcode

### Option 1: Using Xcode Project (Current Setup)
1. Open `ios/KidsCampTracker.xcodeproj` in Xcode
2. Select your target device or simulator
3. Press Cmd+R to build and run

### Option 2: Fix Xcode Path and Install Pods (Recommended)
If you have Xcode installed, run this command to fix the path:
```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Then install pods:
```bash
cd ios
pod install
cd ..
```

After that, open `ios/KidsCampTracker.xcworkspace` instead.

### Option 3: Run from Terminal
From the project root directory:
```bash
npx react-native run-ios
```

The app is now set up and ready for testing!