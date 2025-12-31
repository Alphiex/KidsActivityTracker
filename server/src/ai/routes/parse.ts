import { Router, Request, Response } from 'express';
import { getAIOrchestrator } from '../index';

const router = Router();

/**
 * POST /api/v1/ai/parse-search
 * 
 * Parse natural language search query into structured filters.
 * Useful for detecting intent from phrases like:
 * "swimming lessons for my 5 year old on Saturdays near downtown"
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      });
    }

    if (query.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 3 characters'
      });
    }

    if (query.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Query must be less than 500 characters'
      });
    }

    const orchestrator = getAIOrchestrator();
    const result = await orchestrator.parseSearch(query);

    return res.json({
      success: true,
      parsed_filters: result.parsed_filters,
      confidence: result.confidence,
      detected_intent: result.detected_intent
    });

  } catch (error: any) {
    console.error('[Parse Route] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to parse search query'
    });
  }
});

export default router;
