# Kids Activity Tracker

> A React Native mobile application for discovering and managing children's activities in North Vancouver and across British Columbia. Features automated web scraping, smart filtering, modern Airbnb-style UI, and comprehensive calendar management.

## Overview

Kids Activity Tracker helps parents find, track, and manage recreational activities for their children by aggregating data from multiple recreation centers and providers across BC.

### Key Features
- Browse 1000+ activities with smart filtering (age, location, date, cost)
- Manage multiple child profiles with personalized recommendations
- Budget-friendly filtering and cost tracking
- Location-based search with interactive map view
- Hide closed or full activities automatically (global preference)
- Real-time availability tracking with registration status
- Modern Airbnb-style UI with card and list views
- Favorite activities and get notifications

### Calendar Features (v2.1.0)
- Shared Children Calendar Overlay - view activities from children shared by other parents
- Quick Add Activity - FAB button and long-press on calendar dates
- Drag & Drop Rescheduling - long-press activities to reschedule
- Native iOS Calendar Sync - two-way sync with iOS Calendar app
- Activity Reminders & Push Notifications
- Conflict Detection - automatic detection of overlapping activities
- Bulk Operations - multi-select activities for batch operations
- Print/Share Calendar - export calendar view as image

### Technology Stack
- **Frontend**: React Native 0.80 (TypeScript) - iOS & Android
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cloud**: Google Cloud Platform (Cloud Run, Cloud SQL)
- **Scraping**: Puppeteer for automated data collection
- **State Management**: Redux Toolkit + MMKV for persistence

## Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/KidsActivityTracker.git
cd KidsActivityTracker

# Install dependencies
npm install
cd ios && pod install && cd ..

# Start Metro bundler (terminal 1)
npx react-native start --reset-cache

# Run on iOS (terminal 2)
# IMPORTANT: Use iOS 18.6 simulator to avoid network issues
./scripts/development/run-ios-18-6.sh

# Run on Android
npx react-native run-android
```

## Production Information

### Live Services
- **API**: https://kids-activity-api-205843686007.us-central1.run.app
- **Project**: kids-activity-tracker-2024
- **Region**: us-central1
- **Database**: Cloud SQL PostgreSQL

### Key Statistics
- **Activities Tracked**: 1000+ active activities
- **Providers**: North Vancouver Recreation, Community Centers BC-wide
- **Performance**: <200ms API response time

## Project Structure

```
KidsActivityTracker/
├── src/                          # React Native app source
│   ├── components/               # Reusable UI components
│   │   └── modern/              # Modern UI components
│   ├── screens/                 # App screens
│   ├── services/                # API and business logic
│   ├── store/                   # Redux state management
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Helper functions
├── backend/                      # Backend server
│   ├── prisma/                  # Database schema & migrations
│   ├── src/
│   │   ├── api/                # REST API routes
│   │   ├── services/           # Business logic
│   │   ├── scrapers/           # Web scraping modules
│   │   └── utils/              # Utilities & filters
│   ├── scripts/                # Backend maintenance scripts
│   └── deploy/                 # Deployment configurations
├── ios/                         # iOS native code & Xcode project
├── android/                     # Android native code
├── scripts/                     # Development & deployment scripts
│   ├── development/            # run-ios-18-6.sh, etc.
│   └── deployment/             # deploy-api.sh, etc.
├── docs/                        # Documentation
│   └── planning/               # Feature planning documents
├── assets/                      # Static assets (icons, images)
├── CLAUDE.md                    # Development instructions
├── package.json                 # Dependencies
└── tsconfig.json               # TypeScript configuration
```

## Development Commands

```bash
# Development
npm run ios              # Run iOS simulator
npm run android          # Run Android emulator
npm run lint            # Lint code
npm run typecheck       # TypeScript checking

# iOS with specific simulator (recommended)
./scripts/development/run-ios-18-6.sh

# Backend Deployment
./scripts/deployment/deploy-api.sh
```

### iOS Simulator Configuration

**Important**: iOS 18.4 simulator has known network connectivity issues. Always use iOS 18.6:

```bash
# Preferred method
./scripts/development/run-ios-18-6.sh

# Alternative - use UDID directly
npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
```

## Common Issues & Solutions

### No Activities Showing
1. Check API URL in `src/config/api.ts` matches deployed service
2. Verify `hideClosedOrFull` filter isn't too restrictive
3. Check network connectivity and CORS settings

### Build Failures
```bash
# Clean and rebuild
cd ios && rm -rf build Pods && pod install
cd .. && npx react-native clean
```

### Native Module Issues
After installing new packages with native modules:
```bash
cd ios && pod install && cd ..
./scripts/development/run-ios-18-6.sh
```

## Security Considerations

- API rate limiting implemented (100 req/15min)
- SQL injection protection via Prisma parameterized queries
- XSS prevention through React Native's default escaping
- Environment variables for sensitive configuration
- HTTPS-only in production
- Input validation on all API endpoints

## Contributing

We welcome contributions! Please follow these guidelines:
1. Run `npm run lint` and `npm run typecheck` before committing
2. Keep the root directory clean - place files in appropriate subdirectories
3. Update documentation when adding new features

## License

MIT License - See LICENSE file for details

---

**Version**: 2.1.0
**Last Updated**: December 2024
**Maintained By**: Mike & Team
