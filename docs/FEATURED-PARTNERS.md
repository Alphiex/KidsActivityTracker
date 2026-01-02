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
| **Payment Processing** | Stripe Checkout |
| **Subscription Management** | Stripe Customer Portal |

## Pricing Tiers

Partners can subscribe to three tiers with different pricing and priority:

| Tier | Monthly Price | Annual Price | Priority |
|------|--------------|--------------|----------|
| **Gold** | $249/month | $2,490/year | Highest - Always shown first |
| **Silver** | $129/month | $1,290/year | Medium - Shown after gold |
| **Bronze** | $49/month | $490/year | Standard - Shown after silver |

### Tier Benefits

All tiers include:
- Featured placement in the app
- Activity-level analytics
- Click and impression tracking
- Geographic targeting options
- Self-service partner portal

Higher tiers receive:
- Priority placement in search results
- More prominent dashboard positioning
- Better visibility when multiple sponsors match user criteria

### Monthly Impression Limits

Each tier has monthly impression limits for top-of-search-results placements:

| Tier | Monthly Limit | Weighting |
|------|---------------|-----------|
| **Gold** | Unlimited | 3x (highest priority) |
| **Silver** | 25,000 | 2x |
| **Bronze** | 5,000 | 1x |

- Impressions are counted when activities appear at the top of search results
- The sponsor section on explore page does NOT count against limits
- When limit is reached, the activity stops appearing at top of results until next month
- Weighted selection ensures all tiers have fair exposure (gold has 3x weight vs bronze)

## Payment System (Stripe)

Partner payments are processed through Stripe, providing:

- **Stripe Checkout** - Secure, hosted payment pages
- **Customer Portal** - Self-service subscription management
- **Automatic Renewals** - Monthly or annual billing cycles
- **Webhook Integration** - Real-time subscription status updates

### Payment Flow

```
┌─────────────┐    ┌──────────────┐    ┌────────────┐    ┌─────────────┐
│   Partner   │    │  Partner     │    │   Stripe   │    │   Backend   │
│   Portal    │    │  API         │    │            │    │             │
└──────┬──────┘    └──────┬───────┘    └─────┬──────┘    └──────┬──────┘
       │                  │                  │                  │
       │ Click Subscribe  │                  │                  │
       │─────────────────>│                  │                  │
       │                  │                  │                  │
       │                  │ Create Checkout  │                  │
       │                  │ Session          │                  │
       │                  │─────────────────>│                  │
       │                  │                  │                  │
       │                  │<─────────────────│                  │
       │                  │ Checkout URL     │                  │
       │                  │                  │                  │
       │<─────────────────│                  │                  │
       │ Redirect to      │                  │                  │
       │ Stripe Checkout  │                  │                  │
       │                  │                  │                  │
       │──────────────────────────────────>│                  │
       │ Complete Payment                   │                  │
       │                  │                  │                  │
       │                  │                  │ Webhook Event   │
       │                  │                  │ (checkout.      │
       │                  │                  │ session.        │
       │                  │                  │ completed)      │
       │                  │                  │─────────────────>│
       │                  │                  │                  │
       │                  │                  │                  │ Activate
       │                  │                  │                  │ Subscription
       │                  │                  │                  │ & Flag
       │                  │                  │                  │ Activities
       │                  │                  │                  │
       │<──────────────────────────────────────────────────────│
       │ Success Redirect                   │                  │
```

### Subscription Lifecycle

When a partner subscribes:

1. Partner selects tier (Bronze/Silver/Gold) and billing cycle (monthly/annual)
2. Redirected to Stripe Checkout to complete payment
3. On successful payment, Stripe webhook triggers `checkout.session.completed`
4. Backend automatically:
   - Updates partner account with subscription details
   - Sets subscription status to `active`
   - Flags ALL provider's activities as featured with the selected tier
   - Sets `featuredEndDate` to match subscription period end

When subscription renews:
1. Stripe automatically charges the card
2. Webhook `customer.subscription.updated` fires
3. Backend extends `featuredEndDate` to new period end

When subscription is cancelled:
1. Partner cancels via Stripe Customer Portal (or API)
2. Subscription remains active until period end
3. At period end, `customer.subscription.deleted` webhook fires
4. Backend removes featured status from all activities

### Automatic Activity Flagging

The system automatically manages featured status based on subscription:

**On Subscription Activation:**
```typescript
// All provider activities are flagged as featured
await prisma.activity.updateMany({
  where: { providerId: partner.providerId },
  data: {
    isFeatured: true,
    featuredTier: tier,  // 'bronze', 'silver', or 'gold'
    featuredStartDate: new Date(),
    featuredEndDate: subscriptionPeriodEnd,
  },
});
```

**On Subscription Cancellation/Expiration:**
```typescript
// All featured status is removed
await prisma.activity.updateMany({
  where: { providerId: partner.providerId },
  data: {
    isFeatured: false,
    featuredTier: null,
  },
});
```

### Expiration Safety Mechanisms

Three-layer protection ensures activities are properly unflagged when subscriptions end:

1. **Stripe Webhook (Primary)**
   - `customer.subscription.deleted` triggers immediate unflagging

2. **Query-Time Filter (Real-time)**
   - Featured partner queries filter out activities where `featuredEndDate < now`
   - Provides immediate protection even if cleanup hasn't run

3. **Scheduled Cleanup (Backup)**
   - Runs on server startup
   - Runs every 6 hours automatically
   - Admin can trigger manually via `POST /api/admin/partners/cleanup-expired`
   - Finds and processes any expired subscriptions

## Database Schema

Featured data is stored directly on the Activity model with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `isFeatured` | Boolean | Whether activity is featured |
| `featuredTier` | String | Tier level: 'gold', 'silver', 'bronze' |
| `featuredStartDate` | DateTime | When featuring begins |
| `featuredEndDate` | DateTime | When featuring expires |

### Sponsored Impression Tracking

Impressions are tracked in the `SponsoredImpression` table:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `activityId` | UUID | FK to Activity |
| `impressionType` | String | 'top_result' or 'sponsor_section' |
| `position` | Int | Position in results (1, 2, or 3) |
| `userId` | String | User ID (if authenticated) |
| `sessionId` | String | Session ID for anonymous tracking |
| `searchQuery` | String | Search query used |
| `filters` | JSON | Applied filters |
| `deviceType` | String | ios, android, web |
| `createdAt` | DateTime | When impression occurred |

### Monthly Stats Aggregation

Pre-aggregated monthly stats in `SponsoredMonthlyStats` table:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `activityId` | UUID | FK to Activity |
| `year` | Int | Year (e.g., 2026) |
| `month` | Int | Month (1-12) |
| `topResultCount` | Int | Impressions at top of search results |
| `sponsorSectionCount` | Int | Impressions in sponsor section |
| `totalImpressions` | Int | Total impressions |
| `uniqueUsers` | Int | Unique users who saw the activity |

**Unique constraint**: `(activityId, year, month)` ensures one record per activity per month.

### Partner Account Model

| Field | Type | Description |
|-------|------|-------------|
| `providerId` | UUID | FK to Provider (unique) |
| `planId` | UUID | FK to PartnerPlan |
| `subscriptionStatus` | String | active, inactive, cancelled, past_due |
| `subscriptionStartDate` | DateTime | When subscription began |
| `subscriptionEndDate` | DateTime | Current period end date |
| `billingEmail` | String | Billing contact email |
| `billingName` | String | Billing contact name |
| `revenueCatCustomerId` | String | Stripe Customer ID |
| `targetCities` | String[] | Geographic targeting |
| `targetProvinces` | String[] | Province targeting |

### Indexes

```sql
-- Optimized indexes for featured partner queries
@@index([isFeatured, featuredTier])
@@index([isFeatured, featuredEndDate])
```

## API Endpoints

### Partner Portal Endpoints (Authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/partner/login` | POST | Partner authentication |
| `/api/partner/dashboard` | GET | Dashboard with stats |
| `/api/partner/activities` | GET | List featured activities |
| `/api/partner/activities/:id/feature` | POST | Feature an activity |
| `/api/partner/activities/:id/unfeature` | POST | Remove featuring |
| `/api/partner/analytics` | GET | Overall performance metrics |
| `/api/partner/analytics/activities` | GET | Per-activity analytics |
| `/api/partner/analytics/activity/:id` | GET | Single activity details |

### Vendor Portal Analytics Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vendor/:vendorId/analytics/sponsored` | GET | Sponsored activity analytics summary |
| `/api/vendor/:vendorId/analytics/sponsored/:activityId` | GET | Detailed analytics for single activity |
| `/api/vendor/:vendorId/analytics/overview` | GET | Overall vendor analytics overview |

### Sponsored Activity Endpoints (Public/Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sponsored/section` | GET | Get activities for sponsor section (explore page) |
| `/api/v1/sponsored/tier-limits` | GET | Get tier limits and descriptions |
| `/api/v1/sponsored/analytics/:activityId` | GET | Get activity analytics (requires auth) |
| `/api/v1/sponsored/provider/:providerId/analytics` | GET | Get provider analytics (requires auth) |

### Subscription Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/partner/subscription/checkout` | POST | Create Stripe Checkout session |
| `/api/partner/subscription/portal` | POST | Create Stripe Customer Portal session |
| `/api/partner/subscription/details` | GET | Get current subscription details |
| `/api/partner/subscription/cancel` | POST | Cancel subscription (at period end) |

**Checkout Request:**
```json
{
  "tier": "silver",
  "billingCycle": "monthly"
}
```

**Checkout Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
  "sessionId": "cs_test_...",
  "tier": "silver",
  "billingCycle": "monthly",
  "price": 129
}
```

### Webhook Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/stripe` | POST | Handle Stripe webhook events |

Handled events:
- `checkout.session.completed` - Activate new subscription
- `customer.subscription.created` - Log subscription creation
- `customer.subscription.updated` - Handle renewals and changes
- `customer.subscription.deleted` - Deactivate subscription
- `invoice.payment_failed` - Handle failed payments

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/partners` | GET | List all partner accounts |
| `/api/admin/partners/:id` | GET | Get partner details |
| `/api/admin/partners/:id` | PUT | Update partner settings |
| `/api/admin/partners` | POST | Create new partner account |
| `/api/admin/partners/:id/analytics` | GET | Get partner analytics |
| `/api/admin/partners/cleanup-expired` | POST | Manually cleanup expired subscriptions |

### Public Endpoints

#### GET /api/v1/partners

Retrieve featured activities matching user filters.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ageMin` | number | Minimum age filter |
| `ageMax` | number | Maximum age filter |
| `costMin` | number | Minimum cost filter |
| `costMax` | number | Maximum cost filter |
| `activityType` | string | Activity type code or UUID |
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
      "isFeatured": true,
      "featuredTier": "gold",
      "location": {
        "name": "Aquatic Centre",
        "city": "Vancouver"
      }
    }
  ],
  "meta": {
    "total": 1,
    "limit": 3
  }
}
```

## Analytics System

### Tracked Metrics

The system tracks impressions and clicks for all featured activities:

#### PartnerImpression

| Field | Type | Description |
|-------|------|-------------|
| `partnerAccountId` | UUID | FK to PartnerAccount |
| `activityId` | UUID | FK to Activity |
| `placement` | String | Where shown (dashboard, search, etc.) |
| `platform` | String | ios, android, web |
| `city` | String | User's city |
| `timestamp` | DateTime | When impression occurred |

#### PartnerClick

| Field | Type | Description |
|-------|------|-------------|
| `partnerAccountId` | UUID | FK to PartnerAccount |
| `activityId` | UUID | FK to Activity |
| `placement` | String | Where clicked |
| `destinationType` | String | registration, website, details |
| `destinationUrl` | String | Target URL |
| `platform` | String | ios, android, web |

### Analytics Endpoints

#### Overall Analytics
`GET /api/partner/analytics?startDate=...&endDate=...`

Returns:
- Total impressions, clicks, and CTR
- Time series data (daily breakdown)
- Breakdown by placement
- Breakdown by city (top 10)

#### Activity-Level Analytics
`GET /api/partner/analytics/activities?startDate=...&limit=20`

Returns per-activity metrics:
```json
{
  "success": true,
  "activities": [
    {
      "activityId": "uuid",
      "name": "Kids Swimming Lessons",
      "activityType": "swimming",
      "location": "Community Pool",
      "city": "Vancouver",
      "impressions": 1234,
      "clicks": 56,
      "ctr": "4.54"
    }
  ]
}
```

#### Single Activity Analytics
`GET /api/partner/analytics/activity/:activityId`

Returns detailed breakdown:
- Total impressions and clicks
- Breakdown by destination type (registration, website, etc.)
- Breakdown by placement (dashboard, search results, etc.)

### Daily Analytics Aggregation

The `PartnerAnalyticsDaily` table stores pre-aggregated daily metrics:

| Field | Type | Description |
|-------|------|-------------|
| `date` | DateTime | Analytics date |
| `impressionsTotal` | Int | Total daily impressions |
| `clicksTotal` | Int | Total daily clicks |
| `impressionsByPlacement` | JSON | Breakdown by placement |
| `clicksByPlacement` | JSON | Breakdown by placement |

## Partner Portal Website

The partner portal is available at `/sponsor` on the website:

### Pages

| Page | URL | Description |
|------|-----|-------------|
| Login | `/sponsor/login` | Partner authentication |
| Dashboard | `/sponsor` | Overview with key metrics |
| Analytics | `/sponsor/analytics` | Detailed performance data |
| Plans | `/sponsor/plans` | View and subscribe to plans |
| Billing | `/sponsor/billing` | Manage subscription and payment |
| Targeting | `/sponsor/targeting` | Configure geographic targeting |
| Forgot Password | `/sponsor/forgot-password` | Password reset request |
| Reset Password | `/sponsor/reset-password` | Complete password reset |

### Dashboard Features

- Total impressions and clicks (30-day summary)
- Click-through rate
- Current plan and status
- Quick links to analytics and billing

### Analytics Page Features

- Date range selector (7/30/90 days)
- Summary stats cards
- Daily performance chart
- Breakdown by placement
- Top cities
- **Activity Performance Table** - Per-activity impressions, clicks, and CTR

### Billing Page Features

- Current subscription details
- Renewal/end date
- **Manage Subscription** button (opens Stripe Customer Portal)
- Update billing information
- View payment history (via Stripe Portal)
- Cancel subscription

## Frontend Integration (Mobile App)

### Dashboard Display

Featured activities appear in a dedicated "Featured Partners" section at the top of the dashboard:

```typescript
// src/screens/DashboardScreenModern.tsx
const loadFeaturedActivities = async () => {
  const featured = await activityService.getFeaturedActivities(3);
  setFeaturedActivities(featured);
};
```

### Analytics Tracking

The app tracks impressions and clicks:

```typescript
// Record impression when featured activity is displayed
await analyticsService.trackImpression({
  activityId: activity.id,
  placement: 'featured_partners',
  platform: Platform.OS,
});

// Record click when user taps on activity
await analyticsService.trackClick({
  activityId: activity.id,
  placement: 'featured_partners',
  destinationType: 'details',
  platform: Platform.OS,
});
```

### Filter Matching

The partner endpoint respects all user preference filters:

- **Age Range**: Activities matching child age profiles
- **Activity Types**: Preferred activity categories
- **Locations**: Selected cities/regions
- **Days of Week**: Available schedule days
- **Cost Range**: Budget preferences

This ensures featured content remains relevant to users.

## Weighted Selection Algorithm

Sponsored activities are selected using a weighted random algorithm that:

1. **Respects Monthly Limits**: Activities that have exceeded their monthly limit are excluded
2. **Weighted Selection**: Higher tiers have higher probability but all tiers have a chance
3. **Tier Sorting**: Selected activities are sorted by tier priority for display

```typescript
// Tier configuration
const TIER_CONFIG = {
  gold: { monthlyLimit: null, weight: 3, priority: 0 },   // Unlimited, 3x weight
  silver: { monthlyLimit: 25000, weight: 2, priority: 1 }, // 25k limit, 2x weight
  bronze: { monthlyLimit: 5000, weight: 1, priority: 2 }   // 5k limit, 1x weight
};

// Weighted random selection
function weightedRandomSelection(activities, maxResults) {
  const selected = [];
  const remaining = [...activities];

  for (let i = 0; i < maxResults && remaining.length > 0; i++) {
    // Calculate total weight
    const totalWeight = remaining.reduce((sum, a) => sum + a.weight, 0);

    // Random selection based on weight
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight;
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }

    // Move selected activity from remaining to selected
    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  // Sort by tier priority for display
  return selected.sort((a, b) => a.priority - b.priority);
}
```

### Selection Process

1. Find all featured activities matching user filters
2. Check each activity's monthly impression count against tier limit
3. Exclude activities that have exceeded their limit
4. Apply weighted random selection (max 3 for regular searches)
5. Sort selected activities by tier priority (gold first)
6. Record impressions for the selected activities

## Business Rules

1. **Active Requirement**: Only `isActive = true` activities can be featured
2. **Date Validation**: Featuring automatically expires based on `featuredEndDate`
3. **Filter Compliance**: Featured activities must match user filters to appear
4. **Fair Rotation**: Randomization within tiers ensures equal exposure for same-tier partners
5. **Limit Enforcement**: Maximum 3 featured activities shown per dashboard load
6. **Auto-Flagging**: All provider activities are automatically featured when subscription is active
7. **Auto-Unflagging**: All activities are unflagged when subscription expires

## Environment Variables

Required environment variables for partner payments:

```env
# Stripe (Partner Payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL (for success/cancel redirects)
FRONTEND_URL=https://your-website.com
```

## Implemented Features

- [x] Admin dashboard for partner management
- [x] Analytics and impression tracking
- [x] Click-through rate reporting
- [x] Self-service partner portal
- [x] A/B testing for partner placement
- [x] Geographic targeting options
- [x] **Stripe payment integration**
- [x] **Automatic activity flagging on subscription**
- [x] **Automatic unflagging on subscription expiration**
- [x] **Activity-level analytics**
- [x] **Stripe Customer Portal integration**
- [x] **Subscription lifecycle webhook handling**
- [x] **Scheduled cleanup for expired subscriptions**
- [x] **Sponsored impression tracking system**
- [x] **Monthly impression limits by tier**
- [x] **Weighted random selection algorithm**
- [x] **Top 3 sponsored activities per API call**
- [x] **Sponsor section endpoint (no limit)**
- [x] **Vendor portal analytics dashboard**
- [x] **Monthly stats aggregation**

## Related Documentation

- [STRIPE-INTEGRATION.md](./STRIPE-INTEGRATION.md) - Stripe setup and configuration
- [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) - Consumer subscription system (RevenueCat)
- [API-REFERENCE.md](./API-REFERENCE.md) - Complete API documentation
- [SECURITY.md](./SECURITY.md) - Security implementation details

---

**Document Version**: 3.0
**Last Updated**: January 2026
