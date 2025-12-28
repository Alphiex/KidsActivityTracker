# Database Guide

PostgreSQL database schema and operations for Kids Activity Tracker.

## Overview

| | |
|---|---|
| **Database** | PostgreSQL 15 |
| **Hosting** | Google Cloud SQL |
| **Instance** | `kids-activity-db-dev` |
| **IP Address** | 34.42.149.102 |
| **Database Name** | `kidsactivity` |
| **ORM** | Prisma 6.x |
| **Total Tables** | 24 |

## Connection

```bash
# Environment variable
DATABASE_URL="postgresql://postgres:PASSWORD@34.42.149.102:5432/kidsactivity"

# Direct psql connection
PGPASSWORD='PASSWORD' psql -h 34.42.149.102 -U postgres -d kidsactivity
```

## Entity Relationship Diagram

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
                              │  - cityId    │  │  - platform  │
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

## Table Reference

### Core Activity Domain (9 tables)

#### Activity
Primary activity records from recreation providers.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| providerId | UUID | FK to Provider |
| externalId | String | Course ID from provider |
| name | String | Activity name |
| category | String | Category name |
| subcategory | String? | Subcategory |
| description | String? | Short description |
| fullDescription | String? | Detailed description |
| dateStart | DateTime? | Start date |
| dateEnd | DateTime? | End date |
| startTime | String? | Start time (HH:mm) |
| endTime | String? | End time (HH:mm) |
| dayOfWeek | String[] | Days activity runs |
| ageMin | Int? | Minimum age |
| ageMax | Int? | Maximum age |
| cost | Decimal? | Price |
| spotsAvailable | Int? | Remaining spots |
| totalSpots | Int? | Total capacity |
| registrationStatus | String? | open/closed/waitlist |
| registrationUrl | String? | Registration link |
| locationId | UUID? | FK to Location |
| isActive | Boolean | Currently available |
| lastSeenAt | DateTime? | Last scrape time |
| isFeatured | Boolean | Featured partner activity flag |
| featuredTier | String? | Tier: gold, silver, bronze |
| featuredStartDate | DateTime? | Featured start date |
| featuredEndDate | DateTime? | Featured end date |
| manuallyEditedFields | String[] | Fields protected from scraper overwrites |
| manuallyEditedAt | DateTime? | When last manually edited |
| manuallyEditedBy | String? | Admin user who made edit |

**Indexes**:
- `(providerId, externalId)` - Unique deduplication
- `(activityTypeId, activitySubtypeId)` - Type filtering
- `(isActive, category)` - Status + category
- `(locationId)` - Location queries
- `(isFeatured, featuredTier)` - Featured tier queries
- `(isFeatured, featuredEndDate)` - Featured expiration queries

#### ActivitySession
Multi-session activity schedule details.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activityId | UUID | FK to Activity |
| sessionNumber | Int | Order in sequence |
| date | DateTime | Session date |
| dayOfWeek | String | Day name |
| startTime | String | Start time |
| endTime | String | End time |
| instructor | String? | Session instructor |

#### ActivityPrerequisite
Requirements for activity enrollment.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activityId | UUID | FK to Activity |
| name | String | Prerequisite name |
| description | String? | Details |
| courseId | String? | Required course ID |
| isRequired | Boolean | Mandatory flag |

#### ActivityType
Top-level activity categories.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| code | String | Unique code (aquatics) |
| name | String | Display name |
| description | String? | Category description |
| iconName | String? | Icon identifier |
| displayOrder | Int | Sort order |

**Standard Types**: Aquatics, Arts, Sports, Dance, Camps, Early Years, Youth, Fitness, Education

#### ActivitySubtype
Second-level categories under types.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activityTypeId | UUID | FK to ActivityType |
| code | String | Unique code |
| name | String | Display name |

#### Provider
Recreation centers and organizations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Provider name (unique) |
| website | String? | Website URL |
| platform | String? | Scraper platform type |
| region | String? | Geographic region |
| scraperConfig | JSON? | Scraper settings |
| isActive | Boolean | Currently scraping |

#### Location
Physical venues for activities.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Venue name |
| address | String? | Street address |
| city | String? | City name |
| province | String? | Province |
| cityId | UUID? | FK to City |
| latitude | Float? | GPS latitude |
| longitude | Float? | GPS longitude |
| phoneNumber | String? | Contact phone |

#### City
Geographic city data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | City name |
| province | String | Province code |
| country | String | Country (Canada) |

**Unique Constraint**: `(name, province, country)`

### User Domain (6 tables)

#### User
User accounts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String | Email (unique) |
| passwordHash | String | Bcrypt hash |
| name | String? | Display name |
| phoneNumber | String? | Contact phone |
| isVerified | Boolean | Email verified |
| verificationToken | String? | Email token |
| resetToken | String? | Password reset token |
| preferences | JSON? | User preferences |

#### Child
Child profiles for activity tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User (owner) |
| name | String | Child name |
| dateOfBirth | DateTime | Birthday |
| gender | String? | Gender |
| interests | String[] | Interest tags |
| notes | String? | Private notes |
| isActive | Boolean | Soft delete flag |

#### ChildActivity
Activity tracking per child.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| childId | UUID | FK to Child |
| activityId | UUID | FK to Activity |
| status | String | planned/registered/completed/interested |
| scheduledDate | DateTime? | Planned date |
| startTime | String? | Scheduled time |
| endTime | String? | End time |
| registeredAt | DateTime? | Registration date |
| completedAt | DateTime? | Completion date |
| rating | Int? | 1-5 rating |
| notes | String? | Parent notes |

**Unique Constraint**: `(childId, activityId)`

#### Favorite
User's bookmarked activities.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| activityId | UUID | FK to Activity |
| notifyOnChange | Boolean | Send notifications |

#### Session
Active user sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | FK to User |
| refreshTokenHash | String | Hashed token |
| userAgent | String? | Browser info |
| ipAddress | String? | Client IP |
| expiresAt | DateTime | Expiration |

### Sharing Domain (3 tables)

#### ActivityShare
Sharing agreement between users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| sharingUserId | UUID | Owner sharing |
| sharedWithUserId | UUID | Recipient |
| permissionLevel | String | view/edit |
| expiresAt | DateTime? | Expiration |
| isActive | Boolean | Active flag |

#### ActivityShareProfile
Which children are shared.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| activityShareId | UUID | FK to ActivityShare |
| childId | UUID | FK to Child |
| canViewInterested | Boolean | View flag |
| canViewRegistered | Boolean | View flag |
| canViewCompleted | Boolean | View flag |

#### Invitation
Sharing invitations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| senderId | UUID | FK to User |
| recipientEmail | String | Invite email |
| status | String | pending/sent/accepted |
| token | String | Unique invite token |
| expiresAt | DateTime | Expiration |

### Operations Domain (4 tables)

#### ScrapeJob
Scraper run records.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| providerId | UUID | FK to Provider |
| status | Enum | PENDING/RUNNING/COMPLETED/FAILED |
| startedAt | DateTime | Job start |
| completedAt | DateTime? | Job end |
| activitiesFound | Int | Total found |
| activitiesCreated | Int | New records |
| activitiesUpdated | Int | Updated records |
| errorMessage | String? | Error details |

#### ScraperRun
Detailed scraper metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| providerId | UUID | FK to Provider |
| fieldCoverage | JSON | Coverage by field |
| avgFieldCoverage | Float | Quality score |
| alertSent | Boolean | Alert triggered |
| alertReason | String? | Alert cause |

#### ProviderMetrics
Historical performance data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| providerId | UUID | FK to Provider |
| scrapeDate | DateTime | Date |
| activitiesFound | Int | Count |
| dataQualityScore | Float | Quality % |
| scrapeDuration | Int | Seconds |

### Partner Domain (7 tables)

#### PartnerPlan
Subscription plans for partners.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Plan name |
| tier | String | gold, silver, bronze |
| monthlyPrice | Decimal | Monthly cost |
| yearlyPrice | Decimal? | Annual cost |
| maxFeaturedActivities | Int | Max featured |
| features | JSON | Plan features |
| isActive | Boolean | Available for signup |

#### PartnerAccount
Partner accounts linked to providers.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| providerId | UUID | FK to Provider (unique) |
| planId | UUID? | FK to PartnerPlan |
| subscriptionStatus | String | active/inactive/cancelled |
| subscriptionStartDate | DateTime? | Start date |
| subscriptionEndDate | DateTime? | End date |
| billingEmail | String | Billing email |
| billingName | String? | Billing name |
| targetCities | String[] | Geographic targeting |
| targetProvinces | String[] | Province targeting |

#### PartnerImpression
Impression tracking for analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| partnerAccountId | UUID | FK to PartnerAccount |
| activityId | UUID? | FK to Activity |
| placement | String | Where shown |
| platform | String | ios/android/web |
| userId | UUID? | Logged-in user |
| city | String? | User city |
| timestamp | DateTime | When shown |

#### PartnerClick
Click tracking for analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| partnerAccountId | UUID | FK to PartnerAccount |
| activityId | UUID? | FK to Activity |
| placement | String | Where clicked |
| destinationType | String | registration/website |
| destinationUrl | String? | Target URL |
| platform | String | ios/android/web |
| timestamp | DateTime | When clicked |

#### PartnerAnalyticsDaily
Pre-aggregated daily metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| partnerAccountId | UUID | FK to PartnerAccount |
| date | DateTime | Analytics date |
| impressionsTotal | Int | Daily impressions |
| clicksTotal | Int | Daily clicks |
| impressionsByPlacement | JSON | By placement |
| clicksByPlacement | JSON | By placement |

#### PartnerABTest
A/B testing configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Test name |
| testType | String | Test type |
| status | String | DRAFT/RUNNING/COMPLETED |
| variants | JSON | Variant config |
| trafficPercent | Int | % in test |
| startDate | DateTime? | Test start |
| endDate | DateTime? | Test end |

#### PartnerABTestAssignment
User assignments to test variants.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| testId | UUID | FK to PartnerABTest |
| identifier | String | User/device ID |
| identifierType | String | user_id/device_id |
| variant | String | Assigned variant |
| assignedAt | DateTime | Assignment time |

## Common Queries

### Find activities by filters

```sql
SELECT a.*, l.name as location_name, p.name as provider_name
FROM "Activity" a
LEFT JOIN "Location" l ON a."locationId" = l.id
LEFT JOIN "Provider" p ON a."providerId" = p.id
WHERE a."isActive" = true
  AND a."ageMin" <= 8 AND a."ageMax" >= 5
  AND a.category = 'Aquatics'
ORDER BY a."dateStart" ASC
LIMIT 20;
```

### Get child's scheduled activities

```sql
SELECT ca.*, a.name, a."startTime", a."endTime"
FROM "ChildActivity" ca
JOIN "Activity" a ON ca."activityId" = a.id
WHERE ca."childId" = 'uuid'
  AND ca."scheduledDate" BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY ca."scheduledDate", a."startTime";
```

### Activity count by city

```sql
SELECT c.name as city, COUNT(a.id) as activity_count
FROM "City" c
JOIN "Location" l ON l."cityId" = c.id
JOIN "Activity" a ON a."locationId" = l.id
WHERE a."isActive" = true
GROUP BY c.name
ORDER BY activity_count DESC;
```

## Migrations

```bash
# Create migration
npx prisma migrate dev --name add_new_field

# Apply migration (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

## Prisma Commands

```bash
# Generate client after schema changes
npx prisma generate

# Open database GUI
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

---

**Document Version**: 4.0
**Last Updated**: December 2024
