# Kids Activity Tracker

A comprehensive mobile application for discovering, tracking, and managing children's recreational activities across Canada.

## Overview

Kids Activity Tracker helps parents find and organize activities for their children by aggregating program data from municipal recreation departments and community centers across 81 Canadian cities in 8 provinces. The app features intelligent filtering, personalized recommendations, calendar integration, and family sharing capabilities.

## Key Statistics

| Metric | Value |
|--------|-------|
| Active Activities | 112,000+ |
| Supported Cities | 81 |
| Provinces Covered | 8 |
| Activity Locations | 3,980+ |
| Active Providers | 79 |
| API Endpoints | 75+ |
| Database Tables | 35+ |

## Features

- **Activity Discovery** - Search and filter activities by age, type, location, cost, and schedule
- **Distance-Based Search** - Filter activities by proximity using GPS location or saved address with configurable radius (5-100km)
- **AI Recommendations** - Personalized activity suggestions with child-focused benefit explanations ("Great for your child")
- **AI Chat Assistant** - Conversational AI for natural language activity discovery with multi-turn context
- **Calendar Integration** - Visual scheduling with conflict detection and export capabilities
- **Child Profiles** - Track multiple children with interests and activity history
- **Family Sharing** - Share activity plans with co-parents and caregivers
- **Activity Sharing** - Share activities via social media/messaging with deep links that open directly in the app
- **Real-time Updates** - Daily automated scraping keeps activity data fresh
- **Email Notifications** - Daily/weekly digests, capacity alerts, price drop notifications, and waitlist alerts
- **Freemium Model** - Free tier with limits, premium subscription for power users

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React Native 0.80, TypeScript, Redux Toolkit |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 15, Cloud SQL |
| Scraping | Puppeteer, Cheerio |
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
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, components, and data flow |
| [Getting Started](GETTING-STARTED.md) | Development setup and workflow |
| [API Reference](API-REFERENCE.md) | Backend API documentation |
| [Database](DATABASE.md) | Schema and data models |
| [Scrapers](SCRAPERS.md) | Web scraping and validation system |
| [Supported Cities](SUPPORTED-CITIES.md) | Coverage by region (81 cities, 8 provinces) |
| [Frontend](FRONTEND.md) | React Native app guide |
| [Deployment](DEPLOYMENT.md) | Cloud deployment procedures |
| [Security](SECURITY.md) | Security practices |
| [AI Chat Feature](AI-CHAT-FEATURE-PLAN.md) | Conversational AI, recommendations, guardrails |
| [Subscriptions](SUBSCRIPTIONS.md) | Consumer subscription system, purchase flow, auditing |
| [Subscription Setup](SUBSCRIPTION_SETUP.md) | RevenueCat & App Store/Play Store configuration |
| [Sponsored Partners](SPONSORED-PARTNERS.md) | Partner system for activity providers with analytics |
| [Stripe Integration](STRIPE-INTEGRATION.md) | Stripe setup for partner/sponsor payments |
| [Privacy Policy](PRIVACY-POLICY.md) | User privacy and data handling |
| [App Store Listing](APP-STORE-LISTING.md) | App Store metadata and screenshots |
| [Filter Testing](FILTER-TESTING-CHECKLIST.md) | QA checklist for search filters |
| [UI Search Testing](UI-SEARCH-TESTING-CHECKLIST.md) | UI testing procedures |
| [Screenshot Guide](SCREENSHOT-GUIDE.md) | App Store screenshot guidelines |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and solutions |

## Project Structure

```
KidsActivityTracker/
├── src/                    # React Native frontend
│   ├── components/         # Reusable UI components
│   ├── screens/            # Screen components (50+)
│   │   └── onboarding/     # Onboarding flow screens
│   ├── services/           # API and business logic
│   └── store/              # Redux state management
├── server/                 # Node.js backend
│   ├── src/                # Express API server
│   │   └── ai/             # AI recommendation system
│   ├── scrapers/           # Web scraping system
│   │   ├── platforms/      # Platform-specific scrapers
│   │   ├── configs/        # Provider configurations
│   │   └── validation/     # Claude Vision validation
│   └── prisma/             # Database schema
├── scripts/                # Build and deployment scripts
│   ├── ios/                # iOS build/run scripts
│   ├── deployment/         # Deploy scripts
│   ├── database/           # Database scripts
│   └── maintenance/        # Data maintenance scripts
├── website/                # Marketing website
└── docs/                   # Documentation (20+ files)
```

## Key URLs

| Environment | URL |
|-------------|-----|
| Production API | https://kids-activity-api-4ev6yi22va-uc.a.run.app |
| API Health Check | https://kids-activity-api-4ev6yi22va-uc.a.run.app/health |
| API Documentation | https://kids-activity-api-4ev6yi22va-uc.a.run.app/api-docs |
| Website | https://website-4ev6yi22va-uc.a.run.app |

## Contributing

1. Create a feature branch from `main`
2. Run code quality checks before committing:
   ```bash
   npm run lint && npm run typecheck
   ```
3. Submit a pull request with a clear description

---

**Document Version**: 5.3
**Last Updated**: January 2026
