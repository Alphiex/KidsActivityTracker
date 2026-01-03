import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { childrenService } from '../services/childrenService';
import { subscriptionService } from '../services/subscriptionService';
import { childFavoritesService } from '../services/childFavoritesService';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validateChild = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('notes').optional().trim()
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

// Create a new child profile
router.post('/', verifyToken, validateChild, handleValidationErrors, async (req: Request, res: Response) => {
  try {
    // Check subscription limit
    const limitCheck = await subscriptionService.canAddChild(req.user!.id);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        message: `You have reached your limit of ${limitCheck.limit} children. Upgrade to Premium to add more.`,
        limit: limitCheck.limit,
        current: limitCheck.current
      });
    }

    const child = await childrenService.createChild({
      userId: req.user!.id,
      name: req.body.name,
      dateOfBirth: new Date(req.body.dateOfBirth),
      gender: req.body.gender,
      avatarUrl: req.body.avatarUrl,
      avatarId: req.body.avatarId,
      colorId: req.body.colorId,
      interests: req.body.interests,
      notes: req.body.notes,
      location: req.body.location,
      locationDetails: req.body.locationDetails
    });

    res.status(201).json({
      success: true,
      child
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all children for the authenticated user
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const children = await childrenService.getChildrenByUserId(req.user!.id, includeInactive);

    res.json({
      success: true,
      children
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get children with activity statistics
router.get('/stats', verifyToken, async (req: Request, res: Response) => {
  try {
    const children = await childrenService.getChildrenWithActivityStats(req.user!.id);

    res.json({
      success: true,
      children
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get shared children (children shared with the user)
router.get('/shared', verifyToken, async (req: Request, res: Response) => {
  try {
    const sharedChildren = await childrenService.getSharedChildren(req.user!.id);

    res.json({
      success: true,
      children: sharedChildren
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get shared children (alias for /shared - for mobile app compatibility)
router.get('/shared-with-me', verifyToken, async (req: Request, res: Response) => {
  try {
    const sharedChildren = await childrenService.getSharedChildren(req.user!.id);

    res.json({
      success: true,
      data: sharedChildren
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Search children
router.get('/search', verifyToken, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const children = await childrenService.searchChildren(req.user!.id, q);

    res.json({
      success: true,
      children
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get a single child by ID
router.get('/:childId', verifyToken, async (req: Request, res: Response) => {
  try {
    const child = await childrenService.getChildById(req.params.childId, req.user!.id);

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.json({
      success: true,
      child
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update a child profile
router.put('/:childId', verifyToken, async (req: Request, res: Response) => {
  try {
    const updateData: any = {};

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(req.body.dateOfBirth);
    if (req.body.gender !== undefined) updateData.gender = req.body.gender;
    if (req.body.avatarUrl !== undefined) updateData.avatarUrl = req.body.avatarUrl;
    if (req.body.avatarId !== undefined) updateData.avatarId = req.body.avatarId;
    if (req.body.colorId !== undefined) updateData.colorId = req.body.colorId;
    if (req.body.interests !== undefined) updateData.interests = req.body.interests;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    if (req.body.location !== undefined) updateData.location = req.body.location;
    if (req.body.locationDetails !== undefined) updateData.locationDetails = req.body.locationDetails;

    const child = await childrenService.updateChild(
      req.params.childId,
      req.user!.id,
      updateData
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.json({
      success: true,
      child
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update child (PATCH - same as PUT for compatibility)
router.patch('/:childId', verifyToken, async (req: Request, res: Response) => {
  try {
    const updateData: any = {};

    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(req.body.dateOfBirth);
    if (req.body.gender !== undefined) updateData.gender = req.body.gender;
    if (req.body.avatarUrl !== undefined) updateData.avatarUrl = req.body.avatarUrl;
    if (req.body.avatarId !== undefined) updateData.avatarId = req.body.avatarId;
    if (req.body.colorId !== undefined) updateData.colorId = req.body.colorId;
    if (req.body.interests !== undefined) updateData.interests = req.body.interests;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    if (req.body.location !== undefined) updateData.location = req.body.location;
    if (req.body.locationDetails !== undefined) updateData.locationDetails = req.body.locationDetails;

    const child = await childrenService.updateChild(
      req.params.childId,
      req.user!.id,
      updateData
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.json({
      success: true,
      child
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update child interests
router.patch('/:childId/interests', verifyToken, async (req: Request, res: Response) => {
  try {
    const { interests } = req.body;
    
    if (!Array.isArray(interests)) {
      return res.status(400).json({
        success: false,
        error: 'Interests must be an array'
      });
    }

    const child = await childrenService.updateChildInterests(
      req.params.childId,
      req.user!.id,
      interests
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.json({
      success: true,
      child
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Soft delete a child profile
router.delete('/:childId', verifyToken, async (req: Request, res: Response) => {
  try {
    const permanent = req.query.permanent === 'true';
    
    let success: boolean;
    if (permanent) {
      success = await childrenService.permanentlyDeleteChild(req.params.childId, req.user!.id);
    } else {
      success = await childrenService.deleteChild(req.params.childId, req.user!.id);
    }

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    res.json({
      success: true,
      message: permanent ? 'Child permanently deleted' : 'Child deactivated'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk create children
router.post('/bulk', verifyToken, async (req: Request, res: Response) => {
  try {
    const { children } = req.body;

    if (!Array.isArray(children) || children.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Children array is required'
      });
    }

    // Check subscription limit for bulk creation
    const limitCheck = await subscriptionService.canAddChild(req.user!.id);
    const remainingSlots = limitCheck.limit - limitCheck.current;
    if (children.length > remainingSlots) {
      return res.status(403).json({
        success: false,
        error: 'SUBSCRIPTION_LIMIT_REACHED',
        message: `You can only add ${remainingSlots} more ${remainingSlots === 1 ? 'child' : 'children'}. Upgrade to Premium to add more.`,
        limit: limitCheck.limit,
        current: limitCheck.current,
        requested: children.length,
        availableSlots: remainingSlots
      });
    }

    // Validate each child
    for (const child of children) {
      if (!child.name || !child.dateOfBirth) {
        return res.status(400).json({
          success: false,
          error: 'Each child must have name and dateOfBirth'
        });
      }
    }

    const createdChildren = await childrenService.bulkCreateChildren(
      req.user!.id,
      children.map(child => ({
        name: child.name,
        dateOfBirth: new Date(child.dateOfBirth),
        gender: child.gender,
        avatarUrl: child.avatarUrl,
        avatarId: child.avatarId,
        colorId: child.colorId,
        interests: child.interests || [],
        notes: child.notes
      }))
    );

    res.status(201).json({
      success: true,
      children: createdChildren
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Child Activity Management =============

// Add activity to child's calendar
router.post('/:childId/activities', verifyToken, async (req: Request, res: Response) => {
  try {
    const { activityId, status, scheduledDate, startTime, endTime, notes } = req.body;

    if (!activityId) {
      return res.status(400).json({
        success: false,
        error: 'Activity ID is required'
      });
    }

    const childActivity = await childrenService.addActivityToChild(
      req.params.childId,
      activityId,
      req.user!.id,
      status || 'planned',
      scheduledDate ? new Date(scheduledDate) : undefined,
      startTime,
      endTime,
      notes
    );

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

// Get activities for a specific child
router.get('/:childId/activities', verifyToken, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    console.log('Getting activities for child:', req.params.childId, 'user:', req.user!.id);
    const activities = await childrenService.getChildActivities(
      req.params.childId,
      req.user!.id,
      status
    );
    console.log('Found activities:', activities.length);
    if (activities.length > 0) {
      console.log('First activity:', JSON.stringify(activities[0], null, 2));
    }

    res.json({
      success: true,
      activities
    });
  } catch (error: any) {
    console.error('Error getting child activities:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all activities for all user's children (for calendar)
router.get('/activities/all', verifyToken, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const activities = await childrenService.getAllChildActivitiesForUser(
      req.user!.id,
      startDate,
      endDate
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

// Update child activity status
router.patch('/:childId/activities/:activityId', verifyToken, async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const childActivity = await childrenService.updateChildActivityStatus(
      req.params.activityId,
      req.user!.id,
      status,
      notes
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

// Remove activity from child's calendar
router.delete('/:childId/activities/:activityId', verifyToken, async (req: Request, res: Response) => {
  try {
    await childrenService.removeActivityFromChild(
      req.params.activityId,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Activity removed from child calendar'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Check if activity is assigned to any child
router.get('/activities/:activityId/assigned', verifyToken, async (req: Request, res: Response) => {
  try {
    const isAssigned = await childrenService.isActivityAssignedToAnyChild(
      req.params.activityId,
      req.user!.id
    );

    res.json({
      success: true,
      isAssigned
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Skill Progression Tracking =============

// Get all skill progress for a child
router.get('/:childId/skills', verifyToken, async (req: Request, res: Response) => {
  try {
    const skills = await childrenService.getChildSkillProgress(
      req.params.childId,
      req.user!.id
    );

    res.json({
      success: true,
      skills
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific skill progress for a child
router.get('/:childId/skills/:skillCategory', verifyToken, async (req: Request, res: Response) => {
  try {
    const skill = await childrenService.getChildSkillByCategory(
      req.params.childId,
      req.params.skillCategory,
      req.user!.id
    );

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: 'Skill progress not found'
      });
    }

    res.json({
      success: true,
      skill
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update or create skill progress for a child
router.post('/:childId/skills', verifyToken, async (req: Request, res: Response) => {
  try {
    const { skillCategory, currentLevel, activityName, hoursToAdd, notes, achievement } = req.body;

    if (!skillCategory) {
      return res.status(400).json({
        success: false,
        error: 'Skill category is required'
      });
    }

    const skill = await childrenService.updateChildSkillProgress(
      req.params.childId,
      req.user!.id,
      {
        skillCategory,
        currentLevel,
        activityName,
        hoursToAdd,
        notes,
        achievement
      }
    );

    res.json({
      success: true,
      skill
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Log activity completion and update skill progress
router.post('/:childId/skills/log-completion', verifyToken, async (req: Request, res: Response) => {
  try {
    const { activityId, activityName, skillCategory, hoursSpent, levelUp, notes } = req.body;

    if (!skillCategory) {
      return res.status(400).json({
        success: false,
        error: 'Skill category is required'
      });
    }

    const skill = await childrenService.logActivityCompletion(
      req.params.childId,
      req.user!.id,
      {
        activityId,
        activityName,
        skillCategory,
        hoursSpent: hoursSpent || 1,
        levelUp,
        notes
      }
    );

    res.json({
      success: true,
      skill
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete skill progress for a child
router.delete('/:childId/skills/:skillCategory', verifyToken, async (req: Request, res: Response) => {
  try {
    await childrenService.deleteChildSkillProgress(
      req.params.childId,
      req.params.skillCategory,
      req.user!.id
    );

    res.json({
      success: true,
      message: 'Skill progress deleted'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Child Preferences Management =============

// Get child preferences
router.get('/:childId/preferences', verifyToken, async (req: Request, res: Response) => {
  try {
    const preferences = await childrenService.getChildPreferences(
      req.params.childId,
      req.user!.id
    );

    res.json({
      success: true,
      preferences
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update child preferences
router.put('/:childId/preferences', verifyToken, async (req: Request, res: Response) => {
  try {
    const updateData: any = {};

    // Location preferences
    if (req.body.locationSource !== undefined) updateData.locationSource = req.body.locationSource;
    if (req.body.savedAddress !== undefined) updateData.savedAddress = req.body.savedAddress;
    if (req.body.distanceRadiusKm !== undefined) updateData.distanceRadiusKm = req.body.distanceRadiusKm;
    if (req.body.distanceFilterEnabled !== undefined) updateData.distanceFilterEnabled = req.body.distanceFilterEnabled;

    // Activity type preferences
    if (req.body.preferredActivityTypes !== undefined) updateData.preferredActivityTypes = req.body.preferredActivityTypes;
    if (req.body.preferredSubtypes !== undefined) updateData.preferredSubtypes = req.body.preferredSubtypes;
    if (req.body.excludedCategories !== undefined) updateData.excludedCategories = req.body.excludedCategories;

    // Schedule preferences
    if (req.body.daysOfWeek !== undefined) updateData.daysOfWeek = req.body.daysOfWeek;
    if (req.body.timePreferences !== undefined) updateData.timePreferences = req.body.timePreferences;

    // Budget preferences
    if (req.body.priceRangeMin !== undefined) updateData.priceRangeMin = req.body.priceRangeMin;
    if (req.body.priceRangeMax !== undefined) updateData.priceRangeMax = req.body.priceRangeMax;
    if (req.body.maxBudgetFriendlyAmount !== undefined) updateData.maxBudgetFriendlyAmount = req.body.maxBudgetFriendlyAmount;

    // Environment preference
    if (req.body.environmentFilter !== undefined) updateData.environmentFilter = req.body.environmentFilter;

    const preferences = await childrenService.updateChildPreferences(
      req.params.childId,
      req.user!.id,
      updateData
    );

    res.json({
      success: true,
      preferences
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Copy preferences from one child to another
router.post('/:childId/preferences/copy/:sourceChildId', verifyToken, async (req: Request, res: Response) => {
  try {
    const preferences = await childrenService.copyChildPreferences(
      req.params.sourceChildId,
      req.params.childId,
      req.user!.id
    );

    res.json({
      success: true,
      preferences,
      message: 'Preferences copied successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize preferences for a child from user's current preferences (migration helper)
router.post('/:childId/preferences/initialize', verifyToken, async (req: Request, res: Response) => {
  try {
    const preferences = await childrenService.initializeChildPreferencesFromUser(
      req.params.childId,
      req.user!.id
    );

    res.json({
      success: true,
      preferences,
      message: 'Preferences initialized from user settings'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk initialize preferences for all children (migration helper)
router.post('/preferences/initialize-all', verifyToken, async (req: Request, res: Response) => {
  try {
    const result = await childrenService.initializeAllChildrenPreferences(req.user!.id);

    res.json({
      success: true,
      ...result,
      message: `Initialized preferences for ${result.initialized} children`
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============= Child Favorites Management =============

// Get all favorites for a specific child
router.get('/:childId/favorites', verifyToken, async (req: Request, res: Response) => {
  try {
    const favorites = await childFavoritesService.getChildFavorites(
      req.params.childId,
      req.user!.id
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

// Get favorites for multiple children (for filtering)
router.get('/favorites/multi', verifyToken, async (req: Request, res: Response) => {
  try {
    const childIds = (req.query.childIds as string)?.split(',').filter(Boolean);

    if (!childIds || childIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'childIds query parameter is required'
      });
    }

    const favorites = await childFavoritesService.getFavoritesForChildren(
      childIds,
      req.user!.id
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

// Add activity to child's favorites
router.post(
  '/:childId/favorites/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const notifyOnChange = req.body.notifyOnChange !== false;

      const favorite = await childFavoritesService.addFavorite(
        req.params.childId,
        req.params.activityId,
        req.user!.id,
        notifyOnChange
      );

      res.status(201).json({
        success: true,
        favorite,
        message: 'Added to favorites'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Remove activity from child's favorites
router.delete(
  '/:childId/favorites/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      await childFavoritesService.removeFavorite(
        req.params.childId,
        req.params.activityId,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Removed from favorites'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Check if activity is favorited for a child
router.get(
  '/:childId/favorites/:activityId/status',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const isFavorited = await childFavoritesService.isFavorited(
        req.params.childId,
        req.params.activityId,
        req.user!.id
      );

      res.json({
        success: true,
        isFavorited
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get favorite status for an activity across multiple children
router.get(
  '/favorites/status/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const childIds = (req.query.childIds as string)?.split(',').filter(Boolean);

      if (!childIds || childIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'childIds query parameter is required'
        });
      }

      const status = await childFavoritesService.getFavoriteStatusForChildren(
        req.params.activityId,
        childIds,
        req.user!.id
      );

      res.json({
        success: true,
        status
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Update notification preference for a favorite
router.patch(
  '/:childId/favorites/:activityId/notify',
  verifyToken,
  [param('activityId').isUUID(), body('notifyOnChange').isBoolean()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const favorite = await childFavoritesService.updateFavoriteNotification(
        req.params.childId,
        req.params.activityId,
        req.user!.id,
        req.body.notifyOnChange
      );

      res.json({
        success: true,
        favorite
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============= Child Waitlist Management =============

// Get all waitlist entries for a specific child
router.get('/:childId/waitlist', verifyToken, async (req: Request, res: Response) => {
  try {
    const waitlist = await childFavoritesService.getChildWaitlist(
      req.params.childId,
      req.user!.id
    );

    res.json({
      success: true,
      waitlist
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get waitlist entries for multiple children
router.get('/waitlist/multi', verifyToken, async (req: Request, res: Response) => {
  try {
    const childIds = (req.query.childIds as string)?.split(',').filter(Boolean);

    if (!childIds || childIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'childIds query parameter is required'
      });
    }

    const waitlist = await childFavoritesService.getWaitlistForChildren(
      childIds,
      req.user!.id
    );

    res.json({
      success: true,
      waitlist
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Add child to waitlist for an activity
router.post(
  '/:childId/waitlist/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const entry = await childFavoritesService.joinWaitlist(
        req.params.childId,
        req.params.activityId,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        waitlistEntry: entry,
        message: 'Added to waitlist'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Remove child from waitlist
router.delete(
  '/:childId/waitlist/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      await childFavoritesService.leaveWaitlist(
        req.params.childId,
        req.params.activityId,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Removed from waitlist'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Check if child is on waitlist for an activity
router.get(
  '/:childId/waitlist/:activityId/status',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const isOnWaitlist = await childFavoritesService.isOnWaitlist(
        req.params.childId,
        req.params.activityId,
        req.user!.id
      );

      res.json({
        success: true,
        isOnWaitlist
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get waitlist status for an activity across multiple children
router.get(
  '/waitlist/status/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const childIds = (req.query.childIds as string)?.split(',').filter(Boolean);

      if (!childIds || childIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'childIds query parameter is required'
        });
      }

      const status = await childFavoritesService.getWaitlistStatusForChildren(
        req.params.activityId,
        childIds,
        req.user!.id
      );

      res.json({
        success: true,
        status
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get combined activity status (favorite + waitlist) for multiple children
router.get(
  '/activity-status/:activityId',
  verifyToken,
  [param('activityId').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const childIds = (req.query.childIds as string)?.split(',').filter(Boolean);

      if (!childIds || childIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'childIds query parameter is required'
        });
      }

      const status = await childFavoritesService.getActivityStatusForChildren(
        req.params.activityId,
        childIds,
        req.user!.id
      );

      res.json({
        success: true,
        status
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============= Child Notification Preferences =============

// Get notification preferences for a child
router.get('/:childId/notifications', verifyToken, async (req: Request, res: Response) => {
  try {
    const preferences = await childFavoritesService.getChildNotificationPreferences(
      req.params.childId,
      req.user!.id
    );

    res.json({
      success: true,
      preferences
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update notification preferences for a child
router.put(
  '/:childId/notifications',
  verifyToken,
  [
    body('enabled').optional().isBoolean(),
    body('spotsAvailable').optional().isBoolean(),
    body('favoriteCapacity').optional().isBoolean(),
    body('capacityThreshold').optional().isInt({ min: 1, max: 10 }),
    body('priceDrops').optional().isBoolean(),
    body('newActivities').optional().isBoolean(),
    body('dailyDigest').optional().isBoolean(),
    body('weeklyDigest').optional().isBoolean(),
    body('pushEnabled').optional().isBoolean(),
    body('pushSpotsAvailable').optional().isBoolean(),
    body('pushCapacityAlerts').optional().isBoolean(),
    body('pushPriceDrops').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const preferences = await childFavoritesService.updateChildNotificationPreferences(
        req.params.childId,
        req.user!.id,
        req.body
      );

      res.json({
        success: true,
        preferences,
        message: 'Notification preferences updated'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ============= Migration Helpers =============

// Migrate user-level favorites to a specific child
router.post('/:childId/favorites/migrate', verifyToken, async (req: Request, res: Response) => {
  try {
    const result = await childFavoritesService.migrateUserFavoritesToChild(
      req.user!.id,
      req.params.childId
    );

    res.json({
      success: true,
      ...result,
      message: `Migrated ${result.migrated} favorites to child`
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;