import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAdmin, PERMISSIONS, requirePermission } from '../../middleware/adminAuth';
import { importService } from '../../services/importService';
import { approvalService } from '../../services/approvalService';
import { fileParserService } from '../../services/fileParserService';
import { FieldMapping } from '../../services/activityImportMapper';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const fileType = fileParserService.validateFileType(file.originalname, file.mimetype);
    if (!fileType) {
      cb(new Error('Invalid file type. Only CSV and XLSX files are supported.'));
    } else {
      cb(null, true);
    }
  },
});

/**
 * @swagger
 * /api/admin/imports:
 *   get:
 *     summary: List all import batches
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: Filter by vendor ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 */
router.get('/', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const { page, limit, vendorId, status } = req.query;

    const result = await importService.getImportBatches({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      vendorId: vendorId as string,
      status: status as any,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/queue:
 *   get:
 *     summary: Get approval queue
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/queue', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const { page, limit, vendorId } = req.query;

    const result = await approvalService.getApprovalQueue({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      vendorId: vendorId as string,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/pending-count:
 *   get:
 *     summary: Get count of pending approvals
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/pending-count', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const count = await approvalService.getPendingCount();

    res.json({
      success: true,
      count,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/history:
 *   get:
 *     summary: Get approval history
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/history', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const { page, limit, vendorId, status, startDate, endDate } = req.query;

    const result = await approvalService.getApprovalHistory({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      vendorId: vendorId as string,
      status: status as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/upload:
 *   post:
 *     summary: Upload import file for a vendor
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - vendorId
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               vendorId:
 *                 type: string
 *               fieldMapping:
 *                 type: string
 *                 description: JSON string of field mappings
 */
router.post(
  '/upload',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_CREATE),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { vendorId, fieldMapping } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      if (!vendorId) {
        return res.status(400).json({
          success: false,
          error: 'Vendor ID is required',
        });
      }

      // Parse field mapping if provided
      let mapping: FieldMapping | undefined;
      if (fieldMapping) {
        try {
          mapping = JSON.parse(fieldMapping);
        } catch {
          return res.status(400).json({
            success: false,
            error: 'Invalid field mapping JSON',
          });
        }
      }

      // Create import batch
      const batch = await importService.createImportBatch(
        vendorId,
        {
          originalname: file.originalname,
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        },
        req.user!.id,
        mapping
      );

      res.status(201).json({
        success: true,
        batch,
        message: 'File uploaded successfully. Run validation to continue.',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}:
 *   get:
 *     summary: Get import batch details
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const result = await importService.getImportBatchStatus(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Import batch not found',
      });
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/{id}/approval:
 *   get:
 *     summary: Get approval details for import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/approval', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const result = await approvalService.getApprovalDetails(req.params.id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === 'Import batch not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/{id}/audit:
 *   get:
 *     summary: Get approval audit trail
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/audit', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const trail = await approvalService.getApprovalAuditTrail(req.params.id);

    res.json({
      success: true,
      auditTrail: trail,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/{id}/validate:
 *   post:
 *     summary: Validate import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fieldMapping:
 *                 type: object
 *                 description: Field mappings
 */
router.post(
  '/:id/validate',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_VALIDATE),
  async (req: Request, res: Response) => {
    try {
      const { fieldMapping } = req.body;

      if (!fieldMapping) {
        return res.status(400).json({
          success: false,
          error: 'Field mapping is required',
        });
      }

      const result = await importService.validateImportBatch(req.params.id, fieldMapping);

      res.json({
        success: true,
        validation: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/submit:
 *   post:
 *     summary: Submit import batch for approval
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/submit',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_CREATE),
  async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;

      const batch = await approvalService.submitForApproval(
        req.params.id,
        req.user!.id,
        notes
      );

      res.json({
        success: true,
        batch,
        message: batch.approvalStatus === 'AUTO_APPROVED'
          ? 'Import was auto-approved and is being processed'
          : 'Import submitted for approval',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/approve:
 *   post:
 *     summary: Approve import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/approve',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_APPROVE),
  async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;

      // Get admin user ID
      const adminId = req.adminUser!.id;

      const batch = await approvalService.approveImport(req.params.id, adminId, notes);

      res.json({
        success: true,
        batch,
        message: 'Import approved and processing started',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/reject:
 *   post:
 *     summary: Reject import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/reject',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_APPROVE),
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
      }

      // Get admin user ID
      const adminId = req.adminUser!.id;

      const batch = await approvalService.rejectImport(req.params.id, adminId, reason);

      res.json({
        success: true,
        batch,
        message: 'Import rejected',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/request-changes:
 *   post:
 *     summary: Request changes to import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/request-changes',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_APPROVE),
  async (req: Request, res: Response) => {
    try {
      const { feedback } = req.body;

      if (!feedback) {
        return res.status(400).json({
          success: false,
          error: 'Feedback is required',
        });
      }

      const adminId = req.adminUser!.id;

      const batch = await approvalService.requestChanges(req.params.id, adminId, feedback);

      res.json({
        success: true,
        batch,
        message: 'Changes requested',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/cancel:
 *   post:
 *     summary: Cancel import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/cancel',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_DELETE),
  async (req: Request, res: Response) => {
    try {
      await importService.cancelImportBatch(req.params.id);
      const result = await importService.getImportBatchStatus(req.params.id);

      res.json({
        success: true,
        batch: result,
        message: 'Import cancelled',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/retry:
 *   post:
 *     summary: Retry failed rows in import batch
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/retry',
  requireAdmin(),
  requirePermission(PERMISSIONS.IMPORT_APPROVE),
  async (req: Request, res: Response) => {
    try {
      const result = await importService.retryFailedRows(req.params.id);

      res.json({
        success: true,
        ...result,
        message: 'Retry completed',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/imports/{id}/rows:
 *   get:
 *     summary: Get import rows
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/rows', requireAdmin(), async (req: Request, res: Response) => {
  try {
    const { page, limit, status } = req.query;

    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 50;
    const offset = (pageNum - 1) * limitNum;

    const result = await importService.getImportRows(req.params.id, {
      limit: limitNum,
      offset,
      status: status as any,
    });

    res.json({
      success: true,
      ...result,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/admin/imports/preview-file:
 *   post:
 *     summary: Preview file content and get suggested mappings
 *     tags: [Admin - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/preview-file',
  requireAdmin(),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      // Validate file type
      const fileType = fileParserService.validateFileType(file.originalname, file.mimetype);
      if (!fileType) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
        });
      }

      // Parse file
      const rows = fileParserService.parseFile(file.buffer, fileType);

      // Get file stats
      const stats = fileParserService.getFileStats(rows);

      // Suggest field mappings
      const headers = fileParserService.detectHeaders(rows);
      const suggestedMappings = fileParserService.suggestFieldMappings(headers);

      res.json({
        success: true,
        fileType,
        stats,
        headers,
        suggestedMappings,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
