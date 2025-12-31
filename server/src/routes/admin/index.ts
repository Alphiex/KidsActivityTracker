import { Router } from 'express';
import vendorsRouter from './vendors';
import importsRouter from './imports';
import geocodingRouter from './geocoding';

const router = Router();

// Mount admin route modules
router.use('/vendors', vendorsRouter);
router.use('/imports', importsRouter);
router.use('/geocoding', geocodingRouter);

// Future routes:
// router.use('/users', adminUsersRouter);

export default router;
