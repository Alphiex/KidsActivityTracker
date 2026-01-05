import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getAIOrchestrator, isAIInitialized } from '../index';
import { AIRecommendationRequest } from '../types/ai.types';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

// Disable express-rate-limit's strict proxy validation (we configure trust proxy in server.ts)
const rateLimitValidation = { trustProxy: false, xForwardedForHeader: false };

/**
 * Rate limiter for AI endpoints
 * More restrictive than regular API endpoints due to cost
 * Disabled in non-production for easier testing
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isProduction ? parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '10') : 0,
  message: {
    success: false,
    error: 'AI rate limit exceeded. Please try again in a minute.',
    retry_after_seconds: 60
  },
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  validate: rateLimitValidation,
});

/**
 * POST /api/v1/ai/recommendations
 * 
 * Get AI-powered activity recommendations based on search intent and filters.
 * 
 * Request body:
 * - search_intent: string - Natural language description of what user is looking for
 * - filters: object - Activity search filters (same as /api/v1/activities)
 * - include_explanations: boolean - Whether to include "why" reasons (default: true)
 * 
 * Response:
 * - recommendations: array of ranked activities with explanations
 * - assumptions: array of assumptions made by AI
 * - questions: array of clarifying questions (if any)
 * - _meta: object with source, model, latency info
 */
router.post('/',
  aiRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Check if AI module is initialized
      if (!isAIInitialized()) {
        return res.status(503).json({
          success: false,
          error: 'AI service is not available. Please try again later.'
        });
      }

      // Build request
      const request: AIRecommendationRequest = {
        search_intent: req.body.search_intent || '',
        filters: req.body.filters || {},
        user_id: (req as any).user?.id,
        include_explanations: req.body.include_explanations ?? true,
        // Legacy family_context for backwards compatibility
        family_context: req.body.family_context,
        // NEW: Per-child profiles for independent search
        children_profiles: req.body.children_profiles,
        filter_mode: req.body.filter_mode,
      };

      // Debug logging
      console.log('[AI Route] Received request:', {
        hasChildrenProfiles: !!req.body.children_profiles,
        childrenProfilesCount: req.body.children_profiles?.length || 0,
        childrenProfiles: req.body.children_profiles?.map((p: any) => ({
          name: p.name,
          location: p.location,
        })),
        filterMode: req.body.filter_mode,
      });

      // Validate search intent
      if (!request.search_intent && Object.keys(request.filters).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a search_intent or filters'
        });
      }

      // Get recommendations from orchestrator
      const orchestrator = getAIOrchestrator();
      const result = await orchestrator.getRecommendations(request);

      // Return success response
      res.json({
        success: true,
        ...result,
        _meta: {
          source: result.source,
          model: result.model_used,
          latency_ms: result.latency_ms,
          cached: result.source === 'cache'
        }
      });

    } catch (error: any) {
      console.error('[AI Route] Recommendation error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate recommendations. Please try again.'
      });
    }
  }
);

/**
 * GET /api/v1/ai/health
 * 
 * Health check for AI service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const initialized = isAIInitialized();
    
    if (!initialized) {
      return res.status(503).json({
        success: false,
        status: 'unavailable',
        message: 'AI service not initialized'
      });
    }

    const orchestrator = getAIOrchestrator();
    const cacheStats = await orchestrator.getCacheStats();
    const costMetrics = orchestrator.getCostMetrics();

    res.json({
      success: true,
      status: 'healthy',
      cache: cacheStats,
      cost: {
        today_requests: costMetrics.today.requests,
        today_cost_usd: costMetrics.today.cost_usd.toFixed(4)
      }
    });

  } catch (error: any) {
    console.error('[AI Route] Health check error:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/ai/metrics
 * 
 * Get AI usage metrics (admin only in production)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    if (!isAIInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'AI service not initialized'
      });
    }

    const orchestrator = getAIOrchestrator();
    const cacheStats = await orchestrator.getCacheStats();
    const costMetrics = orchestrator.getCostMetrics();

    res.json({
      success: true,
      cache: cacheStats,
      cost: costMetrics
    });

  } catch (error: any) {
    console.error('[AI Route] Metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
