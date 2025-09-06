# Development Guide

## Prerequisites

### Required Software
- **Node.js 20+** - JavaScript runtime
- **PostgreSQL 15+** - Database
- **Git** - Version control
- **Google Cloud SDK** - For deployment

### Mobile Development
- **Xcode 15+** - iOS development (Mac only)
- **Android Studio** - Android development
- **CocoaPods** - iOS dependency manager
  ```bash
  sudo gem install cocoapods
  ```

### Optional Tools
- **Bundler** - Ruby dependency manager for iOS
  ```bash
  gem install bundler
  ```

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/KidsActivityTracker.git
cd KidsActivityTracker
```

### 2. Install Dependencies
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install

# iOS dependencies
cd ../ios && pod install
```

### 3. Environment Setup
```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
```

### 4. Configure Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/kidsactivity"

# JWT Authentication
JWT_SECRET="your-secure-secret-here"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV=development

# Scraper (for local testing)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

#### Frontend (.env)
```env
# API Configuration
API_URL=http://localhost:3000
```

### 5. Database Setup
```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed
```

### 6. Start Development Servers

#### Backend
```bash
cd backend
npm run dev  # Starts on http://localhost:3000
```

#### React Native
```bash
# In root directory
npm start  # Starts Metro bundler

# In new terminal - iOS
npm run ios

# Or Android
npm run android
```

## Project Structure

```
KidsActivityTracker/
├── src/                    # React Native app
│   ├── components/        # UI components
│   ├── screens/          # App screens
│   ├── services/         # API services
│   ├── contexts/         # React contexts
│   ├── navigation/       # Navigation setup
│   └── utils/            # Utilities
├── backend/
│   ├── src/              # Backend source
│   ├── prisma/           # Database schema
│   ├── scrapers/         # Web scrapers
│   ├── api/              # API routes
│   └── cli.js            # CLI tool
├── ios/                  # iOS native code
├── android/              # Android native code
└── docs/                 # Documentation
```

## Development Workflow

### 1. Feature Development

#### Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

#### Code Standards
- Use TypeScript for type safety
- Follow ESLint rules
- Format with Prettier
- Write meaningful commit messages

#### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test ActivityCard.test.tsx

# Run with coverage
npm test -- --coverage
```

### 2. Backend Development

#### API Development
1. Define routes in `backend/api/server.js`
2. Implement business logic in services
3. Update Prisma schema if needed
4. Generate migration: `npx prisma migrate dev`

#### Database Operations
```bash
# View database in Prisma Studio
npx prisma studio

# Reset database
npx prisma migrate reset

# Generate migration
npx prisma migrate dev --name your_migration_name
```

#### CLI Commands
```bash
# Run scraper
node backend/cli.js scrape

# Run migrations
node backend/cli.js migrate

# Fix activity costs
node backend/cli.js fix-costs

# Backup database
node backend/cli.js backup-db
```

### 3. React Native Development

#### Component Development
```typescript
// src/components/ActivityCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ 
  activity, 
  onPress 
}) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.container}>
        <Text style={styles.title}>{activity.name}</Text>
      </View>
    </TouchableOpacity>
  );
};
```

#### Screen Development
```typescript
// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { activityService } from '../services/activityService';

export const HomeScreen = () => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    const data = await activityService.getActivities();
    setActivities(data);
  };

  return (
    <FlatList
      data={activities}
      renderItem={({ item }) => <ActivityCard activity={item} />}
    />
  );
};
```

#### API Service Pattern
```typescript
// src/services/activityService.ts
import axios from 'axios';
import { API_URL } from '../config/api';

class ActivityService {
  async getActivities(filters?: ActivityFilters) {
    const response = await axios.get(`${API_URL}/api/v1/activities`, {
      params: filters
    });
    return response.data.activities;
  }

  async getActivity(id: string) {
    const response = await axios.get(`${API_URL}/api/v1/activities/${id}`);
    return response.data.activity;
  }
}

export const activityService = new ActivityService();
```

### 4. Debugging

#### React Native Debugging
```bash
# Open React Native Debugger
npm run debug

# View device logs - iOS
npx react-native log-ios

# View device logs - Android
npx react-native log-android
```

#### Backend Debugging
```javascript
// Use debug module
const debug = require('debug')('app:scraper');
debug('Processing activity:', activity);

// Enable debug output
DEBUG=app:* npm run dev
```

#### Database Debugging
```bash
# View SQL queries
DEBUG=prisma:query npm run dev

# Inspect database
npx prisma studio
```

### 5. Testing

#### Unit Tests
```javascript
// __tests__/components/ActivityCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityCard } from '../src/components/ActivityCard';

describe('ActivityCard', () => {
  it('displays activity name', () => {
    const activity = { name: 'Swimming' };
    const { getByText } = render(<ActivityCard activity={activity} />);
    expect(getByText('Swimming')).toBeTruthy();
  });
});
```

#### Integration Tests
```javascript
// __tests__/api/activities.test.js
const request = require('supertest');
const app = require('../../backend/api/server');

describe('GET /api/v1/activities', () => {
  it('returns activities list', async () => {
    const response = await request(app)
      .get('/api/v1/activities')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.activities)).toBe(true);
  });
});
```

## Common Tasks

### Adding a New Screen
1. Create screen component in `src/screens/`
2. Add to navigation in `src/navigation/AppNavigator.tsx`
3. Create corresponding service in `src/services/`
4. Add tests in `__tests__/screens/`

### Adding API Endpoint
1. Define route in `backend/api/server.js`
2. Implement logic in service file
3. Update API documentation
4. Add tests

### Updating Database Schema
1. Edit `backend/prisma/schema.prisma`
2. Generate migration: `npx prisma migrate dev --name description`
3. Update seed data if needed
4. Deploy migration to production

### Adding New Activity Provider
1. Create scraper in `backend/scrapers/`
2. Extend BaseScraper class
3. Add provider to database
4. Test locally before deployment

## Environment Variables

### Development
```env
NODE_ENV=development
DATABASE_URL=postgresql://localhost/kidsactivity
API_URL=http://localhost:3000
JWT_SECRET=dev-secret
```

### Production
```env
NODE_ENV=production
DATABASE_URL=postgresql://[CLOUD_SQL_CONNECTION]
API_URL=https://kids-activity-api-205843686007.us-central1.run.app
JWT_SECRET=[SECURE_SECRET]
```

## Build & Deployment

### Backend Build
```bash
cd backend
npm run build  # Compiles TypeScript
```

### React Native Build

#### iOS
```bash
cd ios
fastlane beta  # Deploy to TestFlight
```

#### Android
```bash
cd android
./gradlew assembleRelease  # Build APK
./gradlew bundleRelease    # Build AAB for Play Store
```

### Production Deployment
```bash
# Deploy API
cd backend
gcloud builds submit --config deploy/cloudbuild-api.yaml

# Deploy scraper
gcloud builds submit --config deploy/cloudbuild-scraper-enhanced.yaml
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 [PID]
```

#### Pod Install Failures
```bash
cd ios
rm -rf Pods Podfile.lock
pod cache clean --all
pod install
```

#### Metro Bundler Issues
```bash
# Clear cache
npx react-native start --reset-cache

# Clean build
cd android && ./gradlew clean
cd ../ios && xcodebuild clean
```

#### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_ctl status

# Start PostgreSQL
pg_ctl start

# Verify connection
psql -U postgres -d kidsactivity
```

### Error Messages

#### "Cannot find module 'prisma'"
```bash
cd backend
npm install
npx prisma generate
```

#### "No bundle URL present"
```bash
# Restart Metro bundler
npm start --reset-cache
```

#### "Module not found" in React Native
```bash
# Clear everything
watchman watch-del-all
rm -rf node_modules
npm install
cd ios && pod install
```

## Code Style Guide

### TypeScript
- Use interfaces for object types
- Prefer const over let
- Use async/await over promises
- Explicit return types for functions

### React Native
- Functional components with hooks
- Extract styles to StyleSheet
- Use TypeScript for props
- Memoize expensive computations

### Backend
- Use middleware for common logic
- Validate input with express-validator
- Handle errors consistently
- Log important operations

### Git Commits
- Use conventional commits
- Keep commits atomic
- Write descriptive messages
- Reference issue numbers

## Resources

### Documentation
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Prisma Docs](https://www.prisma.io/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [Google Cloud Docs](https://cloud.google.com/docs)

### Tools
- [React Native Debugger](https://github.com/jhen0409/react-native-debugger)
- [Prisma Studio](https://www.prisma.io/studio)
- [Postman](https://www.postman.com/) - API testing
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)

### Community
- Project Issues: GitHub Issues
- React Native: [Discord](https://discord.gg/reactnative)
- Prisma: [Slack](https://slack.prisma.io/)

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit pull request
6. Wait for review

### Code Review Checklist
- [ ] Tests pass
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] No console.logs in production code
- [ ] Security best practices followed
- [ ] Performance considered