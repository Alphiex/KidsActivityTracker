import { Router, Request, Response } from 'express';
import { geocodingService } from '../../services/geocodingService';
import { prisma } from '../../lib/prisma';

const router = Router();

/**
 * GET /api/admin/geocoding/status
 * Get geocoding status - how many locations have/don't have coordinates
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [totalLocations, geocodedLocations, totalActivities, activitiesWithCoords] = await Promise.all([
      prisma.location.count(),
      prisma.location.count({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
      }),
      prisma.activity.count({ where: { isActive: true } }),
      prisma.activity.count({
        where: {
          isActive: true,
          latitude: { not: null },
          longitude: { not: null },
        },
      }),
    ]);

    res.json({
      success: true,
      status: {
        locations: {
          total: totalLocations,
          geocoded: geocodedLocations,
          pending: totalLocations - geocodedLocations,
          percentComplete: totalLocations > 0 
            ? Math.round((geocodedLocations / totalLocations) * 100) 
            : 0,
        },
        activities: {
          total: totalActivities,
          withCoordinates: activitiesWithCoords,
          withoutCoordinates: totalActivities - activitiesWithCoords,
          percentComplete: totalActivities > 0 
            ? Math.round((activitiesWithCoords / totalActivities) * 100) 
            : 0,
        },
      },
    });
  } catch (error: any) {
    console.error('[Admin Geocoding] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get geocoding status',
    });
  }
});

/**
 * POST /api/admin/geocoding/locations
 * Geocode locations that are missing coordinates
 */
router.post('/locations', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.body;

    const result = await geocodingService.geocodeAllLocations({
      limit: Math.min(limit, 200), // Cap at 200 per request
      delayMs: 100,
    });

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[Admin Geocoding] Error geocoding locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to geocode locations',
    });
  }
});

/**
 * POST /api/admin/geocoding/sync-activities
 * Copy coordinates from locations to activities
 */
router.post('/sync-activities', async (req: Request, res: Response) => {
  try {
    const { limit = 1000 } = req.body;

    const updated = await geocodingService.syncActivityCoordinates({
      limit: Math.min(limit, 5000),
    });

    res.json({
      success: true,
      updated,
    });
  } catch (error: any) {
    console.error('[Admin Geocoding] Error syncing activity coordinates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync activity coordinates',
    });
  }
});

/**
 * POST /api/admin/geocoding/location/:id
 * Geocode a specific location
 */
router.post('/location/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await geocodingService.geocodeLocation(id);

    if (success) {
      const location = await prisma.location.findUnique({
        where: { id },
        select: { name: true, latitude: true, longitude: true, fullAddress: true },
      });

      res.json({
        success: true,
        location,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to geocode location',
      });
    }
  } catch (error: any) {
    console.error('[Admin Geocoding] Error geocoding location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to geocode location',
    });
  }
});

export default router;
