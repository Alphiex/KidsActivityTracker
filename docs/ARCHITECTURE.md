# System Architecture

This document describes the technical architecture of the Kids Activity Tracker platform.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOBILE CLIENTS                               │
│  ┌─────────────────┐                    ┌─────────────────┐         │
│  │   iOS App       │                    │  Android App    │         │
│  │  React Native   │                    │  React Native   │         │
│  └────────┬────────┘                    └────────┬────────┘         │
└───────────┼──────────────────────────────────────┼──────────────────┘
            │                                      │
            └──────────────┬───────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GOOGLE CLOUD PLATFORM                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     CLOUD RUN (API)                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Express   │  │ Auth/Rate   │  │  Activity Service   │  │   │
│  │  │   Router    │──│  Limiting   │──│  Child Service      │  │   │
│  │  │             │  │  Middleware │  │  Sharing Service    │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │   │
│  └───────────────────────────────────────────────┼──────────────┘   │
│                                                  │                   │
│  ┌───────────────────────────────────────────────┼──────────────┐   │
│  │                    CLOUD SQL                  │               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              PostgreSQL 15 Database                     │ │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │   │
│  │  │  │Activities│ │  Users   │ │ Children │ │ Providers │  │ │   │
│  │  │  │  (2900+) │ │          │ │          │ │   (43)    │  │ │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   CLOUD SCHEDULER                             │  │
│  │                   (Daily 6:00 AM UTC)                         │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                    CLOUD RUN JOBS                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │              Scraper Job (Puppeteer)                    │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │ │  │
│  │  │  │ Perfect │ │ Active  │ │ REGPROG │ │  COE    │ ...   │ │  │
│  │  │  │  Mind   │ │ Network │ │         │ │         │       │ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/Puppeteer
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL RECREATION WEBSITES                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Calgary │ │Vancouver│ │ Toronto │ │ Ottawa  │ │  etc... │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (React Native)

```
┌─────────────────────────────────────────────────────────────────┐
│                        App.tsx                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Navigation Container                      │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │ Explore │  │Favorites│  │ Family  │  │   Profile   │  │  │
│  │  │  Stack  │  │  Stack  │  │  Stack  │  │    Stack    │  │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘  │  │
│  └───────┼────────────┼───────────┼──────────────┼──────────┘  │
│          │            │           │              │              │
│  ┌───────▼────────────▼───────────▼──────────────▼──────────┐  │
│  │                      Redux Store                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │  │
│  │  │Activities│ │ Children│  │  Auth   │  │ Preferences │  │  │
│  │  │  Slice  │  │  Slice  │  │  Slice  │  │    Slice    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                     Services Layer                         │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐  │  │
│  │  │    API    │  │   Auth    │  │     Preferences       │  │  │
│  │  │  Service  │  │  Service  │  │       Service         │  │  │
│  │  └─────┬─────┘  └───────────┘  └───────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │   Location Service (GPS, Geocoding, Distance Calc)    │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  └────────┼──────────────────────────────────────────────────┘  │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │                    MMKV Storage                            │  │
│  │            (Encrypted local persistence)                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Backend (Express API)

```
┌─────────────────────────────────────────────────────────────────┐
│                        server.ts                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Express Application                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                    Middleware                        │  │  │
│  │  │  helmet │ cors │ rateLimit │ morgan │ bodyParser    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                           │                                │  │
│  │  ┌────────────────────────▼────────────────────────────┐  │  │
│  │  │                    Route Groups                      │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │  │  │
│  │  │  │  /auth  │ │/activit │ │/children│ │ /sharing │  │  │  │
│  │  │  │         │ │  ies    │ │         │ │          │  │  │  │
│  │  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘  │  │  │
│  │  └───────┼───────────┼───────────┼───────────┼────────┘  │  │
│  │          │           │           │           │            │  │
│  │  ┌───────▼───────────▼───────────▼───────────▼────────┐  │  │
│  │  │                   Services                          │  │  │
│  │  │  authService │ activityService │ childrenService   │  │  │
│  │  └─────────────────────────┬──────────────────────────┘  │  │
│  │                            │                              │  │
│  │  ┌─────────────────────────▼──────────────────────────┐  │  │
│  │  │              Prisma ORM Client                      │  │  │
│  │  └─────────────────────────┬──────────────────────────┘  │  │
│  └────────────────────────────┼──────────────────────────────┘  │
│                               │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                                ▼
                        PostgreSQL Database
```

### Navigation Architecture

```
App.tsx
├── RootNavigator
│   ├── AuthNavigator
│   │   ├── LoginScreen
│   │   ├── RegisterScreen
│   │   └── ForgotPasswordScreen
│   ├── OnboardingNavigator
│   │   ├── WelcomeScreen
│   │   ├── ActivityTypePreferences
│   │   ├── AgePreferences
│   │   ├── LocationPreferences
│   │   ├── DistancePreferences
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
│           ├── DistancePreferences
│           └── Account
```

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
│ Build Prisma     │
│ where clause     │
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

### Distance Filtering Flow

```
User enables distance filter
        │
        ▼
┌──────────────────┐
│ Location Service │
│ Get GPS or       │
│ Saved Address    │
└────────┬─────────┘
         │ coordinates
         ▼
┌──────────────────┐
│ Activity Service │
│ Add params:      │
│ userLat, userLon │
│ radiusKm         │
└────────┬─────────┘
         │ GET /api/v1/activities
         ▼
┌──────────────────┐
│ API Server       │
│ 1. Bounding box  │
│ 2. Haversine     │
│    distance calc │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Activities       │
│ filtered by      │
│ proximity        │
└──────────────────┘
```

### Scraper Data Flow

```
Cloud Scheduler (6 AM UTC)
        │
        ▼
Cloud Run Job Start
        │
        ▼
┌───────────────────────────────────────────┐
│          For each Provider:               │
│  1. Load provider config (JSON)           │
│  2. Initialize Puppeteer browser          │
│  3. Navigate to recreation website        │
│  4. Extract activity data                 │
│  5. Transform & normalize                 │
│  6. Upsert to database                    │
│  7. Deactivate stale records              │
│  8. Record metrics                        │
└───────────────────────────────────────────┘
        │
        ▼
Database Updated (2,900+ activities)
```

## Technology Stack

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React Native 0.80 | Cross-platform mobile |
| Language | TypeScript | Type safety |
| State | Redux Toolkit | State management |
| Storage | MMKV | Encrypted persistence |
| Navigation | React Navigation 7.x | Screen routing |
| UI | Custom + Lucide Icons | Design system |
| HTTP | Axios | API communication |
| Forms | react-hook-form | Form handling |

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 20 | Server runtime |
| Framework | Express 4.x | HTTP server |
| Language | TypeScript | Type safety |
| ORM | Prisma 6.x | Database access |
| Auth | JWT | Token authentication |
| Validation | express-validator | Input validation |
| Security | Helmet, CORS | HTTP security |
| Docs | Swagger/OpenAPI | API documentation |

### Database
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Primary datastore |
| Hosting | Cloud SQL | Managed service |
| Migrations | Prisma Migrate | Schema versioning |

### Scraping
| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser | Puppeteer | Web automation |
| Parser | Cheerio | HTML parsing |
| Scheduling | Cloud Scheduler | Cron jobs |
| Execution | Cloud Run Jobs | Serverless compute |

## Performance Optimization

### Frontend
- **Lazy Loading**: Screens loaded on demand
- **List Virtualization**: FlatList with windowSize optimization
- **Image Caching**: Automatic with optimized loading
- **MMKV Storage**: 30x faster than AsyncStorage
- **Memoization**: useMemo/useCallback for expensive renders

### Backend
- **Database Indexes**: On frequently queried columns
- **Batch Operations**: Prevent N+1 queries
- **Pagination**: Max 100 items per page
- **Connection Pooling**: Prisma default pool
- **Query Optimization**: Selective includes

### Infrastructure
- **Auto-scaling**: 0 to 100 instances on Cloud Run
- **Memory Allocation**: 2GB for API and scraper jobs
- **Cold Start**: Optimized container images

## Key Metrics Targets

| Metric | Target |
|--------|--------|
| API Response Time | < 200ms (p95) |
| Database Query Time | < 50ms (p95) |
| Error Rate | < 0.1% |
| Scraper Success | > 99% |

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

**Document Version**: 4.1
**Last Updated**: December 2025
