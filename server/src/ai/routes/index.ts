import { Router } from 'express';
import recommendationsRouter from './recommendations';

const router = Router();

/**
 * AI Routes
 * 
 * Current endpoints:
 * - POST /api/v1/ai/recommendations - Get AI-powered recommendations
 * - GET /api/v1/ai/health - Health check
 * - GET /api/v1/ai/metrics - Usage metrics
 * 
 * Future endpoints:
 * - POST /api/v1/ai/plan-week - Weekly schedule builder (B)
 * - POST /api/v1/ai/explain - Activity explainer (C)
 * - POST /api/v1/ai/parse-search - NL to filters (D)
 * - POST /api/v1/ai/enhance-listing - Provider enhancer (E)
 * - GET /api/v1/ai/provider/:id/review-summary - Review summaries (F)
 */

router.use('/recommendations', recommendationsRouter);

// Future routes will be added here:
// router.use('/plan', plannerRouter);
// router.use('/explain', explainRouter);
// router.use('/parse', parseRouter);
// router.use('/enhance', enhanceRouter);
// router.use('/reviews', reviewsRouter);

export default router;
