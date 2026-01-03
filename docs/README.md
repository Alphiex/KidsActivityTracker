# Kids Activity Tracker

A comprehensive mobile application for discovering, tracking, and managing children's recreational activities across Canada.

## Overview

Kids Activity Tracker helps parents find and organize activities for their children by aggregating program data from municipal recreation departments and community centers across 80 Canadian cities in 11 provinces. The app features intelligent filtering, AI-powered recommendations, calendar integration, map view, and family management capabilities.

## Key Statistics

| Metric | Value |
|--------|-------|
| Active Activities | 126,000+ |
| Supported Cities | 80 |
| Provinces Covered | 11 |
| Activity Locations | 4,900+ |
| Geocoded Locations | 95.9% |
| Geocoded Activities | 99.3% |
| Active Providers | 85 |
| API Endpoints | 80+ |
| Database Tables | 40+ |

## Features

### Activity Discovery
- **Search & Filter** - Filter by age, type, location, cost, schedule, and environment (indoor/outdoor)
- **Map View** - Geographic activity browsing with 99%+ geocoded locations
- **Distance-Based Search** - Filter by proximity using GPS or saved address (5-100km radius)
- **Real-time Updates** - Automated scraping keeps activity data fresh

### AI-Powered Features
- **AI Recommendations** - Personalized suggestions based on child profiles and preferences
- **AI Chat Assistant** - Conversational activity discovery with multi-turn context
- **AI Weekly Planner** - Generate optimal weekly schedules for families with conflict detection

### Family Management
- **Child Profiles** - Multiple children with individual preferences and activity history
- **Activity States** - Track enrolled, completed, dropped, and watching activities
- **Calendar Integration** - Visual scheduling with custom events
- **Custom Events** - Add family-created activities not from providers
- **Watching/Waitlist** - Monitor activities for availability and get notifications

### Sharing & Notifications
- **Activity Sharing** - Deep links that open directly in the app or show web fallback
- **Email Notifications** - Digests, capacity alerts, price drops, and waitlist updates
- **Family Sharing** - Share activity plans with co-parents and caregivers

### Monetization
- **Freemium Model** - Free tier with limits, premium subscription for power users
- **Sponsored Partners** - B2B system for activity providers with analytics

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React Native 0.80, TypeScript, Redux Toolkit |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 15, Cloud SQL |
| AI | OpenAI GPT-4, LangGraph orchestration |
| Scraping | Puppeteer, Cheerio, Claude Vision validation |
| Maps | Google Maps SDK, Geocoding API |
| Consumer Payments | RevenueCat (iOS/Android subscriptions) |
| Partner Payments | Stripe (B2B partner subscriptions) |
| Infrastructure | Google Cloud Platform (Cloud Run, Cloud SQL) |

## Quick Start

```bash
# Install dependencies
npm install && cd server && npm install && cd ../ios && pod install && cd ..

# Run backend locally
cd server && npm run dev

# Run iOS app (use iOS 18.6 simulator)
./scripts/ios/run-simulator.sh

# Run Android app
JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx react-native run-android
```

## Documentation

### Core Documentation
| Document | Description |
|----------|-------------|
| [CLAUDE.md](../CLAUDE.md) | Claude AI development guide and project rules |
| [Architecture](ARCHITECTURE.md) | System design, components, and data flow |
| [Getting Started](GETTING-STARTED.md) | Development setup and workflow |
| [API Reference](API-REFERENCE.md) | Backend API documentation |
| [Database](DATABASE.md) | Schema and data models |
| [Frontend](FRONTEND.md) | React Native app guide |

### Features
| Document | Description |
|----------|-------------|
| [AI Chat Feature](AI-CHAT-FEATURE-PLAN.md) | Conversational AI, recommendations, guardrails |
| [AI Enhancement Plan](AI_ENHANCEMENT_PLAN.md) | AI feature roadmap and improvements |
| [Scrapers](SCRAPERS.md) | Web scraping and validation system |
| [Supported Cities](SUPPORTED-CITIES.md) | Coverage by region (80 cities, 11 provinces) |

### Monetization
| Document | Description |
|----------|-------------|
| [Subscriptions](SUBSCRIPTIONS.md) | Consumer subscription system and flow |
| [Subscription Setup](SUBSCRIPTION_SETUP.md) | RevenueCat & App Store configuration |
| [Sponsored Partners](SPONSORED-PARTNERS.md) | Partner system with analytics |
| [Stripe Integration](STRIPE-INTEGRATION.md) | Stripe setup for partner payments |

### Deployment & Operations
| Document | Description |
|----------|-------------|
| [Deployment](DEPLOYMENT.md) | Cloud deployment procedures |
| [Security](SECURITY.md) | Security practices |
| [Google Maps Setup](GOOGLE_MAPS_SETUP.md) | Maps API configuration |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and solutions |

### Testing & QA
| Document | Description |
|----------|-------------|
| [Filter Testing](FILTER-TESTING-CHECKLIST.md) | QA checklist for search filters |
| [UI Search Testing](UI-SEARCH-TESTING-CHECKLIST.md) | UI testing procedures |

### App Store
| Document | Description |
|----------|-------------|
| [App Store Listing](APP-STORE-LISTING.md) | App Store metadata |
| [Screenshot Guide](SCREENSHOT-GUIDE.md) | App Store screenshot guidelines |
| [Privacy Policy](PRIVACY-POLICY.md) | User privacy and data handling |

## Project Structure

```
KidsActivityTracker/
├── src/                    # React Native frontend
│   ├── components/         # Reusable UI components
│   │   ├── ai/             # AI-specific components
│   │   └── modern/         # Modern UI components
│   ├── screens/            # Screen components (50+)
│   │   ├── activities/     # Activity detail screens
│   │   ├── children/       # Child management screens
│   │   └── onboarding/     # Onboarding flow screens
│   ├── services/           # API and business logic
│   ├── store/              # Redux state management
│   ├── hooks/              # Custom React hooks
│   ├── navigation/         # React Navigation config
│   └── utils/              # Utility functions
├── server/                 # Node.js backend
│   ├── src/                # Express API server
│   │   ├── ai/             # AI features
│   │   │   ├── graph/      # LangGraph state machine
│   │   │   ├── orchestrator/ # AI orchestration
│   │   │   └── routes/     # AI API routes
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Express middleware
│   ├── scrapers/           # Web scraping system
│   │   ├── base/           # BaseScraper class
│   │   ├── platforms/      # Platform-specific scrapers
│   │   ├── configs/        # Provider configurations
│   │   └── validation/     # Claude Vision validation
│   ├── prisma/             # Database schema
│   └── generated/          # Prisma client
├── website/                # Next.js marketing site & deep link fallback
├── scripts/                # Build and deployment scripts
│   ├── ios/                # iOS build/run scripts
│   ├── deployment/         # Deploy scripts
│   ├── database/           # Database scripts
│   └── maintenance/        # Data maintenance scripts
├── ios/                    # iOS native code
├── android/                # Android native code
├── config/                 # Environment configuration
└── docs/                   # Documentation (25+ files)
```

## Key URLs

| Environment | URL |
|-------------|-----|
| Production API | https://kids-activity-api-4ev6yi22va-uc.a.run.app |
| API Health Check | https://kids-activity-api-4ev6yi22va-uc.a.run.app/health |
| API Documentation | https://kids-activity-api-4ev6yi22va-uc.a.run.app/api-docs |
| Website | https://kidsactivitytracker.ca |

## Contributing

1. Create a feature branch from `main`
2. Run code quality checks before committing:
   ```bash
   npm run lint && npm run typecheck
   ```
3. Submit a pull request with a clear description

---

**Document Version**: 6.0
**Last Updated**: January 2026
