# Claude Development Rules for KidsActivityTracker

## Project Overview

KidsActivityTracker is a React Native mobile app that helps Canadian families discover and manage children's activities. It aggregates activities from 85+ recreation providers across Canada, with AI-powered recommendations and family management features.

### Key Features
- **Activity Discovery**: Search 126,000+ activities with filters for age, location, cost, schedule
- **Map View**: Geographic activity browsing with 99%+ geocoded locations
- **AI Recommendations**: Personalized suggestions based on child profiles and preferences
- **AI Chat**: Conversational activity discovery assistant
- **AI Weekly Planner**: Generate optimal weekly schedules for families
- **Family Management**: Multiple children with individual preferences
- **Calendar Integration**: Track enrolled activities and custom events
- **Watching/Waitlist**: Monitor activities for availability changes
- **Deep Linking**: Share activities via social media

---

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

---

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

---

## Known Issues / TODOs

### RevenueCat Configuration (TODO)
- **Issue**: RevenueCat throws errors on app load about missing offerings
- **Products exist**: Monthly (`prodd665eef953`), Yearly (`prod041b48aa16`)
- **Fix needed**: In RevenueCat dashboard (https://app.revenuecat.com/projects/7814d1ec):
  1. Ensure products are synced (green checkmarks in Products tab)
  2. Create an offering and set it as "Current"
  3. Add Monthly package (`$rc_monthly`) → `prodd665eef953`
  4. Add Annual package (`$rc_annual`) → `prod041b48aa16`

---

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

---

## API Configuration
- API endpoint: `https://kids-activity-api-4ev6yi22va-uc.a.run.app`
- Database: PostgreSQL on Google Cloud SQL
- Geocoding: Google Maps Geocoding API (server-side key in `.env`)

---

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

### Server Environment (gitignored)
- `server/.env` - Contains database URL, API keys (Anthropic, OpenAI, Stripe, Google Geocoding)

### Regenerating Environment
After changing `.env` files, regenerate the iOS config:
```bash
cd ios && pod install && cd ..
```

This updates `node_modules/react-native-config/ios/ReactNativeConfig/GeneratedDotEnv.m`

---

## Coverage Statistics (January 2026)
- **126,000+** activities from **80 cities** across **11 provinces**
- **85 active providers** with **4,900+ locations**
- **99.3%** of activities geocoded (125,383 with coordinates)
- **95.9%** of locations geocoded (4,708 with coordinates)
- **Province breakdown**: BC (33 cities), ON (33 cities), AB (5), QC (5), SK (2), MB (1), NL (1), NS (1)
- **Scraper platforms**: PerfectMind, ActiveNetwork, Amilia, IC3, CivicRec, and others
- **Scraping schedule**: Currently set to every 3 days (development mode)
  - Production: Critical cities 3x daily, standard daily, low-priority weekly

---

## Scraper Scheduling

### Development Mode (Current)
All 85 scrapers are set to run randomly every 3 days to reduce load during development.

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

### Geocoding Integration
New locations are automatically geocoded during scraping via `BaseScraper.geocodeNewLocations()`.

---

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

### Scraper Auto-Fix (AI-Powered)
```bash
# Analyze discrepancies only
node server/scrapers/scripts/runAutoFix.js --analyze

# Dry run - preview fixes without applying
node server/scrapers/scripts/runAutoFix.js --max=5 --verbose

# Apply fixes to scrapers
node server/scrapers/scripts/runAutoFix.js --max=5 --verbose --apply

# Run validation to generate discrepancy reports
node server/scrapers/scripts/runValidation.js --provider=vancouver --sample=5
```

The auto-fix pipeline uses Claude AI to:
1. Analyze validation discrepancies
2. Discover CSS selectors for missing fields
3. Validate fixes (≥70% accuracy required)
4. Apply patches to scraper code
See `docs/SCRAPERS.md` for full documentation.

### Geocoding
```bash
# Backfill coordinates for existing locations
node server/scrapers/scripts/geocodeLocations.js --limit=1000
```

---

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

---

## Project Structure
```
KidsActivityTracker/
├── src/                    # React Native source code
│   ├── components/         # UI components (ActivityCard, modern/, ai/)
│   ├── screens/            # Screen components (*Modern.tsx active)
│   ├── services/           # API and business logic
│   ├── store/              # Redux store and slices
│   ├── hooks/              # Custom React hooks
│   ├── navigation/         # React Navigation config
│   ├── theme/              # Styling and theming
│   └── utils/              # Utility functions
├── server/                 # Backend API server
│   ├── src/                # TypeScript source
│   │   ├── ai/             # AI features (orchestrator, graph, routes)
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   └── middleware/     # Express middleware
│   ├── prisma/             # Database schema
│   ├── generated/          # Prisma client
│   └── scrapers/           # Web scrapers
│       ├── base/           # BaseScraper class
│       ├── platforms/      # Platform-specific scrapers
│       ├── configs/        # Provider configurations
│       └── validation/     # Claude Vision validation system
├── website/                # Next.js marketing site & deep link fallback
├── ios/                    # iOS native code
├── android/                # Android native code
├── scripts/                # All project scripts
│   ├── ios/                # iOS build/run scripts
│   ├── deployment/         # Deploy scripts
│   ├── database/           # Database scripts
│   └── development/        # Dev utilities
├── docs/                   # Documentation (25+ files)
├── config/                 # Configuration files
├── __tests__/              # Test files
└── assets/                 # Static assets
```

---

## Key Active Files

### Screens
- Dashboard: `src/screens/DashboardScreenModern.tsx`
- Calendar: `src/screens/CalendarScreenModernFixed.tsx`
- Activity Detail: `src/screens/activities/ActivityDetailScreenModern.tsx`
- Search: `src/screens/SearchScreen.tsx`
- Map: `src/screens/MapSearchScreen.tsx`
- AI Recommendations: `src/screens/AIRecommendationsScreen.tsx`
- AI Chat: `src/screens/AIChatScreen.tsx`
- Weekly Planner: `src/screens/WeeklyPlannerScreen.tsx`
- Child Detail: `src/screens/children/ChildDetailScreen.tsx`
- Onboarding: `src/screens/onboarding/` (ActivityTypes, Age, Location screens)

### Components
- Activity Card: `src/components/ActivityCard.tsx`
- Child Assignment Sheet: `src/components/ChildAssignmentSheet.tsx`
- AI Components: `src/components/ai/` (AIRecommendationCard, AILoadingState, etc.)
- Top Navigation: `src/components/TopTabNavigation.tsx`

### Services
- API Service: `src/services/api.ts`
- AI Service: `src/services/aiService.ts`
- Child Preferences: `src/services/childPreferencesService.ts`
- Child Favorites: `src/services/childFavoritesService.ts`
- Child Activities: `src/services/childActivityService.ts`
- Notification Service: `src/services/notificationService.ts`
- Preferences: `src/services/preferencesService.ts`
- Deep Link Service: `src/services/deepLinkService.ts`

### Utilities
- Activity Type Icons: `src/utils/activityTypeIcons.ts`
- Activity Sharing: `src/utils/sharing.ts`
- Formatters: `src/utils/formatters.ts`

---

## Core Features

### Child Management
Each family can have multiple children with:
- **Profile**: Name, date of birth, gender, photo
- **Preferences**: Activity types, days available, distance radius, price range
- **Location**: Saved address for distance calculations
- **Activities**: Enrolled, completed, dropped activities
- **Favorites**: Starred activities per child
- **Custom Events**: Family-created events (not from scrapers)

### Activity States (per child)
```typescript
type ActivityStatus =
  | 'interested'    // Saved/favorited
  | 'enrolled'      // Currently participating
  | 'completed'     // Finished the activity
  | 'dropped'       // Withdrew from activity
  | 'watching';     // Monitoring for availability
```

### Watching/Waitlist System
- **Watching**: User wants notifications when spots open up
- Activities track `spotsAvailable` from scrapers
- When spots become available, push notifications sent
- Separate from waitlist (provider's internal list)

### Child Selection Modes
- **Manual**: User explicitly selects children for filtering
- **Auto**: System determines based on activity age requirements
- **Filter Mode**: OR (any child matches) vs AND (all children match)

---

## Deep Linking & Activity Sharing

### Overview
Users can share activities via social media/messaging. Shared links open directly in the app (if installed) or show a web fallback page with download options.

### URL Format
- Activity links: `https://kidsactivitytracker.ca/activity/{activityId}`
- Invitation links: `https://kidsactivitytracker.ca/invite/{token}`
- Custom scheme: `kidsactivitytracker://activity/{activityId}`

### Key Files
- **Navigation**: `src/navigation/RootNavigator.tsx` - Deep link routing config
- **Deep Link Service**: `src/services/deepLinkService.ts` - URL parsing and handling
- **Sharing Utility**: `src/utils/sharing.ts` - `generateActivityDeepLink()`, `shareActivity()`
- **Activity Detail**: `src/screens/activities/ActivityDetailScreenModern.tsx` - Handles `activityId` param from deep links
- **Web Fallback**: `website/src/app/activity/[id]/page.tsx` - Shows activity preview + download buttons

### Configuration Files
| Platform | File | Purpose |
|----------|------|---------|
| iOS | `website/public/.well-known/apple-app-site-association` | Universal Links config |
| iOS | `ios/KidsActivityTracker/KidsActivityTracker.entitlements` | Associated domains |
| Android | `android/app/src/main/AndroidManifest.xml` | App Links intent filters |
| Android | `website/public/.well-known/assetlinks.json` | Digital Asset Links |

### Testing Deep Links
```bash
# iOS Simulator
xcrun simctl openurl booted "https://kidsactivitytracker.ca/activity/test-id"

# Android Emulator
adb shell am start -a android.intent.action.VIEW -d "https://kidsactivitytracker.ca/activity/test-id"
```

---

## Activity Types & Icons
- Icons defined in `src/utils/activityTypeIcons.ts` using Material Community Icons
- Canonical activity type names (use these in database):
  - `Swimming & Aquatics` (not "Swimming")
  - `Gymnastics & Movement` (icon: `human-handsup`)
  - `Special Needs Programs` (icon: `heart-multiple`)
  - `Multi-Sport` (icon: `podium-gold`)
  - `Language & Culture` (icon: `translate`)
- Scraper mappings in `server/scrapers/utils/databaseActivityMapper.js`

---

## AI Features

### AI Recommendations
Personalized activity suggestions based on child profile and preferences.
- Screen: `src/screens/AIRecommendationsScreen.tsx`
- Card: `src/components/ai/AIRecommendationCard.tsx`
- Shows "Great for your child:" section with child-focused benefits
- Match quality badges: "Excellent Match", "Great Match", "Good Match"
- Backend: LangGraph orchestrator with specialized nodes

### AI Chat
Conversational assistant for activity discovery.
- Screen: `src/screens/AIChatScreen.tsx`
- Multi-turn conversations with context retention
- Understands child profiles and preferences
- Backend: `server/src/ai/routes/chat.ts`

### AI Weekly Planner
Generate optimal weekly activity schedules for families.
- Screen: `src/screens/WeeklyPlannerScreen.tsx`
- Access: Calendar screen → "AI Plan" button
- Features:
  - Per-child availability grid (7 days × 3 time slots: morning/afternoon/evening)
  - Sibling grouping toggle (schedule together when possible)
  - Week selection with calendar picker
  - Semi-interactive results: approve/reject activities, then bulk-add to calendar
  - Conflict detection and AI suggestions
- Backend: `server/src/ai/graph/nodes/plannerNode.ts`
- API: POST `/api/v1/ai/plan-week` with constraints

### AI Architecture
```
Request → AI Orchestrator → LangGraph State Machine
                              ├── parseQueryNode
                              ├── fetchCandidatesNode
                              ├── rankActivitiesNode
                              ├── generateExplanationsNode
                              └── plannerNode (for weekly planning)
```

---

## Map View

### Geographic Activity Search
- Uses bounds-based API: `GET /api/v1/activities/bounds`
- Parameters: `minLat`, `maxLat`, `minLng`, `maxLng`
- Returns activities with coordinates within viewport
- Supports all standard filters (age, cost, activity type, etc.)

### Geocoding
- 99.3% of activities have coordinates
- New locations auto-geocoded during scraping (`BaseScraper.geocodeNewLocations()`)
- Uses Google Maps Geocoding API (server-side)
- Backfill script: `server/scrapers/scripts/geocodeLocations.js`

---

## Scraper Validation System
The project includes a Claude Vision-based validation system for verifying scraped data:
```bash
node server/scrapers/scripts/runValidation.js --provider=vancouver --sample=5
```
- `server/scrapers/validation/` - Validation components
- Captures screenshots, extracts data via Claude Vision, compares with scraped data
- Generates HTML reports with discrepancy analysis

---

## Database Maintenance Scripts
```bash
node server/scripts/maintenance/fix-city-provinces.js  # Fix city/province data
node server/scripts/maintenance/normalize-locations.js # Consolidate locations
```

---

## Backend API Routes

### Activities
- `GET /api/v1/activities` - Search with filters
- `GET /api/v1/activities/bounds` - Geographic search
- `GET /api/v1/activities/:id` - Activity details
- `GET /api/v1/activities/stats/summary` - Statistics

### Children
- `GET /api/v1/children` - List user's children
- `POST /api/v1/children` - Create child
- `PUT /api/v1/children/:id` - Update child
- `DELETE /api/v1/children/:id` - Delete child
- `GET /api/v1/children/:id/activities` - Child's activities
- `POST /api/v1/children/:id/activities` - Add activity to child
- `PUT /api/v1/children/:id/activities/:activityId` - Update status
- `GET /api/v1/children/:id/favorites` - Child's favorites
- `POST /api/v1/children/:id/custom-events` - Create custom event

### AI
- `POST /api/v1/ai/recommendations` - Get AI recommendations
- `POST /api/v1/ai/chat` - Chat with AI assistant
- `POST /api/v1/ai/plan-week` - Generate weekly plan

### Partners
- `GET /api/v1/partners/sponsored` - Sponsored activities
- `POST /api/v1/partners/impressions` - Track ad impressions
- `POST /api/v1/partners/clicks` - Track ad clicks
