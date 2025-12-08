# Kids Activity Tracker - System Architecture

## Overview

Kids Activity Tracker is a full-stack application with React Native frontend, Node.js backend, PostgreSQL database, and automated web scraping, deployed on Google Cloud Platform.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   React Native App   │
          │    (iOS/Android)     │
          │   MMKV Encrypted     │
          └──────────┬──────────┘
                     │ HTTPS
          ┌──────────▼──────────┐
          │   Cloud Run API      │
          │  (Node.js/Express)   │
          │  Helmet + CORS       │
          └─────┬─────────┬──────┘
                │         │
    ┌───────────▼───┐ ┌───▼──────────────┐
    │  Cloud SQL    │ │  Cloud Scheduler  │
    │  (PostgreSQL) │ │  (Cron Jobs)      │
    │  24 Tables    │ └───┬──────────────┘
    └───────────────┘     │
                  ┌───────▼────────┐
                  │ Cloud Run Jobs  │
                  │ (Web Scraper)   │
                  └───────┬────────┘
                          │
                  ┌───────▼────────┐
                  │  NVRC Website   │
                  │  (PerfectMind)  │
                  └────────────────┘
```

---

## Component Architecture

### Frontend - React Native

#### Technology Stack
- **Framework**: React Native 0.80+
- **Language**: TypeScript
- **State Management**: Redux Toolkit + MMKV persistence
- **Navigation**: React Navigation 6.x
- **UI Components**: Custom Airbnb-style design system
- **Storage**: MMKV (encrypted, device-specific keys)
- **Theme**: Light/Dark mode support

#### Key Libraries
| Library | Purpose |
|---------|---------|
| `react-native-mmkv` | Encrypted persistent storage |
| `react-native-reanimated` | Smooth animations |
| `@react-navigation/*` | Navigation system |
| `@reduxjs/toolkit` | State management |
| `react-native-device-info` | Device encryption keys |
| `react-native-vector-icons` | Icon system |

#### Navigation Architecture
```
App.tsx
├── RootNavigator
│   ├── AuthNavigator
│   │   ├── LoginScreen
│   │   └── RegisterScreen
│   ├── OnboardingNavigator
│   │   ├── WelcomeScreen
│   │   ├── ActivityTypePreferences
│   │   ├── AgePreferences
│   │   ├── LocationPreferences
│   │   └── SchedulePreferences
│   └── MainTabs
│       ├── Explore (HomeStack)
│       │   ├── Dashboard
│       │   ├── Search & Filters
│       │   ├── Calendar
│       │   ├── ActivityList
│       │   ├── ActivityDetail
│       │   ├── CityBrowse
│       │   └── LocationBrowse
│       ├── Favourites (FavoritesStack)
│       ├── Friends & Family (FriendsStack)
│       │   ├── Children Management
│       │   ├── Sharing
│       │   └── Activity History
│       └── Profile (ProfileStack)
│           ├── Settings
│           ├── Preferences
│           └── Account
```

#### State Architecture
```
store/
├── slices/
│   ├── authSlice.ts        # Authentication state
│   ├── childrenSlice.ts    # Children profiles
│   ├── activitiesSlice.ts  # Activity data
│   ├── favoritesSlice.ts   # User favorites
│   └── preferencesSlice.ts # User preferences
├── store.ts                 # Redux configuration
└── hooks.ts                 # Typed hooks
```

### Backend - Node.js API

#### Technology Stack
| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 |
| Framework | Express 4.x |
| Language | TypeScript |
| ORM | Prisma 6.x |
| Auth | JWT (access + refresh tokens) |
| Validation | express-validator |
| Security | Helmet, CORS |
| Documentation | Swagger/OpenAPI |

#### API Structure
```
server/src/
├── routes/
│   ├── auth.ts              # Authentication (14 endpoints)
│   ├── activities.ts        # Activity search
│   ├── activityTypes.ts     # Type browsing
│   ├── children.ts          # Child management
│   ├── childActivities.ts   # Activity tracking
│   ├── cities.ts            # Location data
│   ├── locations.ts         # Venue data
│   ├── invitations.ts       # Sharing invites
│   └── sharing.ts           # Activity sharing
├── services/
│   ├── authService.ts       # Auth logic
│   ├── activityService.enhanced.ts
│   ├── childrenService.ts
│   ├── childActivityService.ts
│   └── invitationService.ts
├── middleware/
│   ├── auth.ts              # JWT + rate limiting
│   └── validateBody.ts      # Input validation
├── utils/
│   ├── tokenUtils.ts        # Token hashing
│   ├── activityFilters.ts   # Query building
│   └── dateUtils.ts         # Date helpers
├── swagger/
│   └── config.ts            # API documentation
└── server.ts                # Express app + Helmet + CORS
```

#### API Endpoint Groups
- `/api/auth/*` - Authentication (14 endpoints)
- `/api/v1/activities/*` - Activity operations (3 endpoints)
- `/api/v1/activity-types/*` - Category browsing (3 endpoints)
- `/api/v1/cities/*` - City data (3 endpoints)
- `/api/v1/locations/*` - Venue data (3 endpoints)
- `/api/children/*` - Child management (12 endpoints)
- `/api/child-activities/*` - Activity tracking (11 endpoints)
- `/api/favorites/*` - Favorites (3 endpoints)
- `/api/invitations/*` - Sharing (4 endpoints)

### Database - PostgreSQL

#### Schema Overview (24 Tables)

**Core Domain:**
- Activity, ActivitySession, ActivityPrerequisite
- ActivityType, ActivitySubtype, Category, ActivityCategory
- Provider, Location, City

**User Domain:**
- User, Session, TrustedDevice
- Child, ChildActivity, Favorite

**Sharing Domain:**
- ActivityShare, ActivityShareProfile, Invitation

**Operations:**
- ScrapeJob, ScraperRun, ProviderMetrics
- ScraperHealthCheck, ActivityHistory

#### Key Indexes for Performance
```prisma
// ChildActivity - Calendar & History queries
@@index([status])
@@index([completedAt])
@@index([registeredAt])
@@index([childId, scheduledDate])

// User - Auth lookups
@@index([verificationToken])
@@index([resetToken])
@@index([isVerified])

// Activity - Search queries
@@index([activityTypeId, activitySubtypeId])
@@index([isActive, category])
@@index([registrationStatus])
```

### Web Scraper - Puppeteer

#### Architecture
```
server/scrapers/
├── base/
│   └── BaseScraper.js       # Abstract base class
├── nvrcEnhancedParallelScraper.js
├── scraperJob.js            # Entry point
└── utils/
    ├── browserPool.js       # Browser management
    └── dataProcessor.js     # Data normalization
```

#### Scraping Flow
1. **Initialization**: Load provider config, create browser pool
2. **Pre-processing**: Mark existing activities with `isUpdated: false`
3. **Data Collection**: Navigate pages in parallel
4. **Extraction**: Parse activity details, sessions, prerequisites
5. **Transformation**: Normalize data, deduplicate by courseId
6. **Loading**: Upsert to database, update `isUpdated: true`
7. **Post-processing**: Deactivate stale records, log metrics

---

## Cloud Infrastructure

### Google Cloud Platform Services

#### Cloud Run API
- **Service**: `kids-activity-api`
- **Specs**: 2GB memory, auto-scaling 0-100 instances
- **URL**: `https://kids-activity-api-205843686007.us-central1.run.app`
- **Features**: Managed SSL, HTTPS endpoint

#### Cloud SQL
- **Instance**: `kids-activity-db-dev`
- **Type**: PostgreSQL 15
- **IP**: 34.42.149.102
- **Location**: us-central1
- **Backup**: Daily automated backups

#### Cloud Scheduler
- **Job**: `kids-activity-scraper-schedule`
- **Schedule**: Daily at 6 AM UTC
- **Target**: Cloud Run Job trigger

#### Artifact Registry
- Docker images for API and scraper
- Automated builds via Cloud Build

### Deployment Pipeline

```bash
# Build and deploy API
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/kids-activity-api
gcloud run deploy kids-activity-api \
  --image us-central1-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/kids-activity-api \
  --region us-central1 \
  --memory 2Gi \
  --allow-unauthenticated
```

---

## Security Architecture

### Authentication Flow
```
User Login
    │
    ▼
┌─────────────────┐
│ POST /api/auth  │
│    /login       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify Password │
│ (bcrypt)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────┐
│ Generate Tokens │──────>│ Store Session    │
│ - Access (15m)  │       │ (hashed refresh) │
│ - Refresh (7d)  │       └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return to App   │
│ Store in MMKV   │
│ (encrypted)     │
└─────────────────┘
```

### Security Layers

**API Level:**
- Helmet security headers (HSTS, X-Frame-Options, etc.)
- CORS restricted to approved origins
- Rate limiting (100 req/15min general, 5 req/15min auth)
- Input validation on all endpoints

**Token Security:**
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, hash stored in DB
- Session table tracks all active sessions
- Automatic cleanup of expired sessions

**Mobile Security:**
- MMKV encryption with device-specific keys
- No hardcoded fallback tokens
- Secure logger redacts sensitive data

---

## Data Flow

### Activity Search Flow
```
User Search
    │
    ▼
┌──────────────────┐
│ Mobile App       │
│ Apply filters    │
└────────┬─────────┘
         │ GET /api/v1/activities
         │ ?activityType=aquatics
         │ &ageMin=5&ageMax=10
         ▼
┌──────────────────┐
│ API Server       │
│ Build where      │
│ clause           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PostgreSQL       │
│ Query with       │
│ indexes          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ API Response     │
│ activities: []   │
│ pagination: {}   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Mobile App       │
│ Render list      │
└──────────────────┘
```

### Calendar Data Flow
```
Calendar View
    │
    ▼
┌──────────────────┐
│ GET /calendar    │
│ ?view=month      │
│ &childIds=a,b    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Verify Child     │
│ Ownership        │
│ (batch query)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Query Child      │
│ Activities in    │
│ date range       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Return Calendar  │
│ Events with      │
│ child colors     │
└──────────────────┘
```

---

## Performance Optimization

### Frontend
- **Lazy Loading**: Screens loaded on demand
- **List Virtualization**: FlatList with windowSize optimization
- **Image Caching**: Automatic with react-native-fast-image
- **MMKV Storage**: 30x faster than AsyncStorage
- **Memoization**: useMemo/useCallback for expensive renders

### Backend
- **Database Indexes**: On frequently queried columns
- **Batch Operations**: Prevent N+1 queries
- **Pagination**: Max 100 items per page
- **Connection Pooling**: Prisma default pool size
- **Query Optimization**: Selective includes

### Infrastructure
- **Auto-scaling**: 0 to 100 instances on Cloud Run
- **Cold Start Mitigation**: Min instances = 0 (cost optimization)
- **Memory Allocation**: 2GB for API

---

## Monitoring & Logging

### Application Monitoring
- Cloud Logging for all services
- Structured JSON logs
- Error tracking with stack traces

### Key Metrics
| Metric | Target |
|--------|--------|
| API Response Time | < 200ms (p95) |
| Database Query Time | < 50ms (p95) |
| Error Rate | < 0.1% |
| Scraper Success | > 99% |

### Health Endpoints
- `GET /health` - API health check
- Scraper health tracking in database

---

## Scalability Considerations

### Current Capacity
- 2,900+ active activities
- Supports concurrent users
- Daily scraping pipeline
- 24 database tables

### Scaling Strategies
1. **Horizontal**: Cloud Run auto-scaling
2. **Database**: Read replicas (future)
3. **Caching**: Redis layer (planned)
4. **CDN**: Static assets (planned)

### Future Architecture
```
                    ┌─────────────┐
                    │   CDN       │
                    │  (images)   │
                    └──────┬──────┘
                           │
┌──────────────────────────┼──────────────────────────┐
│                  Load Balancer                       │
└──────────┬───────────────┼───────────────┬──────────┘
           │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │  API Pod  │   │  API Pod  │   │  API Pod  │
     └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │   Redis     │
                    │  (cache)    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
        │  Primary  │ │ Replica │ │ Replica   │
        │    DB     │ │   DB    │ │    DB     │
        └───────────┘ └─────────┘ └───────────┘
```

---

## Technology Decisions

| Decision | Rationale |
|----------|-----------|
| React Native | Single codebase, native performance, hot reload |
| TypeScript | Type safety, better IDE support, fewer bugs |
| Node.js/Express | JavaScript everywhere, async I/O, ecosystem |
| PostgreSQL | Relational model fits, ACID, Prisma support |
| Google Cloud | Serverless scaling, managed services, cost-effective |
| Prisma | Type-safe ORM, migrations, good DX |
| MMKV | Fast, encrypted, cross-platform storage |
| JWT | Stateless auth, mobile-friendly |

---

**Document Version**: 3.0
**Last Updated**: December 2024
**Next Review**: March 2025
