# Changelog

All notable changes to the Kids Activity Tracker project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-09

### Added
- **Authentication System**
  - JWT-based authentication with access/refresh tokens
  - Secure token storage using MMKV
  - Automatic token refresh
  - Login/Register/Logout functionality

- **Activity Discovery**
  - Browse 5000+ activities from NVRC
  - Advanced search functionality
  - Filter by category, age, location, and price
  - Pagination support with infinite scroll
  - Activity detail views with full information

- **User Features**
  - Favorites management (add/remove/view)
  - User preferences and personalization
  - Dark mode support
  - Offline support with network indicators

- **Backend Infrastructure**
  - Node.js/Express API with TypeScript
  - PostgreSQL database with Prisma ORM
  - Redis caching for performance
  - Google Cloud Run deployment
  - Automated scraping from NVRC

- **Mobile App Features**
  - React Native 0.76.6 with TypeScript
  - Redux Toolkit for state management
  - React Navigation v6
  - Custom UI components
  - Network status indicators
  - Error boundaries and handling

### Fixed
- API parameter naming (snake_case to camelCase)
- Authentication token storage and expiry
- Date serialization issues
- Network connectivity handling
- iOS Simulator network issues
- TypeScript compilation errors
- Onboarding navigation issue where "Let's Go!" button did nothing
- Navigation structure to properly handle onboarding completion
- ActivityCard crash due to non-existent useStore hook import

### Changed
- Migrated from mock data to real API
- Updated all API endpoints to match backend
- Improved error handling throughout app
- Enhanced UI/UX with loading states
- Optimized performance with pagination

### Security
- Implemented JWT authentication
- Added rate limiting
- Secure password hashing with bcrypt
- CORS configuration
- Input validation and sanitization

## [0.5.0] - 2025-08-07

### Added
- Initial React Native project setup
- Basic navigation structure
- Mock data for development
- UI screens and components
- Redux store configuration

### Known Issues
- Push notifications not yet implemented
- Social features planned for future release
- Advanced filtering options in development

## Upcoming Features

### Version 1.1.0 (Planned)
- Push notifications for new activities
- Advanced calendar integration
- Social features (share activities)
- Multi-child profile support
- Waitlist notifications

### Version 1.2.0 (Planned)
- Direct registration through app
- Payment integration
- Review and rating system
- Community features
- Event reminders

## Migration Guide

### From 0.5.0 to 1.0.0

1. **Update Dependencies**
   ```bash
   npm install
   cd ios && pod install
   ```

2. **Environment Variables**
   - Update API URL in `src/config/api.ts`
   - Configure backend `.env` file

3. **Database Migration**
   ```bash
   cd backend
   npm run db:migrate
   ```

4. **Clear App Data**
   - iOS: Delete app from simulator
   - Android: Clear app data

## Support

For questions or issues:
- Check [DEBUG_API.md](./DEBUG_API.md) for troubleshooting
- Open an issue on GitHub
- Review documentation in project root