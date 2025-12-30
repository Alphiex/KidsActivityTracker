# Claude Development Rules for KidsActivityTracker

## iOS Simulator Configuration

### IMPORTANT: Always Use iOS 18.6 Simulator
- **Issue**: iOS 18.4 simulator has known network connectivity issues that cause "Network Error" when making API calls
- **Solution**: Always use iOS 18.6 simulator (iPhone 16 Pro) for development and testing

### Running the App
When asked to run the app on iOS simulator, ALWAYS use one of these methods:

1. **Preferred Method**: Run the custom script
   ```bash
   ./scripts/ios/run-simulator.sh
   ```
   (Also available via symlink: `./run-ios-18-6.sh`)

2. **Alternative Method**: Use the UDID directly
   ```bash
   npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
   ```

3. **Never use**:
   - `npx react-native run-ios` (without specifying simulator - may default to 18.4)
   - `npx react-native run-ios --simulator="iPhone 16 Pro"` (may pick wrong iOS version)

### Available iOS 18.6 Simulators
- iPhone 16 Pro: `A8661E75-FE3E-483F-8F13-AC87110E8EE2` (PRIMARY)
- iPhone 16 Pro Max: `9F3BA117-5391-4064-9FAF-8A7CA82CE93C`
- iPhone 16: `6558E69E-75D4-4088-B42B-DBD7F5FDFAFA`
- iPhone 16 Plus: `86E8B2CB-2E1B-4621-9A20-78549BDFB0F9`

## Android Emulator Configuration

### Running on Android
When asked to run the app on Android emulator:

1. **Start the emulator** (if not running):
   ```bash
   JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools \
   /opt/homebrew/share/android-commandlinetools/emulator/emulator -avd Pixel_7_API_34 &
   ```

2. **Build and run the app**:
   ```bash
   JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools \
   npx react-native run-android
   ```

### Available Android Emulators
- Pixel 7 API 34: `Pixel_7_API_34` (PRIMARY - Android 14)

### Android-Specific Fixes Applied
The following fixes were applied for Android compatibility:

1. **MMKV Lazy Initialization**: MMKV storage is lazily initialized with error handling to avoid JSI timing issues on Android. Files affected:
   - `src/services/preferencesService.ts`
   - `src/services/favoritesService.ts`
   - `src/utils/secureStorage.ts`
   - `App.tsx`

2. **RevenueCat UI Lazy Loading**: The `react-native-purchases-ui` module is dynamically loaded to prevent linking errors on Android. File affected:
   - `src/services/revenueCatService.ts`

### Android Environment Variables
```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
```

## Code Quality Rules

### Before Committing Code
Always run these commands to ensure code quality:
```bash
npm run lint        # Check for linting issues
npm run typecheck   # Check for TypeScript errors
```

### Activity Display
- Activities have `startTime` and `endTime` fields at root level
- Days of week shown in pink badges on activity cards
- Format: "9:30 am - 12:00 pm"

## API Configuration
- API endpoint: `https://kids-activity-api-205843686007.us-central1.run.app`
- Database: PostgreSQL on Google Cloud SQL

## Coverage Statistics (December 2025)
- **100,000+** activities from **79 cities** across **10 provinces**
- **11 scraper platforms**: PerfectMind (35), ActiveNetwork (29), Amilia (3), IC3 (2), others
- **30 critical cities** scraped 3x daily, **43 standard** daily, **5 low** weekly
- Top cities: Vancouver (10k), Ottawa (7.4k), NVRC (7.4k), Burnaby (6.6k), Toronto (4.8k)

## Scripts Reference

### iOS Development
```bash
./scripts/ios/run-simulator.sh       # Run on iOS 18.6 simulator
./scripts/ios/build-archive.sh       # Build for App Store
./scripts/ios/deploy-testflight.sh   # Deploy to TestFlight
```

### Deployment
```bash
./scripts/deployment/deploy-api.sh     # Deploy API to Cloud Run
./scripts/deployment/deploy-server.sh  # Full server deployment
./scripts/deployment/deploy-schema.js  # Deploy database schema
```

### Database
```bash
node scripts/database/run-migration.js    # Run migrations
node scripts/database/seed-database.js    # Seed database
node scripts/database/check-database.js   # Verify database
```

## Development Workflow

### iOS Development
1. Start Metro bundler: `npx react-native start --reset-cache`
2. Run iOS app: `./scripts/ios/run-simulator.sh`
3. If network issues occur, restart Metro and rebuild
4. For physical device testing, use Xcode or `npx react-native run-ios --device`

### Android Development
1. Start Metro bundler: `npx react-native start --reset-cache`
2. Start Android emulator (see Android Emulator Configuration above)
3. Run Android app: `JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx react-native run-android`
4. Use `adb shell am force-stop com.kidsactivitytracker` to force stop the app
5. Use `adb shell am start -n com.kidsactivitytracker/.MainActivity` to restart

## Project Structure
```
KidsActivityTracker/
├── src/                    # React Native source code
│   ├── components/         # UI components (ActivityCard, modern/)
│   ├── screens/            # Screen components (*Modern.tsx active)
│   ├── services/           # API and business logic
│   ├── store/              # Redux store and slices
│   ├── theme/              # Styling and theming
│   └── utils/              # Utility functions
├── server/                 # Backend API server
│   ├── src/                # TypeScript source
│   ├── prisma/             # Database schema
│   └── scrapers/           # Web scrapers
├── ios/                    # iOS native code
├── android/                # Android native code
├── scripts/                # All project scripts
│   ├── ios/                # iOS build/run scripts
│   ├── deployment/         # Deploy scripts
│   ├── database/           # Database scripts
│   └── development/        # Dev utilities
├── docs/                   # Documentation (10 files)
├── config/                 # Configuration files
├── __tests__/              # Test files
└── assets/                 # Static assets
```

## Key Active Files
- Dashboard: `src/screens/DashboardScreenModern.tsx`
- Calendar: `src/screens/CalendarScreenModernFixed.tsx`
- Activity Card: `src/components/modern/ActivityCard.tsx`
- API Service: `src/services/api.ts`
