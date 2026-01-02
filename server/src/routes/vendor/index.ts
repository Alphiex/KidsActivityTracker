import { Router } from 'express';
import authRouter from './auth';
import importsRouter from './imports';
import activitiesRouter from './activities';
import profileRouter from './profile';
import analyticsRouter from './analytics';
import { vendorLimiter } from '../../middleware/vendorAuth';

const router = Router();

// Apply rate limiting to all vendor routes
router.use(vendorLimiter);

// Auth routes (no vendorId required)
router.use('/auth', authRouter);

// Routes that require vendorId
router.use('/:vendorId/profile', profileRouter);
router.use('/:vendorId/imports', importsRouter);
router.use('/:vendorId/activities', activitiesRouter);
router.use('/:vendorId/analytics', analyticsRouter);

export default router;
