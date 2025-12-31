import { Router, Request, Response } from 'express';
import { getAIOrchestrator } from '../index';

const router = Router();

/**
 * POST /api/v1/ai/explain
 * 
 * Generate personalized explanations of why an activity is good for specific children.
 * Returns benefits breakdown, age appropriateness, and match scores.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { activity_id, child_ids } = req.body;
    const userId = (req as any).user?.id;

    if (!activity_id || typeof activity_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'activity_id is required and must be a string'
      });
    }

    // Validate child_ids if provided
    let childIdArray: string[] | undefined;
    if (child_ids) {
      if (!Array.isArray(child_ids)) {
        return res.status(400).json({
          success: false,
          error: 'child_ids must be an array of strings'
        });
      }
      childIdArray = child_ids.filter((id: any) => typeof id === 'string');
    }

    const orchestrator = getAIOrchestrator();
    const explanations = await orchestrator.explainActivity(
      activity_id,
      userId,
      childIdArray
    );

    return res.json({
      success: true,
      explanations
    });

  } catch (error: any) {
    console.error('[Explain Route] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate activity explanations'
    });
  }
});

export default router;
