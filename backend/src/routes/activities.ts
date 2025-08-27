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
    const {
      search,
      category,
      categories,
      ageMin,
      ageMax,
      costMin,
      costMax,
      startDate,
      endDate,
      dayOfWeek,
      location,
      providerId,
      limit = '50',
      offset = '0',
      sortBy = 'dateStart',
      sortOrder = 'asc'
    } = req.query;

    const params = {
      search: search as string,
      category: category as string,
      categories: categories as string,
      ageMin: ageMin ? parseInt(ageMin as string) : undefined,
      ageMax: ageMax ? parseInt(ageMax as string) : undefined,
      costMin: costMin ? parseFloat(costMin as string) : undefined,
      costMax: costMax ? parseFloat(costMax as string) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      dayOfWeek: dayOfWeek ? (Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek]) as string[] : undefined,
      location: location as string,
      providerId: providerId as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as 'cost' | 'dateStart' | 'name' | 'createdAt',
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const result = await activityService.searchActivities(params);

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