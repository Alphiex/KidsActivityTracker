# Kids Activity Tracker

> A React Native mobile application for discovering and managing children's activities in Greater Vancouver. Features automated web scraping, smart filtering, modern Airbnb-style UI, and comprehensive calendar management.

## Overview

Kids Activity Tracker helps parents find, track, and manage recreational activities for their children by aggregating data from local recreation centers and providers.

### Key Features

- **Activity Discovery**: Browse 2,900+ activities with smart filtering (age, location, date, cost)
- **Child Profiles**: Manage multiple children with personalized recommendations
- **Calendar Integration**: Track activities with week/month views and color-coded child assignments
- **Favorites**: Save and organize activities you're interested in
- **Activity Sharing**: Share children profiles with co-parents and family members
- **Real-time Status**: Live availability tracking and registration status
- **Modern UI**: Airbnb-style design with card views and smooth animations
- **Freemium Model**: Free tier with limits, premium subscription for unlimited access

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native 0.80+ (TypeScript) |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL 15 with Prisma 6.x ORM |
| **Cloud** | Google Cloud Platform (Cloud Run, Cloud SQL) |
| **Scraping** | Puppeteer for automated data collection |
| **State** | Redux Toolkit + MMKV (encrypted persistence) |
| **Auth** | JWT (access + refresh tokens) |
| **Payments** | RevenueCat (iOS/Android subscriptions) |

---

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
./run-ios-18-6.sh

# Run on Android
npx react-native run-android
```

---

## Production Information

### Live Services

| Service | URL/Details |
|---------|-------------|
| **API** | https://kids-activity-api-205843686007.us-central1.run.app |
| **Database** | Cloud SQL PostgreSQL (34.42.149.102) |
| **Region** | us-central1 |
| **Memory** | 2GB (Cloud Run) |

### Key Statistics

| Metric | Value |
|--------|-------|
| **Activities** | 2,900+ active |
| **Database Tables** | 24 |
| **API Endpoints** | 60+ |
| **Response Time** | <200ms (p95) |

---

## Project Structure

```
KidsActivityTracker/
├── src/                          # React Native app source
│   ├── components/               # Reusable UI components
│   │   └── modern/              # Modern Airbnb-style components
│   ├── screens/                 # App screens
│   ├── services/                # API and business logic
│   ├── store/                   # Redux state management
│   │   └── slices/             # Redux slices (auth, children, etc.)
│   ├── navigation/              # React Navigation setup
│   ├── types/                   # TypeScript definitions
│   └── utils/                   # Helper functions
├── server/                       # Backend server
│   ├── prisma/                  # Database schema (24 tables)
│   ├── src/
│   │   ├── routes/             # REST API routes
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, rate limiting
│   │   └── swagger/            # API documentation
│   └── scrapers/               # Web scraping modules
├── ios/                         # iOS native code
├── android/                     # Android native code
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md         # System architecture
│   ├── API.md                  # API reference
│   ├── DATABASE.md             # Schema documentation
│   ├── FEATURES.md             # Feature guide
│   └── SECURITY.md             # Security documentation
├── CLAUDE.md                    # Development instructions
└── package.json                 # Dependencies
```

---

## Development

### Commands

```bash
# Development
npm run ios              # Run iOS simulator
npm run android          # Run Android emulator
npm run lint            # Lint code
npm run typecheck       # TypeScript checking

# iOS with specific simulator (recommended)
./run-ios-18-6.sh

# Backend
cd server && npm run dev    # Run local server
```

### iOS Simulator Configuration

**Important**: iOS 18.4 simulator has known network connectivity issues. Always use iOS 18.6:

```bash
# Preferred method
./run-ios-18-6.sh

# Alternative - use UDID directly
npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
```

### Available iOS 18.6 Simulators

| Device | UDID |
|--------|------|
| iPhone 16 Pro (Primary) | A8661E75-FE3E-483F-8F13-AC87110E8EE2 |
| iPhone 16 Pro Max | 9F3BA117-5391-4064-9FAF-8A7CA82CE93C |
| iPhone 16 | 6558E69E-75D4-4088-B42B-DBD7F5FDFAFA |

---

## Security

### Implemented Security Measures

**API Security:**
- Helmet security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- CORS restricted to approved origins
- Rate limiting (100 req/15min general, 5 req/15min auth)
- Input validation on all endpoints
- JWT secret validation at startup

**Authentication:**
- JWT access tokens (15-minute expiry)
- JWT refresh tokens (7-day expiry, hashed in database)
- Session table tracks all active sessions
- Automatic token refresh

**Mobile Security:**
- MMKV encryption with device-specific keys
- No hardcoded fallback tokens
- Secure logger redacts sensitive data

**Database Security:**
- Prisma parameterized queries (SQL injection protection)
- Optimized indexes for performance
- Pagination limits (max 100 items)
- Batch operations to prevent N+1 queries

See [docs/SECURITY.md](docs/SECURITY.md) for complete security documentation.

---

## Subscriptions & Monetization

The app uses a freemium model with RevenueCat for payment processing.

### Tier Structure

| Feature | Free | Premium ($5.99/mo) |
|---------|------|-------------------|
| Child profiles | 2 | Unlimited |
| Favorites | 10 | Unlimited |
| Family sharing | 1 person | Unlimited |
| Filters | Basic | Advanced |
| Calendar | View only | Export to calendar |
| Alerts | Weekly digest | Instant notifications |
| Saved searches | None | 10 presets |

### Key Components

- **RevenueCat Integration**: Handles iOS App Store and Google Play purchases
- **Feature Gating**: Limits enforced on both client and server
- **Webhook Handling**: Real-time subscription status updates
- **A/B Testing**: Paywall optimization experiments
- **Analytics**: Conversion funnel tracking

### Purchase Flow

1. User hits a limit (e.g., tries to add 3rd child)
2. Upgrade prompt modal shown with contextual messaging
3. User taps "Upgrade" → navigates to Paywall screen
4. RevenueCat presents native purchase UI
5. On success: webhook updates backend, app refreshes subscription state
6. Limits removed, user continues with premium features

### Documentation

- [SUBSCRIPTIONS.md](docs/SUBSCRIPTIONS.md) - Complete subscription system documentation
- [SUBSCRIPTION_SETUP.md](docs/SUBSCRIPTION_SETUP.md) - App Store/Play Store setup guide

---

## Common Issues & Solutions

### No Activities Showing
1. Check API URL in `src/config/api.ts`
2. Verify `hideClosedOrFull` filter setting
3. Check network connectivity

### Build Failures
```bash
# Clean and rebuild
cd ios && rm -rf build Pods && pod install
cd .. && npx react-native clean
```

### Native Module Issues
```bash
cd ios && pod install && cd ..
./run-ios-18-6.sh
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and data flow |
| [API.md](docs/API.md) | Complete API reference (60+ endpoints) |
| [DATABASE.md](docs/DATABASE.md) | Database schema (24 tables) |
| [FEATURES.md](docs/FEATURES.md) | Feature guide and navigation |
| [SECURITY.md](docs/SECURITY.md) | Security implementation details |
| [SUBSCRIPTIONS.md](docs/SUBSCRIPTIONS.md) | Subscription system, purchase flow, auditing |
| [SUBSCRIPTION_SETUP.md](docs/SUBSCRIPTION_SETUP.md) | RevenueCat & store configuration guide |

---

## Contributing

1. Run `npm run lint` and `npm run typecheck` before committing
2. Keep the root directory clean - use appropriate subdirectories
3. Update documentation when adding new features

---

## License

MIT License - See LICENSE file for details

---

**Version**: 3.0.0
**Last Updated**: December 2024
**Maintained By**: Mike
