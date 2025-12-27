# Kids Activity Tracker

A comprehensive mobile application for discovering, tracking, and managing children's recreational activities across Canada.

## Overview

Kids Activity Tracker helps parents find and organize activities for their children by aggregating program data from municipal recreation departments and community centers across 43 Canadian cities. The app features intelligent filtering, personalized recommendations, calendar integration, and family sharing capabilities.

## Key Statistics

| Metric | Value |
|--------|-------|
| Active Activities | 2,900+ |
| Supported Cities | 43 |
| Scraper Platforms | 9 |
| Activity Categories | 9 |
| API Endpoints | 60+ |
| Database Tables | 24 |

## Features

- **Activity Discovery** - Search and filter activities by age, type, location, cost, and schedule
- **Smart Recommendations** - Personalized suggestions based on child profiles and preferences
- **Calendar Integration** - Visual scheduling with conflict detection and export capabilities
- **Child Profiles** - Track multiple children with interests and activity history
- **Family Sharing** - Share activity plans with co-parents and caregivers
- **Real-time Updates** - Daily automated scraping keeps activity data fresh
- **Freemium Model** - Free tier with limits, premium subscription for power users

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React Native 0.80, TypeScript, Redux Toolkit |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 15, Cloud SQL |
| Scraping | Puppeteer, Cheerio |
| Payments | RevenueCat (iOS/Android subscriptions) |
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
| [Scrapers](SCRAPERS.md) | Web scraping system |
| [Supported Cities](SUPPORTED-CITIES.md) | Coverage by region |
| [Frontend](FRONTEND.md) | React Native app guide |
| [Deployment](DEPLOYMENT.md) | Cloud deployment procedures |
| [Security](SECURITY.md) | Security practices |
| [Subscriptions](SUBSCRIPTIONS.md) | Subscription system, purchase flow, auditing |
| [Subscription Setup](SUBSCRIPTION_SETUP.md) | RevenueCat & App Store/Play Store configuration |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and solutions |

## Project Structure

```
KidsActivityTracker/
├── src/                    # React Native frontend
│   ├── components/         # Reusable UI components
│   ├── screens/            # Screen components (45+)
│   ├── services/           # API and business logic
│   └── store/              # Redux state management
├── server/                 # Node.js backend
│   ├── src/                # Express API server
│   ├── scrapers/           # Web scraping system
│   └── prisma/             # Database schema
├── scripts/                # Build and deployment scripts
│   ├── ios/                # iOS build/run scripts
│   ├── deployment/         # Deploy scripts
│   └── database/           # Database scripts
└── docs/                   # Documentation
```

## Key URLs

| Environment | URL |
|-------------|-----|
| Production API | https://kids-activity-api-205843686007.us-central1.run.app |
| API Health Check | https://kids-activity-api-205843686007.us-central1.run.app/health |
| API Documentation | https://kids-activity-api-205843686007.us-central1.run.app/api-docs |

## Contributing

1. Create a feature branch from `main`
2. Run code quality checks before committing:
   ```bash
   npm run lint && npm run typecheck
   ```
3. Submit a pull request with a clear description

---

**Document Version**: 4.0
**Last Updated**: December 2024
