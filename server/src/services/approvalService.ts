import { ImportBatch, ImportApproval, ApprovalStatus, ImportStatus, Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { importService } from './importService';

// Approval queue item
export interface ApprovalQueueItem {
  batch: ImportBatch;
  vendor: {
    id: string;
    name: string;
    code: string;
  };
  uploadedBy: {
    id: string;
    email: string;
    name: string;
  };
  submittedAt: Date;
  rowCount: number;
  validRows: number;
  invalidRows: number;
}

// Approval history item
export interface ApprovalHistoryItem {
  batchId: string;
  vendorName: string;
  fileName: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  status: ApprovalStatus;
  totalRows: number;
  activitiesCreated: number;
  activitiesUpdated: number;
}

export class ApprovalService {
  /**
   * Submit an import batch for approval
   */
  async submitForApproval(batchId: string, submitterId: string, notes?: string): Promise<ImportBatch> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        vendor: true,
      },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    if (batch.status !== 'VALIDATED') {
      throw new Error('Import batch must be validated before submitting for approval');
    }

    if (batch.approvalStatus !== 'PENDING') {
      throw new Error(`Import batch has already been ${batch.approvalStatus.toLowerCase()}`);
    }

    // Check if should auto-approve
    const shouldAutoApprove = await this.shouldAutoApprove(batch);

    if (shouldAutoApprove) {
      return this.autoApprove(batchId, submitterId);
    }

    // Update batch status
    const updated = await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'PENDING_APPROVAL',
        submittedForApprovalAt: new Date(),
        submittedForApprovalBy: submitterId,
        notes: notes || batch.notes,
      },
    });

    return updated;
  }

  /**
   * Check if an import should be auto-approved based on vendor settings
   */
  async shouldAutoApprove(batch: ImportBatch & { vendor: { autoApproveUpdates: boolean; requiresApproval: boolean } }): Promise<boolean> {
    // Check vendor settings
    if (!batch.vendor.requiresApproval) {
      return true;
    }

    // Check if all activities are updates and vendor allows auto-approve updates
    if (batch.vendor.autoApproveUpdates) {
      const existingCount = await this.countExistingActivities(batch);
      if (existingCount === batch.validRows) {
        return true;
      }
    }

    return false;
  }

  /**
   * Count how many activities in batch already exist (are updates)
   */
  private async countExistingActivities(batch: ImportBatch): Promise<number> {
    const rows = await prisma.importRow.findMany({
      where: {
        importBatchId: batch.id,
        status: 'VALID',
        externalId: { not: null },
      },
      select: { externalId: true },
    });

    if (rows.length === 0) return 0;

    const vendor = await prisma.vendor.findUnique({
      where: { id: batch.vendorId },
      select: { providerId: true },
    });

    if (!vendor?.providerId) return 0;

    const existingActivities = await prisma.activity.count({
      where: {
        providerId: vendor.providerId,
        externalId: {
          in: rows.map(r => r.externalId!),
        },
      },
    });

    return existingActivities;
  }

  /**
   * Auto-approve and process an import
   */
  private async autoApprove(batchId: string, submitterId: string): Promise<ImportBatch> {
    // Create approval audit record
    await prisma.importApproval.create({
      data: {
        importBatchId: batchId,
        reviewerId: submitterId, // System/auto approver
        action: 'AUTO_APPROVED',
        reason: 'Auto-approved based on vendor settings',
      },
    });

    // Update batch status
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'APPROVED',
        approvalStatus: 'AUTO_APPROVED',
        approvedAt: new Date(),
        approvedBy: 'SYSTEM',
      },
    });

    // Process the import
    await importService.processImportBatch(batchId);

    // Return updated batch
    return prisma.importBatch.findUniqueOrThrow({
      where: { id: batchId },
    });
  }

  /**
   * Approve an import batch
   */
  async approveImport(batchId: string, reviewerId: string, notes?: string): Promise<ImportBatch> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    if (batch.status !== 'PENDING_APPROVAL' && batch.status !== 'VALIDATED') {
      throw new Error(`Cannot approve batch in status: ${batch.status}`);
    }

    if (batch.approvalStatus === 'APPROVED' || batch.approvalStatus === 'AUTO_APPROVED') {
      throw new Error('Import batch has already been approved');
    }

    // Create approval audit record
    await prisma.importApproval.create({
      data: {
        importBatchId: batchId,
        reviewerId,
        action: 'APPROVED',
        comments: notes || null,
      },
    });

    // Update batch status
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'APPROVED',
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: reviewerId,
      },
    });

    // Process the import
    await importService.processImportBatch(batchId);

    // Return updated batch
    return prisma.importBatch.findUniqueOrThrow({
      where: { id: batchId },
    });
  }

  /**
   * Reject an import batch
   */
  async rejectImport(batchId: string, reviewerId: string, reason: string): Promise<ImportBatch> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    if (batch.approvalStatus !== 'PENDING') {
      throw new Error(`Cannot reject batch with approval status: ${batch.approvalStatus}`);
    }

    // Create approval audit record
    await prisma.importApproval.create({
      data: {
        importBatchId: batchId,
        reviewerId,
        action: 'REJECTED',
        reason,
      },
    });

    // Update batch status
    const updated = await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'REJECTED',
        approvalStatus: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: reviewerId,
        rejectionReason: reason,
      },
    });

    return updated;
  }

  /**
   * Request changes to an import batch
   */
  async requestChanges(
    batchId: string,
    reviewerId: string,
    feedback: string
  ): Promise<ImportBatch> {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    if (batch.approvalStatus !== 'PENDING') {
      throw new Error(`Cannot request changes for batch with status: ${batch.approvalStatus}`);
    }

    // Create approval audit record
    await prisma.importApproval.create({
      data: {
        importBatchId: batchId,
        reviewerId,
        action: 'CHANGES_REQUESTED',
        comments: feedback,
      },
    });

    // Update batch status
    const updated = await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'CHANGES_REQUESTED',
        approvalStatus: 'CHANGES_REQUESTED',
      },
    });

    return updated;
  }

  /**
   * Get the approval queue (batches pending approval)
   */
  async getApprovalQueue(options?: {
    page?: number;
    limit?: number;
    vendorId?: string;
  }): Promise<{
    items: ApprovalQueueItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ImportBatchWhereInput = {
      status: 'PENDING_APPROVAL',
      approvalStatus: 'PENDING',
      ...(options?.vendorId && { vendorId: options.vendorId }),
    };

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
          uploadedByUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          rows: {
            select: { status: true },
          },
        },
        orderBy: { submittedForApprovalAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.importBatch.count({ where }),
    ]);

    const items: ApprovalQueueItem[] = batches.map(batch => ({
      batch: {
        ...batch,
        rows: undefined,
        vendor: undefined,
        uploadedByUser: undefined,
      } as unknown as ImportBatch,
      vendor: batch.vendor,
      uploadedBy: batch.uploadedByUser,
      submittedAt: batch.submittedForApprovalAt || batch.createdAt,
      rowCount: batch.rows.length,
      validRows: batch.rows.filter(r => r.status === 'VALID').length,
      invalidRows: batch.rows.filter(r => r.status === 'INVALID').length,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(options?: {
    page?: number;
    limit?: number;
    vendorId?: string;
    status?: ApprovalStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    items: ApprovalHistoryItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ImportBatchWhereInput = {
      approvalStatus: { not: 'PENDING' },
      ...(options?.vendorId && { vendorId: options.vendorId }),
      ...(options?.status && { approvalStatus: options.status }),
      ...(options?.startDate && {
        createdAt: { gte: options.startDate },
      }),
      ...(options?.endDate && {
        createdAt: { lte: options.endDate },
      }),
    };

    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        where,
        include: {
          vendor: {
            select: { name: true },
          },
          approvals: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.importBatch.count({ where }),
    ]);

    const items: ApprovalHistoryItem[] = batches.map(batch => {
      const lastApproval = batch.approvals[0];
      return {
        batchId: batch.id,
        vendorName: batch.vendor.name,
        fileName: batch.fileName,
        submittedAt: batch.submittedForApprovalAt || batch.createdAt,
        reviewedAt: lastApproval?.createdAt || null,
        reviewedBy: lastApproval?.reviewerId || null,
        status: batch.approvalStatus,
        totalRows: batch.totalRows,
        activitiesCreated: batch.activitiesCreated,
        activitiesUpdated: batch.activitiesUpdated,
      };
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Get approval details for a batch
   */
  async getApprovalDetails(batchId: string): Promise<{
    batch: ImportBatch;
    approvalHistory: ImportApproval[];
    vendor: { id: string; name: string; code: string };
    rows: {
      id: string;
      rowNumber: number;
      status: string;
      externalId: string | null;
      parsedData: any;
      validationErrors: any;
    }[];
  }> {
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
        approvals: {
          orderBy: { createdAt: 'desc' },
        },
        rows: {
          orderBy: { rowNumber: 'asc' },
          take: 100, // Limit for performance
        },
      },
    });

    if (!batch) {
      throw new Error('Import batch not found');
    }

    return {
      batch: {
        ...batch,
        vendor: undefined,
        approvals: undefined,
        rows: undefined,
      } as unknown as ImportBatch,
      approvalHistory: batch.approvals,
      vendor: batch.vendor,
      rows: batch.rows.map(row => ({
        id: row.id,
        rowNumber: row.rowNumber,
        status: row.status,
        externalId: row.externalId,
        parsedData: row.parsedData,
        validationErrors: row.validationErrors,
      })),
    };
  }

  /**
   * Get pending approval count for dashboard
   */
  async getPendingCount(): Promise<number> {
    return prisma.importBatch.count({
      where: {
        status: 'PENDING_APPROVAL',
        approvalStatus: 'PENDING',
      },
    });
  }

  /**
   * Get batch approval audit trail
   */
  async getApprovalAuditTrail(batchId: string): Promise<ImportApproval[]> {
    return prisma.importApproval.findMany({
      where: { importBatchId: batchId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }
}

// Export singleton instance
export const approvalService = new ApprovalService();
