import { Router, Request, Response } from 'express';
import { EnhancedActivityService } from '../services/activityService.enhanced';
import { optionalAuth } from '../middleware/auth';

const router = Router();
const activityService = new EnhancedActivityService();

/**
 * @route   GET /api/v1/partners
 * @desc    Get featured partner activities matching user filters
 * @access  Public (optional auth for personalization)
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      // Age parameters
      ageMin,
      age_min,
      ageMax,
      age_max,
      // Cost parameters
      costMin,
      cost_min,
      costMax,
      cost_max,
      // Activity type parameters
      activityType,
      activitySubtype,
      categories,
      // Date parameters
      startDate,
      start_date,
      endDate,
      end_date,
      // Day of week
      dayOfWeek,
      day_of_week,
      days_of_week,
      // Location parameters
      location,
      locations,
      // Distance filtering
      userLat,
      userLon,
      radiusKm,
      // Limit (default 3 for partners)
      limit = '3'
    } = req.query;

    console.log('[Partners] API Request:', {
      ageMin: ageMin || age_min,
      ageMax: ageMax || age_max,
      activityType,
      locations,
      limit,
      timestamp: new Date().toISOString()
    });

    // Parse day of week - handle arrays and comma-separated strings
    let parsedDayOfWeek: string[] | undefined;
    const dayParam = dayOfWeek || day_of_week || days_of_week;
    if (dayParam) {
      if (Array.isArray(dayParam)) {
        parsedDayOfWeek = dayParam as string[];
      } else if (typeof dayParam === 'string') {
        parsedDayOfWeek = dayParam.split(',').map(d => d.trim());
      }
    }

    // Parse locations - handle arrays and comma-separated strings
    let parsedLocations: string[] | undefined;
    const locationParam = locations || location;
    if (locationParam) {
      if (Array.isArray(locationParam)) {
        parsedLocations = locationParam as string[];
      } else if (typeof locationParam === 'string') {
        parsedLocations = locationParam.split(',').map(l => l.trim());
      }
    }

    const params = {
      ageMin: ageMin ? parseInt(ageMin as string) : age_min ? parseInt(age_min as string) : undefined,
      ageMax: ageMax ? parseInt(ageMax as string) : age_max ? parseInt(age_max as string) : undefined,
      costMin: costMin ? parseFloat(costMin as string) : cost_min ? parseFloat(cost_min as string) : undefined,
      costMax: costMax ? parseFloat(costMax as string) : cost_max ? parseFloat(cost_max as string) : undefined,
      activityType: activityType as string,
      activitySubtype: activitySubtype as string,
      categories: categories as string,
      startDate: startDate ? new Date(startDate as string) : start_date ? new Date(start_date as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : end_date ? new Date(end_date as string) : undefined,
      dayOfWeek: parsedDayOfWeek,
      locations: parsedLocations,
      // Distance filtering - sponsors only appear if within user's radius
      userLat: userLat ? parseFloat(userLat as string) : undefined,
      userLon: userLon ? parseFloat(userLon as string) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm as string) : undefined,
      limit: parseInt(limit as string)
    };

    // Use searchActivities and filter for featured activities
    const result = await activityService.searchActivities({
      ...params,
      limit: (params.limit || 20) * 3 // Fetch more to account for filtering
    });
    
    // Filter for featured activities only
    const featuredActivities = (result.activities || [])
      .filter((a: any) => a.isFeatured)
      .slice(0, params.limit || 20);

    res.json({
      success: true,
      data: featuredActivities,
      meta: {
        total: featuredActivities.length,
        limit: params.limit
      }
    });
  } catch (error: any) {
    console.error('[Partners] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch featured partner activities'
    });
  }
});

export default router;
