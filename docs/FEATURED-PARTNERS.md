# Featured Partners System

Paid partnership capabilities for activity providers to promote their programs with priority visibility in the Kids Activity Tracker app.

## Overview

The Featured Partners system allows recreation centers and activity providers to pay for enhanced visibility of their activities. Featured activities appear prominently on the dashboard and are filtered using the same criteria as regular activities, ensuring relevance to users.

| | |
|---|---|
| **Feature Tiers** | Gold, Silver, Bronze |
| **Dashboard Display** | Up to 3 featured activities |
| **Filtering** | Matches user preferences (age, location, activity type) |
| **Randomization** | Within each tier for fair rotation |

## Feature Tiers

Partners are organized into three tiers with priority-based display:

| Tier | Priority | Description |
|------|----------|-------------|
| **Gold** | Highest | Premium placement, always shown first |
| **Silver** | Medium | Shown after gold partners |
| **Bronze** | Standard | Shown after silver partners |

### Display Logic

1. Activities are grouped by feature tier
2. Within each tier, activities are randomly shuffled (ensuring fair exposure)
3. Activities are displayed in tier priority order: Gold → Silver → Bronze
4. Results are limited to the requested count (default: 3)

## Database Schema

Featured data is stored directly on the Activity model with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `isFeatured` | Boolean | Whether activity is featured |
| `featuredTier` | String | Tier level: 'gold', 'silver', 'bronze' |
| `featuredStartDate` | DateTime | When featuring begins |
| `featuredEndDate` | DateTime | When featuring expires |

### Indexes

```sql
-- Optimized indexes for featured partner queries
@@index([isFeatured, featuredTier])
@@index([isFeatured, featuredEndDate])
```

## Partner Account Management

Partners are managed through the `PartnerAccount` model which links to a Provider:

| Field | Type | Description |
|-------|------|-------------|
| `providerId` | UUID | FK to Provider (unique) |
| `planId` | UUID | FK to PartnerPlan |
| `subscriptionStatus` | String | active, inactive, cancelled |
| `billingEmail` | String | Billing contact email |
| `targetCities` | String[] | Geographic targeting |
| `targetProvinces` | String[] | Province targeting |

### Partner Plans

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Plan name |
| `tier` | String | gold, silver, bronze |
| `monthlyPrice` | Decimal | Monthly subscription price |
| `maxFeaturedActivities` | Int | Maximum activities allowed |
| `features` | JSON | Plan features |

## API Endpoints

### Public Endpoints

#### GET /api/v1/partners

Retrieve featured activities matching user filters. Also available at `/api/v1/sponsors` for backward compatibility.

**Access**: Public (optional authentication for personalization)

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ageMin` | number | Minimum age filter |
| `ageMax` | number | Maximum age filter |
| `costMin` | number | Minimum cost filter |
| `costMax` | number | Maximum cost filter |
| `activityType` | string | Activity type code or UUID |
| `activitySubtype` | string | Activity subtype code or UUID |
| `categories` | string | Comma-separated activity types |
| `startDate` | string | Activities starting after (ISO date) |
| `endDate` | string | Activities ending before (ISO date) |
| `dayOfWeek` | string[] | Days of week (Monday, Tuesday, etc.) |
| `locations` | string[] | City names or location IDs |
| `limit` | number | Max results (default: 3) |

**Response** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Elite Swimming Academy",
      "category": "Aquatics",
      "description": "Premier swimming instruction...",
      "isFeatured": true,
      "featuredTier": "gold",
      "featuredStartDate": "2024-01-01T00:00:00Z",
      "featuredEndDate": "2024-12-31T23:59:59Z",
      "dateStart": "2024-01-15T00:00:00Z",
      "dateEnd": "2024-03-15T00:00:00Z",
      "ageMin": 5,
      "ageMax": 12,
      "cost": 150.00,
      "location": {
        "name": "Aquatic Centre",
        "city": "Vancouver"
      },
      "provider": {
        "name": "Vancouver Parks"
      }
    }
  ],
  "meta": {
    "total": 1,
    "limit": 3
  }
}
```

### Admin Endpoints

#### GET /api/admin/partners

List all partner accounts with stats. **Requires admin authentication**.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by subscription status |
| `tier` | string | Filter by plan tier |
| `search` | string | Search provider name |
| `page` | number | Page number |
| `limit` | number | Items per page |

#### GET /api/admin/partners/:id

Get partner details with full analytics. **Requires admin authentication**.

#### PUT /api/admin/partners/:id

Update partner settings. **Requires admin authentication**.

#### POST /api/admin/partners

Create a new partner account. **Requires admin authentication**.

#### GET /api/admin/partners/:id/analytics

Get detailed analytics for partner. **Requires admin authentication**.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Analytics start date |
| `endDate` | string | Analytics end date |
| `granularity` | string | day, week, month |

### Partner Portal Endpoints

Self-service portal for partners to manage their accounts:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/partner/login` | POST | Partner authentication |
| `/api/partner/dashboard` | GET | Partner dashboard data |
| `/api/partner/activities` | GET | List featured activities |
| `/api/partner/activities/:id/feature` | POST | Feature an activity |
| `/api/partner/activities/:id/unfeature` | POST | Remove featuring |
| `/api/partner/analytics` | GET | View performance metrics |

## Analytics Tracking

The system tracks impressions and clicks for all featured activities:

### PartnerImpression

| Field | Type | Description |
|-------|------|-------------|
| `partnerAccountId` | UUID | FK to PartnerAccount |
| `activityId` | UUID | FK to Activity |
| `placement` | String | Where shown (dashboard, search, etc.) |
| `platform` | String | ios, android, web |
| `city` | String | User's city |

### PartnerClick

| Field | Type | Description |
|-------|------|-------------|
| `partnerAccountId` | UUID | FK to PartnerAccount |
| `activityId` | UUID | FK to Activity |
| `placement` | String | Where clicked |
| `destinationType` | String | registration, website, etc. |
| `destinationUrl` | String | Target URL |

### Daily Analytics Aggregation

The `PartnerAnalyticsDaily` table stores pre-aggregated daily metrics:

| Field | Type | Description |
|-------|------|-------------|
| `date` | DateTime | Analytics date |
| `impressionsTotal` | Int | Total daily impressions |
| `clicksTotal` | Int | Total daily clicks |
| `impressionsByPlacement` | JSON | Breakdown by placement |
| `clicksByPlacement` | JSON | Breakdown by placement |

## A/B Testing

The system supports A/B testing for partner features:

### PartnerABTest

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Test name |
| `testType` | String | Type of test |
| `status` | String | DRAFT, RUNNING, COMPLETED |
| `variants` | JSON | Test variants config |
| `trafficPercent` | Int | % of traffic in test |

## Frontend Integration

### Dashboard Display

Featured activities appear in a dedicated "Featured Partners" section at the top of the dashboard:

```typescript
// src/screens/DashboardScreenModern.tsx
const loadFeaturedActivities = async () => {
  const featured = await activityService.getFeaturedActivities(3);
  setFeaturedActivities(featured);
};
```

### Filter Matching

The partner endpoint respects all user preference filters:

- **Age Range**: Activities matching child age profiles
- **Activity Types**: Preferred activity categories
- **Locations**: Selected cities/regions
- **Days of Week**: Available schedule days
- **Cost Range**: Budget preferences

This ensures featured content remains relevant to users.

## Activity Service Integration

Featured queries are handled by `EnhancedActivityService`:

```typescript
// server/src/services/activityService.enhanced.ts
async searchFeaturedActivities(params) {
  // Base featured filter
  const where = {
    isActive: true,
    isFeatured: true,
    // Must be within active featured dates
    OR: [
      { featuredStartDate: null, featuredEndDate: null },
      { featuredStartDate: { lte: now }, featuredEndDate: null },
      { featuredStartDate: null, featuredEndDate: { gte: now } },
      { featuredStartDate: { lte: now }, featuredEndDate: { gte: now } }
    ]
  };

  // Apply user preference filters...
  // Group by tier and randomize within each tier
  return this.randomizeWithinTiers(activities, limit);
}
```

### Tier Randomization Algorithm

```typescript
private randomizeWithinTiers(activities, limit) {
  const tiers = { gold: [], silver: [], bronze: [] };

  // Group by tier
  activities.forEach(activity => {
    const tier = activity.featuredTier?.toLowerCase() || 'bronze';
    tiers[tier].push(activity);
  });

  // Shuffle within each tier (Fisher-Yates)
  Object.keys(tiers).forEach(tier => {
    tiers[tier] = this.shuffleArray(tiers[tier]);
  });

  // Combine in priority order
  return [...tiers.gold, ...tiers.silver, ...tiers.bronze].slice(0, limit);
}
```

## Administration

### Making an Activity Featured

Via Admin Activity Management UI or directly in database:

```sql
-- Add featuring to an activity
UPDATE "Activity"
SET
  "isFeatured" = true,
  "featuredTier" = 'gold',
  "featuredStartDate" = '2024-01-01',
  "featuredEndDate" = '2024-12-31'
WHERE id = 'activity-uuid';
```

### Removing Featured Status

```sql
-- Remove featuring
UPDATE "Activity"
SET
  "isFeatured" = false,
  "featuredTier" = NULL,
  "featuredStartDate" = NULL,
  "featuredEndDate" = NULL
WHERE id = 'activity-uuid';
```

### Querying Active Featured Partners

```sql
-- Find all active featured activities
SELECT a.name, a."featuredTier", p.name as provider
FROM "Activity" a
JOIN "Provider" p ON a."providerId" = p.id
WHERE a."isFeatured" = true
  AND a."isActive" = true
  AND (a."featuredEndDate" IS NULL OR a."featuredEndDate" >= NOW())
ORDER BY
  CASE a."featuredTier"
    WHEN 'gold' THEN 1
    WHEN 'silver' THEN 2
    WHEN 'bronze' THEN 3
  END;
```

## Business Rules

1. **Active Requirement**: Only `isActive = true` activities can be featured
2. **Date Validation**: Featuring automatically expires based on `featuredEndDate`
3. **Filter Compliance**: Featured activities must match user filters to appear
4. **Fair Rotation**: Randomization within tiers ensures equal exposure for same-tier partners
5. **Limit Enforcement**: Maximum 3 featured activities shown per dashboard load (configurable)
6. **Partner Account Required**: Activities can only be featured if provider has active PartnerAccount

## Implemented Features

- [x] Admin dashboard for partner management
- [x] Analytics and impression tracking
- [x] Click-through rate reporting
- [x] Self-service partner portal
- [x] A/B testing for partner placement
- [x] Geographic targeting options

## Future Enhancements

- [ ] Automated billing integration (Stripe)
- [ ] Budget caps and spend tracking
- [ ] Advanced targeting (interests, behavior)
- [ ] Competitor exclusion zones

---

**Document Version**: 2.0
**Last Updated**: December 2024
