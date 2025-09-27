# Kids Activity Tracker

> A React Native mobile application for discovering and managing children's activities in North Vancouver, with plans to expand across British Columbia. Features automated web scraping from local recreation centers.

## 📱 Overview

Kids Activity Tracker helps parents find, track, and manage recreational activities for their children by aggregating data from North Vancouver Recreation & Culture (NVRC) and other local providers.

### Key Features
- 🔍 Browse 2,900+ activities by category, age, location, and date
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

```bash
# Clone repository
git clone https://github.com/yourusername/KidsActivityTracker.git
cd KidsActivityTracker

# Install dependencies
npm install
cd server && npm install
cd ../ios && pod install

# Set up environment
cp config/.env.example .env
cp server/config/.env.example server/.env

# Start backend server
cd server && npm run dev

# Start React Native (in new terminal)
npm start
npm run ios  # or npm run android
```

## 📚 Documentation

All project documentation is in [`docs/`](docs/) directory:

- [📖 Development Guide](docs/guides/DEVELOPMENT_GUIDE.md) - Setup and development workflow
- [🏗️ Architecture](docs/architecture/ARCHITECTURE.md) - System design  
- [🚀 Deployment](docs/guides/DEPLOYMENT.md) - Production deployment
- [📡 API Documentation](docs/api/API_DOCUMENTATION.md) - API endpoints
- [🔒 Security Plan](docs/security/SECURITY_ENHANCEMENT_PLAN.md) - Security improvements
- [🎨 Design Specs](docs/design/AIRBNB_REFACTOR_PLAN.md) - UI/UX design
- [🔧 Maintenance](docs/guides/MAINTENANCE.md) - Troubleshooting

## 🌐 Production Information

### Live Services
- **API**: https://kids-activity-api-205843686007.us-central1.run.app
- **Project**: kids-activity-tracker-2024
- **Region**: us-central1

### Key Statistics  
- **Activities Tracked**: 2,900+ (North Vancouver)
- **Update Frequency**: Daily at 6 AM UTC
- **Providers**: North Vancouver Recreation & Culture
- **Expansion**: Planning BC-wide coverage

## 🛠️ CLI Commands

```bash
# Backend operations
node backend/cli.js scrape        # Run NVRC scraper
node backend/cli.js migrate       # Run database migrations  
node backend/cli.js fix-costs     # Fix activity costs
node backend/cli.js backup-db     # Backup database

# Development
npm test                          # Run tests
npm run lint                      # Run linter
npm run typecheck                 # Type checking
```

## 📁 Project Structure

```
KidsActivityTracker/
├── src/                    # React Native app
│   ├── components/        # UI components
│   ├── screens/          # App screens
│   └── services/         # API services
├── backend/
│   ├── prisma/           # Database schema
│   ├── scrapers/         # Web scrapers
│   └── api/              # API routes
├── ios/                  # iOS native code
├── android/              # Android native code
└── docs/                 # Consolidated documentation
```

## 📄 License

MIT License - See LICENSE file for details

---

**Version**: 1.0.0  
**Last Updated**: August 2024  
**Maintained By**: Mike & Team