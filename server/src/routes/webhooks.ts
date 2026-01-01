import { Router, Request, Response } from 'express';
import { subscriptionService } from '../services/subscriptionService';
import crypto from 'crypto';

const router = Router();

// RevenueCat webhook secret (should be in environment variables)
const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

/**
 * Verify RevenueCat webhook signature
 */
function verifyRevenueCatSignature(req: Request): boolean {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.warn('REVENUECAT_WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Allow in development
  }

  const signature = req.headers['x-revenuecat-signature'] as string;
  if (!signature) {
    return false;
  }

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

/**
 * POST /api/webhooks/revenuecat
 * Handle RevenueCat subscription events
 *
 * Event types:
 * - INITIAL_PURCHASE: First time purchase
 * - RENEWAL: Subscription renewed
 * - CANCELLATION: User cancelled (may still have access until period end)
 * - UNCANCELLATION: User reactivated cancelled subscription
 * - NON_RENEWING_PURCHASE: One-time purchase
 * - SUBSCRIPTION_PAUSED: Subscription paused (Google Play)
 * - EXPIRATION: Subscription expired
 * - BILLING_ISSUE: Payment failed
 * - PRODUCT_CHANGE: User changed plans
 * - TRANSFER: Subscription transferred between users
 */
router.post('/revenuecat', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production' && !verifyRevenueCatSignature(req)) {
      console.error('Invalid RevenueCat webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const eventType = event.event?.type;
    const appUserId = event.event?.app_user_id;

    console.log(`[RevenueCat Webhook] Event: ${eventType}, User: ${appUserId}`);

    if (!appUserId) {
      console.error('No app_user_id in webhook event');
      return res.status(400).json({ error: 'Missing app_user_id' });
    }

    // Extract subscription info
    const subscriberInfo = event.event?.subscriber_attributes || {};
    const entitlements = event.event?.entitlement_ids || [];
    const productId = event.event?.product_id;
    const expirationDate = event.event?.expiration_at_ms
      ? new Date(event.event.expiration_at_ms)
      : undefined;

    // Determine billing cycle from product ID
    const billingCycle = productId?.includes('annual') ? 'annual' : 'monthly';

    // Handle different event types
    switch (eventType) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
        // Activate or renew subscription
        if (entitlements.includes('premium') || entitlements.includes('pro')) {
          await subscriptionService.activateFromExternal(
            appUserId,
            event.event?.original_transaction_id || appUserId,
            'revenuecat',
            'premium',
            billingCycle as 'monthly' | 'annual',
            expirationDate
          );
          console.log(`[RevenueCat] Activated premium for user: ${appUserId}`);
        }
        break;

      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        // Deactivate subscription
        await subscriptionService.deactivateFromExternal(appUserId);
        console.log(`[RevenueCat] Deactivated subscription for user: ${appUserId}`);
        break;

      case 'CANCELLATION':
        // User cancelled but may still have access
        // Just log it - they keep access until expiration
        console.log(`[RevenueCat] User ${appUserId} cancelled subscription (access until ${expirationDate})`);
        // Update status to cancelled but keep the plan
        await subscriptionService.updateSubscription(appUserId, {
          status: 'cancelled'
        }).catch(() => {
          // Ignore if no subscription exists
        });
        break;

      case 'PRODUCT_CHANGE':
        // User changed plans
        const newProductId = event.event?.new_product_id;
        const newBillingCycle = newProductId?.includes('annual') ? 'annual' : 'monthly';
        await subscriptionService.updateSubscription(appUserId, {
          billingCycle: newBillingCycle,
          currentPeriodEnd: expirationDate
        }).catch(() => {
          // Ignore if no subscription exists
        });
        console.log(`[RevenueCat] User ${appUserId} changed to ${newBillingCycle} billing`);
        break;

      case 'SUBSCRIPTION_PAUSED':
        console.log(`[RevenueCat] Subscription paused for user: ${appUserId}`);
        break;

      case 'TRANSFER':
        console.log(`[RevenueCat] Subscription transferred for user: ${appUserId}`);
        break;

      default:
        console.log(`[RevenueCat] Unhandled event type: ${eventType}`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[RevenueCat Webhook Error]', error);
    // Still return 200 to prevent retries for our errors
    // RevenueCat will retry on 5xx errors
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * POST /api/webhooks/stripe
 * Handle Stripe subscription events for partner payments
 *
 * IMPORTANT: This route must receive raw body for signature verification.
 * The raw body middleware is configured in server.ts
 */
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const { constructWebhookEvent, handleWebhookEvent } = await import('../services/stripeService');

    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.error('[Stripe Webhook] No signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // Get raw body (set by express.raw() middleware)
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      console.error('[Stripe Webhook] No raw body available - check middleware configuration');
      return res.status(400).json({ error: 'Raw body not available' });
    }

    let event;
    try {
      event = constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.log(`[Stripe Webhook] Event received: ${event.type}`);

    // Handle the event
    await handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook Error]', error);
    // Return 500 so Stripe will retry
    res.status(500).json({ error: error.message });
  }
});

export default router;
