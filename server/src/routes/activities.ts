import { Router, Request, Response } from 'express';
import { EnhancedActivityService } from '../services/activityService.enhanced';
import { optionalAuth } from '../middleware/auth';

const router = Router();
const activityService = new EnhancedActivityService();

/**
 * @route   GET /api/v1/activities
 * @desc    Search activities with filters
 * @access  Public (optional auth for personalization)
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    // Support both camelCase and snake_case parameters for compatibility
    const {
      search,
      category,
      categories,
      activityType,
      activitySubtype,
      // Age parameters - support both formats
      ageMin,
      age_min,
      ageMax, 
      age_max,
      // Cost parameters - support both formats
      costMin,
      cost_min,
      costMax,
      cost_max,
      // Date parameters - support multiple formats
      startDate,
      start_date,
      start_date_after,
      endDate,
      end_date,
      start_date_before,
      // Date match mode - 'partial' = overlap, 'full' = completely within range
      dateMatchMode,
      // Day of week - support both formats
      dayOfWeek,
      day_of_week,
      days_of_week,
      location,
      locations, // Support multiple locations
      providerId,
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      // Distance filtering
      userLat,
      userLon,
      radiusKm,
      // Map filtering - only return activities with coordinates
      hasCoordinates,
      // Environment filter - indoor/outdoor/all
      environmentFilter,
      environment, // Alternative name
      limit = '50',
      offset = '0',
      sortBy = 'availability', // Default: availability-first random ordering
      sortOrder = 'asc',
      randomSeed, // Seed for consistent random ordering across pagination
      // Sponsored activity options
      sponsoredMode = 'top', // 'top' (default), 'section', or 'none'
      sessionId // For impression tracking
    } = req.query;

    console.log('[Routes] Activities API Request:', {
      activityType,
      activitySubtype,
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      limit,
      offset,
      search,
      category,
      categories,
      locations,
      location,
      // Show which parameter format was used
      ageParams: { ageMin, age_min, ageMax, age_max },
      costParams: { costMin, cost_min, costMax, cost_max },
      dateParams: { startDate, start_date, start_date_after, endDate, end_date, start_date_before },
      dayParams: { dayOfWeek, day_of_week, days_of_week },
      queryParams: req.query,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // Log activity type search detection for debugging
    const isActivityTypeSearch = !!(activityType || activitySubtype || categories);
    console.log('📍 [ROUTE] Activity Type Search:', isActivityTypeSearch, '| Has location:', !!(location || locations));
    
    // Map parameters, supporting both naming conventions
    const params = {
      search: search as string,
      category: category as string,
      categories: categories as string,
      activityType: activityType as string,
      activitySubtype: activitySubtype as string,
      // Use camelCase version if available, otherwise snake_case
      ageMin: ageMin ? parseInt(ageMin as string) : age_min ? parseInt(age_min as string) : undefined,
      ageMax: ageMax ? parseInt(ageMax as string) : age_max ? parseInt(age_max as string) : undefined,
      costMin: costMin ? parseFloat(costMin as string) : cost_min ? parseFloat(cost_min as string) : undefined,
      costMax: costMax ? parseFloat(costMax as string) : cost_max ? parseFloat(cost_max as string) : undefined,
      // Handle various date formats
      startDate: startDate ? new Date(startDate as string) :
                 start_date ? new Date(start_date as string) :
                 start_date_after ? new Date(start_date_after as string) : undefined,
      endDate: endDate ? new Date(endDate as string) :
               end_date ? new Date(end_date as string) :
               start_date_before ? new Date(start_date_before as string) : undefined,
      // Date match mode - 'partial' (default) = overlap, 'full' = completely within range
      dateMatchMode: ((dateMatchMode as string) || 'partial') as 'partial' | 'full',
      // Handle day of week variations
      dayOfWeek: dayOfWeek ? (Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek]) as string[] :
                 day_of_week ? (Array.isArray(day_of_week) ? day_of_week : [day_of_week]) as string[] :
                 days_of_week ? (Array.isArray(days_of_week) ? days_of_week : (days_of_week as string).split(',')) as string[] : undefined,
      // Always pass location parameters - AND logic with activity type is now supported
      location: location as string,
      locations: locations ? (
        Array.isArray(locations) 
          ? locations 
          : typeof locations === 'string' && locations.includes(',')
            ? locations.split(',').map(s => s.trim()).filter(s => s)
            : [locations]
      ) as string[] : undefined,
      providerId: providerId as string,
      hideClosedActivities: hideClosedActivities === 'true',
      hideFullActivities: hideFullActivities === 'true',
      hideClosedOrFull: hideClosedOrFull === 'true',
      // Distance filtering - only include if all three are valid
      userLat: userLat ? parseFloat(userLat as string) : undefined,
      userLon: userLon ? parseFloat(userLon as string) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm as string) : undefined,
      // Map filtering - only return activities with coordinates
      hasCoordinates: hasCoordinates === 'true',
      // Environment filter - indoor/outdoor/all
      environmentFilter: (environmentFilter || environment) as 'indoor' | 'outdoor' | 'all' | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as 'cost' | 'dateStart' | 'name' | 'createdAt' | 'distance' | 'availability',
      sortOrder: sortOrder as 'asc' | 'desc',
      randomSeed: randomSeed as string,
      // Sponsored activity options
      sponsoredMode: sponsoredMode as 'top' | 'section' | 'none',
      userId: (req as any).userId, // From auth middleware if authenticated
      sessionId: sessionId as string,
      deviceType: req.headers['x-device-type'] as string ||
                  (req.headers['user-agent']?.includes('iPhone') || req.headers['user-agent']?.includes('iPad') ? 'ios' :
                   req.headers['user-agent']?.includes('Android') ? 'android' : 'web')
    };

    console.log('🚨 [API Route] Global filter params being passed:', {
      hideClosedActivities: params.hideClosedActivities,
      hideFullActivities: params.hideFullActivities,
      hideClosedOrFull: params.hideClosedOrFull,
      hideClosedActivitiesRaw: hideClosedActivities,
      hideFullActivitiesRaw: hideFullActivities,
      hideClosedOrFullRaw: hideClosedOrFull
    });

    const result = await activityService.searchActivities(params);

    console.log(`Activities API Response: Found ${result.activities.length} activities (total: ${result.pagination.total})`);
    if (result.activities.length > 0) {
      console.log('First activity:', {
        id: result.activities[0].id,
        name: result.activities[0].name,
        category: result.activities[0].category,
        externalId: result.activities[0].externalId
      });
    }

    res.json({
      success: true,
      activities: result.activities,
      total: result.pagination.total,
      hasMore: result.pagination.offset + result.pagination.limit < result.pagination.total,
      pagination: result.pagination,
      // Include sponsored metadata if available
      sponsored: result.sponsored
    });
  } catch (error: any) {
    console.error('Activity search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search activities'
    });
  }
});

/**
 * @route   GET /api/v1/activities/bounds
 * @desc    Search activities within map bounds
 * @access  Public
 */
router.get('/bounds', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      minLat,
      maxLat,
      minLng,
      maxLng,
      // Filter options
      activityType,
      activitySubtype,
      ageMin,
      ageMax,
      costMin,
      costMax,
      dayOfWeek,
      hideClosedOrFull,
      hideClosedActivities,
      hideFullActivities,
      limit = '500',
    } = req.query;

    // Validate required bounds parameters
    if (!minLat || !maxLat || !minLng || !maxLng) {
      return res.status(400).json({
        success: false,
        error: 'Missing required bounds parameters: minLat, maxLat, minLng, maxLng'
      });
    }

    const bounds = {
      minLat: parseFloat(minLat as string),
      maxLat: parseFloat(maxLat as string),
      minLng: parseFloat(minLng as string),
      maxLng: parseFloat(maxLng as string),
    };

    // Calculate center and radius for the existing search function
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    // Calculate radius as half the diagonal distance (approximate)
    const latDiff = bounds.maxLat - bounds.minLat;
    const lngDiff = bounds.maxLng - bounds.minLng;
    // 1 degree latitude ~ 111km
    const radiusKm = Math.max(latDiff * 111, lngDiff * 85) / 2 * 1.2; // 20% buffer

    const params = {
      userLat: centerLat,
      userLon: centerLng,
      radiusKm: Math.min(radiusKm, 200), // Cap at 200km
      hasCoordinates: true,
      activityType: activityType as string,
      activitySubtype: activitySubtype as string,
      ageMin: ageMin ? parseInt(ageMin as string) : undefined,
      ageMax: ageMax ? parseInt(ageMax as string) : undefined,
      costMin: costMin ? parseFloat(costMin as string) : undefined,
      costMax: costMax ? parseFloat(costMax as string) : undefined,
      dayOfWeek: dayOfWeek ? (Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek]) as string[] : undefined,
      hideClosedOrFull: hideClosedOrFull === 'true',
      hideClosedActivities: hideClosedActivities === 'true',
      hideFullActivities: hideFullActivities === 'true',
      limit: parseInt(limit as string),
      offset: 0,
      sortBy: 'availability' as const, // Use availability sort, not distance (which isn't a Prisma field)
      sortOrder: 'asc' as const,
    };

    console.log('[Routes] Activities Bounds Request:', { bounds, params });

    const result = await activityService.searchActivities(params);

    // Filter to activities actually within bounds (more precise than radius)
    const activitiesInBounds = result.activities.filter(activity => {
      const lat = activity.latitude || activity.location?.latitude;
      const lng = activity.longitude || activity.location?.longitude;
      if (!lat || !lng) return false;
      return lat >= bounds.minLat && lat <= bounds.maxLat &&
             lng >= bounds.minLng && lng <= bounds.maxLng;
    });

    res.json({
      success: true,
      activities: activitiesInBounds,
      total: activitiesInBounds.length,
      bounds,
    });
  } catch (error: any) {
    console.error('Activities bounds search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search activities within bounds'
    });
  }
});

/**
 * @route   GET /api/v1/activities/stats/summary
 * @desc    Get activity statistics
 * @access  Public
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const categories = await activityService.getActivitiesByCategory();
    const upcomingCount = await activityService.getUpcomingActivities({ daysAhead: 7 });
    
    res.json({
      success: true,
      stats: {
        categories,
        totalCategories: categories.length,
        upcomingCount: upcomingCount.pagination.total
      }
    });
  } catch (error: any) {
    console.error('Activity stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity statistics'
    });
  }
});

/**
 * @route   GET /api/v1/activities/:id
 * @desc    Get activity details
 * @access  Public (optional auth for favorites)
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activity = await activityService.getActivity(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    res.json({
      success: true,
      activity
    });
  } catch (error: any) {
    console.error('Activity detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity details'
    });
  }
});


export default router;