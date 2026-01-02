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

### Activity Gender Filtering
- Activities have a `gender` field: `'male'`, `'female'`, or `null` (all genders)
- Scrapers auto-detect gender from activity names (e.g., "Boys Basketball" → male, "Girls Softball" → female)
- Filter logic: Shows activities matching child's gender OR activities with null gender
- Gender is a TOP PRIORITY filter in AI recommendations

## API Configuration
- API endpoint: `https://kids-activity-api-4ev6yi22va-uc.a.run.app`
- Database: PostgreSQL on Google Cloud SQL

## Environment Variables (react-native-config)

The app uses `react-native-config` for environment variables. Configuration files:

### Development
- `config/.env` - Development environment (symlinked to `.env`)
- Contains: `API_URL`, `GOOGLE_PLACES_API_KEY`, `SKIP_AUTH`

### Production
- `config/.env.production` - Production environment (symlinked to `.env.production`)
- Must contain `GOOGLE_PLACES_API_KEY` for App Store builds

### iOS-Specific Configuration (gitignored)
These files must exist locally for builds:
- `ios/Config.local.xcconfig` - Contains `GOOGLE_MAPS_API_KEY`
- `ios/GoogleService-Info.plist` - Firebase config with `API_KEY`
- `ios/KidsActivityTracker/GoogleService-Info.plist` - Duplicate for Xcode

### Regenerating Environment
After changing `.env` files, regenerate the iOS config:
```bash
cd ios && pod install && cd ..
```

This updates `node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m`

## Coverage Statistics (December 2025)
- **112,000+** activities from **81 cities** across **8 provinces**
- **79 active providers** with **3,980 locations**
- **Province breakdown**: BC (33 cities), ON (33 cities), AB (5), QC (5), SK (2), MB (1), NL (1), NS (1)
- **Scraper platforms**: PerfectMind, ActiveNetwork, Amilia, IC3, and others
- **Scraping schedule**: Currently set to every 3 days (development mode)
  - Production: Critical cities 3x daily, standard daily, low-priority weekly

## Scraper Scheduling

### Development Mode (Current)
All 84 scrapers are set to run randomly every 3 days to reduce load during development.

```bash
# Switch to development schedule (every 3 days, random times)
node server/scripts/update-schedule-dev.js

# Restore production schedule
node server/scripts/restore-schedule-prod.js
```

### Schedule Configuration
Each provider config (`server/scrapers/configs/providers/*.json`) has a `schedule` object:
- `frequency`: "every-3-days" (dev) or "3x-daily", "2x-daily", "daily", "weekly" (prod)
- `times`: Array of times to run (e.g., ["06:00", "12:00", "18:00"])
- `tier`: "critical", "high", "standard", or "low"
- `_production`: Backup of production schedule when in dev mode

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
│       ├── platforms/      # Platform-specific scrapers
│       ├── configs/        # Provider configurations
│       └── validation/     # Claude Vision validation system
├── ios/                    # iOS native code
├── android/                # Android native code
├── scripts/                # All project scripts
│   ├── ios/                # iOS build/run scripts
│   ├── deployment/         # Deploy scripts
│   ├── database/           # Database scripts
│   └── development/        # Dev utilities
├── docs/                   # Documentation (20+ files)
├── config/                 # Configuration files
├── __tests__/              # Test files
└── assets/                 # Static assets
```

## Key Active Files
- Dashboard: `src/screens/DashboardScreenModern.tsx`
- Calendar: `src/screens/CalendarScreenModernFixed.tsx`
- Activity Card: `src/components/ActivityCard.tsx`
- AI Recommendations: `src/screens/AIRecommendationsScreen.tsx`
- AI Chat: `src/screens/AIChatScreen.tsx`
- AI Components: `src/components/ai/` (AIRecommendationCard, AILoadingState, etc.)
- Top Navigation: `src/components/TopTabNavigation.tsx`
- Activity Type Icons: `src/utils/activityTypeIcons.ts`
- API Service: `src/services/api.ts`
- Onboarding: `src/screens/onboarding/` (ActivityTypes, Age, Location screens)
- Favorites: `src/services/favoritesService.ts`
- Preferences: `src/services/preferencesService.ts`

## Activity Types & Icons
- Icons defined in `src/utils/activityTypeIcons.ts` using Material Community Icons
- Canonical activity type names (use these in database):
  - `Swimming & Aquatics` (not "Swimming")
  - `Gymnastics & Movement` (icon: `human-handsup`)
  - `Special Needs Programs` (icon: `heart-multiple`)
  - `Multi-Sport` (icon: `podium-gold`)
  - `Language & Culture` (icon: `translate`)
- Scraper mappings in `server/scrapers/utils/databaseActivityMapper.js`

## AI Features
- **AI Recommendations**: Personalized activity suggestions based on child profile and preferences
  - Screen: `src/screens/AIRecommendationsScreen.tsx`
  - Card: `src/components/ai/AIRecommendationCard.tsx`
  - Shows "Great for your child:" section with child-focused benefits
  - Match quality badges: "Excellent Match", "Great Match", "Good Match"
- **AI Chat**: Conversational assistant for activity discovery
  - Screen: `src/screens/AIChatScreen.tsx`
  - Multi-turn conversations with context retention
- **Navigation**: AIRecommendations screen does not highlight any top/bottom menu items

## Scraper Validation System
The project includes a Claude Vision-based validation system for verifying scraped data:
```bash
node server/scrapers/scripts/runValidation.js --provider=vancouver --sample=5
```
- `server/scrapers/validation/` - Validation components
- Captures screenshots, extracts data via Claude Vision, compares with scraped data
- Generates HTML reports with discrepancy analysis

## Database Maintenance Scripts
```bash
node server/scripts/maintenance/fix-city-provinces.js  # Fix city/province data
node server/scripts/maintenance/normalize-locations.js # Consolidate locations
```
