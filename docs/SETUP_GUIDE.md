# Kids Activity Tracker - Setup Guide

This guide will help you set up the Kids Activity Tracker project for local development.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **Redis** (optional, for caching) - [Download](https://redis.io/download/)

### Mobile Development
- **Xcode** (v15+) - For iOS development (Mac only)
- **Android Studio** - For Android development
- **CocoaPods** - iOS dependency manager
  ```bash
  sudo gem install cocoapods
  ```

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/KidsActivityTracker.git
cd KidsActivityTracker
```

## Step 2: Backend Setup

### 2.1 Install Backend Dependencies

```bash
cd backend
npm install
```

### 2.2 Database Setup

1. **Create PostgreSQL Database**
   ```bash
   createdb kidsactivitytracker
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file with your configuration:**
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/kidsactivitytracker"
   
   # Redis (optional)
   REDIS_URL="redis://localhost:6379"
   
   # JWT Secrets (generate secure random strings)
   JWT_ACCESS_SECRET="your-access-secret-here"
   JWT_REFRESH_SECRET="your-refresh-secret-here"
   
   # Session Secret
   SESSION_SECRET="your-session-secret-here"
   
   # Other settings
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:8081
   ```

4. **Generate secure secrets:**
   ```bash
   # Generate random secrets
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

### 2.3 Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Seed database with sample data
npm run db:seed
```

### 2.4 Start Backend Server

```bash
# Development mode with hot reload
npm run dev

# Or production mode
npm run build
npm start
```

The backend API will be available at `http://localhost:3000`

## Step 3: Mobile App Setup

### 3.1 Install Dependencies

```bash
# Return to project root
cd ..

# Install React Native dependencies
npm install
```

### 3.2 iOS Setup (Mac only)

1. **Fix Xcode Path (if needed)**
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```

2. **Install iOS dependencies**
   ```bash
   cd ios
   bundle install  # Install Ruby dependencies
   bundle exec pod install  # Install CocoaPods
   cd ..
   ```

3. **Configure API endpoint for iOS**
   - The app is configured to use production API by default
   - To use local backend, update `src/config/api.ts`:
   ```typescript
   const LOCAL_API_URL = Platform.select({
     ios: 'http://localhost:3000',
     android: 'http://10.0.2.2:3000',
   });
   ```

### 3.3 Android Setup

1. **Ensure Android SDK is installed**
   - Open Android Studio
   - Go to SDK Manager
   - Install Android SDK Platform 34
   - Install Android SDK Build-Tools

2. **Configure API endpoint for Android**
   - Android emulator uses `10.0.2.2` to access host machine
   - This is already configured in the API config

## Step 4: Running the Application

### 4.1 Start Metro Bundler

```bash
# In project root
npm start
```

### 4.2 Run on iOS (Mac only)

```bash
# In a new terminal
npm run ios

# Or specify a device
npm run ios -- --device "iPhone 15 Pro"
```

### 4.3 Run on Android

```bash
# Ensure Android emulator is running or device is connected
npm run android
```

## Step 5: Development Tools

### 5.1 React Native Debugger

1. **Install React Native Debugger**
   - Download from [GitHub releases](https://github.com/jhen0409/react-native-debugger/releases)

2. **Enable debugging**
   - iOS: Press `Cmd + D` in simulator
   - Android: Press `Cmd + M` (Mac) or `Ctrl + M` (Windows/Linux)
   - Select "Debug with Chrome" or "Debug"

### 5.2 Reactotron (Optional)

1. **Install Reactotron**
   - Download from [Reactotron releases](https://github.com/infinitered/reactotron/releases)

2. **The app is already configured for Reactotron**
   - Just run Reactotron before starting the app

### 5.3 Database Management

```bash
# Open Prisma Studio
cd backend
npm run db:studio
```

This opens a web UI for viewing and editing database records.

## Step 6: Testing

### 6.1 Test Backend API

```bash
# Run the test script
./TEST_API.sh
```

### 6.2 Test Account

Use these credentials for testing:
- **Email**: test@kidsactivitytracker.com
- **Password**: Test123!

### 6.3 Run Tests

```bash
# Frontend tests
npm test

# Backend tests
cd backend
npm test
```

## Common Issues and Solutions

### Issue: Metro bundler fails to start
**Solution:**
```bash
# Clear cache
npx react-native start --reset-cache

# Clear watchman
watchman watch-del-all
```

### Issue: iOS build fails
**Solution:**
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Issue: Android build fails
**Solution:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Issue: Cannot connect to backend
**Solution:**
1. Ensure backend is running on port 3000
2. Check firewall settings
3. For Android emulator, use `10.0.2.2` instead of `localhost`
4. For iOS simulator, `localhost` should work

### Issue: Database connection error
**Solution:**
1. Ensure PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Try connecting with psql:
   ```bash
   psql -U username -d kidsactivitytracker
   ```

### Issue: CocoaPods installation fails
**Solution:**
```bash
# Update CocoaPods
sudo gem update cocoapods

# Clear CocoaPods cache
pod cache clean --all

# Try again
cd ios
pod install
```

## What's Working in the App

- ✅ User authentication (login/register)
- ✅ Activity discovery with 5000+ activities
- ✅ Advanced search and filtering
- ✅ Favorite activities management
- ✅ User preferences and personalization
- ✅ Dark mode support
- ✅ Offline support with network indicators
- ✅ Real-time data from NVRC

## Next Steps

1. **Configure your IDE**
   - Install ESLint and Prettier extensions
   - Enable format on save

2. **Set up pre-commit hooks**
   ```bash
   npm run prepare
   ```

3. **Review the documentation**
   - [API Documentation](./BACKEND_API_SPEC.md)
   - [Deployment Guide](./CLOUD_DEPLOYMENT.md)
   - [Debug Guide](./DEBUG_API.md)

## Need Help?

- Check the [Troubleshooting section](#common-issues-and-solutions)
- Review React Native [documentation](https://reactnative.dev/docs/getting-started)
- Open an issue on GitHub