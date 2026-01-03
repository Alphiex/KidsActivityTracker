import { Router } from 'express';
import recommendationsRouter from './recommendations';
import parseRouter from './parse';
import explainRouter from './explain';
import planRouter from './plan';
import chatRouter from './chat';

const router = Router();

/**
 * AI Routes
 *
 * Endpoints:
 * - POST /api/v1/ai/recommendations - Get AI-powered recommendations
 * - POST /api/v1/ai/parse-search - Parse NL to structured filters
 * - POST /api/v1/ai/explain - Get activity explanations for children
 * - POST /api/v1/ai/plan-week - Generate weekly activity schedule
 * - POST /api/v1/ai/chat - Conversational AI assistant
 * - GET /api/v1/ai/chat/quota - Get AI usage quota
 * - GET /api/v1/ai/health - Health check
 * - GET /api/v1/ai/metrics - Usage metrics
 *
 * Future endpoints:
 * - POST /api/v1/ai/enhance-listing - Provider enhancer (E)
 * - GET /api/v1/ai/provider/:id/review-summary - Review summaries (F)
 */

router.use('/recommendations', recommendationsRouter);
router.use('/parse-search', parseRouter);
router.use('/explain', explainRouter);
router.use('/plan-week', planRouter);
router.use('/chat', chatRouter);

// Mount planRouter at root to expose /find-alternative endpoint
// This creates POST /api/v1/ai/find-alternative
router.use('/', planRouter);

// Future routes will be added here:
// router.use('/enhance', enhanceRouter);
// router.use('/reviews', reviewsRouter);

export default router;
