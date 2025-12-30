import { ImportBatch, ImportRow, ImportStatus, ImportRowStatus, ApprovalStatus, Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { fileParserService, RawRow } from './fileParserService';
import { activityImportMapper, FieldMapping, NormalizedActivity, RowValidationResult, FieldValidationError } from './activityImportMapper';
import { vendorService } from './vendorService';

// File interface for multer uploads
interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// Result types
export interface ValidationResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    rowNumber: number;
    errors: Array<{ field: string; message: string }>;
  }>;
  warnings: Array<{
    rowNumber: number;
    warnings: Array<{ field: string; message: string }>;
  }>;
}

export interface ProcessingResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{
    rowNumber: number;
    externalId: string;
    error: string;
  }>;
}

export interface ImportBatchWithDetails extends ImportBatch {
  vendor?: {
    id: string;
    name: string;
    code: string;
  };
  rowSummary?: {
    pending: number;
    valid: number;
    invalid: number;
    created: number;
    updated: number;
    failed: number;
  };
}

export class ImportService {
  /**
   * Create a new import batch from uploaded file
   */
  async createImportBatch(
    vendorId: string,
    file: UploadedFile,
    uploadedBy: string,
    fieldMapping?: FieldMapping
  ): Promise<ImportBatch> {
    // Validate file type
    const fileType = fileParserService.validateFileType(
      file.originalname,
      file.mimetype
    );

    if (!fileType) {
      throw new Error('Invalid file type. Only CSV and XLSX files are supported.');
    }

    // Get vendor to check approval settings
    const vendor = await vendorService.getVendorById(vendorId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Check rate limits
    const limits = await vendorService.checkImportLimits(vendorId);
    if (!limits.allowed) {
      throw new Error(
        `Import limit reached. Daily remaining: ${limits.dailyRemaining}, Monthly remaining: ${limits.monthlyRemaining}`
      );
    }

    // Parse the file
    const rows = fileParserService.parseFile(file.buffer, fileType);

    if (rows.length === 0) {
      throw new Error('File contains no data rows');
    }

    if (rows.length > 1000) {
      throw new Error('File exceeds maximum of 1000 rows');
    }

    // Create import batch
    const batch = await prisma.importBatch.create({
      data: {
        vendorId,
        uploadedBy,
        fileName: file.originalname,
        fileSize: file.size,
        fileType,
        status: 'PENDING',
        totalRows: rows.length,
        requiresApproval: vendor.requiresApproval,
        approvalStatus: vendor.requiresApproval ? 'PENDING' : 'AUTO_APPROVED',
        fieldMappingUsed: fieldMapping || null,
      },
    });

    // Create import rows
    const importRows = rows.map((row, index) => ({
      importBatchId: batch.id,
      rowNumber: index + 1,
      rawData: row,
      status: 'PENDING' as ImportRowStatus,
    }));

    await prisma.importRow.createMany({
      data: importRows,
    });

    return batch;
  }

  /**
   * Validate an import batch
   */
  async validateImportBatch(
    batchId: string,
    fieldMapping: FieldMapping
  ): Promise<ValidationResult> {
    // Update status to validating
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'VALIDATING',
        validationStartedAt: new Date(),
        fieldMappingUsed: fieldMapping,
      },
    });

    // Get all rows
    const rows = await prisma.importRow.findMany({
      where: { importBatchId: batchId },
      orderBy: { rowNumber: 'asc' },
    });

    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    let validRows = 0;
    let invalidRows = 0;

    // Check for duplicate externalIds within the batch
    const externalIdColumn = fieldMapping.externalId;
    const externalIds = new Map<string, number[]>();

    if (externalIdColumn) {
      rows.forEach(row => {
        const rawData = row.rawData as RawRow;
        const externalId = String(rawData[externalIdColumn] || '').trim();
        if (externalId) {
          if (!externalIds.has(externalId)) {
            externalIds.set(externalId, []);
          }
          externalIds.get(externalId)!.push(row.rowNumber);
        }
      });
    }

    // Validate each row
    for (const row of rows) {
      const rawData = row.rawData as RawRow;

      // Map to normalized activity
      const activity = activityImportMapper.mapRawToActivity(rawData, fieldMapping);

      // Validate
      const validation = activityImportMapper.validateActivity(activity);

      // Check for duplicate externalId within batch
      if (externalIdColumn && activity.externalId) {
        const duplicates = externalIds.get(activity.externalId);
        if (duplicates && duplicates.length > 1) {
          validation.errors.push({
            field: 'externalId',
            value: activity.externalId,
            message: `Duplicate externalId found in rows: ${duplicates.join(', ')}`,
            severity: 'error',
          });
          validation.isValid = false;
        }
      }

      // Update row status
      const rowStatus: ImportRowStatus = validation.isValid ? 'VALID' : 'INVALID';

      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          status: rowStatus,
          parsedData: activity as unknown as Prisma.InputJsonValue,
          externalId: activity.externalId || null,
          validationErrors: validation.errors.length > 0 ? validation.errors as unknown as Prisma.InputJsonValue : null,
          validationWarnings: validation.warnings.length > 0 ? validation.warnings as unknown as Prisma.InputJsonValue : null,
        },
      });

      if (validation.isValid) {
        validRows++;
      } else {
        invalidRows++;
        errors.push({
          rowNumber: row.rowNumber,
          errors: validation.errors.map(e => ({ field: e.field, message: e.message })),
        });
      }

      if (validation.warnings.length > 0) {
        warnings.push({
          rowNumber: row.rowNumber,
          warnings: validation.warnings.map(w => ({ field: w.field, message: w.message })),
        });
      }
    }

    // Update batch status
    const batchStatus: ImportStatus = invalidRows > 0 && validRows === 0
      ? 'VALIDATION_FAILED'
      : 'VALIDATED';

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: batchStatus,
        validationCompletedAt: new Date(),
        validRows,
        invalidRows,
        errors: errors.length > 0 ? errors : null,
        warnings: warnings.length > 0 ? warnings : null,
      },
    });

    return {
      success: validRows > 0,
      totalRows: rows.length,
      validRows,
      invalidRows,
      errors,
      warnings,
    };
  }

  /**
   * Process an approved import batch
   */
  async processImportBatch(batchId: string): Promise<ProcessingResult> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    // Check if approved (or auto-approved)
    if (batch.requiresApproval && batch.approvalStatus !== 'APPROVED' && batch.approvalStatus !== 'AUTO_APPROVED') {
      throw new Error('Import batch has not been approved');
    }

    // Check status
    if (batch.status !== 'VALIDATED' && batch.status !== 'APPROVED') {
      throw new Error(`Cannot process batch with status: ${batch.status}`);
    }

    // Update status to processing
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    // Get valid rows
    const rows = await prisma.importRow.findMany({
      where: {
        importBatchId: batchId,
        status: 'VALID',
      },
      orderBy: { rowNumber: 'asc' },
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ProcessingResult['errors'] = [];

    for (const row of rows) {
      try {
        const activity = row.parsedData as unknown as NormalizedActivity;

        if (!activity || !activity.externalId) {
          skipped++;
          await prisma.importRow.update({
            where: { id: row.id },
            data: {
              status: 'SKIPPED',
              action: 'skipped',
            },
          });
          continue;
        }

        // Create or update activity
        const result = await activityImportMapper.createOrUpdateActivity(
          activity,
          batch.vendorId,
          batchId
        );

        if (result.action === 'created') {
          created++;
        } else {
          updated++;
        }

        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: result.action === 'created' ? 'CREATED' : 'UPDATED',
            activityId: result.activity.id,
            action: result.action,
          },
        });
      } catch (error: any) {
        failed++;
        errors.push({
          rowNumber: row.rowNumber,
          externalId: (row.parsedData as any)?.externalId || 'unknown',
          error: error.message,
        });

        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: 'FAILED',
            validationErrors: [{ field: 'processing', message: error.message }],
          },
        });
      }
    }

    // Update batch with results
    const finalStatus: ImportStatus = failed > 0
      ? created + updated > 0
        ? 'PARTIALLY_COMPLETED'
        : 'FAILED'
      : 'COMPLETED';

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        processingCompletedAt: new Date(),
        activitiesCreated: created,
        activitiesUpdated: updated,
        activitiesSkipped: skipped,
        activitiesFailed: failed,
      },
    });

    return {
      success: failed === 0 || created + updated > 0,
      totalProcessed: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }

  /**
   * Get import batch with details
   */
  async getImportBatchStatus(batchId: string): Promise<ImportBatchWithDetails | null> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!batch) {
      return null;
    }

    // Get row summary
    const rowCounts = await prisma.importRow.groupBy({
      by: ['status'],
      where: { importBatchId: batchId },
      _count: { _all: true },
    });

    const rowSummary = {
      pending: 0,
      valid: 0,
      invalid: 0,
      created: 0,
      updated: 0,
      failed: 0,
    };

    rowCounts.forEach(count => {
      switch (count.status) {
        case 'PENDING':
          rowSummary.pending = count._count._all;
          break;
        case 'VALID':
          rowSummary.valid = count._count._all;
          break;
        case 'INVALID':
          rowSummary.invalid = count._count._all;
          break;
        case 'CREATED':
          rowSummary.created = count._count._all;
          break;
        case 'UPDATED':
          rowSummary.updated = count._count._all;
          break;
        case 'FAILED':
          rowSummary.failed = count._count._all;
          break;
      }
    });

    return {
      ...batch,
      rowSummary,
    };
  }

  /**
   * Get import rows with pagination
   */
  async getImportRows(
    batchId: string,
    options: {
      status?: ImportRowStatus;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ rows: ImportRow[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options;

    const where: any = { importBatchId: batchId };
    if (status) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.importRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.importRow.count({ where }),
    ]);

    return { rows, total };
  }

  /**
   * Cancel an import batch
   */
  async cancelImportBatch(batchId: string): Promise<void> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    // Can only cancel pending or validated batches
    if (!['PENDING', 'VALIDATED', 'VALIDATION_FAILED', 'PENDING_APPROVAL'].includes(batch.status)) {
      throw new Error(`Cannot cancel batch with status: ${batch.status}`);
    }

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * Retry failed rows in a batch
   */
  async retryFailedRows(batchId: string): Promise<ProcessingResult> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    if (batch.status !== 'PARTIALLY_COMPLETED') {
      throw new Error(`Cannot retry batch with status: ${batch.status}`);
    }

    // Get failed rows
    const failedRows = await prisma.importRow.findMany({
      where: {
        importBatchId: batchId,
        status: 'FAILED',
      },
    });

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: ProcessingResult['errors'] = [];

    for (const row of failedRows) {
      try {
        const activity = row.parsedData as unknown as NormalizedActivity;

        if (!activity || !activity.externalId) {
          continue;
        }

        const result = await activityImportMapper.createOrUpdateActivity(
          activity,
          batch.vendorId,
          batchId
        );

        if (result.action === 'created') {
          created++;
        } else {
          updated++;
        }

        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: result.action === 'created' ? 'CREATED' : 'UPDATED',
            activityId: result.activity.id,
            action: result.action,
            validationErrors: null,
          },
        });
      } catch (error: any) {
        failed++;
        errors.push({
          rowNumber: row.rowNumber,
          externalId: (row.parsedData as any)?.externalId || 'unknown',
          error: error.message,
        });
      }
    }

    // Update batch counts
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: failed > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED',
        activitiesCreated: batch.activitiesCreated + created,
        activitiesUpdated: batch.activitiesUpdated + updated,
        activitiesFailed: failed,
      },
    });

    return {
      success: failed === 0,
      totalProcessed: failedRows.length,
      created,
      updated,
      skipped: 0,
      failed,
      errors,
    };
  }

  /**
   * List import batches with filters
   */
  async listImportBatches(options: {
    vendorId?: string;
    status?: ImportStatus;
    approvalStatus?: ApprovalStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ batches: ImportBatchWithDetails[]; total: number }> {
    const { vendorId, status, approvalStatus, limit = 50, offset = 0 } = options;

    const where: any = {};
    if (vendorId) {
      where.vendorId = vendorId;
    }
    if (status) {
      where.status = status;
    }
    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.importBatch.count({ where }),
    ]);

    return { batches, total };
  }

  /**
   * Delete import batch and associated data
   */
  async deleteImportBatch(batchId: string): Promise<void> {
    // This will cascade delete ImportRows due to the relation
    await prisma.importBatch.delete({
      where: { id: batchId },
    });
  }

  /**
   * Get import batches with pagination (page-based)
   */
  async getImportBatches(options: {
    page?: number;
    limit?: number;
    vendorId?: string;
    status?: ImportStatus;
  } = {}): Promise<{
    batches: ImportBatchWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const result = await this.listImportBatches({
      vendorId: options.vendorId,
      status: options.status,
      limit,
      offset,
    });

    return {
      batches: result.batches,
      total: result.total,
      page,
      limit,
    };
  }
}

// Export singleton instance
export const importService = new ImportService();
