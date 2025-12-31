import { Router, Request, Response } from 'express';
import { getAIOrchestrator } from '../index';

const router = Router();

/**
 * POST /api/v1/ai/plan-week
 * 
 * Generate an optimal weekly activity schedule for the family.
 * Considers multiple children, time conflicts, travel distance, and activity balance.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for weekly planning'
      });
    }

    const { 
      week_start, 
      max_activities_per_child,
      avoid_back_to_back,
      max_travel_between_activities_km
    } = req.body;

    // Validate week_start
    let weekStartDate: string;
    if (week_start) {
      const parsed = new Date(week_start);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'week_start must be a valid date string'
        });
      }
      weekStartDate = parsed.toISOString().split('T')[0];
    } else {
      // Default to next Monday
      const today = new Date();
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      weekStartDate = nextMonday.toISOString().split('T')[0];
    }

    // Build constraints
    const constraints: any = {};
    if (typeof max_activities_per_child === 'number') {
      constraints.max_activities_per_child = Math.min(10, Math.max(1, max_activities_per_child));
    }
    if (typeof avoid_back_to_back === 'boolean') {
      constraints.avoid_back_to_back = avoid_back_to_back;
    }
    if (typeof max_travel_between_activities_km === 'number') {
      constraints.max_travel_between_activities_km = max_travel_between_activities_km;
    }

    const orchestrator = getAIOrchestrator();
    const schedule = await orchestrator.planWeek(weekStartDate, userId, constraints);

    if (!schedule) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate weekly schedule'
      });
    }

    return res.json({
      success: true,
      schedule
    });

  } catch (error: any) {
    console.error('[Plan Route] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate weekly schedule'
    });
  }
});

export default router;
