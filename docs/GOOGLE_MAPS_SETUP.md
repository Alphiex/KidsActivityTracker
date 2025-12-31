# Google Maps Setup

This app uses Google Maps on both iOS and Android for consistent cross-platform experience.

## API Keys

You need **two separate API keys** from the [Google Cloud Console](https://console.cloud.google.com):

1. **iOS Key** - Restricted to iOS apps with bundle ID `com.kidsactivitytracker.app`
2. **Android Key** - Restricted to Android apps with package `com.kidsactivitytracker` and SHA-1 fingerprint

### Required APIs
Enable these APIs in Google Cloud Console:
- Maps SDK for iOS
- Maps SDK for Android

## Local Development Setup

### Android

Add your API key to `android/local.properties`:

```properties
GOOGLE_MAPS_API_KEY=your_android_api_key_here
```

This file is gitignored and won't be committed.

### iOS

Create `ios/Config.local.xcconfig` with your API key:

```
GOOGLE_MAPS_API_KEY = your_ios_api_key_here
```

This file is gitignored and won't be committed.

Then in Xcode:
1. Open the project settings
2. Go to Build Settings
3. Add `GOOGLE_MAPS_API_KEY` as a user-defined setting (or it will be read from the xcconfig)

## CI/CD Setup

For automated builds, set the API keys as environment variables:

```bash
# For Android
export GOOGLE_MAPS_API_KEY=your_android_key

# For iOS (in Xcode Cloud or fastlane)
# Set GOOGLE_MAPS_API_KEY in build settings or xcconfig
```

## Getting SHA-1 Fingerprint

For Android key restrictions, get the SHA-1 fingerprint:

```bash
# Debug keystore
cd android && ./gradlew signingReport

# Release keystore
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
```

## Troubleshooting

### Map shows blank/gray on iOS
- Verify `GoogleMaps` pod is installed: `pod install`
- Check that API key is set in Info.plist or build settings
- Ensure Maps SDK for iOS is enabled in Google Cloud Console

### Map shows blank/gray on Android
- Verify API key is in `local.properties` or environment
- Check that API key has correct package name and SHA-1 in restrictions
- Ensure Maps SDK for Android is enabled in Google Cloud Console

### "API key not valid" error
- Verify the API key restrictions match your app's bundle ID / package name
- Check that the correct APIs are enabled
- Wait a few minutes after creating/modifying keys for changes to propagate
