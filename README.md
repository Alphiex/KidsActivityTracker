# Kids Activity Tracker

> A React Native mobile application for discovering and managing children's activities in Greater Vancouver. Features automated web scraping, smart filtering, modern Airbnb-style UI, and comprehensive calendar management.

## Overview

Kids Activity Tracker helps parents find, track, and manage recreational activities for their children by aggregating data from local recreation centers and providers.

### Key Features

- **Activity Discovery**: Browse 100,000+ activities with smart filtering (age, location, date, cost)
- **79 Cities Supported**: Coverage across 10 provinces from coast to coast
- **Address Autocomplete**: Start typing your address and get instant suggestions with full address parsing
- **Distance Filtering**: Find activities within your radius (5-100km) from GPS or saved address
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
| **Database** | Cloud SQL PostgreSQL (kids-activity-db-dev) |
| **Region** | us-central1 |
| **Memory** | 2GB (Cloud Run) |

### Key Statistics

| Metric | Value |
|--------|-------|
| **Activities** | 100,000+ active |
| **Cities** | 79 municipalities |
| **Provinces** | 10 (BC, AB, SK, MB, ON, QC, NS, NL) |
| **Database Tables** | 24 |
| **API Endpoints** | 60+ |
| **Response Time** | <200ms (p95) |

---

## Supported Cities

Activities are scraped daily from 79 municipalities across Canada. Data is refreshed multiple times per day for critical cities.

### British Columbia (25 cities)

**Metro Vancouver (18)**
| City | Activities | Schedule |
|------|------------|----------|
| Vancouver | 10,356 | 3x daily |
| Burnaby | 6,648 | 3x daily |
| Surrey | 4,017 | 3x daily |
| Richmond | 4,249 | 3x daily |
| Coquitlam | 3,513 | 3x daily |
| North Vancouver (NVRC) | 7,400 | 3x daily |
| West Vancouver | 4,488 | Daily |
| Port Coquitlam | 2,169 | Daily |
| Maple Ridge | 2,094 | Daily |
| Township of Langley | 2,022 | Daily |
| Delta | 1,954 | Daily |
| New Westminster | 1,733 | Daily |
| City of Langley | 1,712 | Daily |
| Port Moody | 684 | Daily |
| Pitt Meadows | 388 | Daily |
| Abbotsford | 1,901 | Daily |
| White Rock | 194 | Daily |
| Bowen Island | 113 | Daily |

**Vancouver Island & Okanagan (7)**
| City | Activities | Schedule |
|------|------------|----------|
| Saanich | 2,002 | Daily |
| Victoria | 169 | 3x daily |
| Nanaimo | 470 | Daily |
| Kelowna | 133 | Daily |
| Vernon | -- | Daily |
| Kamloops | 224 | Daily |
| Prince George | -- | Daily |

### Alberta (4 cities)

| City | Activities | Schedule |
|------|------------|----------|
| Edmonton | 3,157 | 3x daily |
| Calgary | 674 | 3x daily |
| Airdrie | 436 | Daily |
| Red Deer | -- | Daily |

### Saskatchewan (2 cities)

| City | Activities | Schedule |
|------|------------|----------|
| Regina | 1,178 | 3x daily |
| Saskatoon | 82 | 3x daily |

### Manitoba (1 city)

| City | Activities | Schedule |
|------|------------|----------|
| Winnipeg | -- | 3x daily |

### Ontario (37 cities)

**Greater Toronto Area (13)**
| City | Activities | Schedule |
|------|------------|----------|
| Toronto | 4,797 | 3x daily |
| Mississauga | 4,687 | 3x daily |
| Brampton | 3,715 | 3x daily |
| Richmond Hill | 1,663 | 3x daily |
| Markham | 382 | 3x daily |
| Vaughan | 462 | 3x daily |
| Oakville | 1,007 | 3x daily |
| Aurora | 736 | Daily |
| Whitchurch-Stouffville | 419 | Daily |
| King Township | 140 | Daily |
| Milton | 26 | Daily |
| Newmarket | -- | Daily |
| Georgina | -- | Daily |

**Durham Region (4)**
| City | Activities | Schedule |
|------|------------|----------|
| Whitby | 1,099 | 3x daily |
| Clarington | 1,089 | Daily |
| Ajax | 937 | Daily |
| Pickering | 870 | Daily |
| Oshawa | 235 | Daily |

**Waterloo Region (3)**
| City | Activities | Schedule |
|------|------------|----------|
| Kitchener | 1,212 | 3x daily |
| Cambridge | 898 | 3x daily |
| Waterloo | -- | Daily |

**Southwestern Ontario (5)**
| City | Activities | Schedule |
|------|------------|----------|
| London | 31 | 3x daily |
| Windsor | -- | 3x daily |
| Guelph | 922 | Daily |
| Brantford | 406 | Daily |
| Chatham-Kent | 99 | Daily |

**Central & Other Ontario (12)**
| City | Activities | Schedule |
|------|------------|----------|
| Ottawa | 7,416 | 3x daily |
| Hamilton | -- | 3x daily |
| St. Catharines | 927 | 3x daily |
| Niagara Falls | 161 | Daily |
| Barrie | 1,361 | 3x daily |
| Greater Sudbury | 613 | Daily |
| Kingston | 201 | Daily |
| Peterborough | -- | Daily |
| Thunder Bay | -- | Daily |
| Burlington | 2 | Daily |
| Caledon | -- | Daily |

### Quebec (5 cities)

| City | Activities | Schedule |
|------|------------|----------|
| Montreal | 575 | 3x daily |
| Quebec City | 43 | 3x daily |
| Laval | 20 | Daily |
| Gatineau | -- | Daily |
| Sherbrooke | 5 | Daily |
| Dorval | 17 | Daily |

### Atlantic Canada (2 cities)

| City | Activities | Schedule |
|------|------------|----------|
| Halifax | -- | 3x daily |
| St. John's | 391 | Daily |

### Scraper Platforms

Data is collected using 11 different platform integrations:

| Platform | Cities | Description |
|----------|--------|-------------|
| PerfectMind | 35 | Most common rec center platform |
| ActiveNetwork | 29 | National recreation platform |
| Amilia | 3 | Quebec-focused platform |
| Intelligenz | 3 | BC/Ontario platform |
| IC3 | 2 | Quebec/Ontario platform |
| LookNBook | 2 | Alberta platform |
| COE | 1 | Edmonton custom platform |
| RegProg | 1 | Calgary custom platform |
| WebTrac | 1 | Saskatoon platform |
| Qidigo | 1 | Sherbrooke platform |
| FullCalendar | 1 | Lions Bay custom |

### Scheduling Tiers

- **Critical (30 cities)**: 3x daily scraping (6am, 12pm, 6pm local time)
- **Standard (43 cities)**: Daily scraping
- **Low (5 cities)**: Weekly scraping (small municipalities)

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
**Last Updated**: December 2025
**Maintained By**: Mike
