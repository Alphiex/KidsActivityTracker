# Stripe Integration Guide

Complete setup guide for Stripe payment integration in the Kids Activity Tracker partner/sponsor system.

## Overview

Stripe is used to process payments for the **Partner/Sponsor** subscription system (B2B). This is separate from the consumer subscription system which uses RevenueCat.

| System | Purpose | Payment Provider |
|--------|---------|------------------|
| Partner Subscriptions | Activity providers paying for featured placement | **Stripe** |
| Consumer Subscriptions | App users paying for premium features | RevenueCat |

## Prerequisites

1. A Stripe account (https://dashboard.stripe.com/register)
2. Node.js backend server
3. PostgreSQL database with partner tables

## Setup Steps

### 1. Create Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Complete registration and verify email
3. In test mode, you can use the test API keys immediately

### 2. Get API Keys

1. Navigate to **Developers > API Keys** in Stripe Dashboard
2. Copy your keys:
   - **Publishable key**: `pk_test_...` (safe for frontend)
   - **Secret key**: `sk_test_...` (backend only, never expose)

### 3. Configure Environment Variables

Add to your `.env` file (already gitignored):

```env
# Stripe (Partner Payments)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

The `.env.example` file contains placeholders for documentation:

```env
# Stripe (Partner Payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 4. Install Stripe Package

The Stripe npm package is already installed:

```bash
cd server
npm install stripe
```

Current version: `^20.1.0`

### 5. Configure Webhook Endpoint

#### Local Development (with Stripe CLI)

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Copy the webhook signing secret displayed (starts with `whsec_`)

5. Add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

#### Production Webhook

1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://your-api-domain.com/api/webhooks/stripe
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** and add to production environment

### 6. Initialize Stripe Products

Products and prices are automatically created when the server starts. The configuration is in `server/src/services/stripeService.ts`:

```typescript
export const PARTNER_TIERS = {
  bronze: {
    name: 'Bronze Partner',
    monthlyPrice: 4900,  // $49.00 in cents
    yearlyPrice: 49000,  // $490.00 in cents
  },
  silver: {
    name: 'Silver Partner',
    monthlyPrice: 12900, // $129.00 in cents
    yearlyPrice: 129000, // $1,290.00 in cents
  },
  gold: {
    name: 'Gold Partner',
    monthlyPrice: 24900, // $249.00 in cents
    yearlyPrice: 249000, // $2,490.00 in cents
  },
};
```

Products are created/retrieved with `initializeStripeProducts()` which runs on first checkout.

## Architecture

### File Structure

```
server/src/
├── services/
│   └── stripeService.ts       # Stripe SDK integration
├── routes/
│   ├── partnerPortal.ts       # Checkout & portal endpoints
│   └── webhooks.ts            # Webhook handler
└── server.ts                  # Raw body middleware for webhooks
```

### Key Components

#### stripeService.ts

Main Stripe service with these exports:

| Function | Description |
|----------|-------------|
| `initializeStripeProducts()` | Creates/retrieves Stripe products and prices |
| `createCheckoutSession()` | Creates a Stripe Checkout session |
| `createCustomerPortalSession()` | Creates a Customer Portal session |
| `handleWebhookEvent()` | Processes webhook events |
| `cancelSubscription()` | Cancels a subscription at period end |
| `getSubscriptionDetails()` | Gets current subscription info |
| `cleanupExpiredSubscriptions()` | Cleanup job for expired subs |
| `constructWebhookEvent()` | Verifies webhook signature |

#### Webhook Handling

The webhook endpoint requires raw body for signature verification:

```typescript
// In server.ts - BEFORE express.json()
app.use('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    (req as any).rawBody = req.body;
    next();
  }
);
```

## API Endpoints

### POST /api/partner/subscription/checkout

Creates a Stripe Checkout session for subscription.

**Request:**
```json
{
  "tier": "silver",
  "billingCycle": "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_...",
  "tier": "silver",
  "billingCycle": "monthly",
  "price": 129
}
```

### POST /api/partner/subscription/portal

Creates a Stripe Customer Portal session.

**Response:**
```json
{
  "success": true,
  "portalUrl": "https://billing.stripe.com/p/session/..."
}
```

### GET /api/partner/subscription/details

Gets current subscription details.

**Response:**
```json
{
  "success": true,
  "subscription": {
    "status": "active",
    "currentPeriodEnd": "2026-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "plan": "Silver Partner"
  }
}
```

### POST /api/webhooks/stripe

Handles Stripe webhook events. See [Webhook Events](#webhook-events) section.

## Webhook Events

### checkout.session.completed

Triggered when customer completes checkout.

**Action:**
- Creates/updates partner subscription
- Flags all provider activities as featured
- Sets subscription period dates

### customer.subscription.updated

Triggered on renewal or plan changes.

**Action:**
- Updates subscription period dates
- Re-flags activities with new end date

### customer.subscription.deleted

Triggered when subscription ends (after cancellation period).

**Action:**
- Sets partner status to inactive
- Removes featured flags from all activities

### invoice.payment_failed

Triggered when payment fails.

**Action:**
- Sets partner status to `past_due`
- Logs payment failure

## Customer Portal

The Stripe Customer Portal allows partners to:

- Update payment method
- View invoices and payment history
- Cancel subscription
- Update billing information

Configure the portal in Stripe Dashboard:
1. Go to **Settings > Billing > Customer portal**
2. Enable "Subscription cancellation"
3. Configure branding (logo, colors)
4. Enable invoice history

## Testing

### Test Card Numbers

| Card | Number | Use Case |
|------|--------|----------|
| Visa (success) | `4242 4242 4242 4242` | Successful payment |
| Visa (decline) | `4000 0000 0000 0002` | Card declined |
| 3D Secure | `4000 0025 0000 3155` | Requires authentication |
| Insufficient funds | `4000 0000 0000 9995` | Insufficient funds |

Use any future expiry date, any CVC, and any postal code.

### Test Webhook Events

Using Stripe CLI:

```bash
# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

### Manual Testing Flow

1. Start local server: `npm run dev`
2. Start webhook forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
3. Create a test partner account via admin
4. Login to partner portal
5. Click "Subscribe" on plans page
6. Complete checkout with test card
7. Verify:
   - Webhook received (check server logs)
   - Partner status updated to `active`
   - Activities flagged as featured

## Automatic Activity Flagging

When a subscription is activated:

```typescript
// All provider's activities are flagged
await prisma.activity.updateMany({
  where: { providerId: partner.providerId },
  data: {
    isFeatured: true,
    featuredTier: tier,
    featuredStartDate: new Date(),
    featuredEndDate: currentPeriodEnd,
  },
});
```

When a subscription expires:

```typescript
// All featured flags are removed
await prisma.activity.updateMany({
  where: { providerId: partner.providerId },
  data: {
    isFeatured: false,
    featuredTier: null,
  },
});
```

## Scheduled Cleanup

A backup cleanup job runs to handle missed webhooks:

- **On server startup**: Immediate cleanup
- **Every 6 hours**: Scheduled cleanup

The cleanup:
1. Finds partners with `subscriptionEndDate < now` still marked active
2. Sets partner status to `inactive`
3. Removes featured flags from their activities
4. Also directly unflag activities with expired `featuredEndDate`

Admin can trigger manually:
```bash
curl -X POST https://api/admin/partners/cleanup-expired \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Going Live

### Checklist

- [ ] Switch to live API keys (`sk_live_...`, `pk_live_...`)
- [ ] Configure production webhook endpoint
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live signing secret
- [ ] Test with real (small amount) transaction
- [ ] Configure Stripe branding (logo, colors)
- [ ] Set up Customer Portal branding
- [ ] Configure receipt emails in Stripe
- [ ] Enable fraud protection (Radar)

### Environment Variables (Production)

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

## Troubleshooting

### Webhook Signature Verification Failed

**Cause:** Raw body not available or wrong secret.

**Fix:**
1. Verify webhook secret matches Stripe Dashboard
2. Ensure raw body middleware is before `express.json()`
3. Check endpoint URL matches exactly

### Products Not Created

**Cause:** API key issues or Stripe account not verified.

**Fix:**
1. Verify API keys are correct
2. Ensure Stripe account is verified
3. Check server logs for Stripe API errors

### Checkout Redirects to Error Page

**Cause:** Invalid success/cancel URLs or session expired.

**Fix:**
1. Verify `FRONTEND_URL` is correct
2. Check success/cancel URLs are valid
3. Ensure checkout URL is used quickly (expires in 24h)

### Activities Not Flagged After Payment

**Cause:** Webhook not received or partner metadata missing.

**Fix:**
1. Check webhook endpoint is receiving events
2. Verify partner metadata is set in checkout session
3. Check server logs for errors in `handleCheckoutCompleted`

## Security Considerations

1. **Never log full API keys** - Only log last 4 characters
2. **Webhook signature verification** - Always verify before processing
3. **HTTPS only** - Webhook endpoint must be HTTPS in production
4. **Limit webhook IP** - Optionally whitelist Stripe IPs
5. **Audit logging** - Log all subscription changes

## Related Documentation

- [SPONSORED-PARTNERS.md](./SPONSORED-PARTNERS.md) - Complete partner system docs
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

---

**Document Version**: 1.0
**Last Updated**: January 2026
