# System Architecture

## Overview

Kids Activity Tracker is a full-stack application with React Native frontend, Node.js backend, PostgreSQL database, and automated web scraping, deployed on Google Cloud Platform.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   React Native App   │
          │    (iOS/Android)     │
          └──────────┬──────────┘
                     │ HTTPS
          ┌──────────▼──────────┐
          │   Cloud Run API      │
          │  (Node.js/Express)   │
          └─────┬─────────┬──────┘
                │         │
    ┌───────────▼───┐ ┌───▼──────────────┐
    │  Cloud SQL    │ │  Cloud Scheduler  │
    │  (PostgreSQL) │ │  (Cron Jobs)      │
    └───────────────┘ └───┬──────────────┘
                          │
                  ┌───────▼────────┐
                  │ Cloud Run Jobs  │
                  │ (Web Scraper)   │
                  └───────┬────────┘
                          │
                  ┌───────▼────────┐
                  │  NVRC Website   │
                  └────────────────┘
```

## Component Architecture

### Frontend - React Native

#### Technology Stack
- **Framework**: React Native 0.80
- **Language**: TypeScript
- **State Management**: Redux Toolkit + MMKV persistence
- **Navigation**: React Navigation
- **UI Components**: Custom Airbnb-style components
- **Storage**: MMKV for persistent storage

#### Key Libraries
- `react-native-maps`: Map integration
- `react-native-reanimated`: Animations
- `@notifee/react-native`: Push notifications
- `react-native-webview`: Web content display

#### Screen Architecture
```
App.tsx
├── Navigation
│   ├── HomeScreen (Activity listing)
│   ├── SearchScreen (Filters and search)
│   ├── ActivityDetailScreen
│   ├── MapScreen (Location view)
│   └── ProfileScreen (User/children)
└── Services
    ├── ApiService (HTTP client)
    ├── AuthService
    └── StorageService
```

### Backend - Node.js API

#### Technology Stack
- **Runtime**: Node.js 20
- **Framework**: Express 4.x
- **Language**: TypeScript
- **ORM**: Prisma 6.x
- **Authentication**: JWT tokens
- **Validation**: Express-validator

#### API Structure
```
server/src/
├── routes/
│   ├── activities.ts      # Activity CRUD
│   ├── auth.ts           # Authentication
│   ├── children.ts       # Child profiles
│   └── sharing.ts        # Activity sharing
├── services/
│   ├── activityService.ts
│   ├── sessionService.ts  # Session management
│   └── notificationService.ts
├── middleware/
│   ├── auth.ts           # JWT verification & rate limiting
│   └── validateBody.ts   # Input validation
├── utils/
│   ├── tokenUtils.ts     # Token hashing
│   └── filters.ts        # Query filters
└── server.ts             # Express app
```

#### API Endpoints
- `/api/v1/activities` - Activity operations
- `/api/auth` - Authentication
- `/api/children` - Child profile management
- `/api/shared-activities` - Activity sharing

### Database - PostgreSQL

#### Schema Design (Prisma)
```prisma
model Activity {
  id                String    @id @default(uuid())
  providerId        String
  externalId        String    # Unique from provider
  courseId          String?   # Course identifier
  name              String
  category          String
  subcategory       String?
  dateStart         DateTime?
  dateEnd           DateTime?
  cost              Float     @default(0)
  spotsAvailable    Int?
  locationId        String?
  isActive          Boolean   @default(true)
  
  // Relations
  provider          Provider  @relation(...)
  location          Location? @relation(...)
  
  @@unique([providerId, externalId])
  @@index([isActive, category])
}

model Provider {
  id           String     @id @default(uuid())
  name         String     @unique
  website      String
  scraperConfig Json
  activities   Activity[]
}

model User {
  id             String          @id @default(uuid())
  email          String          @unique
  passwordHash   String
  children       Child[]
  favorites      Favorite[]
  sessions       Session[]
  trustedDevices TrustedDevice[]
}

model Session {
  id               String   @id @default(cuid())
  userId           String
  refreshTokenHash String
  expiresAt        DateTime
  lastAccessedAt   DateTime
}

model Child {
  id           String     @id @default(uuid())
  userId       String
  name         String
  dateOfBirth  DateTime?
  interests    String[]
  activities   ChildActivity[]
}
```

### Web Scraper - Puppeteer

#### Architecture
```
server/scrapers/
├── base/
│   └── BaseScraper.js       # Abstract base class
├── nvrcEnhancedParallelScraper.js
└── scraperJob.js            # Entry point
```

#### Scraping Flow
1. **Initialization**: Load provider config
2. **Pre-processing**: Mark existing activities inactive
3. **Data Collection**: Navigate and extract data
4. **Processing**: Normalize and deduplicate
5. **Storage**: Update database
6. **Post-processing**: Clean up inactive records

#### Key Features
- Parallel browser instances for speed
- Activity deduplication by courseId
- Incremental updates (only changed data)
- Error recovery and retry logic

## Cloud Infrastructure

### Google Cloud Platform Services

#### Cloud Run (Serverless Containers)
- **API Service**: `kids-activity-api`
  - Auto-scaling 0-100 instances
  - 1GB memory, 1 vCPU
  - HTTPS endpoint with managed SSL

- **Scraper Job**: `kids-activity-scraper-job`
  - Scheduled execution (daily 6 AM UTC)
  - 2GB memory for Puppeteer
  - 30-minute timeout

#### Cloud SQL (Managed PostgreSQL)
- **Instance**: `kids-activity-db-dev`
- **Specs**: db-f1-micro (1 vCPU, 0.6GB RAM)
- **Location**: us-central1
- **Backup**: Daily automated backups
- **High Availability**: Not enabled (dev tier)

#### Cloud Scheduler
- **Job**: `kids-activity-scraper-schedule`
- **Schedule**: `0 6 * * *` (Daily 6 AM UTC)
- **Target**: Cloud Run Job trigger

#### Container Registry
- Docker images for API and scraper
- Automated builds via Cloud Build

### Deployment Pipeline

#### Cloud Build Configuration
```yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/api', '.']
  
  # Push to registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/api']
  
  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['run', 'deploy', 'kids-activity-api', '--image', 'gcr.io/$PROJECT_ID/api']
```

## Data Flow

### Activity Data Pipeline
1. **Source**: NVRC website (PerfectMind platform)
2. **Extraction**: Puppeteer scrapes HTML
3. **Transformation**: Normalize to schema
4. **Loading**: Upsert to PostgreSQL
5. **API**: Serve to mobile app
6. **Client**: Display in React Native

### Request Flow
1. User opens app → React Native
2. App requests data → API Service
3. API queries database → PostgreSQL
4. Results returned → JSON response
5. App renders UI → React Native components

## Security Architecture

### Authentication & Authorization
- JWT tokens for API authentication
- Token refresh with hashed storage in database
- Session management with Session/TrustedDevice tables
- Automatic session cleanup (7-day expiry, max 5 per user)

### Data Protection
- HTTPS for all communications
- Environment variables for secrets
- Helmet security headers
- Input validation and sanitization

### Rate Limiting
- API rate limiting (100 requests/15 minutes)
- Auth rate limiting (5 requests/15 minutes)
- Scraper throttling (prevent blocking)

## Performance Optimization

### Frontend
- Lazy loading of screens
- Image caching
- MMKV for fast local storage
- Optimized list rendering

### Backend
- Database indexing on key fields
- Query optimization with Prisma
- Connection pooling
- Response caching (planned)

### Infrastructure
- Auto-scaling for traffic spikes
- CDN for static assets (planned)
- Database query optimization

## Monitoring & Logging

### Application Monitoring
- Cloud Logging for all services
- Error tracking and alerting
- Performance metrics

### Key Metrics
- API response times
- Scraper success rate
- Database query performance
- Error rates

## Scalability Considerations

### Current Capacity
- Handles 1,000+ active activities
- Supports concurrent users
- Daily scraping without issues
- 22 database tables

### Future Scaling
- Horizontal scaling via Cloud Run
- Database read replicas
- Caching layer (Redis)
- CDN for media content

## Technology Decisions

### Why React Native?
- Single codebase for iOS/Android
- Native performance
- Large ecosystem
- Hot reload for development

### Why Node.js?
- JavaScript everywhere
- Excellent async handling
- Large package ecosystem
- Good for I/O operations

### Why PostgreSQL?
- Relational data model fits well
- ACID compliance
- Excellent performance
- Prisma ORM support

### Why Google Cloud?
- Serverless scaling
- Managed services
- Cost-effective
- Good free tier

## Future Architecture Improvements

1. **Microservices**: Split scraper and API
2. **Message Queue**: For async processing
3. **Caching Layer**: Redis for performance
4. **Search Service**: Elasticsearch for better search
5. **Analytics Pipeline**: User behavior tracking
6. **Multi-region**: For global availability

---

**Document Version**: 2.0
**Last Updated**: December 2024