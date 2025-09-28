# Kids Activity Tracker

> A React Native mobile application for discovering and managing children's activities in North Vancouver and across British Columbia. Features automated web scraping, smart filtering, and modern Airbnb-style UI.

## 📱 Overview

Kids Activity Tracker helps parents find, track, and manage recreational activities for their children by aggregating data from multiple recreation centers and providers across BC.

### Key Features
- 🔍 Browse 1000+ activities with smart filtering (age, location, date, cost)
- 👶 Manage multiple child profiles with personalized recommendations
- 💰 Budget-friendly filtering and cost tracking
- 📍 Location-based search with interactive map view
- 🎯 Hide closed or full activities automatically (global preference)
- 🔄 Real-time availability tracking with registration status
- 📊 Modern Airbnb-style UI with card and list views
- ⭐ Favorite activities and get notifications

### Technology Stack
- **Frontend**: React Native 0.76.5 (TypeScript) - iOS & Android
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cloud**: Google Cloud Platform (Cloud Run, Cloud SQL)
- **Scraping**: Puppeteer for automated data collection
- **State Management**: Redux Toolkit + MMKV for persistence

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/KidsActivityTracker.git
cd KidsActivityTracker

# Install dependencies
npm install
cd server && npm install && cd ..
cd ios && pod install && cd ..

# Start backend server
cd server && npm run dev

# Start React Native Metro (new terminal)
npx react-native start --reset-cache

# Run on iOS (new terminal)
npx react-native run-ios --simulator="iPhone 16 Pro"

# Run on Android
npx react-native run-android
```

## 🌐 Production Information

### Live Services
- **API**: https://kids-activity-api-4ev6yi22va-uc.a.run.app
- **Project**: kids-activity-tracker-2024
- **Region**: us-central1
- **Database**: Cloud SQL PostgreSQL

### Key Statistics
- **Activities Tracked**: 1000+ active activities
- **Providers**: North Vancouver Recreation, Community Centers BC-wide
- **Users**: Growing user base across British Columbia
- **Performance**: <200ms API response time

## 🏗️ Project Structure

```
KidsActivityTracker/
├── src/                    # React Native app source
│   ├── components/        # Reusable UI components
│   ├── screens/          # App screens
│   ├── services/         # API and business logic
│   ├── store/           # Redux state management
│   ├── types/           # TypeScript definitions
│   └── utils/           # Helper functions
├── server/               # Backend server
│   ├── prisma/          # Database schema & migrations
│   ├── src/
│   │   ├── api/        # REST API routes
│   │   ├── services/   # Business logic
│   │   ├── scrapers/   # Web scraping modules
│   │   └── utils/      # Utilities & filters
│   └── scripts/        # Maintenance scripts
├── ios/                 # iOS native code
├── android/            # Android native code
└── .archive/           # Archived old code
```

## 📚 Key Lessons Learned

### Architecture & Design
- **Monorepo Structure**: Keeping frontend and backend in same repo simplifies deployment
- **TypeScript Everywhere**: Full-stack TypeScript reduces bugs and improves DX
- **Prisma ORM**: Excellent for type-safe database operations and migrations
- **MMKV Storage**: Much faster than AsyncStorage for React Native persistence

### Performance Optimizations
- **Global Filters**: Hide closed/full activities by default improves UX
- **Pagination**: Essential for handling 1000+ activities efficiently
- **Image Caching**: Critical for smooth scrolling with activity images
- **Background Refresh**: Keep data fresh without impacting performance

### Deployment & DevOps
- **Cloud Run URLs**: ⚠️ CRITICAL - URL changes on redeploy break clients!
  - Solution: Use custom domain mapping or stable service names
  - Current URL must be preserved: `kids-activity-api-4ev6yi22va-uc.a.run.app`
- **Helmet Security**: Can break iOS apps - carefully configure CORS headers
- **Environment Variables**: Use `.env` files but never commit them
- **Database Migrations**: Always backup before running in production

### Common Issues & Solutions

#### No Activities Showing
1. Check API URL in `src/config/api.ts` matches deployed service
2. Verify `hideClosedOrFull` filter isn't too restrictive
3. Check network connectivity and CORS settings

#### Build Failures
```bash
# Clean and rebuild
cd ios && rm -rf build Pods && pod install
cd .. && npx react-native clean
```

#### API Deployment
```bash
# Deploy to Cloud Run (from server directory)
gcloud run deploy kids-activity-api \
  --source . \
  --region=us-central1 \
  --project=kids-activity-tracker-2024 \
  --allow-unauthenticated
```

## 🔧 Development Commands

```bash
# Development
npm run ios              # Run iOS simulator
npm run android          # Run Android emulator
npm test                # Run tests
npm run lint            # Lint code
npm run typecheck       # TypeScript checking

# Backend
cd server
npm run dev            # Start dev server
npm run build          # Build for production
npm run migrate:dev    # Run migrations
npm run migrate:deploy # Deploy migrations

# Maintenance
node scripts/check-activities.js  # Verify data integrity
node scripts/fix-costs.js         # Fix activity pricing
```

## 🔒 Security Considerations

- API rate limiting implemented (100 req/15min)
- SQL injection protection via Prisma parameterized queries
- XSS prevention through React Native's default escaping
- Environment variables for sensitive configuration
- HTTPS-only in production
- Input validation on all API endpoints

## 📈 Future Enhancements

- [ ] Push notifications for activity openings
- [ ] Social features - share activities with friends
- [ ] Advanced search with AI recommendations
- [ ] Multi-language support (French, Mandarin)
- [ ] Apple Watch companion app
- [ ] Waitlist management for full activities

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines (coming soon).

## 📄 License

MIT License - See LICENSE file for details

---

**Version**: 2.0.0
**Last Updated**: September 2025
**Maintained By**: Mike & Team

## Emergency Contacts

- **Production Issues**: Check Cloud Run logs
- **Database Issues**: Cloud SQL console
- **Build Issues**: Check GitHub Actions or local Xcode