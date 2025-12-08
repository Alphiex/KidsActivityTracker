# Kids Activity Tracker - Database Guide

## Overview

Kids Activity Tracker uses PostgreSQL with Prisma ORM for database operations.

- **Production**: Google Cloud SQL (us-central1)
- **Instance**: `kids-activity-db-dev`
- **IP Address**: 34.42.149.102
- **Database**: `kidsactivity`
- **Schema**: Managed via Prisma
- **Total Tables**: 24

---

## Connection

```bash
# Production (Cloud SQL)
DATABASE_URL="postgresql://postgres:PASSWORD@34.42.149.102:5432/kidsactivity"

# Using psql
PGPASSWORD='PASSWORD' psql -h 34.42.149.102 -U postgres -d kidsactivity
```

---

## Schema Overview

### Entity Relationship Diagram

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│      User        │────>│     Session      │     │  TrustedDevice   │
│                  │────>│                  │<────│                  │
│  - email         │     │  - refreshToken  │     │  - fingerprint   │
│  - passwordHash  │     │  - expiresAt     │     │  - expiresAt     │
│  - preferences   │     └──────────────────┘     └──────────────────┘
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────────┐  ┌──────────────┐
│  Child   │  │   Favorite   │──────>┌──────────────────┐
│          │  │              │       │    Activity      │
│  - name  │  │  - notifyOn  │       │                  │
│  - DOB   │  │    Change    │       │  - name          │
│  - ints  │  └──────────────┘       │  - category      │
└────┬─────┘                         │  - cost          │
     │                               │  - dateStart     │
     ▼                               │  - ageMin/Max    │
┌──────────────┐                     │  - spotsAvail    │
│ChildActivity │─────────────────────│                  │
│              │                     └────────┬─────────┘
│  - status    │                              │
│  - rating    │                     ┌────────┴─────────┐
│  - schedule  │                     │                  │
└──────────────┘                     ▼                  ▼
                              ┌──────────────┐  ┌──────────────┐
                              │   Location   │  │   Provider   │
                              │              │  │              │
                              │  - address   │  │  - name      │
                              │  - cityId    │  │  - website   │
                              │  - lat/lng   │  │  - isActive  │
                              └──────┬───────┘  └──────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │     City     │
                              │              │
                              │  - name      │
                              │  - province  │
                              └──────────────┘
```

---

## Core Models

### Activity

The main activity model stores information scraped from recreation providers.

```prisma
model Activity {
  id                     String                 @id @default(uuid())
  providerId             String
  externalId             String                 // Course ID from provider
  name                   String
  category               String
  subcategory            String?
  description            String?
  fullDescription        String?
  schedule               String?
  dateStart              DateTime?
  dateEnd                DateTime?
  registrationDate       DateTime?
  registrationEndDate    DateTime?
  registrationEndTime    String?
  ageMin                 Int?
  ageMax                 Int?
  cost                   Float                  @default(0)
  costIncludesTax        Boolean                @default(true)
  taxAmount              Float?
  spotsAvailable         Int?
  totalSpots             Int?
  locationId             String?
  registrationUrl        String?
  directRegistrationUrl  String?
  detailUrl              String?
  courseId               String?
  courseDetails          String?
  dates                  String?
  dayOfWeek              String[]
  startTime              String?
  endTime                String?
  instructor             String?
  prerequisites          String?
  whatToBring            String?
  contactInfo            String?
  registrationStatus     String?                @default("Unknown")
  registrationButtonText String?
  hasMultipleSessions    Boolean                @default(false)
  sessionCount           Int                    @default(0)
  hasPrerequisites       Boolean                @default(false)
  isActive               Boolean                @default(true)  // Deprecated
  isUpdated              Boolean                @default(false) // Use this for "active"
  lastSeenAt             DateTime               @default(now())
  activityTypeId         String?
  activitySubtypeId      String?
  rawData                Json?
  createdAt              DateTime               @default(now())
  updatedAt              DateTime               @updatedAt

  // Relations
  activitySubtype        ActivitySubtype?       @relation(...)
  activityType           ActivityType?          @relation(...)
  location               Location?              @relation(...)
  provider               Provider               @relation(...)
  prerequisitesList      ActivityPrerequisite[]
  sessions               ActivitySession[]
  childActivities        ChildActivity[]
  favorites              Favorite[]
  categories             ActivityCategory[]

  @@unique([providerId, externalId])
  @@index([activitySubtypeId])
  @@index([activityTypeId, activitySubtypeId])
  @@index([activityTypeId])
  @@index([category])
  @@index([isActive, category])
  @@index([isActive, dateStart])
  @@index([isActive, lastSeenAt])
  @@index([locationId])
  @@index([providerId])
  @@index([registrationStatus])
}
```

### User & Authentication

```prisma
model User {
  id                  String          @id @default(uuid())
  email               String          @unique
  name                String
  passwordHash        String
  phoneNumber         String?
  preferences         Json            @default("{}")
  isVerified          Boolean         @default(false)
  verificationToken   String?
  resetToken          String?
  resetTokenExpiry    DateTime?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  // Relations
  children            Child[]
  favorites           Favorite[]
  sessions            Session[]
  trustedDevices      TrustedDevice[]
  sentInvitations     Invitation[]    @relation("InvitationSender")
  receivedInvitations Invitation[]    @relation("InvitationRecipient")
  myShares            ActivityShare[] @relation("SharingUser")
  sharedWithMe        ActivityShare[] @relation("SharedWithUser")

  @@index([email])
  @@index([verificationToken])
  @@index([resetToken])
  @@index([isVerified])
}

model Session {
  id               String   @id @default(cuid())
  userId           String
  refreshTokenHash String
  userAgent        String?
  ipAddress        String?
  createdAt        DateTime @default(now())
  expiresAt        DateTime
  lastAccessedAt   DateTime @default(now())
  user             User     @relation(...)

  @@index([userId])
  @@index([refreshTokenHash])
  @@index([expiresAt])
}

model TrustedDevice {
  id          String   @id @default(cuid())
  userId      String
  fingerprint String
  name        String   @default("Unknown Device")
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  user        User     @relation(...)

  @@unique([userId, fingerprint])
  @@index([userId])
  @@index([expiresAt])
}
```

### Child & Activity Management

```prisma
model Child {
  id              String                 @id @default(uuid())
  userId          String
  name            String
  dateOfBirth     DateTime?
  gender          String?
  avatarUrl       String?
  interests       String[]
  notes           String?
  isActive        Boolean                @default(true)
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  // Relations
  user            User                   @relation(...)
  childActivities ChildActivity[]
  profiles        ActivityShareProfile[]

  @@index([userId])
}

model ChildActivity {
  id               String    @id @default(uuid())
  childId          String
  activityId       String
  status           String    // "planned", "in_progress", "completed"
  registeredAt     DateTime?
  completedAt      DateTime?
  scheduledDate    DateTime?
  startTime        String?
  endTime          String?
  recurring        Boolean   @default(false)
  recurrencePattern String?  // "weekly", "biweekly", "monthly"
  recurrenceEnd    DateTime?
  notes            String?
  rating           Int?      // 1-5 stars
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // Relations
  activity         Activity  @relation(...)
  child            Child     @relation(...)

  @@unique([childId, activityId])
  @@index([activityId])
  @@index([childId, status])
  @@index([scheduledDate])
  @@index([childId, scheduledDate])
  @@index([status])
  @@index([completedAt])
  @@index([registeredAt])
  @@index([rating])
}

model Favorite {
  id             String   @id @default(uuid())
  userId         String
  activityId     String
  notifyOnChange Boolean  @default(true)
  createdAt      DateTime @default(now())

  // Relations
  activity       Activity @relation(...)
  user           User     @relation(...)

  @@unique([userId, activityId])
  @@index([activityId])
  @@index([userId])
}
```

### Activity Types & Categories

```prisma
model ActivityType {
  id           String            @id @default(uuid())
  code         String            @unique  // e.g., "aquatics"
  name         String            // e.g., "Aquatics"
  description  String?
  iconName     String?
  imageUrl     String?
  displayOrder Int
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  // Relations
  activities   Activity[]
  subtypes     ActivitySubtype[]

  @@index([code])
}

model ActivitySubtype {
  id             String       @id @default(uuid())
  activityTypeId String
  code           String       // e.g., "learn-to-swim"
  name           String       // e.g., "Learn to Swim"
  description    String?
  imageUrl       String?
  displayOrder   Int          @default(999)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  // Relations
  activityType   ActivityType @relation(...)
  activities     Activity[]

  @@unique([activityTypeId, code])
  @@index([activityTypeId])
}

model Category {
  id           String             @id @default(uuid())
  name         String             @unique
  description  String?
  ageMin       Int?
  ageMax       Int?
  requiresParent Boolean          @default(false)
  displayOrder Int                @default(999)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  // Relations
  activities   ActivityCategory[]

  @@index([name])
  @@index([displayOrder])
}

model ActivityCategory {
  id         String   @id @default(uuid())
  activityId String
  categoryId String
  createdAt  DateTime @default(now())

  // Relations
  activity   Activity @relation(...)
  category   Category @relation(...)

  @@unique([activityId, categoryId])
  @@index([activityId])
  @@index([categoryId])
}
```

### Location

```prisma
model City {
  id        String     @id @default(uuid())
  name      String
  province  String
  country   String     @default("Canada")
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  // Relations
  locations Location[]

  @@unique([name, province, country])
  @@index([name])
}

model Location {
  id          String     @id @default(uuid())
  name        String
  address     String?
  cityId      String
  postalCode  String?
  latitude    Float?
  longitude   Float?
  facility    String?
  fullAddress String?    // Complete formatted address for Apple Maps
  mapUrl      String?    // Apple Maps URL for navigation
  placeId     String?    // Apple Place ID
  phoneNumber String?
  website     String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  city        City       @relation(...)
  activities  Activity[]

  @@unique([name, address, cityId])
  @@index([cityId])
  @@index([name])
  @@index([name, cityId])
}
```

### Sharing & Invitations

```prisma
model ActivityShare {
  id               String                 @id @default(uuid())
  sharingUserId    String
  sharedWithUserId String
  permissionLevel  String
  expiresAt        DateTime?
  isActive         Boolean                @default(true)
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  // Relations
  sharingUser      User                   @relation("SharingUser", ...)
  sharedWithUser   User                   @relation("SharedWithUser", ...)
  profiles         ActivityShareProfile[]

  @@unique([sharingUserId, sharedWithUserId])
  @@index([sharedWithUserId])
  @@index([sharingUserId])
}

model ActivityShareProfile {
  id                String        @id @default(uuid())
  activityShareId   String
  childId           String
  canViewInterested Boolean       @default(true)
  canViewRegistered Boolean       @default(true)
  canViewCompleted  Boolean       @default(false)
  canViewNotes      Boolean       @default(false)
  createdAt         DateTime      @default(now())

  // Relations
  activityShare     ActivityShare @relation(...)
  child             Child         @relation(...)

  @@unique([activityShareId, childId])
}

model Invitation {
  id              String    @id @default(uuid())
  senderId        String
  recipientEmail  String
  recipientUserId String?
  status          String    // "pending", "accepted", "rejected", "expired"
  message         String?
  token           String    @unique
  expiresAt       DateTime
  acceptedAt      DateTime?
  createdAt       DateTime  @default(now())

  // Relations
  sender          User      @relation("InvitationSender", ...)
  recipient       User?     @relation("InvitationRecipient", ...)

  @@index([recipientEmail])
  @@index([recipientUserId])
  @@index([senderId])
  @@index([status, expiresAt])
  @@index([token])
}
```

### Provider & Scraping

```prisma
model Provider {
  id                 String               @id @default(uuid())
  name               String               @unique
  website            String
  scraperConfig      Json
  isActive           Boolean              @default(true)
  region             String?
  contactInfo        Json?
  platform           String?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  // Relations
  activities         Activity[]
  ProviderMetrics    ProviderMetrics[]
  ScrapeJob          ScrapeJob[]
  ScraperHealthCheck ScraperHealthCheck[]

  @@index([isActive])
  @@index([platform])
  @@index([region])
}

model ScrapeJob {
  id                String    @id @default(uuid())
  providerId        String
  status            JobStatus @default(PENDING) // PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  startedAt         DateTime?
  completedAt       DateTime?
  activitiesFound   Int       @default(0)
  activitiesCreated Int       @default(0)
  activitiesUpdated Int       @default(0)
  activitiesRemoved Int       @default(0)
  errorMessage      String?
  errorDetails      Json?
  createdAt         DateTime  @default(now())

  // Relations
  provider          Provider  @relation(...)

  @@index([createdAt])
  @@index([providerId])
  @@index([status])
}

model ScraperRun {
  id                    String    @id @default(uuid())
  providerId            String
  status                String
  startedAt             DateTime  @default(now())
  completedAt           DateTime?
  activitiesFound       Int       @default(0)
  activitiesCreated     Int       @default(0)
  activitiesUpdated     Int       @default(0)
  activitiesDeactivated Int       @default(0)
  activitiesPurged      Int       @default(0)
  errorMessage          String?
  logs                  Json?

  @@index([providerId, startedAt])
}

model ProviderMetrics {
  id                  String   @id @default(uuid())
  providerId          String
  scrapeDate          DateTime @db.Date
  activitiesFound     Int      @default(0)
  activitiesProcessed Int      @default(0)
  dataQualityScore    Float?
  errors              Json?
  scrapeDuration      Int?     // milliseconds
  memoryUsed          BigInt?
  createdAt           DateTime @default(now())

  // Relations
  provider            Provider @relation(...)

  @@index([providerId])
  @@index([providerId, scrapeDate])
  @@index([scrapeDate])
}

model ScraperHealthCheck {
  id         String    @id @default(uuid())
  providerId String
  status     String    // "healthy", "warning", "error"
  message    String?
  details    Json?
  checkedAt  DateTime  @default(now())
  resolvedAt DateTime?

  // Relations
  provider   Provider  @relation(...)

  @@index([checkedAt])
  @@index([providerId])
  @@index([status])
}

model ActivityHistory {
  id            String   @id @default(uuid())
  activityId    String
  changeType    String   // "created", "updated", "deactivated"
  previousData  Json?
  newData       Json?
  changedFields String[]
  createdAt     DateTime @default(now())

  @@index([activityId, createdAt])
}

model ActivityPrerequisite {
  id          String   @id @default(uuid())
  activityId  String
  name        String
  description String?
  url         String?
  courseId    String?
  isRequired  Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  activity    Activity @relation(...)

  @@index([activityId])
}

model ActivitySession {
  id            String   @id @default(uuid())
  activityId    String
  sessionNumber Int?
  date          String?
  dayOfWeek     String?
  startTime     String?
  endTime       String?
  location      String?
  subLocation   String?
  instructor    String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  activity      Activity @relation(...)

  @@index([activityId])
  @@index([date])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## Prisma Commands

```bash
cd server

# Generate client after schema changes
npx prisma generate

# Push schema to database (no migration files)
npx prisma db push

# Create and apply migration
npx prisma migrate dev --name description

# Apply migrations to production
npx prisma migrate deploy

# View database in browser
npx prisma studio

# Reset database (development only!)
npx prisma migrate reset
```

---

## Common Queries

### Activity Search with Filters
```typescript
const activities = await prisma.activity.findMany({
  where: {
    isUpdated: true,
    activityTypeId: typeId,
    ageMin: { lte: childAge },
    ageMax: { gte: childAge },
    cost: { lte: maxBudget },
    location: { cityId: selectedCityId },
  },
  include: {
    location: { include: { city: true } },
    provider: true,
    activityType: true,
    activitySubtype: true,
  },
  orderBy: { dateStart: 'asc' },
  take: 50,
});
```

### Batch Child Verification
```typescript
// Prevent N+1 queries when verifying multiple children
async verifyMultipleChildOwnership(
  childIds: string[],
  userId: string
): Promise<Record<string, boolean>> {
  const ownedChildren = await prisma.child.findMany({
    where: { id: { in: childIds }, userId },
    select: { id: true }
  });
  const ownedSet = new Set(ownedChildren.map(c => c.id));
  const result: Record<string, boolean> = {};
  for (const childId of childIds) {
    result[childId] = ownedSet.has(childId);
  }
  return result;
}
```

### Paginated Activity History
```typescript
const { page = 1, limit = 20 } = filters;
const boundedLimit = Math.min(100, Math.max(1, limit));
const skip = (page - 1) * boundedLimit;

const [total, activities] = await Promise.all([
  prisma.childActivity.count({ where: whereClause }),
  prisma.childActivity.findMany({
    where: whereClause,
    include: { child: true, activity: { include: { location: true } } },
    orderBy: [{ completedAt: 'desc' }, { registeredAt: 'desc' }],
    skip,
    take: boundedLimit
  })
]);
```

---

## Database Scripts

Located in `scripts/database/`:

```bash
# Seed Vancouver cities
node scripts/database/seed-vancouver-cities.js

# Seed activity types
node scripts/database/seed-activity-types.js
```

---

## Backup & Recovery

```bash
# Create Cloud SQL backup
gcloud sql backups create --instance=kids-activity-db-dev

# Manual dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup.sql
```

---

## Monitoring

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::text) DESC;

-- Active queries
SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';

-- Index usage stats
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
```

---

## Tables Summary (24 tables)

| Table | Description |
|-------|-------------|
| Activity | Activities from recreation providers |
| ActivityCategory | Many-to-many relationship between activities and categories |
| ActivityHistory | Change tracking for activities |
| ActivityPrerequisite | Prerequisites for activities |
| ActivitySession | Individual session details |
| ActivityShare | Sharing relationships between users |
| ActivityShareProfile | Shared child profiles |
| ActivitySubtype | Activity subcategories (e.g., Swimming Lessons) |
| ActivityType | Activity categories (e.g., Aquatics) |
| Category | Age-based categories |
| Child | User's children profiles |
| ChildActivity | Activities assigned to children |
| City | Cities/municipalities |
| Favorite | User favorite activities |
| Invitation | Sharing invitations |
| Location | Facilities and venues |
| Provider | Data sources (NVRC, etc.) |
| ProviderMetrics | Scraper performance metrics |
| ScrapeJob | Scraping job records |
| ScraperHealthCheck | Scraper health monitoring |
| ScraperRun | Scraper execution logs |
| Session | User authentication sessions |
| TrustedDevice | Trusted devices for users |
| User | User accounts |

---

## Performance Indexes

The following indexes were added for query optimization:

**ChildActivity Indexes:**
- `@@index([status])` - For filtering by status
- `@@index([completedAt])` - For ordering in history
- `@@index([registeredAt])` - For ordering in history
- `@@index([rating])` - For filtering by rating
- `@@index([childId, scheduledDate])` - For calendar queries

**User Indexes:**
- `@@index([verificationToken])` - For email verification
- `@@index([resetToken])` - For password reset
- `@@index([isVerified])` - For filtering verified users

**Invitation Indexes:**
- `@@index([recipientUserId])` - For looking up invitations

---

**Document Version**: 4.0
**Last Updated**: December 2024
**Next Review**: March 2025
