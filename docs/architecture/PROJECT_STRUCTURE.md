# Project Structure Documentation

## Overview
KidsActivityTracker is organized as a monorepo containing a React Native mobile app and a Node.js backend API.

## Directory Structure

```
KidsActivityTracker/
├── 📱 src/                         # React Native Application Source
│   ├── screens/                    # App Screens (22 screens)
│   │   ├── HomeScreen.tsx         # Main dashboard
│   │   ├── ActivitiesScreen.tsx   # Browse all activities
│   │   ├── SearchScreen.tsx       # Advanced search
│   │   ├── FavoritesScreen.tsx    # User favorites
│   │   ├── ProfileScreen.tsx      # User profile
│   │   ├── SettingsScreen.tsx     # App settings
│   │   └── ...                    # Other screens
│   │
│   ├── components/                 # Reusable Components
│   │   ├── ActivityCard.tsx       # Activity display card
│   │   ├── FilterBar.tsx          # Search filters
│   │   ├── LoadingIndicator.tsx   # Loading states
│   │   └── ...                    # Other components
│   │
│   ├── services/                   # Business Logic & API
│   │   ├── activityService.ts     # Activity API calls
│   │   ├── authService.ts         # Authentication
│   │   ├── favoritesService.ts    # Favorites management
│   │   └── preferencesService.ts  # User preferences
│   │
│   ├── contexts/                   # React Contexts
│   │   ├── AuthContext.tsx        # Authentication state
│   │   ├── ThemeContext.tsx       # Theme management
│   │   └── NetworkContext.tsx     # Network status
│   │
│   ├── navigation/                 # Navigation Configuration
│   │   └── AppNavigator.tsx       # Main navigation stack
│   │
│   ├── utils/                      # Utility Functions
│   │   ├── formatters.ts          # Data formatting
│   │   ├── validators.ts          # Input validation
│   │   └── secureStorage.ts       # Secure storage wrapper
│   │
│   ├── theme/                      # Theme Configuration
│   │   └── index.ts               # Colors, fonts, styles
│   │
│   ├── types/                      # TypeScript Definitions
│   │   ├── index.ts               # Main types
│   │   └── api.ts                 # API response types
│   │
│   ├── config/                     # App Configuration
│   │   ├── api.ts                 # API endpoints
│   │   └── app.ts                 # App constants
│   │
│   └── assets/                     # Static Assets
│       └── images/
│           ├── activities/         # 52 activity images
│           └── icons/              # App icons
│
├── 🖥️ backend/                     # Node.js Backend
│   ├── api/                        # API Server
│   │   └── server.js              # Express server & routes
│   │
│   ├── database/                   # Database Layer
│   │   ├── config/                # Database configuration
│   │   └── services/              # Database services
│   │       ├── activityService.js # Activity CRUD
│   │       ├── userService.js     # User management
│   │       └── favoriteService.js # Favorites logic
│   │
│   ├── scrapers/                   # Data Scrapers
│   │   ├── nvrcEnhancedParallelScraper.js  # Main scraper
│   │   └── scraperService.js      # Scraper orchestration
│   │
│   ├── prisma/                     # Database Schema
│   │   ├── schema.prisma          # Database models
│   │   └── migrations/            # Schema migrations
│   │
│   ├── scripts/                    # Organized Scripts
│   │   ├── deploy/                # Deployment scripts
│   │   │   └── deploy-api-manual.sh
│   │   ├── scraper/               # Scraper management
│   │   ├── database/              # Database operations
│   │   └── utils/                 # Utility scripts
│   │
│   └── services/                   # Business Services
│       └── authService.js         # Authentication logic
│
├── 📱 ios/                         # iOS Native Code
│   ├── KidsActivityTracker.xcodeproj
│   ├── KidsActivityTracker.xcworkspace
│   └── Podfile                    # iOS dependencies
│
├── 🤖 android/                     # Android Native Code
│   ├── app/
│   │   └── build.gradle          # Android config
│   └── gradle.properties
│
├── 🧪 __tests__/                   # Test Files
│   ├── components/                # Component tests
│   ├── screens/                   # Screen tests
│   └── services/                  # Service tests
│
├── 📜 scripts/                     # Project Scripts
│   ├── development/               # Dev tools
│   │   ├── dev-start.sh         # Start dev environment
│   │   └── dev-stop.sh          # Stop dev environment
│   ├── deployment/               # Deploy scripts
│   ├── setup/                    # Setup scripts
│   │   └── complete-setup.sh    # Initial setup
│   └── utilities/                # Utility scripts
│       ├── cleanup-project.sh   # Project cleanup
│       └── replace-activity-images.sh
│
├── 📋 Configuration Files
│   ├── package.json              # Dependencies
│   ├── tsconfig.json            # TypeScript config
│   ├── babel.config.js          # Babel config
│   ├── metro.config.js          # Metro bundler config
│   ├── .eslintrc.js             # ESLint rules
│   ├── .prettierrc              # Code formatting
│   └── .gitignore               # Git ignore rules
│
└── 📚 Documentation
    ├── README.md                # Main documentation
    ├── PROJECT_STRUCTURE.md    # This file
    └── API.md                   # API documentation

```

## Key Directories Explained

### `/src` - React Native Application
The main mobile application code. All TypeScript/React Native code lives here.

### `/backend` - Node.js Backend
Complete backend API server with database, authentication, and scraping capabilities.

### `/scripts` - Automation Scripts
Organized scripts for development, deployment, and maintenance tasks.

### `/ios` & `/android` - Native Code
Platform-specific native code and configurations.

## File Naming Conventions

- **Components**: PascalCase (e.g., `ActivityCard.tsx`)
- **Screens**: PascalCase with "Screen" suffix (e.g., `HomeScreen.tsx`)
- **Services**: camelCase with "Service" suffix (e.g., `activityService.ts`)
- **Utils**: camelCase (e.g., `formatters.ts`)
- **Scripts**: kebab-case with `.sh` extension (e.g., `deploy-api.sh`)

## Important Files

### Configuration
- `backend/.env` - Environment variables (not in git)
- `src/config/api.ts` - API endpoint configuration
- `backend/prisma/schema.prisma` - Database schema

### Entry Points
- `index.js` - React Native app entry
- `backend/api/server.js` - Backend API entry
- `App.tsx` - React Native root component

## Development Workflow

1. **Frontend Development**
   - Work in `/src` directory
   - Run `npm start` for Metro bundler
   - Use `npm run ios` or `npm run android`

2. **Backend Development**
   - Work in `/backend` directory
   - Run `npm run dev` for development server
   - Database migrations: `npx prisma migrate dev`

3. **Testing**
   - Tests in `/__tests__` directory
   - Run `npm test` for all tests

4. **Deployment**
   - Backend: `backend/scripts/deploy/deploy-api-manual.sh`
   - iOS: `ios/deploy-to-testflight.sh`

## Data Flow

```
User Input → React Native UI → Services → API Calls → Backend Server
                                                           ↓
Database ← Prisma ORM ← Services ← Express Routes ← API Response
```

## State Management

- **Global State**: Redux Toolkit with persist
- **Local State**: React hooks (useState, useEffect)
- **Context**: Theme, Auth, Network status
- **Storage**: MMKV for preferences, AsyncStorage for cache

## Security

- JWT authentication for API
- Secure storage for sensitive data
- Environment variables for secrets
- API rate limiting
- Input validation on both client and server

## Performance Optimizations

- API-level filtering (no client-side filtering)
- Image optimization (800x450px, 85% quality)
- Lazy loading for screens
- Redux persist for offline capability
- Axios retry logic for network resilience

## Maintenance

### Regular Tasks
- Update dependencies: `npm update`
- Clean build: `scripts/utilities/cleanup-project.sh`
- Database backup: `backend/scripts/database/backup-db.sh`
- Scraper runs: Automated via Google Cloud Scheduler

### Monitoring
- Backend logs: Google Cloud Console
- App crashes: React Native crash reporting
- API metrics: Cloud Run metrics

## Contributing

1. Follow existing code structure
2. Maintain TypeScript types
3. Write tests for new features
4. Update documentation
5. Use conventional commits

---

Last Updated: August 25, 2025