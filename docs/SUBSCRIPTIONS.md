# Subscription System Documentation

> Complete documentation for the Kids Activity Tracker freemium subscription system, including architecture, purchase flows, feature gating, and auditing.

## Table of Contents

1. [Overview](#overview)
2. [Tier Structure](#tier-structure)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Feature Gating](#feature-gating)
6. [Purchase Flow](#purchase-flow)
7. [Backend Services](#backend-services)
8. [Webhook Handling](#webhook-handling)
9. [Analytics & Tracking](#analytics--tracking)
10. [A/B Testing](#ab-testing)
11. [Auditing & Monitoring](#auditing--monitoring)
12. [Security Considerations](#security-considerations)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The Kids Activity Tracker uses a **freemium model** where users get genuine value on the free tier but encounter natural limits that make premium compelling. The system uses **RevenueCat** as the subscription management layer, handling both iOS App Store and Google Play Store purchases.

### Key Design Principles

1. **Value-First**: Free tier provides real utility (2 children, 10 favorites, basic features)
2. **Natural Limits**: Users hit limits through normal usage, not artificial walls
3. **Transparent Pricing**: Clear feature comparison with no hidden costs
4. **Seamless Upgrade**: One-tap purchase with instant feature unlock
5. **Family Focus**: Premium unlocks unlimited family management

---

## Tier Structure

### Free Tier ("Discovery")

| Feature | Limit |
|---------|-------|
| Child profiles | 2 |
| Favorite activities | 10 |
| Family sharing | 1 recipient |
| Activity search | Basic filters only |
| Calendar view | Week view only |
| Alerts | Weekly digest only |
| Saved searches | None |
| Hide closed/full | No |

### Premium Tier ("Family Pro") - $5.99/month or $49.99/year

| Feature | Limit |
|---------|-------|
| Child profiles | Unlimited (99) |
| Favorite activities | Unlimited (999) |
| Family sharing | Unlimited (99) |
| Activity search | Advanced filters (budget, time, etc.) |
| Calendar view | Week/Month/Year + Export |
| Alerts | Instant (spots open, price drops) |
| Saved searches | 10 presets |
| Hide closed/full | Yes |

### Trial Period

- **Duration**: 7 days
- **Access**: Full premium features
- **Behavior**: Auto-converts to paid at trial end (user can cancel anytime)
- **Eligibility**: One trial per Apple/Google ID (managed by stores)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Paywall    │  │  Upgrade     │  │  Feature     │              │
│  │   Screen     │  │  Prompts     │  │  Gates       │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│  ┌──────▼─────────────────▼─────────────────▼───────┐              │
│  │              subscriptionSlice (Redux)            │              │
│  │   - currentPlan, limits, usage, isTrialing       │              │
│  └──────────────────────┬───────────────────────────┘              │
│                         │                                           │
│  ┌──────────────────────▼───────────────────────────┐              │
│  │              revenueCatService                    │              │
│  │   - initialize, purchase, restore, sync          │              │
│  └──────────────────────┬───────────────────────────┘              │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       REVENUECAT                                     │
│   - Purchase validation    - Entitlement management                 │
│   - Receipt verification   - Webhook dispatch                       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   App Store     │ │ Play Store  │ │    Backend      │
│   (iOS)         │ │ (Android)   │ │    API          │
└─────────────────┘ └─────────────┘ └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │   PostgreSQL    │
                                    │   Database      │
                                    └─────────────────┘
```

### File Structure

```
src/
├── services/
│   ├── revenueCatService.ts      # RevenueCat SDK wrapper
│   ├── subscriptionService.ts    # API client for subscription endpoints
│   ├── analyticsService.ts       # Subscription event tracking
│   └── abTestService.ts          # A/B testing for paywall
├── store/slices/
│   └── subscriptionSlice.ts      # Redux state management
├── screens/
│   └── PaywallScreen.tsx         # Purchase UI
├── components/
│   ├── UpgradePromptModal.tsx    # Limit reached modal
│   └── PremiumBadge.tsx          # PRO badge & locked feature UI
├── hooks/
│   ├── useSubscription.ts        # Main subscription hook
│   └── useFavoriteSubscription.ts # Favorites-specific hook
└── types/
    └── subscription.ts           # TypeScript definitions

server/
├── prisma/
│   └── schema.prisma             # SubscriptionPlan, Subscription models
├── routes/
│   ├── subscriptions.ts          # /api/subscriptions/* endpoints
│   └── webhooks.ts               # /api/webhooks/revenuecat
└── services/
    └── subscriptionService.ts    # Business logic
```

---

## Database Schema

### SubscriptionPlan Table

Stores the available subscription plans and their features.

```prisma
model SubscriptionPlan {
  id                 String         @id @default(uuid())
  code               String         @unique  // 'free', 'premium'
  name               String                  // 'Discovery', 'Family Pro'
  description        String?
  monthlyPrice       Float          @default(0)
  annualPrice        Float          @default(0)

  // Limits
  maxChildren        Int            @default(2)
  maxFavorites       Int            @default(10)
  maxSharedUsers     Int            @default(1)
  savedSearchLimit   Int            @default(0)

  // Feature flags
  hasAdvancedFilters Boolean        @default(false)
  hasCalendarExport  Boolean        @default(false)
  hasInstantAlerts   Boolean        @default(false)
  hasSavedSearches   Boolean        @default(false)

  // Metadata
  isActive           Boolean        @default(true)
  displayOrder       Int            @default(0)
  subscriptions      Subscription[]
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
}
```

### Subscription Table

Stores user subscription records.

```prisma
model Subscription {
  id                String           @id @default(uuid())
  userId            String           @unique
  planId            String
  status            String           @default("active")  // active, cancelled, expired
  billingCycle      String?          // monthly, annual, null for free
  startDate         DateTime         @default(now())
  currentPeriodEnd  DateTime?
  cancelledAt       DateTime?
  trialEndsAt       DateTime?

  // External provider IDs
  externalId        String?          @unique
  externalProvider  String?          // 'revenuecat', 'stripe'

  user              User             @relation(...)
  plan              SubscriptionPlan @relation(...)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
}
```

### Default Plan Data

```sql
-- Free Plan (Discovery)
INSERT INTO "SubscriptionPlan" (code, name, monthlyPrice, annualPrice,
  maxChildren, maxFavorites, maxSharedUsers, savedSearchLimit,
  hasAdvancedFilters, hasCalendarExport, hasInstantAlerts, hasSavedSearches)
VALUES ('free', 'Discovery', 0, 0, 2, 10, 1, 0, false, false, false, false);

-- Premium Plan (Family Pro)
INSERT INTO "SubscriptionPlan" (code, name, monthlyPrice, annualPrice,
  maxChildren, maxFavorites, maxSharedUsers, savedSearchLimit,
  hasAdvancedFilters, hasCalendarExport, hasInstantAlerts, hasSavedSearches)
VALUES ('premium', 'Family Pro', 5.99, 49.99, 99, 999, 99, 10, true, true, true, true);
```

---

## Feature Gating

### How Features Are Gated

Features are gated at multiple levels:

1. **UI Level**: Premium features show locked state or PRO badge
2. **Action Level**: Attempting gated action shows upgrade modal
3. **API Level**: Backend enforces limits on create/update operations

### Gated Features by Screen

| Screen | Feature | Gate Type |
|--------|---------|-----------|
| ChildrenListScreen | Add child | Count limit (2) |
| DashboardScreenModern | Add favorite | Count limit (10) |
| ShareChildScreen | Share with user | Count limit (1) |
| FiltersScreen | Budget filter | Feature flag |
| FiltersScreen | Hide closed/full | Feature flag |
| CalendarScreenModernFixed | Export calendar | Feature flag |
| ProfileScreenModern | Shows usage stats | Display only |

### Implementation Pattern

```typescript
// In component
const { checkAndShowUpgrade, canAddChild } = useSubscription();

const handleAddChild = () => {
  // checkAndShowUpgrade returns true if allowed, false if blocked
  if (checkAndShowUpgrade('children')) {
    navigation.navigate('AddEditChild');
  }
  // If blocked, UpgradePromptModal is automatically shown
};
```

### Backend Enforcement

```typescript
// In children route
router.post('/', verifyToken, async (req, res) => {
  // Check limit before creating
  const canAdd = await subscriptionService.canAddChild(req.user.id);

  if (!canAdd.allowed) {
    return res.status(403).json({
      success: false,
      error: 'LIMIT_REACHED',
      message: `You have reached your limit of ${canAdd.limit} children`,
      current: canAdd.current,
      limit: canAdd.limit
    });
  }

  // Proceed with creation...
});
```

---

## Purchase Flow

### Complete Purchase Sequence

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│   User   │     │  Paywall │     │RevenueCat │     │App Store │     │ Backend  │
└────┬─────┘     └────┬─────┘     └─────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                 │                │                │
     │ Tap Subscribe  │                 │                │                │
     │───────────────>│                 │                │                │
     │                │                 │                │                │
     │                │ purchasePackage │                │                │
     │                │────────────────>│                │                │
     │                │                 │                │                │
     │                │                 │ Purchase flow  │                │
     │                │                 │───────────────>│                │
     │                │                 │                │                │
     │                │                 │<───────────────│                │
     │                │                 │ Receipt        │                │
     │                │                 │                │                │
     │                │<────────────────│                │                │
     │                │ CustomerInfo    │                │                │
     │                │                 │                │                │
     │                │                 │ Webhook event  │                │
     │                │                 │───────────────────────────────>│
     │                │                 │                │                │
     │                │ syncWithBackend │                │                │
     │                │───────────────────────────────────────────────────>│
     │                │                 │                │                │
     │                │<───────────────────────────────────────────────────│
     │                │ Subscription updated             │                │
     │                │                 │                │                │
     │<───────────────│                 │                │                │
     │ Success!       │                 │                │                │
```

### Purchase States

| State | Description | User Experience |
|-------|-------------|-----------------|
| `idle` | No purchase in progress | Normal UI |
| `loading_offerings` | Fetching product info | Loading spinner |
| `purchasing` | Purchase in progress | Disabled buttons |
| `verifying` | Syncing with backend | Brief loading |
| `success` | Purchase complete | Success alert, navigate back |
| `failed` | Purchase failed | Error alert |
| `cancelled` | User cancelled | Return to paywall |

### Trial Flow

1. User taps "Start 7-Day Free Trial"
2. App calls `POST /api/subscriptions/start-trial`
3. Backend creates subscription with `trialEndsAt = now + 7 days`
4. User gets immediate premium access
5. After 7 days, if not converted, access reverts to free

### Restore Flow

1. User taps "Restore Purchases"
2. App calls `revenueCatService.restorePurchases()`
3. RevenueCat checks App Store/Play Store for valid subscriptions
4. If found, app syncs with backend via `POST /api/subscriptions/restore`
5. User's subscription is restored

---

## Backend Services

### Subscription Service Methods

```typescript
class SubscriptionService {
  // Get user's current subscription and usage
  async getUserSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo>

  // Get just the limits (faster for limit checks)
  async getUserLimits(userId: string): Promise<PlanLimits>

  // Check if user can add more resources
  async canAddChild(userId: string): Promise<LimitCheck>
  async canAddFavorite(userId: string): Promise<LimitCheck>
  async canShareWithUser(userId: string): Promise<LimitCheck>

  // Check feature access
  async hasFeature(userId: string, feature: string): Promise<boolean>

  // Subscription management
  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription>
  async updateSubscription(userId: string, updates: Partial<Subscription>): Promise<Subscription>
  async cancelSubscription(userId: string): Promise<void>

  // External provider integration
  async activateFromExternal(userId, externalId, provider, planCode, billingCycle): Promise<Subscription>
  async deactivateFromExternal(userId: string): Promise<void>
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscriptions/plans` | List available plans (public) |
| GET | `/api/subscriptions/current` | Get user's subscription + usage |
| GET | `/api/subscriptions/limits` | Get just limits (fast) |
| GET | `/api/subscriptions/check/:resource` | Check if can add resource |
| GET | `/api/subscriptions/feature/:feature` | Check feature access |
| POST | `/api/subscriptions/verify` | Verify purchase from RevenueCat |
| POST | `/api/subscriptions/restore` | Restore purchases |
| POST | `/api/subscriptions/start-trial` | Start 7-day trial |
| POST | `/api/subscriptions/cancel` | Cancel subscription |

---

## Webhook Handling

### RevenueCat Webhook Events

The backend handles these RevenueCat webhook events at `POST /api/webhooks/revenuecat`:

| Event | Action |
|-------|--------|
| `INITIAL_PURCHASE` | Activate premium subscription |
| `RENEWAL` | Extend subscription period |
| `CANCELLATION` | Mark as cancelled (access until period end) |
| `UNCANCELLATION` | Reactivate subscription |
| `EXPIRATION` | Deactivate subscription |
| `BILLING_ISSUE` | Deactivate subscription |
| `PRODUCT_CHANGE` | Update billing cycle |
| `SUBSCRIPTION_PAUSED` | Log only (Google Play) |
| `TRANSFER` | Log only |

### Webhook Security

```typescript
// Verify webhook signature
function verifyRevenueCatSignature(req: Request): boolean {
  const signature = req.headers['x-revenuecat-signature'];
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', REVENUECAT_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Webhook Response

Always return 200 to acknowledge receipt (even on errors) to prevent retries:

```typescript
res.status(200).json({ received: true });
```

---

## Analytics & Tracking

### Tracked Events

| Event | Properties | When Fired |
|-------|------------|------------|
| `paywall_viewed` | source, variant | Paywall screen opens |
| `paywall_dismissed` | source, timeSpentMs | Paywall closed without purchase |
| `plan_selected` | planCode, billingCycle | Billing toggle changed |
| `purchase_initiated` | productId, price, currency | Subscribe button tapped |
| `purchase_completed` | productId, price, isTrialConversion | Purchase successful |
| `purchase_failed` | productId, errorCode, errorMessage | Purchase failed |
| `purchase_cancelled` | productId | User cancelled purchase |
| `trial_started` | trialDays | Trial started |
| `restore_initiated` | - | Restore tapped |
| `restore_completed` | wasRestored | Restore finished |
| `upgrade_prompt_shown` | feature, currentCount, limit | Limit modal shown |
| `upgrade_prompt_accepted` | feature | User tapped upgrade |
| `upgrade_prompt_dismissed` | feature | User dismissed modal |
| `limit_reached` | resource, currentCount, limit | User hit a limit |

### User Properties

```typescript
analyticsService.setUserProperties({
  subscriptionTier: 'free' | 'premium',
  isTrialing: boolean,
  billingCycle: 'monthly' | 'annual',
  childrenCount: number,
  favoritesCount: number,
});
```

---

## A/B Testing

### Active Experiments

| Experiment | Variants | Description |
|------------|----------|-------------|
| `paywall_headline` | control, family_focus, savings_focus | Test headline messaging |
| `paywall_price_display` | control, monthly_equivalent | Test price display format |
| `trial_cta` | control, start_free, try_premium | Test trial button copy |

### Variant Assignment

- Users are randomly assigned to variants on first exposure
- Assignments are persisted in AsyncStorage
- Same user always sees same variant (consistent experience)
- Assignments are tracked in analytics for conversion analysis

### Adding New Experiments

```typescript
// In abTestService.ts
const EXPERIMENTS: Experiment[] = [
  {
    id: 'new_experiment',
    name: 'New Experiment Name',
    variants: ['control', 'variant_a', 'variant_b'],
    weights: [0.34, 0.33, 0.33],  // Must sum to 1
    isActive: true,
  },
];
```

---

## Auditing & Monitoring

### Subscription Audit Queries

```sql
-- Current subscription distribution
SELECT
  sp.name as plan_name,
  s.status,
  COUNT(*) as user_count
FROM "Subscription" s
JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
GROUP BY sp.name, s.status
ORDER BY sp.name, s.status;

-- Trial conversion rate
SELECT
  COUNT(CASE WHEN "trialEndsAt" IS NOT NULL AND status = 'active' THEN 1 END) as converted,
  COUNT(CASE WHEN "trialEndsAt" IS NOT NULL THEN 1 END) as total_trials,
  ROUND(
    100.0 * COUNT(CASE WHEN "trialEndsAt" IS NOT NULL AND status = 'active' THEN 1 END) /
    NULLIF(COUNT(CASE WHEN "trialEndsAt" IS NOT NULL THEN 1 END), 0), 2
  ) as conversion_rate
FROM "Subscription"
WHERE "trialEndsAt" < NOW();

-- Revenue by billing cycle
SELECT
  s."billingCycle",
  COUNT(*) as subscribers,
  SUM(CASE WHEN s."billingCycle" = 'monthly' THEN sp."monthlyPrice" ELSE sp."annualPrice" / 12 END) as monthly_revenue
FROM "Subscription" s
JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
WHERE s.status = 'active' AND sp.code = 'premium'
GROUP BY s."billingCycle";

-- Users approaching limits
SELECT
  u.id,
  u.email,
  (SELECT COUNT(*) FROM "Child" WHERE "userId" = u.id) as children_count,
  (SELECT COUNT(*) FROM "Favorite" WHERE "userId" = u.id) as favorites_count,
  sp."maxChildren",
  sp."maxFavorites"
FROM "User" u
LEFT JOIN "Subscription" s ON u.id = s."userId"
LEFT JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
WHERE sp.code = 'free'
  AND (
    (SELECT COUNT(*) FROM "Child" WHERE "userId" = u.id) >= sp."maxChildren" - 1
    OR (SELECT COUNT(*) FROM "Favorite" WHERE "userId" = u.id) >= sp."maxFavorites" - 2
  );
```

### Monitoring Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Free → Premium conversion | 5-8% | <3% |
| Trial → Paid conversion | 40%+ | <30% |
| Monthly churn | <5% | >8% |
| Paywall view → purchase | 10-15% | <5% |
| Webhook success rate | 99.9% | <99% |

### Health Check Endpoint

```typescript
// GET /api/health/subscriptions
{
  "healthy": true,
  "checks": {
    "database": "connected",
    "revenuecat_webhook": "last_received_2min_ago",
    "plans_configured": true
  },
  "stats": {
    "active_premium": 1234,
    "active_trials": 56,
    "total_users": 5678
  }
}
```

---

## Security Considerations

### Data Protection

1. **No Payment Data Stored**: All payment processing handled by App Store/Play Store via RevenueCat
2. **Webhook Signature Verification**: All webhook requests verified using HMAC-SHA256
3. **Server-Side Validation**: Subscription status always verified server-side, not trusted from client
4. **Audit Trail**: All subscription changes logged with timestamps

### Access Control

1. **Authenticated Endpoints**: All subscription endpoints require valid JWT
2. **User Isolation**: Users can only access their own subscription data
3. **Rate Limiting**: Subscription endpoints have rate limiting to prevent abuse

### Fraud Prevention

1. **Receipt Validation**: RevenueCat validates all receipts with Apple/Google
2. **Trial Abuse Prevention**: One trial per Apple/Google ID (enforced by stores)
3. **Refund Handling**: Webhooks automatically revoke access on refunds

---

## Troubleshooting

### Common Issues

#### "Subscription not updating after purchase"

1. Check RevenueCat dashboard for purchase record
2. Verify webhook endpoint is receiving events
3. Check backend logs for sync errors
4. Force refresh with `dispatch(fetchSubscription())`

#### "Features still locked after upgrade"

1. Pull to refresh on any screen
2. Check `subscriptionSlice` state in Redux DevTools
3. Verify backend returns correct limits
4. Check for stale cache in MMKV

#### "Trial not starting"

1. User may have already used trial (per Apple/Google ID)
2. Check if user already has active subscription
3. Verify trial endpoint returns success

#### "Webhook events not received"

1. Verify webhook URL is publicly accessible
2. Check for firewall/security rules blocking RevenueCat IPs
3. Review RevenueCat webhook history for delivery status
4. Verify HTTPS certificate is valid

### Debug Mode

Enable verbose logging in development:

```typescript
// In revenueCatService.ts
console.log('[RevenueCat]', 'Debug mode enabled');

// In subscriptionSlice.ts
console.log('[Subscription]', 'State update:', state);
```

### Support Contacts

- **RevenueCat Support**: support@revenuecat.com
- **App Store Support**: https://developer.apple.com/contact/
- **Play Store Support**: https://support.google.com/googleplay/android-developer/

---

## Related Documentation

- [SUBSCRIPTION_SETUP.md](./SUBSCRIPTION_SETUP.md) - Step-by-step setup guide
- [API-REFERENCE.md](./API-REFERENCE.md) - Complete API documentation
- [SECURITY.md](./SECURITY.md) - Security implementation details
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
