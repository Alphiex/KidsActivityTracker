# Xcode Debugging Setup for KidsActivityTracker

## Quick Start

1. **Start Metro Bundler First**
   ```bash
   ./scripts/start-metro-for-xcode.sh
   ```
   This will open a Terminal window with Metro running.

2. **Open Xcode**
   ```bash
   open ios/KidsActivityTracker.xcworkspace
   ```

3. **Build and Run**
   - Select your target device/simulator
   - Press Cmd+R or click the Run button
   - The app will connect to Metro at localhost:8081

## Troubleshooting Connection Issues

### If you see "Could not connect to development server"

1. **Check Metro is running**
   - Look for the Terminal window running Metro
   - You should see "Metro waiting on port 8081"

2. **For Physical Device**
   - Shake the device
   - Go to "Settings" in the debug menu
   - Set "Debug server host & port" to: `YOUR_MAC_IP:8081`
   - Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`

3. **For Simulator**
   - Metro should connect automatically to localhost:8081
   - If not, shake (Cmd+D) and check settings

### Clean Build if Issues Persist

```bash
# Clean everything
cd ios
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf build/
pod deintegrate
pod install

# In Xcode
# Product → Clean Build Folder (Cmd+Shift+K)
# Then build again (Cmd+R)
```

## API Configuration

The app is configured to use the production API:
- **Production API**: https://kids-activity-api-44042034457.us-central1.run.app
- **Local API** (if needed): http://localhost:3000

To switch between APIs, edit `src/config/api.ts`:
- Set `FORCE_LOCAL = true` to use local API
- Set `FORCE_LOCAL = false` to use production API (default)

## Debug vs Release Builds

- **Debug**: Connects to Metro bundler (for hot reloading)
- **Release**: Uses bundled JavaScript (no Metro needed)

To build Release in Xcode:
1. Edit Scheme (Cmd+Shift+,)
2. Run → Build Configuration → Release
3. Build and Run (Cmd+R)

## Common Issues

1. **"Connection refused" errors to 192.168.x.x:8081**
   - This is Metro trying to connect, not your API
   - Solution: Start Metro with the script above

2. **Account creation not working**
   - Check the API is reachable: `curl https://kids-activity-api-44042034457.us-central1.run.app/health`
   - Check API configuration in `src/config/api.ts`

3. **Build errors after pod install**
   - Close Xcode
   - Run: `cd ios && pod install`
   - Open the `.xcworkspace` file, not `.xcodeproj`

## Useful Commands

```bash
# View React Native logs
npx react-native log-ios

# View Metro logs
# Check the Terminal window running Metro

# Reset everything
watchman watch-del-all
rm -rf $TMPDIR/metro-*
rm -rf node_modules ios/Pods
npm install
cd ios && pod install
```