import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { childrenService } from '../services/childrenService';
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
    const child = await childrenService.createChild({
      userId: req.user!.id,
      name: req.body.name,
      dateOfBirth: new Date(req.body.dateOfBirth),
      gender: req.body.gender,
      avatarUrl: req.body.avatarUrl,
      interests: req.body.interests,
      notes: req.body.notes
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

export default router;