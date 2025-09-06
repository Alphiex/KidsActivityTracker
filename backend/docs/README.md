# Kids Activity Tracker

> A React Native mobile application for discovering and managing children's activities in North Vancouver, with automated web scraping from local recreation centers.

## 📱 Project Overview

Kids Activity Tracker helps parents find, track, and manage recreational activities for their children by aggregating data from North Vancouver Recreation & Culture (NVRC) and other local providers.

### Key Features
- 🔍 Browse activities by category, age, location, and date
- 👶 Manage multiple child profiles with age-appropriate filtering
- 💰 Filter by cost and registration status
- 📍 Location-based search with map integration
- 🔄 Daily automated data updates via web scraping
- 📊 Activity recommendations based on child interests

### Technology Stack
- **Frontend**: React Native (TypeScript) - iOS & Android
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cloud**: Google Cloud Platform (Cloud Run, Cloud SQL, Cloud Scheduler)
- **Scraping**: Puppeteer for automated data collection

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Xcode (for iOS development)
- Android Studio (for Android development)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/KidsActivityTracker.git
cd KidsActivityTracker

# Install dependencies
npm install
cd backend && npm install
cd ios && pod install

# Set up environment
cp .env.example .env
cp backend/.env.example backend/.env
```

### Running Locally

```bash
# Start backend
cd backend && npm run dev

# Start React Native (in separate terminal)
npm start

# Run on iOS
npm run ios

# Run on Android  
npm run android
```

## 📚 Documentation

### Core Documentation
- [Architecture](./ARCHITECTURE.md) - System design and technical architecture
- [API Documentation](./API_DOCUMENTATION.md) - Backend endpoints and data models
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment and cloud setup
- [Development Guide](./DEVELOPMENT_GUIDE.md) - Setup and development workflow
- [Scraper Documentation](./SCRAPER_DOCUMENTATION.md) - Web scraping system
- [Maintenance Guide](./MAINTENANCE.md) - Monitoring and troubleshooting

## 🏗️ Project Structure

```
KidsActivityTracker/
├── src/                    # React Native app
│   ├── components/        # Reusable UI components
│   ├── screens/          # Screen components
│   ├── services/         # API services
│   └── utils/            # Utilities
├── backend/
│   ├── src/              # Backend source
│   ├── prisma/           # Database schema
│   ├── scrapers/         # Web scrapers
│   └── deploy/           # Deployment configs
├── ios/                  # iOS native code
├── android/              # Android native code
└── docs/                 # Documentation
```

## 🌐 Production Information

### Live Services
- **API**: https://kids-activity-api-205843686007.us-central1.run.app
- **Project**: kids-activity-tracker-2024
- **Region**: us-central1

### Key Statistics
- **Activities Tracked**: 2,900+
- **Update Frequency**: Daily at 6 AM UTC
- **Providers**: North Vancouver Recreation & Culture

## 🛠️ Available Commands

### Backend CLI
```bash
node backend/cli.js scrape        # Run NVRC scraper
node backend/cli.js migrate       # Run database migrations
node backend/cli.js fix-costs     # Fix activity costs
node backend/cli.js backup-db     # Backup database
```

### Development
```bash
npm test                          # Run tests
npm run lint                      # Run linter
npm run typecheck                 # Type checking
```

## 📝 Contributing

1. Check existing functionality before creating new files
2. Follow established patterns and conventions
3. Keep files under 500 total (excluding node_modules)
4. No test files outside `__tests__` directories
5. No archive directories in repository

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Support

For issues or questions:
- Check [Development Guide](./DEVELOPMENT_GUIDE.md) for setup help
- Review [Maintenance Guide](./MAINTENANCE.md) for troubleshooting
- Open an issue on GitHub for bugs or features

---

**Current Version**: 1.0.0  
**Last Updated**: August 2024  
**Maintained By**: Mike & Team