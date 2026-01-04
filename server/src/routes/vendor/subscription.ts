import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../../lib/prisma';
import { requireVendorAuth } from '../../middleware/vendorAuth';

const router = Router({ mergeParams: true });

// All subscription routes require vendor authentication
router.use(requireVendorAuth());

/**
 * Helper to get or create PartnerAccount for a vendor
 */
async function getOrCreatePartnerAccount(vendorId: string) {
  // Get vendor with provider
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      provider: {
        include: {
          partnerAccount: {
            include: {
              plan: true
            }
          }
        }
      }
    }
  });

  if (!vendor) {
    throw new Error('Vendor not found');
  }

  // If vendor has no provider, create one and link it
  let providerId = vendor.providerId;

  if (!providerId) {
    // Create a provider for this vendor
    const provider = await prisma.provider.create({
      data: {
        name: `Vendor: ${vendor.name}`,
        website: vendor.website || '',
        platform: 'vendor',
        scraperConfig: {}, // Empty config for vendor-managed providers
        isActive: true,
      }
    });

    // Link provider to vendor
    await prisma.vendor.update({
      where: { id: vendorId },
      data: { providerId: provider.id }
    });

    providerId = provider.id;
  }

  // Now get or create the partner account
  let partnerAccount = await prisma.partnerAccount.findUnique({
    where: { providerId },
    include: {
      plan: true,
      provider: true
    }
  });

  if (!partnerAccount) {
    partnerAccount = await prisma.partnerAccount.create({
      data: {
        providerId,
        billingEmail: vendor.email,
        billingName: vendor.contactName || vendor.name,
        subscriptionStatus: 'inactive',
      },
      include: {
        plan: true,
        provider: true
      }
    });
  }

  return partnerAccount;
}

/**
 * POST /api/vendor/:vendorId/subscription/checkout
 * Create a Stripe Checkout session for vendor subscription
 */
router.post('/checkout', [
  body('tier').isIn(['bronze', 'silver', 'gold']).withMessage('Tier must be bronze, silver, or gold'),
  body('billingCycle').isIn(['monthly', 'annual']).withMessage('Billing cycle must be monthly or annual'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { vendorId } = req.params;
    const { tier, billingCycle } = req.body;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get or create partner account for this vendor
    const partnerAccount = await getOrCreatePartnerAccount(vendorId);

    // Import Stripe service
    const { createCheckoutSession, PARTNER_TIERS } = await import('../../services/stripeService');
    const tierConfig = PARTNER_TIERS[tier as keyof typeof PARTNER_TIERS];

    // Determine success/cancel URLs
    const frontendUrl = process.env.VENDOR_FRONTEND_URL || process.env.FRONTEND_URL || 'https://kidsactivitytracker.ca';
    const successUrl = `${frontendUrl}/vendor/dashboard/billing?success=true`;
    const cancelUrl = `${frontendUrl}/vendor/dashboard/plans?cancelled=true`;

    const session = await createCheckoutSession({
      partnerAccountId: partnerAccount.id,
      tier: tier as any,
      billingCycle,
      successUrl,
      cancelUrl,
    });

    console.log(`[VendorSubscription] Checkout session created for vendor ${vendorId}, tier: ${tier}`);

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      tier,
      billingCycle,
      price: billingCycle === 'annual' ? tierConfig.yearlyPrice / 100 : tierConfig.monthlyPrice / 100,
    });
  } catch (error: any) {
    console.error('[VendorSubscription] Checkout error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
});

/**
 * POST /api/vendor/:vendorId/subscription/portal
 * Create a Stripe Customer Portal session for managing subscription
 */
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get partner account
    const partnerAccount = await getOrCreatePartnerAccount(vendorId);

    if (!partnerAccount.revenueCatCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found. Please subscribe first.'
      });
    }

    const { createCustomerPortalSession } = await import('../../services/stripeService');

    const frontendUrl = process.env.VENDOR_FRONTEND_URL || process.env.FRONTEND_URL || 'https://kidsactivitytracker.ca';
    const returnUrl = `${frontendUrl}/vendor/dashboard/billing`;

    const session = await createCustomerPortalSession({
      partnerAccountId: partnerAccount.id,
      returnUrl,
    });

    res.json({
      success: true,
      portalUrl: session.url,
    });
  } catch (error: any) {
    console.error('[VendorSubscription] Portal session error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create portal session'
    });
  }
});

/**
 * GET /api/vendor/:vendorId/subscription/details
 * Get subscription details for vendor
 */
router.get('/details', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get vendor with provider and partner account
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        provider: {
          include: {
            partnerAccount: {
              include: {
                plan: true
              }
            }
          }
        }
      }
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }

    const partnerAccount = vendor.provider?.partnerAccount;

    if (!partnerAccount) {
      return res.json({
        success: true,
        subscription: {
          status: 'inactive',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          plan: null,
        },
      });
    }

    // If they have a Stripe customer ID, get live details
    if (partnerAccount.revenueCatCustomerId) {
      const { getSubscriptionDetails } = await import('../../services/stripeService');
      const details = await getSubscriptionDetails(partnerAccount.id);

      return res.json({
        success: true,
        subscription: details || {
          status: partnerAccount.subscriptionStatus || 'inactive',
          currentPeriodEnd: partnerAccount.subscriptionEndDate,
          cancelAtPeriodEnd: false,
          plan: partnerAccount.plan?.name || null,
        },
      });
    }

    res.json({
      success: true,
      subscription: {
        status: partnerAccount.subscriptionStatus || 'inactive',
        currentPeriodEnd: partnerAccount.subscriptionEndDate,
        cancelAtPeriodEnd: false,
        plan: partnerAccount.plan?.name || null,
      },
    });
  } catch (error: any) {
    console.error('[VendorSubscription] Details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subscription details'
    });
  }
});

/**
 * POST /api/vendor/:vendorId/subscription/sync
 * Manually sync subscription from Stripe (to recover from webhook failures)
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get partner account
    const partnerAccount = await getOrCreatePartnerAccount(vendorId);

    if (!partnerAccount.revenueCatCustomerId) {
      return res.status(400).json({
        success: false,
        error: 'No Stripe customer found. Please complete a checkout first.'
      });
    }

    // Import Stripe and get subscription from Stripe
    const { stripe, PARTNER_TIERS } = await import('../../services/stripeService');

    const subscriptions = await stripe.subscriptions.list({
      customer: partnerAccount.revenueCatCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found in Stripe'
      });
    }

    const subscription = subscriptions.data[0];
    const tier = subscription.metadata?.tier || 'bronze';
    const tierConfig = PARTNER_TIERS[tier as keyof typeof PARTNER_TIERS];

    // Get or create plan
    let plan = await prisma.partnerPlan.findFirst({
      where: { tier },
    });

    if (!plan) {
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

    // Update partner account with subscription info
    // In newer Stripe API, period dates are on subscription items
    let periodEndTimestamp = (subscription as any).current_period_end;
    let periodStartTimestamp = (subscription as any).current_period_start;
    if (!periodEndTimestamp && (subscription as any).items?.data?.[0]) {
      periodEndTimestamp = (subscription as any).items.data[0].current_period_end;
      periodStartTimestamp = (subscription as any).items.data[0].current_period_start;
    }
    const currentPeriodEnd = periodEndTimestamp
      ? new Date(periodEndTimestamp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const subscriptionStartDate = periodStartTimestamp
      ? new Date(periodStartTimestamp * 1000)
      : new Date();

    await prisma.partnerAccount.update({
      where: { id: partnerAccount.id },
      data: {
        planId: plan.id,
        subscriptionStatus: 'active',
        subscriptionStartDate,
        subscriptionEndDate: currentPeriodEnd,
      },
    });

    // Flag activities for this provider
    if (partnerAccount.providerId) {
      await prisma.activity.updateMany({
        where: { providerId: partnerAccount.providerId },
        data: {
          isFeatured: true,
          featuredTier: tier,
          featuredStartDate: new Date(),
          featuredEndDate: currentPeriodEnd,
        },
      });
    }

    console.log(`[VendorSubscription] Synced subscription for vendor ${vendorId}: ${tier}`);

    res.json({
      success: true,
      message: 'Subscription synced successfully',
      subscription: {
        status: 'active',
        tier,
        plan: plan.name,
        currentPeriodEnd,
      },
    });
  } catch (error: any) {
    console.error('[VendorSubscription] Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync subscription'
    });
  }
});

/**
 * POST /api/vendor/:vendorId/subscription/cancel
 * Cancel current subscription
 */
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get partner account
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        provider: {
          include: {
            partnerAccount: true
          }
        }
      }
    });

    const partnerAccount = vendor?.provider?.partnerAccount;

    if (!partnerAccount || partnerAccount.subscriptionStatus !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }

    // Cancel via Stripe
    const { cancelSubscription } = await import('../../services/stripeService');
    await cancelSubscription(partnerAccount.id);

    const updated = await prisma.partnerAccount.findUnique({
      where: { id: partnerAccount.id }
    });

    console.log(`[VendorSubscription] Subscription cancelled for vendor ${vendorId}`);

    res.json({
      success: true,
      message: 'Subscription cancelled. Your benefits will remain active until the end of your billing period.',
      subscription: {
        status: updated?.subscriptionStatus,
        endDate: updated?.subscriptionEndDate
      }
    });
  } catch (error: any) {
    console.error('[VendorSubscription] Cancel error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel subscription'
    });
  }
});

/**
 * POST /api/vendor/:vendorId/subscription/change-tier
 * Change subscription tier (upgrade or downgrade)
 * - Upgrades: Take effect immediately with prorated charge
 * - Downgrades: Take effect at end of current billing period
 */
router.post('/change-tier', [
  body('newTier').isIn(['bronze', 'silver', 'gold']).withMessage('Tier must be bronze, silver, or gold'),
  body('billingCycle').isIn(['monthly', 'annual']).withMessage('Billing cycle must be monthly or annual'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { vendorId } = req.params;
    const { newTier, billingCycle } = req.body;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get partner account
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        provider: {
          include: {
            partnerAccount: {
              include: { plan: true }
            }
          }
        }
      }
    });

    const partnerAccount = vendor?.provider?.partnerAccount;

    if (!partnerAccount || partnerAccount.subscriptionStatus !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription found. Please subscribe first.'
      });
    }

    const currentTier = partnerAccount.plan?.tier;
    if (currentTier === newTier) {
      return res.status(400).json({
        success: false,
        error: `You are already on the ${newTier} tier`
      });
    }

    // Import and call the change tier function
    const { changeSubscriptionTier, PARTNER_TIERS } = await import('../../services/stripeService');

    const result = await changeSubscriptionTier({
      partnerAccountId: partnerAccount.id,
      newTier,
      billingCycle,
    });

    const tierConfig = PARTNER_TIERS[newTier as keyof typeof PARTNER_TIERS];

    console.log(`[VendorSubscription] Tier change for vendor ${vendorId}: ${currentTier} -> ${newTier} (${result.isUpgrade ? 'upgrade' : 'downgrade'})`);

    res.json({
      success: true,
      isUpgrade: result.isUpgrade,
      message: result.isUpgrade
        ? `Upgraded to ${tierConfig.name}! Your new features are now active.`
        : `Downgrade to ${tierConfig.name} scheduled. Your current benefits will remain active until ${result.effectiveDate.toLocaleDateString()}.`,
      effectiveDate: result.effectiveDate,
      prorationAmount: result.prorationAmount,
      newTier,
      newPlan: tierConfig.name,
    });
  } catch (error: any) {
    console.error('[VendorSubscription] Change tier error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to change subscription tier'
    });
  }
});

export default router;
