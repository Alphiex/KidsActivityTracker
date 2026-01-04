/**
 * Stripe Service for Partner Payments
 * Handles subscription management for Bronze, Silver, and Gold partner tiers
 */

import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

// Partner tier configuration
export const PARTNER_TIERS = {
  bronze: {
    name: 'Bronze Partner',
    description: 'Sponsored placement for small activity providers',
    monthlyPrice: 4900, // $49.00 in cents
    yearlyPrice: 49000, // $490.00 in cents
    impressionLimit: 5000,
    features: {
      priority: 'basic',
      analytics: true,
      targeting: false,
      badge: 'Bronze',
      citiesLimit: 1,
    },
  },
  silver: {
    name: 'Silver Partner',
    description: 'Priority placement with advanced analytics',
    monthlyPrice: 12900, // $129.00 in cents
    yearlyPrice: 129000, // $1,290.00 in cents
    impressionLimit: 25000,
    features: {
      priority: 'high',
      analytics: true,
      targeting: true,
      badge: 'Silver',
      citiesLimit: 3,
    },
  },
  gold: {
    name: 'Gold Partner',
    description: 'Premium placement with unlimited impressions',
    monthlyPrice: 24900, // $249.00 in cents
    yearlyPrice: 249000, // $2,490.00 in cents
    impressionLimit: null, // unlimited
    features: {
      priority: 'top',
      analytics: true,
      targeting: true,
      badge: 'Gold',
      citiesLimit: null, // unlimited
    },
  },
};

export type PartnerTier = keyof typeof PARTNER_TIERS;

interface StripeProductConfig {
  productId: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
}

// Cache for Stripe product/price IDs
let stripeProducts: Record<PartnerTier, StripeProductConfig> | null = null;

/**
 * Initialize Stripe products and prices
 * Creates or retrieves existing products for Bronze, Silver, Gold tiers
 */
export async function initializeStripeProducts(): Promise<Record<PartnerTier, StripeProductConfig>> {
  if (stripeProducts) {
    return stripeProducts;
  }

  console.log('[Stripe] Initializing products...');
  const products: Record<string, StripeProductConfig> = {};

  for (const [tier, config] of Object.entries(PARTNER_TIERS)) {
    // Check if product already exists by metadata
    const existingProducts = await stripe.products.search({
      query: `metadata['tier']:'${tier}'`,
    });

    let product: Stripe.Product;

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`[Stripe] Found existing product for ${tier}: ${product.id}`);
    } else {
      // Create new product
      product = await stripe.products.create({
        name: config.name,
        description: config.description,
        metadata: {
          tier,
          impressionLimit: config.impressionLimit?.toString() || 'unlimited',
        },
      });
      console.log(`[Stripe] Created product for ${tier}: ${product.id}`);
    }

    // Get or create prices
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    let monthlyPriceId: string | undefined;
    let yearlyPriceId: string | undefined;

    for (const price of existingPrices.data) {
      if (price.recurring?.interval === 'month') {
        monthlyPriceId = price.id;
      } else if (price.recurring?.interval === 'year') {
        yearlyPriceId = price.id;
      }
    }

    // Create monthly price if not exists
    if (!monthlyPriceId) {
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: config.monthlyPrice,
        currency: 'cad',
        recurring: { interval: 'month' },
        metadata: { tier, billingCycle: 'monthly' },
      });
      monthlyPriceId = monthlyPrice.id;
      console.log(`[Stripe] Created monthly price for ${tier}: ${monthlyPriceId}`);
    }

    // Create yearly price if not exists
    if (!yearlyPriceId) {
      const yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: config.yearlyPrice,
        currency: 'cad',
        recurring: { interval: 'year' },
        metadata: { tier, billingCycle: 'annual' },
      });
      yearlyPriceId = yearlyPrice.id;
      console.log(`[Stripe] Created yearly price for ${tier}: ${yearlyPriceId}`);
    }

    products[tier] = {
      productId: product.id,
      monthlyPriceId,
      yearlyPriceId,
    };
  }

  stripeProducts = products as Record<PartnerTier, StripeProductConfig>;
  console.log('[Stripe] Products initialized successfully');
  return stripeProducts;
}

/**
 * Create a Stripe Checkout session for partner subscription
 */
export async function createCheckoutSession(params: {
  partnerAccountId: string;
  tier: PartnerTier;
  billingCycle: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { partnerAccountId, tier, billingCycle, successUrl, cancelUrl } = params;

  // Get partner account
  const partnerAccount = await prisma.partnerAccount.findUnique({
    where: { id: partnerAccountId },
    include: { provider: true },
  });

  if (!partnerAccount) {
    throw new Error('Partner account not found');
  }

  // Ensure products are initialized
  const products = await initializeStripeProducts();
  const productConfig = products[tier];

  if (!productConfig) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const priceId = billingCycle === 'monthly'
    ? productConfig.monthlyPriceId
    : productConfig.yearlyPriceId;

  // Create or get Stripe customer
  let customerId = partnerAccount.revenueCatCustomerId; // Reusing field for Stripe customer ID

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: partnerAccount.billingEmail,
      name: partnerAccount.billingName || partnerAccount.provider?.name,
      metadata: {
        partnerAccountId: partnerAccount.id,
        providerId: partnerAccount.providerId,
      },
    });
    customerId = customer.id;

    // Save customer ID
    await prisma.partnerAccount.update({
      where: { id: partnerAccountId },
      data: { revenueCatCustomerId: customerId },
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      partnerAccountId,
      tier,
      billingCycle,
    },
    subscription_data: {
      metadata: {
        partnerAccountId,
        tier,
        billingCycle,
      },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
  });

  return session;
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createCustomerPortalSession(params: {
  partnerAccountId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const { partnerAccountId, returnUrl } = params;

  const partnerAccount = await prisma.partnerAccount.findUnique({
    where: { id: partnerAccountId },
  });

  if (!partnerAccount || !partnerAccount.revenueCatCustomerId) {
    throw new Error('No Stripe customer found for this partner');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: partnerAccount.revenueCatCustomerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log(`[Stripe Webhook] Processing event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionCancelled(subscription);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailed(invoice);
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  const partnerAccountId = session.metadata?.partnerAccountId;
  const tier = session.metadata?.tier as PartnerTier;
  const billingCycle = session.metadata?.billingCycle as 'monthly' | 'annual';

  if (!partnerAccountId || !tier) {
    console.error('[Stripe] Missing metadata in checkout session');
    return;
  }

  console.log(`[Stripe] Checkout complete for partner ${partnerAccountId}, tier: ${tier}`);

  // Get the subscription
  const subscriptionId = session.subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Calculate period end - in newer Stripe API, these are on subscription items
  // Try subscription level first, then fall back to items
  let periodEndTimestamp = (subscription as any).current_period_end;
  if (!periodEndTimestamp && subscription.items?.data?.[0]) {
    periodEndTimestamp = (subscription.items.data[0] as any).current_period_end;
  }
  const currentPeriodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  console.log(`[Stripe] Period end timestamp: ${periodEndTimestamp}, Date: ${currentPeriodEnd}`);

  // Update partner account
  await activatePartnerSubscription({
    partnerAccountId,
    tier,
    billingCycle,
    stripeSubscriptionId: subscriptionId,
    currentPeriodEnd,
  });
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const partnerAccountId = subscription.metadata?.partnerAccountId;
  const tier = subscription.metadata?.tier as PartnerTier;
  const billingCycle = subscription.metadata?.billingCycle as 'monthly' | 'annual';

  if (!partnerAccountId) {
    console.log('[Stripe] Subscription update without partner metadata, skipping');
    return;
  }

  const status = subscription.status;
  console.log(`[Stripe] Subscription update for ${partnerAccountId}: ${status}`);

  // Calculate period end - in newer Stripe API, these are on subscription items
  let periodEndTimestamp = (subscription as any).current_period_end;
  if (!periodEndTimestamp && subscription.items?.data?.[0]) {
    periodEndTimestamp = (subscription.items.data[0] as any).current_period_end;
  }
  const currentPeriodEnd = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (status === 'active') {
    await activatePartnerSubscription({
      partnerAccountId,
      tier,
      billingCycle,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd,
    });
  } else if (status === 'past_due') {
    await prisma.partnerAccount.update({
      where: { id: partnerAccountId },
      data: { subscriptionStatus: 'past_due' },
    });
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription: Stripe.Subscription): Promise<void> {
  const partnerAccountId = subscription.metadata?.partnerAccountId;

  if (!partnerAccountId) {
    return;
  }

  console.log(`[Stripe] Subscription cancelled for ${partnerAccountId}`);

  // Deactivate partner subscription
  await deactivatePartnerSubscription(partnerAccountId);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;

  // Find partner by Stripe customer ID
  const partnerAccount = await prisma.partnerAccount.findFirst({
    where: { revenueCatCustomerId: customerId },
  });

  if (partnerAccount) {
    console.log(`[Stripe] Payment failed for partner ${partnerAccount.id}`);
    await prisma.partnerAccount.update({
      where: { id: partnerAccount.id },
      data: { subscriptionStatus: 'past_due' },
    });
  }
}

/**
 * Activate partner subscription and flag their activities
 */
async function activatePartnerSubscription(params: {
  partnerAccountId: string;
  tier: PartnerTier;
  billingCycle: 'monthly' | 'annual';
  stripeSubscriptionId: string;
  currentPeriodEnd: Date;
}): Promise<void> {
  const { partnerAccountId, tier, billingCycle, stripeSubscriptionId, currentPeriodEnd } = params;

  // Get or create the partner plan
  let plan = await prisma.partnerPlan.findFirst({
    where: { tier },
  });

  if (!plan) {
    const tierConfig = PARTNER_TIERS[tier];
    plan = await prisma.partnerPlan.create({
      data: {
        name: tierConfig.name,
        tier,
        monthlyPrice: tierConfig.monthlyPrice / 100,
        yearlyPrice: tierConfig.yearlyPrice / 100,
        impressionLimit: tierConfig.impressionLimit,
        features: tierConfig.features,
        isActive: true,
      },
    });
  }

  // Update partner account
  const partnerAccount = await prisma.partnerAccount.update({
    where: { id: partnerAccountId },
    data: {
      planId: plan.id,
      subscriptionStatus: 'active',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: currentPeriodEnd,
    },
    include: { provider: true },
  });

  console.log(`[Stripe] Activated ${tier} subscription for partner ${partnerAccountId}`);

  // Flag all activities for this provider as featured
  if (partnerAccount.providerId) {
    const updateResult = await prisma.activity.updateMany({
      where: { providerId: partnerAccount.providerId },
      data: {
        isFeatured: true,
        featuredTier: tier,
        featuredStartDate: new Date(),
        featuredEndDate: currentPeriodEnd,
      },
    });

    console.log(`[Stripe] Flagged ${updateResult.count} activities as featured (${tier}) for provider ${partnerAccount.providerId}`);
  }
}

/**
 * Deactivate partner subscription and unflag their activities
 */
async function deactivatePartnerSubscription(partnerAccountId: string): Promise<void> {
  const partnerAccount = await prisma.partnerAccount.update({
    where: { id: partnerAccountId },
    data: {
      subscriptionStatus: 'inactive',
      subscriptionEndDate: new Date(),
    },
  });

  // Remove featured status from activities
  if (partnerAccount.providerId) {
    const updateResult = await prisma.activity.updateMany({
      where: { providerId: partnerAccount.providerId },
      data: {
        isFeatured: false,
        featuredTier: null,
        featuredEndDate: new Date(),
      },
    });

    console.log(`[Stripe] Removed featured status from ${updateResult.count} activities for provider ${partnerAccount.providerId}`);
  }
}

/**
 * Cancel a partner's subscription
 */
export async function cancelSubscription(partnerAccountId: string): Promise<void> {
  const partnerAccount = await prisma.partnerAccount.findUnique({
    where: { id: partnerAccountId },
  });

  if (!partnerAccount || !partnerAccount.revenueCatCustomerId) {
    throw new Error('No active subscription found');
  }

  // Get customer's subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: partnerAccount.revenueCatCustomerId,
    status: 'active',
  });

  if (subscriptions.data.length === 0) {
    throw new Error('No active subscription found');
  }

  // Cancel at period end (so they keep access until the end of billing period)
  await stripe.subscriptions.update(subscriptions.data[0].id, {
    cancel_at_period_end: true,
  });

  await prisma.partnerAccount.update({
    where: { id: partnerAccountId },
    data: { subscriptionStatus: 'cancelled' },
  });

  console.log(`[Stripe] Subscription cancellation scheduled for partner ${partnerAccountId}`);
}

/**
 * Change subscription tier (upgrade or downgrade)
 * - Upgrades: Take effect immediately with prorated charge
 * - Downgrades: Take effect at end of current billing period
 */
export async function changeSubscriptionTier(params: {
  partnerAccountId: string;
  newTier: PartnerTier;
  billingCycle: 'monthly' | 'annual';
}): Promise<{
  success: boolean;
  isUpgrade: boolean;
  effectiveDate: Date;
  prorationAmount?: number;
}> {
  const { partnerAccountId, newTier, billingCycle } = params;

  const partnerAccount = await prisma.partnerAccount.findUnique({
    where: { id: partnerAccountId },
    include: { plan: true },
  });

  if (!partnerAccount || !partnerAccount.revenueCatCustomerId) {
    throw new Error('No active subscription found');
  }

  // Get current subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: partnerAccount.revenueCatCustomerId,
    status: 'active',
  });

  if (subscriptions.data.length === 0) {
    throw new Error('No active subscription found');
  }

  const subscription = subscriptions.data[0];
  const subscriptionItem = subscription.items.data[0];
  const currentTier = partnerAccount.plan?.tier || 'bronze';

  // Determine if upgrade or downgrade
  const tierOrder = ['bronze', 'silver', 'gold'];
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const newTierIndex = tierOrder.indexOf(newTier);
  const isUpgrade = newTierIndex > currentTierIndex;

  // Get new price ID
  const products = await initializeStripeProducts();
  const newProductConfig = products[newTier];
  const newPriceId = billingCycle === 'monthly'
    ? newProductConfig.monthlyPriceId
    : newProductConfig.yearlyPriceId;

  console.log(`[Stripe] Changing tier for ${partnerAccountId}: ${currentTier} -> ${newTier} (${isUpgrade ? 'upgrade' : 'downgrade'})`);

  let effectiveDate: Date;
  let prorationAmount: number | undefined;

  if (isUpgrade) {
    // Upgrades: Apply immediately with proration
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscriptionItem.id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        tier: newTier,
        billingCycle,
      },
    });

    effectiveDate = new Date();

    // Get proration amount from upcoming invoice
    try {
      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: partnerAccount.revenueCatCustomerId,
      });
      prorationAmount = upcomingInvoice.amount_due / 100;
    } catch (e) {
      // Proration may already be charged
    }

    // Update partner account immediately
    let plan = await prisma.partnerPlan.findFirst({ where: { tier: newTier } });
    if (!plan) {
      const tierConfig = PARTNER_TIERS[newTier];
      plan = await prisma.partnerPlan.create({
        data: {
          name: tierConfig.name,
          tier: newTier,
          monthlyPrice: tierConfig.monthlyPrice / 100,
          yearlyPrice: tierConfig.yearlyPrice / 100,
          impressionLimit: tierConfig.impressionLimit,
          features: tierConfig.features,
          isActive: true,
        },
      });
    }

    // Get period end from subscription items
    let periodEndTimestamp = (updatedSubscription as any).current_period_end;
    if (!periodEndTimestamp && updatedSubscription.items?.data?.[0]) {
      periodEndTimestamp = (updatedSubscription.items.data[0] as any).current_period_end;
    }
    const currentPeriodEnd = periodEndTimestamp
      ? new Date(periodEndTimestamp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.partnerAccount.update({
      where: { id: partnerAccountId },
      data: {
        planId: plan.id,
        subscriptionEndDate: currentPeriodEnd,
      },
    });

    // Update featured activities
    if (partnerAccount.providerId) {
      await prisma.activity.updateMany({
        where: { providerId: partnerAccount.providerId },
        data: {
          featuredTier: newTier,
          featuredEndDate: currentPeriodEnd,
        },
      });
    }

    console.log(`[Stripe] Upgrade applied immediately for ${partnerAccountId}`);
  } else {
    // Downgrades: Schedule for end of billing period
    await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscriptionItem.id,
        price: newPriceId,
      }],
      proration_behavior: 'none', // No proration for downgrades
      billing_cycle_anchor: 'unchanged',
      metadata: {
        ...subscription.metadata,
        tier: newTier,
        billingCycle,
        pendingDowngrade: 'true',
      },
    });

    // Get period end from subscription items
    let periodEndTimestamp = (subscription as any).current_period_end;
    if (!periodEndTimestamp && subscription.items?.data?.[0]) {
      periodEndTimestamp = (subscription.items.data[0] as any).current_period_end;
    }
    effectiveDate = periodEndTimestamp
      ? new Date(periodEndTimestamp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Note: The actual plan change will be handled by the subscription.updated webhook
    // when the billing period ends. For now, we just log the scheduled change.
    console.log(`[Stripe] Downgrade scheduled for ${effectiveDate.toISOString()} for ${partnerAccountId}`);
  }

  return {
    success: true,
    isUpgrade,
    effectiveDate,
    prorationAmount,
  };
}

/**
 * Get subscription details for a partner
 */
export async function getSubscriptionDetails(partnerAccountId: string): Promise<{
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  plan: string | null;
} | null> {
  const partnerAccount = await prisma.partnerAccount.findUnique({
    where: { id: partnerAccountId },
    include: { plan: true },
  });

  if (!partnerAccount || !partnerAccount.revenueCatCustomerId) {
    return null;
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: partnerAccount.revenueCatCustomerId,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return {
        status: 'inactive',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        plan: partnerAccount.plan?.name || null,
      };
    }

    const subscription = subscriptions.data[0];
    return {
      status: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      plan: partnerAccount.plan?.name || null,
    };
  } catch (error) {
    console.error('[Stripe] Error getting subscription details:', error);
    return null;
  }
}

// Verify webhook signature
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Cleanup expired subscriptions and unflag their activities
 * This should be run periodically (e.g., daily via cron) as a backup
 * in case webhooks are missed
 */
export async function cleanupExpiredSubscriptions(): Promise<{
  partnersProcessed: number;
  activitiesUnflagged: number;
}> {
  const now = new Date();
  let partnersProcessed = 0;
  let activitiesUnflagged = 0;

  console.log('[Stripe Cleanup] Starting expired subscription cleanup...');

  // 1. Find partner accounts with expired subscriptions that are still marked active
  const expiredPartners = await prisma.partnerAccount.findMany({
    where: {
      subscriptionEndDate: {
        lt: now,
      },
      subscriptionStatus: {
        in: ['cancelled', 'active'], // Active with past end date = expired
      },
    },
    include: {
      provider: true,
    },
  });

  for (const partner of expiredPartners) {
    // Update partner status to inactive
    if (partner.subscriptionStatus !== 'inactive') {
      await prisma.partnerAccount.update({
        where: { id: partner.id },
        data: { subscriptionStatus: 'inactive' },
      });
      partnersProcessed++;
      console.log(`[Stripe Cleanup] Marked partner ${partner.id} as inactive (subscription ended ${partner.subscriptionEndDate})`);
    }

    // Unflag their activities
    if (partner.providerId) {
      const result = await prisma.activity.updateMany({
        where: {
          providerId: partner.providerId,
          isFeatured: true,
        },
        data: {
          isFeatured: false,
          featuredTier: null,
        },
      });
      activitiesUnflagged += result.count;
    }
  }

  // 2. Also directly unflag any activities with expired featuredEndDate
  // This catches any edge cases
  const directUnflag = await prisma.activity.updateMany({
    where: {
      isFeatured: true,
      featuredEndDate: {
        lt: now,
      },
    },
    data: {
      isFeatured: false,
      featuredTier: null,
    },
  });

  activitiesUnflagged += directUnflag.count;

  console.log(`[Stripe Cleanup] Completed: ${partnersProcessed} partners processed, ${activitiesUnflagged} activities unflagged`);

  return {
    partnersProcessed,
    activitiesUnflagged,
  };
}

export { stripe };
