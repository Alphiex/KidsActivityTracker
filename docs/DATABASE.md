# Database Guide

## Overview

Kids Activity Tracker uses PostgreSQL with Prisma ORM for database operations.

- **Production**: Google Cloud SQL (us-central1)
- **Instance**: `kids-activity-db-dev`
- **IP Address**: 34.42.149.102
- **Database**: `kidsactivity`
- **Schema**: Managed via Prisma

## Connection

```bash
# Production (Cloud SQL)
DATABASE_URL="postgresql://postgres:PASSWORD@34.42.149.102:5432/kidsactivity"

# Using psql
PGPASSWORD='PASSWORD' psql -h 34.42.149.102 -U postgres -d kidsactivity
```

## Core Models

### Activity
```prisma
model Activity {
  id                String    @id @default(uuid())
  providerId        String
  externalId        String    // Course ID from provider
  name              String
  category          String
  subcategory       String?
  description       String?
  dateStart         DateTime?
  dateEnd           DateTime?
  registrationDate  DateTime?
  ageMin            Int?
  ageMax            Int?
  cost              Float     @default(0)
  spotsAvailable    Int?
  totalSpots        Int?
  locationId        String?
  registrationUrl   String?
  registrationStatus String?
  instructor        String?
  isUpdated         Boolean   @default(false)
  lastSeenAt        DateTime  @default(now())
  activityTypeId    String?
  activitySubtypeId String?

  @@unique([providerId, externalId])
  @@index([activityTypeId])
  @@index([locationId])
}
```

### User & Authentication
```prisma
model User {
  id                String          @id @default(uuid())
  email             String          @unique
  passwordHash      String
  name              String
  phoneNumber       String?
  isVerified        Boolean         @default(false)
  verificationToken String?
  resetToken        String?
  resetTokenExpiry  DateTime?
  preferences       Json            @default("{}")
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  children          Child[]
  favorites         Favorite[]
  sessions          Session[]
  trustedDevices    TrustedDevice[]
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
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

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
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, fingerprint])
  @@index([userId])
  @@index([expiresAt])
}
```

### Child & Activity Management
```prisma
model Child {
  id              String     @id @default(uuid())
  userId          String
  name            String
  dateOfBirth     DateTime?
  gender          String?
  avatarUrl       String?
  interests       String[]
  notes           String?
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  childActivities ChildActivity[]
}

model ChildActivity {
  id               String    @id @default(uuid())
  childId          String
  activityId       String
  status           String    // "interested", "registered", "completed"
  scheduledDate    DateTime?
  startTime        String?
  endTime          String?
  recurring        Boolean   @default(false)
  recurrencePattern String?
  notes            String?
  rating           Int?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@unique([childId, activityId])
  @@index([childId, status])
  @@index([scheduledDate])
}
```

### Activity Types & Categories
```prisma
model ActivityType {
  id           String            @id @default(uuid())
  code         String            @unique
  name         String
  description  String?
  iconName     String?
  imageUrl     String?
  displayOrder Int

  subtypes     ActivitySubtype[]
  activities   Activity[]
}

model ActivitySubtype {
  id             String       @id @default(uuid())
  activityTypeId String
  code           String
  name           String
  description    String?
  imageUrl       String?
  displayOrder   Int          @default(999)

  activityType   ActivityType @relation(fields: [activityTypeId], references: [id], onDelete: Cascade)
  activities     Activity[]

  @@unique([activityTypeId, code])
}
```

### Location
```prisma
model City {
  id        String     @id @default(uuid())
  name      String
  province  String
  country   String     @default("Canada")
  locations Location[]

  @@unique([name, province, country])
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
  fullAddress String?
  mapUrl      String?

  city        City       @relation(fields: [cityId], references: [id])
  activities  Activity[]

  @@unique([name, address, cityId])
}
```

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

## Common Queries

### Activity Search
```typescript
const activities = await prisma.activity.findMany({
  where: {
    isUpdated: true,
    activityTypeId: typeId,
    ageMin: { lte: childAge },
    ageMax: { gte: childAge },
  },
  include: {
    location: { include: { city: true } },
    activityType: true,
    activitySubtype: true,
  },
  orderBy: { dateStart: 'asc' },
  take: 50,
});
```

### User Sessions
```typescript
// Get active sessions
const sessions = await prisma.session.findMany({
  where: {
    userId,
    expiresAt: { gt: new Date() }
  },
  orderBy: { lastAccessedAt: 'desc' }
});

// Clean expired sessions
await prisma.session.deleteMany({
  where: { expiresAt: { lt: new Date() } }
});
```

### Child Activities
```typescript
const childActivities = await prisma.childActivity.findMany({
  where: {
    childId,
    status: 'registered',
    scheduledDate: { gte: new Date() }
  },
  include: {
    activity: {
      include: { location: true }
    }
  },
  orderBy: { scheduledDate: 'asc' }
});
```

## Database Scripts

Located in `scripts/database/`:

```bash
# Seed Vancouver cities
node scripts/database/seed-vancouver-cities.js

# Seed activity types
node scripts/database/seed-activity-types.js
```

## Backup & Recovery

```bash
# Create Cloud SQL backup
gcloud sql backups create --instance=kids-activity-db-dev

# Manual dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Monitoring

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::text) DESC;

-- Active queries
SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';

-- List all tables
\dt
```

## Tables Summary (22 tables)

| Table | Description |
|-------|-------------|
| Activity | Activities from recreation providers |
| ActivityHistory | Change tracking for activities |
| ActivityPrerequisite | Prerequisites for activities |
| ActivitySession | Individual session details |
| ActivityShare | Sharing relationships between users |
| ActivityShareProfile | Shared child profiles |
| ActivitySubtype | Activity subcategories (e.g., Swimming Lessons) |
| ActivityType | Activity categories (e.g., Aquatics) |
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

**Last Updated**: December 2024
