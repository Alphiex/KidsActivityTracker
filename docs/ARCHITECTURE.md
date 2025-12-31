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
            ┌──────────────┼──────────────────────┐
            │              │                      │
            ▼              ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   RevenueCat     │ │  GCP Cloud Run   │ │  App Store /     │
│  Subscriptions   │ │    (API)         │ │  Play Store      │
└──────────────────┘ └────────┬─────────┘ └──────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                      GOOGLE CLOUD PLATFORM                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     CLOUD RUN (API)                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Express   │  │ Auth/Rate   │  │  Activity Service   │  │   │
│  │  │   Router    │──│  Limiting   │──│  Child Service      │  │   │
│  │  │             │  │  Middleware │  │  AI Recommendations │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │   │
│  └───────────────────────────────────────────────┼──────────────┘   │
│                                                  │                   │
│  ┌───────────────────────────────────────────────┼──────────────┐   │
│  │                    CLOUD SQL                  │               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              PostgreSQL 15 Database                     │ │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │   │
│  │  │  │Activities│ │  Users   │ │ Children │ │ Providers │  │ │   │
│  │  │  │(117,700+)│ │          │ │          │ │   (80)    │  │ │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   CLOUD SCHEDULER                             │  │
│  │           (Tier 1: 3x daily, Tier 2: daily, Tier 3: weekly)   │  │
│  └───────────────────────────┬──────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                    CLOUD RUN JOBS                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │              Scraper Job (Puppeteer/Cheerio)            │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │ │  │
│  │  │  │ Perfect │ │ Active  │ │ Amilia  │ │  IC3    │ ...   │ │  │
│  │  │  │  Mind   │ │ Network │ │         │ │         │       │ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │          Claude Vision Validation System                 │ │  │
│  │  │     (Screenshot capture → Visual extraction → Compare)  │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/Puppeteer
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL RECREATION WEBSITES                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Toronto │ │Vancouver│ │  Ottawa │ │ Calgary │ │  etc... │       │
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
│  │  │Activities│ │ Children│  │  Auth   │  │Subscription │  │  │
│  │  │  Slice  │  │  Slice  │  │  Slice  │  │    Slice    │  │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                     Services Layer                         │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐  │  │
│  │  │    API    │  │RevenueCat │  │     Preferences       │  │  │
│  │  │  Service  │  │  Service  │  │       Service         │  │  │
│  │  └─────┬─────┘  └───────────┘  └───────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │   Location Service (GPS, Geocoding, Distance Calc)    │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────────────┐  │  │
│  │  │        Favorites Service (MMKV + API sync)            │  │  │
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
│  │  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐ │  │  │
│  │  │ │ /auth  │ │/activit│ │/subscr │ │   /sponsored   │ │  │  │
│  │  │ │        │ │  ies   │ │ iption │ │   /partners    │ │  │  │
│  │  │ └───┬────┘ └────┬───┘ └───┬────┘ └───────┬────────┘ │  │  │
│  │  └─────┼───────────┼─────────┼──────────────┼──────────┘  │  │
│  │        │           │         │              │              │  │
│  │  ┌─────▼───────────▼─────────▼──────────────▼──────────┐  │  │
│  │  │                   Services                           │  │  │
│  │  │  authService │ activityService │ subscriptionService │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  │                            │                               │  │
│  │  ┌─────────────────────────▼───────────────────────────┐  │  │
│  │  │                  AI Module                           │  │  │
│  │  │    Recommendation Engine │ Personalization Service   │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  │                            │                               │  │
│  │  ┌─────────────────────────▼───────────────────────────┐  │  │
│  │  │              Prisma ORM Client                       │  │  │
│  │  └─────────────────────────┬───────────────────────────┘  │  │
│  └────────────────────────────┼─────────────────────────────┘  │
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
│   │   ├── OnboardingIntro
│   │   ├── OnboardingActivityTypes
│   │   ├── OnboardingAge
│   │   ├── OnboardingLocation (GPS or city + distance)
│   │   └── OnboardingComplete
│   └── MainTabs
│       ├── Explore (HomeStack)
│       │   ├── DashboardScreenModern
│       │   ├── Search & Filters
│       │   ├── CalendarScreenModernFixed
│       │   ├── ActivityList
│       │   ├── ActivityDetail
│       │   ├── FeaturedPartnersScreen
│       │   ├── CityBrowse
│       │   └── LocationBrowse
│       ├── Favourites (FavoritesStack)
│       │   └── FavoritesScreen
│       ├── Friends & Family (FriendsStack)
│       │   ├── Children Management
│       │   ├── ChildDetailScreen
│       │   ├── Sharing
│       │   └── Activity History
│       └── Profile (ProfileStack)
│           ├── Settings
│           ├── SubscriptionScreen
│           ├── Preferences
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
         │ &userLat=49.28&userLon=-123.12
         │ &radiusKm=25
         ▼
┌──────────────────┐
│ API Server       │
│ Build Prisma     │
│ where clause     │
│ + Haversine      │
│ distance filter  │
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

### Subscription Flow

```
User taps Subscribe
        │
        ▼
┌──────────────────┐
│ RevenueCat SDK   │
│ Fetch offerings  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Show Paywall     │
│ Premium options  │
└────────┬─────────┘
         │ User purchases
         ▼
┌──────────────────┐
│ App Store /      │
│ Play Store       │
│ Process payment  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ RevenueCat       │
│ Webhook → API    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Database         │
│ Update user      │
│ subscription     │
└──────────────────┘
```

### Scraper Data Flow

```
Cloud Scheduler (tiered schedule)
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
┌───────────────────────────────────────────┐
│          Validation System:               │
│  1. Capture screenshot of web page        │
│  2. Send to Claude Vision API             │
│  3. Extract visible data                  │
│  4. Compare with scraped data             │
│  5. Generate discrepancy report           │
└───────────────────────────────────────────┘
        │
        ▼
Database Updated (117,700+ activities)
```

### Email Notification Flow

```
┌───────────────────────────────────────────┐
│         NOTIFICATION TRIGGERS             │
│                                           │
│  ┌─────────────┐    ┌─────────────────┐  │
│  │Daily Digest │    │  Post-Scraper   │  │
│  │ (7 AM PST)  │    │     Alerts      │  │
│  └──────┬──────┘    └────────┬────────┘  │
│         │                    │           │
│  ┌──────┴──────┐    ┌───────┴────────┐  │
│  │Weekly Digest│    │ Activity Change │  │
│  │(Sun 9 AM)   │    │   Detection     │  │
│  └──────┬──────┘    └───────┬────────┘  │
└─────────┼───────────────────┼────────────┘
          │                   │
          ▼                   ▼
┌───────────────────────────────────────────┐
│         NOTIFICATION SERVICE              │
│                                           │
│  1. Match activities to user preferences  │
│  2. Check deduplication (24h window)      │
│  3. Validate quiet hours                  │
│  4. Generate unsubscribe tokens           │
│  5. Build HTML email from template        │
│  6. Send via Nodemailer/SMTP              │
│  7. Log notification to database          │
└───────────────────────────┬───────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Daily     │   │  Capacity   │   │    Price    │
│   Digest    │   │    Alert    │   │    Drop     │
│   Email     │   │   Email     │   │   Email     │
└─────────────┘   └─────────────┘   └─────────────┘
```

**Notification Types**:
| Type | Trigger | Frequency |
|------|---------|-----------|
| Daily Digest | Cron (7 AM PST) | Max 1/day per user |
| Weekly Digest | Cron (Sun 9 AM PST) | Max 1/week per user |
| Capacity Alert | Post-scraper | Max 1/4h per activity |
| Price Drop | Post-scraper | Max 1/24h per activity |
| Spots Available | Post-scraper | When activity becomes available |

**Core Services**:
- `NotificationService`: Orchestrates email sending, deduplication, token generation
- `UserPreferenceMatcherService`: Matches activities to user preferences
- `ActivitySnapshotService`: Detects price/capacity changes between scrapes

## Technology Stack

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React Native 0.80 | Cross-platform mobile |
| Language | TypeScript | Type safety |
| State | Redux Toolkit | State management |
| Storage | MMKV | Encrypted persistence |
| Navigation | React Navigation 7.x | Screen routing |
| UI | Custom + MaterialCommunityIcons | Design system |
| HTTP | Axios | API communication |
| Forms | react-hook-form | Form handling |
| Payments | RevenueCat | Subscription management |

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
| AI | Claude API | Recommendations & validation |

### Database
| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL 15 | Primary datastore |
| Hosting | Cloud SQL | Managed service |
| Migrations | Prisma Migrate | Schema versioning |
| Tables | 35+ | Full schema |

### Scraping
| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser | Puppeteer | Web automation |
| Parser | Cheerio | HTML parsing |
| Scheduling | Cloud Scheduler | Tiered cron jobs |
| Execution | Cloud Run Jobs | Serverless compute |
| Validation | Claude Vision | Data verification |

## Performance Optimization

### Frontend
- **Lazy Loading**: Screens loaded on demand
- **List Virtualization**: FlatList with windowSize optimization
- **Image Caching**: Automatic with optimized loading
- **MMKV Storage**: 30x faster than AsyncStorage
- **Memoization**: useMemo/useCallback for expensive renders
- **Modern Screens**: Optimized *Modern.tsx components

### Backend
- **Database Indexes**: On frequently queried columns
- **Batch Operations**: Prevent N+1 queries
- **Pagination**: Max 100 items per page
- **Connection Pooling**: Prisma default pool
- **Query Optimization**: Selective includes
- **Caching**: Response caching for static data

### Infrastructure
- **Auto-scaling**: 0 to 100 instances on Cloud Run
- **Memory Allocation**: 2GB for API and scraper jobs
- **Cold Start**: Optimized container images
- **CDN**: Static assets cached at edge

## Key Metrics Targets

| Metric | Target |
|--------|--------|
| API Response Time | < 200ms (p95) |
| Database Query Time | < 50ms (p95) |
| Error Rate | < 0.1% |
| Scraper Success | > 99% |
| App Launch Time | < 2s |
| Search Results | < 500ms |

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
| RevenueCat | Simplified subscription management, cross-platform |
| Claude Vision | Accurate validation without brittle selectors |

## Security Architecture

### Authentication
- JWT tokens with 15-minute access / 7-day refresh
- Bcrypt password hashing (12 rounds)
- Rate limiting on auth endpoints (5/15min)

### Data Protection
- MMKV encrypted local storage
- HTTPS-only API communication
- No PII in logs
- Secure token storage

### API Security
- Helmet security headers
- CORS whitelist
- Request validation
- SQL injection prevention (Prisma)

---

**Document Version**: 5.0
**Last Updated**: December 2025
