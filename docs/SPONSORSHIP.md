# Sponsorship System

Paid sponsorship capabilities for activity providers to promote their programs with priority visibility in the Kids Activity Tracker app.

## Overview

The sponsorship system allows recreation centers and activity providers to pay for enhanced visibility of their activities. Sponsored activities appear prominently on the dashboard and are filtered using the same criteria as regular activities, ensuring relevance to users.

| | |
|---|---|
| **Sponsor Tiers** | Gold, Silver, Bronze |
| **Dashboard Display** | Up to 3 sponsored activities |
| **Filtering** | Matches user preferences (age, location, activity type) |
| **Randomization** | Within each tier for fair rotation |

## Sponsorship Tiers

Sponsors are organized into three tiers with priority-based display:

| Tier | Priority | Description |
|------|----------|-------------|
| **Gold** | Highest | Premium placement, always shown first |
| **Silver** | Medium | Shown after gold sponsors |
| **Bronze** | Standard | Shown after silver sponsors |

### Display Logic

1. Activities are grouped by sponsor tier
2. Within each tier, activities are randomly shuffled (ensuring fair exposure)
3. Activities are displayed in tier priority order: Gold → Silver → Bronze
4. Results are limited to the requested count (default: 3)

## Database Schema

Sponsorship data is stored directly on the Activity model with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `isSponsor` | Boolean | Whether activity is sponsored |
| `sponsorTier` | String | Tier level: 'gold', 'silver', 'bronze' |
| `sponsorStartDate` | DateTime | When sponsorship begins |
| `sponsorEndDate` | DateTime | When sponsorship expires |

### Indexes

```sql
-- Optimized indexes for sponsor queries
@@index([isSponsor, sponsorTier])
@@index([isSponsor, sponsorEndDate])
```

## API Endpoint

### GET /api/v1/sponsors

Retrieve sponsored activities matching user filters.

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
      "isSponsor": true,
      "sponsorTier": "gold",
      "sponsorStartDate": "2024-01-01T00:00:00Z",
      "sponsorEndDate": "2024-12-31T23:59:59Z",
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

## Frontend Integration

### Dashboard Display

Sponsored activities appear in a dedicated "Featured" or "Sponsored" section at the top of the dashboard:

```typescript
// src/screens/DashboardScreenModern.tsx
const loadSponsoredActivities = async () => {
  const sponsors = await activityService.getSponsoredActivities(3);
  setSponsoredActivities(sponsors);
};
```

### Filter Matching

The sponsor endpoint respects all user preference filters:

- **Age Range**: Activities matching child age profiles
- **Activity Types**: Preferred activity categories
- **Locations**: Selected cities/regions
- **Days of Week**: Available schedule days
- **Cost Range**: Budget preferences

This ensures sponsored content remains relevant to users.

## Activity Service Integration

Sponsor queries are handled by `EnhancedActivityService`:

```typescript
// server/src/services/activityService.enhanced.ts
async searchSponsoredActivities(params) {
  // Base sponsor filter
  const where = {
    isActive: true,
    isSponsor: true,
    // Must be within active sponsor dates
    OR: [
      { sponsorStartDate: null, sponsorEndDate: null },
      { sponsorStartDate: { lte: now }, sponsorEndDate: null },
      { sponsorStartDate: null, sponsorEndDate: { gte: now } },
      { sponsorStartDate: { lte: now }, sponsorEndDate: { gte: now } }
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
    const tier = activity.sponsorTier?.toLowerCase() || 'bronze';
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

### Making an Activity Sponsored

Sponsorship is configured directly in the database (admin-only operation):

```sql
-- Add sponsorship to an activity
UPDATE "Activity"
SET
  "isSponsor" = true,
  "sponsorTier" = 'gold',
  "sponsorStartDate" = '2024-01-01',
  "sponsorEndDate" = '2024-12-31'
WHERE id = 'activity-uuid';
```

### Removing Sponsorship

```sql
-- Remove sponsorship
UPDATE "Activity"
SET
  "isSponsor" = false,
  "sponsorTier" = NULL,
  "sponsorStartDate" = NULL,
  "sponsorEndDate" = NULL
WHERE id = 'activity-uuid';
```

### Querying Active Sponsors

```sql
-- Find all active sponsors
SELECT a.name, a."sponsorTier", p.name as provider
FROM "Activity" a
JOIN "Provider" p ON a."providerId" = p.id
WHERE a."isSponsor" = true
  AND a."isActive" = true
  AND (a."sponsorEndDate" IS NULL OR a."sponsorEndDate" >= NOW())
ORDER BY
  CASE a."sponsorTier"
    WHEN 'gold' THEN 1
    WHEN 'silver' THEN 2
    WHEN 'bronze' THEN 3
  END;
```

## Business Rules

1. **Active Requirement**: Only `isActive = true` activities can be sponsored
2. **Date Validation**: Sponsors automatically expire based on `sponsorEndDate`
3. **Filter Compliance**: Sponsored activities must match user filters to appear
4. **Fair Rotation**: Randomization within tiers ensures equal exposure for same-tier sponsors
5. **Limit Enforcement**: Maximum 3 sponsors shown per dashboard load (configurable)

## Future Enhancements

Planned improvements to the sponsorship system:

- [ ] Admin dashboard for sponsor management
- [ ] Analytics and impression tracking
- [ ] Click-through rate reporting
- [ ] Automated billing integration
- [ ] Self-service sponsor portal
- [ ] A/B testing for sponsor placement
- [ ] Geographic targeting options

---

**Document Version**: 1.0
**Last Updated**: December 2024
