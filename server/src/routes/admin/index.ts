import { Router } from 'express';
import vendorsRouter from './vendors';
import importsRouter from './imports';

const router = Router();

// Mount admin route modules
router.use('/vendors', vendorsRouter);
router.use('/imports', importsRouter);

// Future routes:
// router.use('/users', adminUsersRouter);

export default router;
