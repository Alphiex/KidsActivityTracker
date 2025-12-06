# Kids Activity Tracker - Documentation

## Quick Start

```bash
# Install dependencies
npm install && cd ios && pod install && cd ..

# Run iOS simulator (18.6)
./scripts/ios/run-simulator.sh

# Run backend locally
cd server && npm run dev
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, components, and data flow |
| [API.md](./API.md) | REST API endpoints, authentication, data models |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, development workflow, code standards |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Google Cloud deployment procedures |
| [FEATURES.md](./FEATURES.md) | Application features and user guide |
| [SECURITY.md](./SECURITY.md) | Security considerations and best practices |
| [DATABASE.md](./DATABASE.md) | Prisma schema, migrations, database operations |
| [SCRAPER.md](./SCRAPER.md) | Web scraper architecture and operation |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |

## Key URLs

| Environment | URL |
|-------------|-----|
| Production API | https://kids-activity-api-205843686007.us-central1.run.app |
| API Health Check | https://kids-activity-api-205843686007.us-central1.run.app/health |

## Project Structure

```
KidsActivityTracker/
├── src/                    # React Native app source
├── server/                 # Backend API (Node.js/Express)
├── ios/                    # iOS native code
├── android/                # Android native code
├── scripts/                # All project scripts
│   ├── ios/               # iOS build/run scripts
│   ├── deployment/        # Deploy scripts
│   ├── database/          # Database scripts
│   └── development/       # Dev utilities
├── docs/                   # Documentation (you are here)
└── config/                 # Configuration files
```

## Technology Stack

- **Mobile**: React Native 0.80, TypeScript, Redux Toolkit
- **Backend**: Node.js 20, Express, Prisma ORM
- **Database**: PostgreSQL (Cloud SQL)
- **Infrastructure**: Google Cloud Run (serverless)
- **Scraping**: Puppeteer for NVRC activity data
