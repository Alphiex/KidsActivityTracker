import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireVendorAuth } from '../../middleware/vendorAuth';

const router = Router({ mergeParams: true });

// All profile routes require vendor authentication
router.use(requireVendorAuth());

/**
 * GET /api/vendor/:vendorId/profile
 * Get vendor profile including subscription status
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        contactName: true,
        contactPhone: true,
        website: true,
        logoUrl: true,
        description: true,
        status: true,
        verifiedAt: true,
        defaultFeaturedTier: true,
        featuredStartDate: true,
        featuredEndDate: true,
        createdAt: true,
        provider: {
          select: {
            partnerAccount: {
              select: {
                id: true,
                subscriptionStatus: true,
                subscriptionStartDate: true,
                subscriptionEndDate: true,
                plan: {
                  select: {
                    id: true,
                    name: true,
                    tier: true,
                    monthlyPrice: true,
                    yearlyPrice: true,
                    impressionLimit: true,
                    features: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found',
      });
    }

    // Get subscription info from PartnerAccount if it exists
    const partnerAccount = vendor.provider?.partnerAccount;
    let subscriptionStatus = 'free';
    let plan = null;

    if (partnerAccount) {
      subscriptionStatus = partnerAccount.subscriptionStatus || 'inactive';
      if (partnerAccount.plan) {
        plan = {
          id: partnerAccount.plan.id,
          name: partnerAccount.plan.name,
          tier: partnerAccount.plan.tier,
          monthlyPrice: partnerAccount.plan.monthlyPrice,
          yearlyPrice: partnerAccount.plan.yearlyPrice,
          impressionLimit: partnerAccount.plan.impressionLimit,
          features: partnerAccount.plan.features,
        };
      }
    } else if (vendor.defaultFeaturedTier) {
      // Fallback to legacy vendor-level featured tier
      subscriptionStatus = 'active';
      const tierName = vendor.defaultFeaturedTier.charAt(0).toUpperCase() +
                       vendor.defaultFeaturedTier.slice(1).toLowerCase();
      plan = {
        name: `${tierName} Sponsor`,
        tier: vendor.defaultFeaturedTier,
      };
    }

    // Remove provider from response (internal detail)
    const { provider, ...vendorData } = vendor;

    res.json({
      success: true,
      vendor: {
        ...vendorData,
        subscriptionStatus,
        plan,
        subscriptionEndDate: partnerAccount?.subscriptionEndDate || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching vendor profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
});

/**
 * PUT /api/vendor/:vendorId/profile
 * Update vendor profile
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;

    // Verify the token belongs to this vendor
    if (req.vendor?.id !== vendorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const { contactName, contactPhone, website, description, logoUrl } = req.body;

    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(contactName !== undefined && { contactName }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        contactName: true,
        contactPhone: true,
        website: true,
        logoUrl: true,
        description: true,
        status: true,
      },
    });

    res.json({
      success: true,
      vendor: updatedVendor,
    });
  } catch (error: any) {
    console.error('Error updating vendor profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }
});

export default router;
