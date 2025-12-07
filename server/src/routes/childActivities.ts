import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { childActivityService, ActivityStatus } from '../services/childActivityService';
import { body, query, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateActivityLink = [
  body('childId').isUUID().withMessage('Valid child ID is required'),
  body('activityId').isUUID().withMessage('Valid activity ID is required'),
  body('status').isIn(['planned', 'in_progress', 'completed']).withMessage('Invalid status'),
  body('notes').optional().trim()
];

const validateActivityUpdate = [
  body('status').isIn(['planned', 'in_progress', 'completed']).withMessage('Invalid status'),
  body('notes').optional().trim(),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5')
];

const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Link an activity to a child
router.post('/link', verifyToken, validateActivityLink, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const childActivity = await childActivityService.linkActivity(req.user!.id, {
      childId: req.body.childId,
      activityId: req.body.activityId,
      status: req.body.status as ActivityStatus,
      notes: req.body.notes
    });

    res.status(201).json({
      success: true,
      childActivity
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk link activities to a child
router.post('/bulk-link', verifyToken, async (req: Request, res: Response) => {
  try {
    const { childId, activityIds, status = 'planned' } = req.body;

    if (!childId || !Array.isArray(activityIds) || activityIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'childId and activityIds array are required'
      });
    }

    const count = await childActivityService.bulkLinkActivities(
      req.user!.id,
      childId,
      activityIds,
      status as ActivityStatus
    );

    res.json({
      success: true,
      linkedCount: count,
      message: `${count} activities linked successfully`
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update activity status for a child
router.put('/:childId/activities/:activityId', verifyToken, validateActivityUpdate, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const childActivity = await childActivityService.updateActivityStatus(
      req.user!.id,
      req.params.childId,
      req.params.activityId,
      {
        status: req.body.status as ActivityStatus,
        notes: req.body.notes,
        rating: req.body.rating
      }
    );

    res.json({
      success: true,
      childActivity
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Remove activity link
router.delete('/:childId/activities/:activityId', verifyToken, async (req: Request, res: Response) => {
  try {
    const success = await childActivityService.unlinkActivity(
      req.user!.id,
      req.params.childId,
      req.params.activityId
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Activity link not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity unlinked successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get activity history
router.get('/history', verifyToken, async (req: Request, res: Response) => {
  try {
    const filters = {
      childId: req.query.childId as string,
      status: req.query.status as ActivityStatus,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      category: req.query.category as string,
      minRating: req.query.minRating ? parseInt(req.query.minRating as string) : undefined
    };

    const history = await childActivityService.getActivityHistory(req.user!.id, filters);

    res.json({
      success: true,
      activities: history
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get age-appropriate activity recommendations
router.get('/:childId/recommendations', verifyToken, async (req: Request, res: Response) => {
  try {
    const activities = await childActivityService.getAgeAppropriateActivities(
      req.user!.id,
      req.params.childId
    );

    res.json({
      success: true,
      activities
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get child's favorite activities
router.get('/:childId/favorites', verifyToken, async (req: Request, res: Response) => {
  try {
    const favorites = await childActivityService.getChildFavorites(
      req.user!.id,
      req.params.childId
    );

    res.json({
      success: true,
      favorites
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get calendar data
router.get('/calendar', verifyToken, async (req: Request, res: Response) => {
  try {
    const view = (req.query.view as 'week' | 'month' | 'year') || 'month';
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const childIds = req.query.childIds 
      ? (req.query.childIds as string).split(',')
      : undefined;

    const calendarData = await childActivityService.getCalendarData(
      req.user!.id,
      view,
      date,
      childIds
    );

    res.json({
      success: true,
      events: calendarData
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get activity statistics
router.get('/stats', verifyToken, async (req: Request, res: Response) => {
  try {
    const childIds = req.query.childIds 
      ? (req.query.childIds as string).split(',')
      : undefined;

    const stats = await childActivityService.getActivityStats(
      req.user!.id,
      childIds
    );

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get upcoming activities for notification
router.get('/upcoming', verifyToken, async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    
    const activities = await childActivityService.getUpcomingActivities(
      req.user!.id,
      days
    );

    res.json({
      success: true,
      activities
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get activities for a specific child
router.get('/:childId/activities', verifyToken, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as ActivityStatus | undefined;
    
    const history = await childActivityService.getActivityHistory(req.user!.id, {
      childId: req.params.childId,
      status
    });

    res.json({
      success: true,
      activities: history
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;