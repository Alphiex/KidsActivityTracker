import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { childrenService } from '../services/childrenService';
import { subscriptionService } from '../services/subscriptionService';
import { body, validationResult } from 'express-validator';

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

export default router;