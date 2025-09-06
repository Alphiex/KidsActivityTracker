import { Request, Response, NextFunction } from 'express';
import { childrenService } from '../services/childrenService';

/**
 * Middleware to verify child ownership
 * Expects childId to be in request params
 */
export const verifyChildOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const childId = req.params.childId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!childId) {
      return res.status(400).json({
        success: false,
        error: 'Child ID is required'
      });
    }

    const isOwner = await childrenService.verifyChildOwnership(childId, userId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this child profile'
      });
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error verifying child ownership'
    });
  }
};

/**
 * Middleware to verify ownership of multiple children
 * Expects childIds to be in query params or request body
 */
export const verifyMultipleChildOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get childIds from query params or body
    let childIds: string[] = [];
    
    if (req.query.childIds) {
      childIds = (req.query.childIds as string).split(',');
    } else if (req.body.childIds && Array.isArray(req.body.childIds)) {
      childIds = req.body.childIds;
    } else if (req.body.childId) {
      childIds = [req.body.childId];
    }

    if (childIds.length === 0) {
      // No specific children to verify, continue
      return next();
    }

    // Verify ownership of all children
    for (const childId of childIds) {
      const isOwner = await childrenService.verifyChildOwnership(childId, userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: `You do not have permission to access child profile: ${childId}`
        });
      }
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error verifying child ownership'
    });
  }
};

/**
 * Middleware to attach child data to request after ownership verification
 * Useful for routes that need the child data
 */
export const loadChildData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const childId = req.params.childId;
    const userId = req.user?.id;

    if (!userId || !childId) {
      return next(); // Let other middleware handle the error
    }

    const child = await childrenService.getChildById(childId, userId);

    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Child not found'
      });
    }

    // Attach child to request
    (req as any).child = child;
    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error loading child data'
    });
  }
};