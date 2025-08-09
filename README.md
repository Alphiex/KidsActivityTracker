# Kids Activity Tracker

A React Native mobile application for discovering and tracking children's activities in North Vancouver and surrounding areas. The app helps parents find sports, camps, arts, and other activities for their children based on age, location, cost, and interests.

## Features

- **Activity Discovery**: Browse thousands of activities from local recreation centers
- **Advanced Search**: Filter by category, age range, location, and price
- **Favorites**: Save activities for quick access
- **Personalized Recommendations**: Get activity suggestions based on your preferences
- **Dark Mode**: Full dark mode support for comfortable viewing
- **Offline Support**: View cached data when offline with network status indicators
- **Real-time Updates**: Activities are automatically updated from provider websites

## Tech Stack

### Mobile App (React Native)
- **Framework**: React Native 0.76.6
- **State Management**: Redux Toolkit with Redux Persist
- **Navigation**: React Navigation v6
- **UI Components**: Custom components with React Native Vector Icons
- **Styling**: StyleSheet with theme support
- **Storage**: MMKV for secure storage, AsyncStorage for preferences
- **Networking**: Axios with retry logic and offline detection

### Backend (Node.js)
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for performance optimization
- **Authentication**: JWT with access/refresh token pattern
- **API**: RESTful API with pagination support
- **Deployment**: Google Cloud Run with Cloud SQL

## Project Structure

```
KidsActivityTracker/
├── src/                    # React Native app source
│   ├── components/         # Reusable UI components
│   ├── screens/           # App screens
│   ├── services/          # API and business logic
│   ├── store/             # Redux store configuration
│   ├── navigation/        # Navigation configuration
│   ├── types/             # TypeScript type definitions
│   ├── hooks/             # Custom React hooks
│   └── contexts/          # React contexts (Theme, etc.)
├── backend/               # Node.js backend
│   ├── src/              # Backend source code
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   └── utils/        # Utility functions
│   ├── prisma/           # Database schema and migrations
│   └── monitoring/       # Monitoring dashboard
├── ios/                  # iOS native code
├── android/              # Android native code
└── docs/                 # Documentation

```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- React Native development environment ([setup guide](https://reactnative.dev/docs/environment-setup))
- Xcode 15+ (for iOS development)
- Android Studio (for Android development)
- PostgreSQL 14+ (for local backend development)
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/KidsActivityTracker.git
   cd KidsActivityTracker
   ```

2. **Install dependencies**
   ```bash
   # Install mobile app dependencies
   npm install
   
   # Install iOS dependencies
   cd ios && pod install && cd ..
   
   # Install backend dependencies
   cd backend && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   # Copy example environment files
   cp backend/.env.example backend/.env
   
   # Edit backend/.env with your configuration
   ```

4. **Set up the database**
   ```bash
   cd backend
   
   # Run database migrations
   npm run db:migrate
   
   # Seed with sample data (optional)
   npm run db:seed
   ```

### Running the App

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Metro bundler**
   ```bash
   # In the project root
   npm start
   ```

3. **Run the app**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

## API Documentation

The backend provides a RESTful API with the following main endpoints:

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout and invalidate tokens

### Activities
- `GET /api/v1/activities` - Search activities with filters
- `GET /api/v1/activities/:id` - Get activity details
- `GET /api/v1/activities/stats/summary` - Get activity statistics

### User Features
- `GET /api/favorites` - Get user's favorite activities
- `POST /api/favorites` - Add activity to favorites
- `DELETE /api/favorites/:activityId` - Remove from favorites
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update preferences

### Reference Data
- `GET /api/v1/categories` - Get all activity categories
- `GET /api/v1/locations` - Get all locations
- `GET /api/v1/providers` - Get all activity providers

For detailed API documentation, see [BACKEND_API_SPEC.md](./BACKEND_API_SPEC.md).

## Development

### Code Style
- TypeScript for type safety
- ESLint and Prettier for code formatting
- Conventional commits for version control

### Testing
```bash
# Run mobile app tests
npm test

# Run backend tests
cd backend && npm test
```

### Building for Production

**iOS**
```bash
# Build iOS app
cd ios
xcodebuild -workspace KidsActivityTracker.xcworkspace \
  -scheme KidsActivityTracker \
  -configuration Release \
  -archivePath ./build/KidsActivityTracker.xcarchive \
  archive
```

**Android**
```bash
# Build Android APK
cd android
./gradlew assembleRelease
```

**Backend**
```bash
cd backend
npm run build
npm run gcp:deploy  # Deploy to Google Cloud
```

## Deployment

The app is deployed using:
- **Backend**: Google Cloud Run with Cloud SQL (PostgreSQL)
- **iOS**: Apple App Store (coming soon)
- **Android**: Google Play Store (coming soon)

See [CLOUD_DEPLOYMENT.md](./CLOUD_DEPLOYMENT.md) for detailed deployment instructions.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

1. **Metro bundler issues**
   ```bash
   # Clear cache
   npx react-native start --reset-cache
   ```

2. **iOS build failures**
   ```bash
   cd ios
   pod deintegrate
   pod install
   ```

3. **Android build issues**
   ```bash
   cd android
   ./gradlew clean
   ```

For more troubleshooting tips, see [DEBUG_API.md](./DEBUG_API.md).

## Recent Updates

### Version 1.0.0 (2025-08-09)

**Major Fixes:**
- ✅ Fixed onboarding navigation issue where "Let's Go!" button wasn't working
- ✅ Implemented event-based navigation for smooth onboarding completion
- ✅ Fixed all API parameter naming (snake_case to camelCase)
- ✅ Activities now load successfully with proper pagination
- ✅ Added network status indicators (online/offline)
- ✅ Fixed authentication token storage and expiry handling
- ✅ Created missing backend endpoints (categories, locations, providers)
- ✅ Improved error handling throughout the app

**Known Issues:**
- Push notifications not yet implemented
- Social features planned for v1.1
- Advanced filtering options in development

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- North Vancouver Recreation & Culture for activity data
- React Native community for excellent tools and libraries
- Google Cloud Platform for hosting infrastructure