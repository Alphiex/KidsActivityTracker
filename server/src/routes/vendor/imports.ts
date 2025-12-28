import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireVendorAuth, requireVendorRole, vendorUploadLimiter } from '../../middleware/vendorAuth';
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
 * /api/vendor/{vendorId}/imports:
 *   get:
 *     summary: List import batches for vendor
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/', requireVendorAuth(), async (req: Request, res: Response) => {
  try {
    const { page, limit, status } = req.query;

    const result = await importService.getImportBatches({
      vendorId: req.vendor!.id,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
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
 * /api/vendor/{vendorId}/imports/upload:
 *   post:
 *     summary: Upload import file
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/upload',
  requireVendorAuth('ADMIN'),
  vendorUploadLimiter,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { fieldMapping } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
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
        req.vendor!.id,
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
 * /api/vendor/{vendorId}/imports/{id}:
 *   get:
 *     summary: Get import batch details
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requireVendorAuth(), async (req: Request, res: Response) => {
  try {
    const result = await importService.getImportBatchStatus(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Import batch not found',
      });
    }

    // Verify batch belongs to this vendor
    if (result.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
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
 * /api/vendor/{vendorId}/imports/{id}/validate:
 *   post:
 *     summary: Validate import batch
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/validate', requireVendorAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { fieldMapping } = req.body;

    if (!fieldMapping) {
      return res.status(400).json({
        success: false,
        error: 'Field mapping is required',
      });
    }

    // Verify batch belongs to this vendor
    const batch = await importService.getImportBatchStatus(req.params.id);
    if (!batch || batch.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
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
});

/**
 * @swagger
 * /api/vendor/{vendorId}/imports/{id}/submit:
 *   post:
 *     summary: Submit import batch for approval
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/submit', requireVendorAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;

    // Verify batch belongs to this vendor
    const batchStatus = await importService.getImportBatchStatus(req.params.id);
    if (!batchStatus || batchStatus.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

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
});

/**
 * @swagger
 * /api/vendor/{vendorId}/imports/{id}/cancel:
 *   post:
 *     summary: Cancel import batch
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/cancel', requireVendorAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    // Verify batch belongs to this vendor
    const batchStatus = await importService.getImportBatchStatus(req.params.id);
    if (!batchStatus || batchStatus.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    await importService.cancelImportBatch(req.params.id);

    res.json({
      success: true,
      message: 'Import cancelled',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/vendor/{vendorId}/imports/{id}/rows:
 *   get:
 *     summary: Get import rows
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/rows', requireVendorAuth(), async (req: Request, res: Response) => {
  try {
    const { page, limit, status } = req.query;

    // Verify batch belongs to this vendor
    const batchStatus = await importService.getImportBatchStatus(req.params.id);
    if (!batchStatus || batchStatus.vendorId !== req.vendor!.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

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
 * /api/vendor/{vendorId}/imports/preview-file:
 *   post:
 *     summary: Preview file and get suggested mappings
 *     tags: [Vendor - Imports]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/preview-file',
  requireVendorAuth('ADMIN'),
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
