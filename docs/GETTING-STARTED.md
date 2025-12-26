# Getting Started

This guide covers setting up the Kids Activity Tracker development environment.

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20+ | Runtime for backend and tooling |
| npm | 10+ | Package management |
| PostgreSQL | 15+ | Database |
| Xcode | 15+ | iOS development |
| CocoaPods | Latest | iOS dependency management |
| Android Studio | Latest | Android development (optional) |
| Git | Latest | Version control |

### Recommended Tools

- **VS Code** with extensions: ESLint, Prettier, TypeScript
- **Postico** or **pgAdmin** for database management
- **Postman** or **Insomnia** for API testing

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/KidsActivityTracker.git
cd KidsActivityTracker
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

### 4. Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 5. Environment Configuration

Create environment files:

```bash
# Frontend environment
cp .env.example .env

# Backend environment
cp server/.env.example server/.env
```

Edit `.env` files with your configuration:

**Frontend (.env)**:
```env
API_URL=http://localhost:3000
```

**Backend (server/.env)**:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/kidsactivity
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=another-secret-key-min-32-chars
PORT=3000
NODE_ENV=development
```

### 6. Database Setup

```bash
# Create database
createdb kidsactivity

# Run migrations
cd server
npx prisma migrate dev

# Seed initial data
npx prisma db seed
cd ..
```

## Running the Application

### Start Backend Server

```bash
cd server
npm run dev
```

The API will be available at `http://localhost:3000`.

API documentation: `http://localhost:3000/api-docs`

### Start Metro Bundler

In a new terminal:

```bash
npx react-native start --reset-cache
```

### Run iOS App

**Important**: Always use iOS 18.6 simulator to avoid network issues.

```bash
# Recommended method
./scripts/ios/run-simulator.sh

# Alternative: specify simulator directly
npx react-native run-ios --udid="A8661E75-FE3E-483F-8F13-AC87110E8EE2"
```

### Available iOS 18.6 Simulators

| Device | UDID |
|--------|------|
| iPhone 16 Pro (Primary) | A8661E75-FE3E-483F-8F13-AC87110E8EE2 |
| iPhone 16 Pro Max | 9F3BA117-5391-4064-9FAF-8A7CA82CE93C |
| iPhone 16 | 6558E69E-75D4-4088-B42B-DBD7F5FDFAFA |
| iPhone 16 Plus | 86E8B2CB-2E1B-4621-9A20-78549BDFB0F9 |

## Development Workflow

### Code Quality Checks

Before committing, always run:

```bash
# Check for linting issues
npm run lint

# Check TypeScript types
npm run typecheck
```

### Project Scripts

**Frontend (root package.json)**:
```bash
npm start              # Start Metro bundler
npm run lint           # Run ESLint
npm run typecheck      # TypeScript check
npm test               # Run tests
npm run ios            # Run iOS app (use script instead)
npm run android        # Run Android app
```

**Backend (server/package.json)**:
```bash
npm run dev            # Development server with hot reload
npm run build          # Compile TypeScript
npm run start          # Production server
npm run lint           # Run ESLint
npm run typecheck      # TypeScript check
npm test               # Run tests
```

**Database (server)**:
```bash
npx prisma migrate dev    # Run migrations (development)
npx prisma migrate deploy # Run migrations (production)
npx prisma db seed        # Seed database
npx prisma studio         # Open Prisma Studio GUI
npx prisma generate       # Regenerate Prisma client
```

## Project Structure Overview

```
KidsActivityTracker/
├── src/                        # React Native source
│   ├── components/             # Reusable components
│   │   ├── ActivityCard.tsx    # Activity display card
│   │   ├── modern/             # Modern UI components
│   │   ├── calendar/           # Calendar components
│   │   └── HierarchicalSelect/ # Location picker
│   ├── screens/                # Screen components
│   │   ├── DashboardScreenModern.tsx
│   │   ├── CalendarScreenModernFixed.tsx
│   │   ├── FiltersScreen.tsx
│   │   └── ...
│   ├── services/               # API & business logic
│   │   ├── api.ts              # API client
│   │   ├── authService.ts
│   │   └── preferencesService.ts
│   ├── store/                  # Redux store
│   │   ├── slices/             # Redux slices
│   │   └── store.ts
│   ├── types/                  # TypeScript definitions
│   ├── navigation/             # React Navigation setup
│   └── theme/                  # Design tokens
│
├── server/                     # Backend server
│   ├── src/
│   │   ├── routes/             # API routes
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, rate limiting
│   │   ├── utils/              # Utilities
│   │   └── server.ts           # Express app
│   ├── scrapers/
│   │   ├── platforms/          # Scraper implementations
│   │   └── configs/providers/  # City configurations
│   └── prisma/
│       ├── schema.prisma       # Database schema
│       └── migrations/         # Migration history
│
├── scripts/
│   ├── ios/                    # iOS scripts
│   ├── deployment/             # Deploy scripts
│   └── database/               # DB utilities
│
├── ios/                        # iOS native code
├── android/                    # Android native code
└── docs/                       # Documentation
```

## Common Development Tasks

### Adding a New Screen

1. Create screen component in `src/screens/`
2. Add to navigation in `src/navigation/`
3. Add TypeScript types if needed

### Adding a New API Endpoint

1. Create route in `server/src/routes/`
2. Add service logic in `server/src/services/`
3. Register route in `server.ts`
4. Add Swagger documentation

### Modifying Database Schema

1. Edit `server/prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name description`
3. Regenerate client: `npx prisma generate`

### Adding a New City/Provider

1. Create config file in `server/scrapers/configs/providers/`
2. Ensure scraper platform exists for the website type
3. Test locally before deploying

## Debugging

### React Native Debugging

- **React Native Debugger**: Download and run before starting app
- **Flipper**: Built-in debugging tool
- **Console logs**: View in Metro bundler terminal

### Backend Debugging

- **VS Code debugger**: Use launch.json configuration
- **API logs**: Morgan logs all requests to console
- **Prisma logs**: Add `DEBUG=prisma:*` environment variable

### Database Debugging

```bash
# Open Prisma Studio for visual database inspection
cd server && npx prisma studio
```

## Troubleshooting

See [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues and solutions.

### Quick Fixes

**Metro bundler issues**:
```bash
npx react-native start --reset-cache
```

**iOS build issues**:
```bash
cd ios && pod install --repo-update && cd ..
```

**Database connection issues**:
```bash
# Verify PostgreSQL is running
pg_isready
```

**Type errors after schema change**:
```bash
cd server && npx prisma generate
```
