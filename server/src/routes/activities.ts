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
      limit = '50',
      offset = '0',
      sortBy = 'availability', // Default: availability-first random ordering
      sortOrder = 'asc',
      randomSeed // Seed for consistent random ordering across pagination
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
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as 'cost' | 'dateStart' | 'name' | 'createdAt' | 'distance' | 'availability',
      sortOrder: sortOrder as 'asc' | 'desc',
      randomSeed: randomSeed as string
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
      pagination: result.pagination
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