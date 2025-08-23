# Fixing Hermes Framework dSYM Error

## Error Message
```
The archive did not include a dSYM for the hermes.framework with the UUIDs [551A6186-A18E-393E-8654-9DD47A10C4D4]
```

## Quick Fix

1. **Clean everything**:
```bash
cd ios
rm -rf ~/Library/Developer/Xcode/DerivedData/KidsActivityTracker-*
rm -rf build/
rm -rf Pods Podfile.lock
pod install
```

2. **Ensure Hermes is properly configured** in `ios/Podfile`:
```ruby
target 'KidsActivityTracker' do
  config = use_native_modules!

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true,  # Make sure this is true
    :fabric_enabled => false,
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )
  
  # ... rest of your Podfile
end
```

3. **Build from Xcode**:
   - Open `ios/KidsActivityTracker.xcworkspace` (not .xcodeproj)
   - Product → Clean Build Folder (⇧⌘K)
   - Product → Archive

4. **Or build from command line**:
```bash
cd ios
xcodebuild -workspace KidsActivityTracker.xcworkspace \
           -scheme KidsActivityTracker \
           -configuration Release \
           -archivePath ./build/KidsActivityTracker.xcarchive \
           archive \
           DEVELOPMENT_TEAM=YOUR_TEAM_ID \
           -UseModernBuildSystem=YES
```

## If the error persists:

### Option 1: Disable Hermes temporarily
In `ios/Podfile`, set:
```ruby
:hermes_enabled => false
```
Then clean and rebuild.

### Option 2: Manual dSYM generation
```bash
# After archive is created
cd ios/build/KidsActivityTracker.xcarchive/dSYMs

# Generate dSYM for Hermes if missing
dsymutil /path/to/hermes.framework/hermes -o hermes.framework.dSYM
```

### Option 3: Update React Native
Sometimes this is fixed in newer RN versions:
```bash
npx react-native upgrade
```

## Build Settings to verify in Xcode:

1. Select your project in Xcode
2. Go to Build Settings
3. Search for "debug" and ensure:
   - **Debug Information Format**: `DWARF with dSYM File` (for Release)
   - **Generate Debug Symbols**: `Yes`
   - **Strip Debug Symbols During Copy**: `Yes` (for Release only)

## For CI/CD or Fastlane:

Add to your build command:
```bash
GCC_GENERATE_DEBUGGING_SYMBOLS=YES \
DEBUG_INFORMATION_FORMAT=dwarf-with-dsym
```

## Common causes:

1. **Hermes not properly linked**: Run `pod install` after any Hermes config changes
2. **Cache issues**: Clear all derived data and build folders
3. **Xcode version mismatch**: Ensure Xcode is up to date
4. **React Native version**: Some RN versions have known Hermes dSYM issues

## To verify dSYMs after build:

```bash
# List all dSYMs in archive
find ~/Library/Developer/Xcode/Archives -name "*.dSYM" -print | grep hermes

# Check UUID of a dSYM
dwarfdump -u path/to/hermes.framework.dSYM
```

## Alternative: Skip dSYM validation

If uploading to App Store Connect via command line:
```bash
xcrun altool --upload-app \
             --type ios \
             --file path/to/app.ipa \
             --apiKey YOUR_API_KEY \
             --apiIssuer YOUR_ISSUER_ID \
             --skip-dsym-validation  # Add this flag
```

Note: This means you won't have symbolicated crash reports for Hermes framework.