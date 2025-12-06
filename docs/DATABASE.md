# Database Guide

## Overview

Kids Activity Tracker uses PostgreSQL with Prisma ORM for database operations.

- **Production**: Google Cloud SQL (us-central1)
- **Instance**: `kids-activity-db-dev`
- **Schema**: Managed via Prisma migrations

## Schema Overview

### Core Models

```prisma
model Activity {
  id                String    @id @default(uuid())
  providerId        String
  externalId        String    // Course ID from provider
  courseId          String?
  name              String
  category          String
  subcategory       String?
  description       String?
  fullDescription   String?
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
  isActive          Boolean   @default(true)
  lastSeenAt        DateTime  @default(now())

  @@unique([providerId, externalId])
  @@index([isActive, category])
}

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String
  name         String?
  createdAt    DateTime   @default(now())
  children     Child[]
  favorites    Favorite[]
}

model Child {
  id           String     @id @default(uuid())
  userId       String
  name         String
  birthDate    DateTime
  interests    String[]
  activities   ChildActivity[]
  user         User       @relation(...)
}

model Provider {
  id           String     @id @default(uuid())
  name         String     @unique
  code         String     @unique
  website      String
  isActive     Boolean    @default(true)
  activities   Activity[]
}

model Location {
  id           String     @id @default(uuid())
  name         String
  address      String?
  city         String?
  latitude     Float?
  longitude    Float?
  activities   Activity[]
}
```

## Common Operations

### Database Connection

```bash
# Local
DATABASE_URL="postgresql://localhost/kidsactivity"

# Production (from Cloud SQL)
DATABASE_URL="postgresql://postgres:PASSWORD@IP:5432/kidsactivity"
```

### Prisma Commands

```bash
cd server

# Generate client after schema changes
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name description

# Apply migrations to production
npx prisma migrate deploy

# View database in browser
npx prisma studio

# Reset database (development only!)
npx prisma migrate reset
```

### Activity Queries

```typescript
// Get active activities by category
const activities = await prisma.activity.findMany({
  where: {
    isActive: true,
    category: 'Aquatics',
  },
  include: {
    location: true,
    provider: true,
  },
  orderBy: { dateStart: 'asc' },
  take: 20,
});

// Count activities by category
const counts = await prisma.activity.groupBy({
  by: ['category'],
  where: { isActive: true },
  _count: { id: true },
});
```

### User Queries

```typescript
// Get user with children
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' },
  include: {
    children: {
      include: {
        activities: {
          include: { activity: true }
        }
      }
    },
    favorites: {
      include: { activity: true }
    }
  }
});
```

## Scripts

Located in `scripts/database/`:

```bash
# Run migrations
node scripts/database/run-migration.js

# Seed database
node scripts/database/seed-database.js

# Check database health
node scripts/database/check-database.js

# Seed categories
node scripts/database/seed-categories.js
```

## Indexes

Key indexes for performance:

```sql
-- Activity search
CREATE INDEX idx_activity_active_category ON "Activity"("isActive", "category");
CREATE INDEX idx_activity_dates ON "Activity"("dateStart", "dateEnd");
CREATE INDEX idx_activity_location ON "Activity"("locationId", "isActive");

-- User lookups
CREATE INDEX idx_user_email ON "User"("email");
CREATE INDEX idx_child_user ON "Child"("userId");
```

## Backup & Recovery

```bash
# Create backup
gcloud sql backups create --instance=kids-activity-db-dev

# Manual dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Monitoring

```bash
# Connection count
SELECT count(*) FROM pg_stat_activity;

# Table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text))
FROM pg_tables WHERE schemaname = 'public';

# Active queries
SELECT pid, query, state FROM pg_stat_activity WHERE state != 'idle';
```
