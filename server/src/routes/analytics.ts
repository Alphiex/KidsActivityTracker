import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '../../generated/prisma';
import { optionalAuth, verifyToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Types for analytics tracking
interface ImpressionEvent {
  activityId?: string;
  placement: string;
  city?: string;
  province?: string;
  platform: string;
  deviceType?: string;
  abTestId?: string;
  abVariant?: string;
  timestamp?: string;
}

interface ClickEvent {
  activityId?: string;
  placement: string;
  destinationType: string;
  destinationUrl?: string;
  city?: string;
  province?: string;
  platform: string;
  abTestId?: string;
  abVariant?: string;
}

/**
 * @route   POST /api/v1/analytics/impressions
 * @desc    Batch record sponsor impressions (from mobile app)
 * @access  Public (with optional auth)
 */
router.post('/impressions', [
  body('impressions').isArray({ min: 1, max: 100 }).withMessage('Impressions must be an array of 1-100 items'),
  body('impressions.*.placement').notEmpty().withMessage('Placement is required'),
  body('impressions.*.platform').notEmpty().withMessage('Platform is required'),
], optionalAuth, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { impressions } = req.body as { impressions: ImpressionEvent[] };
    const userId = req.user?.id || null;

    // Get sponsor accounts for activities
    const activityIds = impressions
      .filter(i => i.activityId)
      .map(i => i.activityId!);

    // Find sponsor accounts linked to these activities via their providers
    const sponsorActivities = activityIds.length > 0 ? await prisma.activity.findMany({
      where: {
        id: { in: activityIds },
        isSponsor: true
      },
      include: {
        provider: {
          include: {
            sponsorAccount: true
          }
        }
      }
    }) : [];

    // Create a map of activityId -> sponsorAccountId
    const activityToSponsor = new Map<string, string>();
    for (const activity of sponsorActivities) {
      if (activity.provider?.sponsorAccount) {
        activityToSponsor.set(activity.id, activity.provider.sponsorAccount.id);
      }
    }

    // Create impression records
    const impressionRecords = impressions
      .filter(impression => {
        // Only create records for sponsored activities or general placements
        return !impression.activityId || activityToSponsor.has(impression.activityId);
      })
      .map(impression => ({
        sponsorAccountId: impression.activityId
          ? activityToSponsor.get(impression.activityId)!
          : null,
        activityId: impression.activityId || null,
        placement: impression.placement,
        userId,
        city: impression.city || null,
        province: impression.province || null,
        abTestId: impression.abTestId || null,
        abVariant: impression.abVariant || null,
        platform: impression.platform,
        deviceType: impression.deviceType || null,
        timestamp: impression.timestamp ? new Date(impression.timestamp) : new Date()
      }))
      .filter(record => record.sponsorAccountId !== null);

    // Batch insert impressions
    if (impressionRecords.length > 0) {
      await prisma.sponsorImpression.createMany({
        data: impressionRecords as any[]
      });
    }

    res.json({
      success: true,
      count: impressionRecords.length,
      message: `Recorded ${impressionRecords.length} impressions`
    });
  } catch (error: any) {
    console.error('[Analytics] Error recording impressions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record impressions'
    });
  }
});

/**
 * @route   POST /api/v1/analytics/clicks
 * @desc    Record a sponsor click event
 * @access  Public (with optional auth)
 */
router.post('/clicks', [
  body('placement').notEmpty().withMessage('Placement is required'),
  body('destinationType').notEmpty().withMessage('Destination type is required'),
  body('platform').notEmpty().withMessage('Platform is required'),
], optionalAuth, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const clickEvent: ClickEvent = req.body;
    const userId = req.user?.id || null;

    // Find sponsor account for the activity
    let sponsorAccountId: string | null = null;

    if (clickEvent.activityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: clickEvent.activityId },
        include: {
          provider: {
            include: {
              sponsorAccount: true
            }
          }
        }
      });

      if (activity?.provider?.sponsorAccount) {
        sponsorAccountId = activity.provider.sponsorAccount.id;
      }
    }

    // Only record if we found a sponsor account
    if (sponsorAccountId) {
      await prisma.sponsorClick.create({
        data: {
          sponsorAccountId,
          activityId: clickEvent.activityId || null,
          placement: clickEvent.placement,
          destinationType: clickEvent.destinationType,
          destinationUrl: clickEvent.destinationUrl || null,
          userId,
          city: clickEvent.city || null,
          province: clickEvent.province || null,
          abTestId: clickEvent.abTestId || null,
          abVariant: clickEvent.abVariant || null,
          platform: clickEvent.platform
        }
      });
    }

    res.json({
      success: true,
      recorded: sponsorAccountId !== null
    });
  } catch (error: any) {
    console.error('[Analytics] Error recording click:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record click'
    });
  }
});

/**
 * @route   GET /api/v1/analytics/ab-test/:testId/assignment
 * @desc    Get user's A/B test variant assignment
 * @access  Public
 */
router.get('/ab-test/:testId/assignment', [
  param('testId').isUUID().withMessage('Valid test ID required'),
  query('identifier').notEmpty().withMessage('Identifier is required'),
  query('identifierType').isIn(['user_id', 'device_id']).withMessage('Identifier type must be user_id or device_id'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { testId } = req.params;
    const { identifier, identifierType } = req.query as { identifier: string; identifierType: string };

    // Get the test
    const test = await prisma.sponsorABTest.findUnique({
      where: { id: testId }
    });

    if (!test || test.status !== 'RUNNING') {
      return res.status(404).json({
        success: false,
        error: 'Test not found or not running'
      });
    }

    // Check for existing assignment
    let assignment = await prisma.sponsorABTestAssignment.findUnique({
      where: {
        testId_identifier: {
          testId,
          identifier
        }
      }
    });

    // If no assignment, create one
    if (!assignment) {
      const variants = test.variants as any[];

      // Check if user should be in the test based on traffic percent
      const shouldBeInTest = Math.random() * 100 < test.trafficPercent;

      if (!shouldBeInTest) {
        return res.json({
          success: true,
          inTest: false,
          variant: null,
          testConfig: null
        });
      }

      // Random variant assignment
      const variantIndex = Math.floor(Math.random() * variants.length);
      const selectedVariant = variants[variantIndex];

      assignment = await prisma.sponsorABTestAssignment.create({
        data: {
          testId,
          identifier,
          identifierType,
          variant: selectedVariant.id || selectedVariant.name
        }
      });
    }

    // Get variant config
    const variants = test.variants as any[];
    const variantConfig = variants.find(v =>
      v.id === assignment!.variant || v.name === assignment!.variant
    );

    res.json({
      success: true,
      inTest: true,
      variant: assignment.variant,
      testConfig: variantConfig || null
    });
  } catch (error: any) {
    console.error('[Analytics] Error getting A/B test assignment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get test assignment'
    });
  }
});

/**
 * @route   GET /api/v1/analytics/ab-tests/active
 * @desc    Get all active A/B tests
 * @access  Public
 */
router.get('/ab-tests/active', async (req: Request, res: Response) => {
  try {
    const tests = await prisma.sponsorABTest.findMany({
      where: {
        status: 'RUNNING'
      },
      select: {
        id: true,
        name: true,
        testType: true,
        trafficPercent: true
      }
    });

    res.json({
      success: true,
      tests
    });
  } catch (error: any) {
    console.error('[Analytics] Error getting active tests:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get active tests'
    });
  }
});

export default router;
