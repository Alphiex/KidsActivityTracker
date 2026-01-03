import { Router, Request, Response } from 'express';
import { getAIOrchestrator } from '../index';
import { verifyToken } from '../../middleware/auth';

const router = Router();

/**
 * POST /api/v1/ai/plan-week
 *
 * Generate an optimal activity schedule for a date range.
 * Supports single week or multi-week planning (e.g., summer, spring break).
 * Considers multiple children, time conflicts, travel distance, and activity balance.
 */
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for weekly planning'
      });
    }

    const {
      week_start,       // Start date (legacy name, kept for compatibility)
      end_date,         // End date for multi-week planning
      child_ids,        // Optional: specific child IDs to plan for (filters family context)
      max_activities_per_child,
      avoid_back_to_back,
      max_travel_between_activities_km,
      schedule_siblings_together,
      allow_gaps,       // Allow gaps between activities (better AI results)
      child_availability
    } = req.body;

    // Validate start date
    let startDate: string;
    if (week_start) {
      const parsed = new Date(week_start);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'week_start must be a valid date string'
        });
      }
      startDate = parsed.toISOString().split('T')[0];
    } else {
      // Default to next Monday
      const today = new Date();
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      startDate = nextMonday.toISOString().split('T')[0];
    }

    // Validate end date (optional - defaults to 1 week from start)
    let endDateStr: string | undefined;
    if (end_date) {
      const parsed = new Date(end_date);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'end_date must be a valid date string'
        });
      }
      // Ensure end is after start
      if (parsed < new Date(startDate)) {
        return res.status(400).json({
          success: false,
          error: 'end_date must be after week_start'
        });
      }
      endDateStr = parsed.toISOString().split('T')[0];
    }

    // Build constraints
    const constraints: any = {
      start_date: startDate,
      end_date: endDateStr,
    };
    // Add child_ids filter (to plan for specific children only)
    if (Array.isArray(child_ids) && child_ids.length > 0) {
      constraints.child_ids = child_ids;
    }
    if (typeof max_activities_per_child === 'number') {
      constraints.max_activities_per_child = Math.min(10, Math.max(1, max_activities_per_child));
    }
    if (typeof avoid_back_to_back === 'boolean') {
      constraints.avoid_back_to_back = avoid_back_to_back;
    }
    if (typeof max_travel_between_activities_km === 'number') {
      constraints.max_travel_between_activities_km = max_travel_between_activities_km;
    }
    if (typeof schedule_siblings_together === 'boolean') {
      constraints.schedule_siblings_together = schedule_siblings_together;
    }
    if (typeof allow_gaps === 'boolean') {
      constraints.allow_gaps = allow_gaps;
    }
    if (Array.isArray(child_availability)) {
      constraints.child_availability = child_availability;
    }

    const orchestrator = getAIOrchestrator();
    const schedule = await orchestrator.planWeek(startDate, userId, constraints);

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
