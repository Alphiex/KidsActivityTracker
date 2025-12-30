/**
 * ValidationSampler.js
 *
 * Randomly samples activities across providers for validation.
 * Supports proportional sampling (more samples from larger providers)
 * and targeted sampling (specific providers/platforms).
 */

const { PrismaClient } = require('../../generated/prisma');

class ValidationSampler {
  constructor(options = {}) {
    this.prisma = options.prisma || new PrismaClient();
    this.ownsPrisma = !options.prisma;
  }

  /**
   * Sample activities proportionally across all active providers
   * @param {number} totalSamples - Total number of activities to sample
   * @param {Object} options - Sampling options
   * @returns {Promise<Array>} - Array of sampled activities with provider info
   */
  async sampleProportionally(totalSamples = 500, options = {}) {
    const {
      platform = null,        // Filter by platform (e.g., 'PerfectMind')
      providerId = null,      // Filter by specific provider
      minActivities = 10,     // Min activities for provider to be included
      excludeVendor = true,   // Exclude vendor-imported activities
      onlyWithUrl = true,     // Only sample activities with detailUrl or registrationUrl
    } = options;

    // Get provider activity counts
    const providerCounts = await this.getProviderActivityCounts({
      platform,
      providerId,
      minActivities,
      excludeVendor,
      onlyWithUrl,
    });

    if (providerCounts.length === 0) {
      console.log('No providers found matching criteria');
      return [];
    }

    // Calculate total activities across all providers
    const totalActivities = providerCounts.reduce((sum, p) => sum + p._count.id, 0);
    console.log(`Total activities across ${providerCounts.length} providers: ${totalActivities}`);

    // Calculate samples per provider (proportional)
    const samplesPerProvider = providerCounts.map(provider => {
      const proportion = provider._count.id / totalActivities;
      const samples = Math.max(1, Math.round(totalSamples * proportion));
      return {
        providerId: provider.providerId,
        providerName: provider.provider.name,
        platform: provider.provider.platform,
        activityCount: provider._count.id,
        samplesToTake: samples,
      };
    });

    // Adjust to hit exact total
    const currentTotal = samplesPerProvider.reduce((sum, p) => sum + p.samplesToTake, 0);
    if (currentTotal !== totalSamples) {
      // Add/remove from largest providers
      const sorted = [...samplesPerProvider].sort((a, b) => b.activityCount - a.activityCount);
      let diff = totalSamples - currentTotal;
      for (const p of sorted) {
        if (diff === 0) break;
        if (diff > 0) {
          p.samplesToTake++;
          diff--;
        } else if (p.samplesToTake > 1) {
          p.samplesToTake--;
          diff++;
        }
      }
    }

    console.log('\nSampling plan:');
    for (const p of samplesPerProvider) {
      console.log(`  ${p.providerName} (${p.platform}): ${p.samplesToTake} samples from ${p.activityCount} activities`);
    }

    // Sample from each provider
    const allSamples = [];
    for (const plan of samplesPerProvider) {
      const samples = await this.sampleFromProvider(
        plan.providerId,
        plan.samplesToTake,
        { excludeVendor, onlyWithUrl }
      );
      allSamples.push(...samples.map(s => ({
        ...s,
        providerName: plan.providerName,
        platform: plan.platform,
      })));
    }

    console.log(`\nTotal sampled: ${allSamples.length} activities`);
    return allSamples;
  }

  /**
   * Sample random activities from a specific provider
   */
  async sampleFromProvider(providerId, count, options = {}) {
    const { excludeVendor = true, onlyWithUrl = true } = options;

    const where = {
      providerId,
      isActive: true,
    };

    if (excludeVendor) {
      where.vendorId = null;
    }

    if (onlyWithUrl) {
      where.OR = [
        { detailUrl: { not: null } },
        { registrationUrl: { not: null } },
      ];
    }

    // Get total count for random offset
    const total = await this.prisma.activity.count({ where });
    if (total === 0) return [];

    // Generate random offsets
    const offsets = this.generateRandomOffsets(total, Math.min(count, total));

    // Fetch activities at those offsets
    const samples = [];
    for (const offset of offsets) {
      const activity = await this.prisma.activity.findFirst({
        where,
        skip: offset,
        select: {
          id: true,
          externalId: true,
          name: true,
          courseId: true,
          providerId: true,
          detailUrl: true,
          registrationUrl: true,
          dateStart: true,
          dateEnd: true,
          startTime: true,
          endTime: true,
          dayOfWeek: true,
          cost: true,
          spotsAvailable: true,
          totalSpots: true,
          registrationStatus: true,
          locationName: true,
          ageMin: true,
          ageMax: true,
          schedule: true,
          dates: true,
          category: true,
          description: true,
        },
      });
      if (activity) {
        samples.push(activity);
      }
    }

    return samples;
  }

  /**
   * Get activity counts per provider
   */
  async getProviderActivityCounts(options = {}) {
    const {
      platform = null,
      providerId = null,
      minActivities = 10,
      excludeVendor = true,
      onlyWithUrl = true,
    } = options;

    const where = {
      isActive: true,
    };

    if (excludeVendor) {
      where.vendorId = null;
    }

    if (onlyWithUrl) {
      where.OR = [
        { detailUrl: { not: null } },
        { registrationUrl: { not: null } },
      ];
    }

    const providerWhere = {
      isActive: true,
    };

    if (platform) {
      providerWhere.platform = platform;
    }

    if (providerId) {
      providerWhere.id = providerId;
    }

    const counts = await this.prisma.activity.groupBy({
      by: ['providerId'],
      where,
      _count: { id: true },
      having: {
        id: { _count: { gte: minActivities } },
      },
    });

    // Fetch provider details
    const providerIds = counts.map(c => c.providerId);
    const providers = await this.prisma.provider.findMany({
      where: {
        id: { in: providerIds },
        ...providerWhere,
      },
      select: {
        id: true,
        name: true,
        platform: true,
      },
    });

    const providerMap = new Map(providers.map(p => [p.id, p]));

    return counts
      .filter(c => providerMap.has(c.providerId))
      .map(c => ({
        ...c,
        provider: providerMap.get(c.providerId),
      }))
      .sort((a, b) => b._count.id - a._count.id);
  }

  /**
   * Generate random unique offsets
   */
  generateRandomOffsets(max, count) {
    const offsets = new Set();
    const safetyLimit = count * 10;
    let attempts = 0;

    while (offsets.size < count && attempts < safetyLimit) {
      offsets.add(Math.floor(Math.random() * max));
      attempts++;
    }

    return Array.from(offsets);
  }

  /**
   * Get previously validated activities to exclude
   */
  async getRecentlyValidatedIds(daysBack = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    const results = await this.prisma.validationResult.findMany({
      where: {
        createdAt: { gte: cutoff },
      },
      select: { activityId: true },
    });

    return new Set(results.map(r => r.activityId));
  }

  /**
   * Sample by specific course IDs (for targeted validation)
   */
  async sampleByCourseIds(courseIds, providerId = null) {
    const where = {
      courseId: { in: courseIds },
      isActive: true,
    };

    if (providerId) {
      where.providerId = providerId;
    }

    return this.prisma.activity.findMany({
      where,
      include: {
        provider: {
          select: { name: true, platform: true },
        },
      },
    });
  }

  async close() {
    if (this.ownsPrisma) {
      await this.prisma.$disconnect();
    }
  }
}

module.exports = ValidationSampler;
