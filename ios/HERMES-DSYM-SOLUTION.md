# Hermes dSYM Solution

## Issue
The archive did not include a dSYM for the hermes.framework with the UUIDs [551A6186-A18E-393E-8654-9DD47A10C4D4].

## Root Cause
Hermes was not explicitly enabled in the Podfile, causing the framework to be included without proper debug symbols.

## Solution Applied

### 1. Enable Hermes in Podfile
Updated `ios/Podfile` to explicitly enable Hermes:
```ruby
use_react_native!(
  :path => config[:reactNativePath],
  :app_path => "#{Pod::Config.instance.installation_root}/..",
  :hermes_enabled => true,  # Added this line
  :fabric_enabled => false,
  :new_arch_enabled => false
)
```

### 2. Clean and Reinstall
```bash
cd ios
rm -rf ~/Library/Developer/Xcode/DerivedData/KidsActivityTracker-*
rm -rf build/ Pods Podfile.lock
pod install
```

### 3. Build with Proper Settings
Created `build-and-archive.sh` script that ensures proper dSYM generation:
- Sets `GCC_GENERATE_DEBUGGING_SYMBOLS=YES`
- Sets `DEBUG_INFORMATION_FORMAT=dwarf-with-dsym`
- Uses generic iOS destination for archive

## To Build and Archive

### Option 1: Use the build script
```bash
cd ios
./build-and-archive.sh
```

### Option 2: Use Xcode
1. Open `ios/KidsActivityTracker.xcworkspace` (not .xcodeproj)
2. Select "Any iOS Device" as the destination
3. Product → Clean Build Folder (⇧⌘K)
4. Product → Archive

### Option 3: Direct xcodebuild
```bash
cd ios
xcodebuild -workspace KidsActivityTracker.xcworkspace \
           -scheme KidsActivityTracker \
           -configuration Release \
           -destination 'generic/platform=iOS' \
           -archivePath ./build/KidsActivityTracker.xcarchive \
           archive
```

## Verify Success
After archiving, check for Hermes dSYM:
```bash
ls -la ios/build/KidsActivityTracker.xcarchive/dSYMs/
```

You should see:
- `hermes.framework.dSYM/`
- `KidsActivityTracker.app.dSYM/`

## If Still Having Issues

1. **Verify Hermes is enabled**:
   ```bash
   grep hermes_enabled ios/Podfile
   ```

2. **Check React Native version compatibility**:
   ```bash
   cat package.json | grep react-native
   ```

3. **Temporary workaround** (not recommended for production):
   - Disable Hermes: Set `hermes_enabled => false` in Podfile
   - This will use JSC instead but you'll lose Hermes performance benefits

## Changes Made
1. ✅ Enabled Hermes in Podfile
2. ✅ Cleaned and reinstalled pods
3. ✅ Created build script with proper dSYM settings
4. ✅ Documented the solution

The app should now build and archive with proper Hermes dSYM files included.