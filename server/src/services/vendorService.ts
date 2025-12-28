import { PrismaClient, Vendor, VendorStatus, VendorUserRole } from '../../generated/prisma';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Input types
export interface CreateVendorInput {
  code: string;
  name: string;
  email: string;
  website?: string;
  contactName?: string;
  contactPhone?: string;
  description?: string;
  requiresApproval?: boolean;
  dailyImportLimit?: number;
  monthlyImportLimit?: number;
}

export interface UpdateVendorInput {
  name?: string;
  email?: string;
  website?: string;
  contactName?: string;
  contactPhone?: string;
  description?: string;
  logoUrl?: string;
  requiresApproval?: boolean;
  autoApproveUpdates?: boolean;
  dailyImportLimit?: number;
  monthlyImportLimit?: number;
}

export interface FeaturedInput {
  defaultFeaturedTier: 'gold' | 'silver' | 'bronze' | null;
  featuredStartDate?: Date | null;
  featuredEndDate?: Date | null;
}

export interface VendorFilters {
  status?: VendorStatus;
  search?: string;
  hasFeatured?: boolean;
  limit?: number;
  offset?: number;
}

export class VendorService {
  /**
   * Create a new vendor
   */
  async createVendor(data: CreateVendorInput): Promise<Vendor> {
    // Normalize code to lowercase with hyphens
    const normalizedCode = data.code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Create the vendor
    const vendor = await prisma.vendor.create({
      data: {
        code: normalizedCode,
        name: data.name,
        email: data.email.toLowerCase(),
        website: data.website,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        description: data.description,
        requiresApproval: data.requiresApproval ?? true,
        dailyImportLimit: data.dailyImportLimit ?? 500,
        monthlyImportLimit: data.monthlyImportLimit ?? 5000,
        status: 'PENDING',
      },
    });

    return vendor;
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(id: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { id },
      include: {
        provider: true,
        vendorUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            activities: true,
            imports: true,
          },
        },
      },
    });
  }

  /**
   * Get vendor by code
   */
  async getVendorByCode(code: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { code: code.toLowerCase() },
    });
  }

  /**
   * Get vendor by email
   */
  async getVendorByEmail(email: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Get vendor by API key
   */
  async getVendorByApiKey(apiKey: string): Promise<Vendor | null> {
    // Hash the API key to compare
    const apiKeyHash = await this.hashApiKey(apiKey);

    const vendor = await prisma.vendor.findFirst({
      where: {
        apiKeyHash,
        status: 'ACTIVE',
      },
    });

    if (vendor) {
      // Update last used timestamp
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { apiKeyLastUsedAt: new Date() },
      });
    }

    return vendor;
  }

  /**
   * List vendors with filters
   */
  async listVendors(filters: VendorFilters = {}): Promise<{ vendors: Vendor[]; total: number }> {
    const { status, search, hasFeatured, limit = 50, offset = 0 } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (hasFeatured !== undefined) {
      if (hasFeatured) {
        where.defaultFeaturedTier = { not: null };
      } else {
        where.defaultFeaturedTier = null;
      }
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          _count: {
            select: {
              activities: true,
              imports: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.vendor.count({ where }),
    ]);

    return { vendors, total };
  }

  /**
   * Update vendor
   */
  async updateVendor(id: string, data: UpdateVendorInput): Promise<Vendor> {
    const updateData: any = { ...data };

    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }

    return prisma.vendor.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Verify vendor (approve application)
   */
  async verifyVendor(id: string, verifiedBy: string): Promise<Vendor> {
    // Create a Provider record for the vendor
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Create Provider for this vendor
    const provider = await prisma.provider.create({
      data: {
        name: `Vendor: ${vendor.name}`,
        website: vendor.website || '',
        platform: 'vendor-import',
        region: null,
        scraperConfig: {
          type: 'vendor-import',
          vendorId: vendor.id,
          vendorCode: vendor.code,
        },
        isActive: true,
      },
    });

    // Update vendor status and link to provider
    return prisma.vendor.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        verifiedAt: new Date(),
        verifiedBy,
        providerId: provider.id,
      },
    });
  }

  /**
   * Suspend vendor
   */
  async suspendVendor(id: string, reason?: string): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
      },
    });
  }

  /**
   * Reactivate vendor
   */
  async reactivateVendor(id: string): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Reject vendor application
   */
  async rejectVendor(id: string, reason?: string): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
    });
  }

  /**
   * Delete vendor (soft delete by setting to INACTIVE)
   */
  async deleteVendor(id: string): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
    });
  }

  /**
   * Generate API key for vendor
   */
  async generateApiKey(vendorId: string): Promise<{ apiKey: string }> {
    // Generate a secure random API key
    const apiKey = `vnd_${crypto.randomBytes(32).toString('hex')}`;

    // Hash the API key for storage
    const apiKeyHash = await this.hashApiKey(apiKey);

    // Store the hash
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        apiKeyHash,
        apiKeyLastUsedAt: null,
      },
    });

    // Return the plain API key (only time it's visible)
    return { apiKey };
  }

  /**
   * Rotate API key (invalidate old, generate new)
   */
  async rotateApiKey(vendorId: string): Promise<{ apiKey: string }> {
    return this.generateApiKey(vendorId);
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(vendorId: string): Promise<void> {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        apiKeyHash: null,
        apiKeyLastUsedAt: null,
      },
    });
  }

  /**
   * Hash API key for storage
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, 10);
  }

  /**
   * Validate API key against stored hash
   */
  async validateApiKey(apiKey: string, apiKeyHash: string): Promise<boolean> {
    return bcrypt.compare(apiKey, apiKeyHash);
  }

  /**
   * Check import rate limits
   */
  async checkImportLimits(vendorId: string): Promise<{
    allowed: boolean;
    dailyRemaining: number;
    monthlyRemaining: number;
    dailyLimit: number;
    monthlyLimit: number;
  }> {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count activities imported today
    const dailyCount = await prisma.activity.count({
      where: {
        vendorId,
        importedAt: { gte: startOfDay },
      },
    });

    // Count activities imported this month
    const monthlyCount = await prisma.activity.count({
      where: {
        vendorId,
        importedAt: { gte: startOfMonth },
      },
    });

    const dailyRemaining = Math.max(0, vendor.dailyImportLimit - dailyCount);
    const monthlyRemaining = Math.max(0, vendor.monthlyImportLimit - monthlyCount);

    return {
      allowed: dailyRemaining > 0 && monthlyRemaining > 0,
      dailyRemaining,
      monthlyRemaining,
      dailyLimit: vendor.dailyImportLimit,
      monthlyLimit: vendor.monthlyImportLimit,
    };
  }

  /**
   * Update vendor featured status
   */
  async updateFeatured(vendorId: string, data: FeaturedInput): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id: vendorId },
      data: {
        defaultFeaturedTier: data.defaultFeaturedTier,
        featuredStartDate: data.featuredStartDate,
        featuredEndDate: data.featuredEndDate,
      },
    });
  }

  /**
   * Bulk update activities with vendor's featured status
   */
  async applyFeatured(vendorId: string): Promise<number> {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || !vendor.defaultFeaturedTier) {
      return 0;
    }

    const result = await prisma.activity.updateMany({
      where: {
        vendorId,
        isActive: true,
      },
      data: {
        isFeatured: true,
        featuredTier: vendor.defaultFeaturedTier,
        featuredStartDate: vendor.featuredStartDate,
        featuredEndDate: vendor.featuredEndDate,
      },
    });

    return result.count;
  }

  /**
   * Remove featured status from all vendor activities
   */
  async removeFeatured(vendorId: string): Promise<number> {
    const result = await prisma.activity.updateMany({
      where: {
        vendorId,
      },
      data: {
        isFeatured: false,
        featuredTier: null,
        featuredStartDate: null,
        featuredEndDate: null,
      },
    });

    return result.count;
  }

  /**
   * Add user to vendor organization
   */
  async addVendorUser(
    vendorId: string,
    userId: string,
    role: VendorUserRole = 'MEMBER',
    invitedBy?: string
  ): Promise<void> {
    await prisma.vendorUser.create({
      data: {
        vendorId,
        userId,
        role,
        invitedBy,
        acceptedAt: new Date(),
      },
    });
  }

  /**
   * Remove user from vendor organization
   */
  async removeVendorUser(vendorId: string, userId: string): Promise<void> {
    await prisma.vendorUser.delete({
      where: {
        vendorId_userId: {
          vendorId,
          userId,
        },
      },
    });
  }

  /**
   * Update vendor user role
   */
  async updateVendorUserRole(
    vendorId: string,
    userId: string,
    role: VendorUserRole
  ): Promise<void> {
    await prisma.vendorUser.update({
      where: {
        vendorId_userId: {
          vendorId,
          userId,
        },
      },
      data: { role },
    });
  }

  /**
   * Get vendor for a user
   */
  async getVendorForUser(userId: string): Promise<Vendor | null> {
    const vendorUser = await prisma.vendorUser.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        vendor: true,
      },
    });

    return vendorUser?.vendor || null;
  }

  /**
   * Check if user has role in vendor
   */
  async hasVendorRole(
    vendorId: string,
    userId: string,
    minRole: VendorUserRole
  ): Promise<boolean> {
    const ROLE_HIERARCHY: Record<VendorUserRole, number> = {
      OWNER: 3,
      ADMIN: 2,
      MEMBER: 1,
    };

    const vendorUser = await prisma.vendorUser.findUnique({
      where: {
        vendorId_userId: {
          vendorId,
          userId,
        },
      },
    });

    if (!vendorUser || !vendorUser.isActive) {
      return false;
    }

    return ROLE_HIERARCHY[vendorUser.role] >= ROLE_HIERARCHY[minRole];
  }

  /**
   * Get vendor statistics
   */
  async getVendorStats(vendorId: string): Promise<{
    totalActivities: number;
    activeActivities: number;
    totalImports: number;
    successfulImports: number;
    failedImports: number;
    lastImportAt: Date | null;
  }> {
    const [
      totalActivities,
      activeActivities,
      importStats,
      lastImport,
    ] = await Promise.all([
      prisma.activity.count({ where: { vendorId } }),
      prisma.activity.count({ where: { vendorId, isActive: true } }),
      prisma.importBatch.groupBy({
        by: ['status'],
        where: { vendorId },
        _count: { _all: true },
      }),
      prisma.importBatch.findFirst({
        where: { vendorId },
        orderBy: { uploadedAt: 'desc' },
        select: { uploadedAt: true },
      }),
    ]);

    const successfulImports = importStats.find(s => s.status === 'COMPLETED')?._count._all || 0;
    const failedImports = importStats.find(s => s.status === 'FAILED')?._count._all || 0;
    const totalImports = importStats.reduce((sum, s) => sum + s._count._all, 0);

    return {
      totalActivities,
      activeActivities,
      totalImports,
      successfulImports,
      failedImports,
      lastImportAt: lastImport?.uploadedAt || null,
    };
  }
}

// Export singleton instance
export const vendorService = new VendorService();
