import { PrismaClient, Prisma, Activity } from '../../generated/prisma';
import { prisma as sharedPrisma } from '../lib/prisma';

// Tier configuration
const TIER_CONFIG = {
  gold: {
    monthlyLimit: null, // Unlimited
    weight: 3,
    priority: 0
  },
  silver: {
    monthlyLimit: 25000,
    weight: 2,
    priority: 1
  },
  bronze: {
    monthlyLimit: 5000,
    weight: 1,
    priority: 2
  }
};

interface SponsoredActivityWithStats {
  activity: Activity;
  tier: string;
  monthlyImpressions: number;
  weight: number;
  remainingQuota: number | null; // null = unlimited
}

interface ImpressionContext {
  userId?: string;
  sessionId?: string;
  searchQuery?: string;
  filters?: Record<string, any>;
  deviceType?: string;
}

interface SponsoredSelectionResult {
  sponsoredActivities: Activity[];
  totalMatching: number;
}

export class SponsoredActivityService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || sharedPrisma;
  }

  /**
   * Get sponsored activities that match the given filters.
   * Returns up to maxResults activities with weighted random selection.
   *
   * @param whereClause - Prisma where clause for filtering activities
   * @param maxResults - Maximum number of sponsored activities to return (default: 3)
   * @param excludeSponsorSection - If true, this is a regular search (not sponsor section)
   */
  async selectSponsoredActivities(
    whereClause: Prisma.ActivityWhereInput,
    maxResults: number = 3,
    excludeSponsorSection: boolean = true
  ): Promise<SponsoredSelectionResult> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Find all featured activities that match the filters
    const sponsoredWhere: Prisma.ActivityWhereInput = {
      ...whereClause,
      isFeatured: true,
      // Ensure featured period is active
      OR: [
        { featuredStartDate: null, featuredEndDate: null },
        {
          featuredStartDate: { lte: now },
          featuredEndDate: { gte: now }
        },
        {
          featuredStartDate: { lte: now },
          featuredEndDate: null
        },
        {
          featuredStartDate: null,
          featuredEndDate: { gte: now }
        }
      ]
    };

    // Get all matching sponsored activities with their monthly stats
    const matchingSponsored = await this.prisma.activity.findMany({
      where: sponsoredWhere,
      include: {
        sponsoredMonthlyStats: {
          where: {
            year: currentYear,
            month: currentMonth
          }
        },
        provider: true,
        location: {
          include: {
            cityRecord: true
          }
        },
        activityType: true,
        activitySubtype: true,
        _count: {
          select: { favorites: true }
        }
      }
    });

    console.log(`[SponsoredService] Found ${matchingSponsored.length} matching sponsored activities`);

    if (matchingSponsored.length === 0) {
      return { sponsoredActivities: [], totalMatching: 0 };
    }

    // Process activities and check quotas
    const eligibleActivities: SponsoredActivityWithStats[] = [];

    for (const activity of matchingSponsored) {
      const tier = (activity.featuredTier?.toLowerCase() || 'bronze') as keyof typeof TIER_CONFIG;
      const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;

      // Get current month impressions
      const monthlyStats = activity.sponsoredMonthlyStats[0];
      const monthlyImpressions = monthlyStats?.topResultCount || 0;

      // Check if quota is exceeded (skip if limit reached)
      if (config.monthlyLimit !== null && monthlyImpressions >= config.monthlyLimit) {
        console.log(`[SponsoredService] Activity ${activity.id} (${tier}) exceeded monthly limit: ${monthlyImpressions}/${config.monthlyLimit}`);
        continue;
      }

      // Calculate remaining quota
      const remainingQuota = config.monthlyLimit === null
        ? null
        : config.monthlyLimit - monthlyImpressions;

      eligibleActivities.push({
        activity: activity as Activity,
        tier,
        monthlyImpressions,
        weight: config.weight,
        remainingQuota
      });
    }

    console.log(`[SponsoredService] ${eligibleActivities.length} activities eligible after quota check`);

    if (eligibleActivities.length === 0) {
      return { sponsoredActivities: [], totalMatching: matchingSponsored.length };
    }

    // Weighted random selection
    const selected = this.weightedRandomSelection(eligibleActivities, maxResults);

    console.log(`[SponsoredService] Selected ${selected.length} activities:`,
      selected.map(s => `${s.activity.name} (${s.tier})`));

    return {
      sponsoredActivities: selected.map(s => s.activity),
      totalMatching: matchingSponsored.length
    };
  }

  /**
   * Weighted random selection algorithm.
   * Higher tier activities have higher weight but all tiers have a chance.
   */
  private weightedRandomSelection(
    activities: SponsoredActivityWithStats[],
    maxResults: number
  ): SponsoredActivityWithStats[] {
    if (activities.length <= maxResults) {
      // If we have fewer than max, return all sorted by tier
      return activities.sort((a, b) => {
        const priorityA = TIER_CONFIG[a.tier as keyof typeof TIER_CONFIG]?.priority ?? 99;
        const priorityB = TIER_CONFIG[b.tier as keyof typeof TIER_CONFIG]?.priority ?? 99;
        return priorityA - priorityB;
      });
    }

    const selected: SponsoredActivityWithStats[] = [];
    const remaining = [...activities];

    for (let i = 0; i < maxResults && remaining.length > 0; i++) {
      // Calculate total weight
      const totalWeight = remaining.reduce((sum, a) => sum + a.weight, 0);

      // Random selection based on weight
      let random = Math.random() * totalWeight;
      let selectedIndex = 0;

      for (let j = 0; j < remaining.length; j++) {
        random -= remaining[j].weight;
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }

      // Move selected activity from remaining to selected
      selected.push(remaining[selectedIndex]);
      remaining.splice(selectedIndex, 1);
    }

    // Sort selected by tier priority for display
    return selected.sort((a, b) => {
      const priorityA = TIER_CONFIG[a.tier as keyof typeof TIER_CONFIG]?.priority ?? 99;
      const priorityB = TIER_CONFIG[b.tier as keyof typeof TIER_CONFIG]?.priority ?? 99;
      return priorityA - priorityB;
    });
  }

  /**
   * Record impressions for sponsored activities.
   * This should be called when activities are returned in API response.
   */
  async recordImpressions(
    activityIds: string[],
    impressionType: 'top_result' | 'sponsor_section',
    context: ImpressionContext
  ): Promise<void> {
    if (activityIds.length === 0) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Create impression records
    const impressionData = activityIds.map((activityId, index) => ({
      activityId,
      impressionType,
      position: index + 1,
      userId: context.userId || null,
      sessionId: context.sessionId || null,
      searchQuery: context.searchQuery || null,
      filters: context.filters || null,
      deviceType: context.deviceType || null
    }));

    // Batch insert impressions
    await this.prisma.sponsoredImpression.createMany({
      data: impressionData
    });

    // Update monthly stats (upsert for each activity)
    for (const activityId of activityIds) {
      await this.prisma.sponsoredMonthlyStats.upsert({
        where: {
          activityId_year_month: {
            activityId,
            year: currentYear,
            month: currentMonth
          }
        },
        create: {
          activityId,
          year: currentYear,
          month: currentMonth,
          topResultCount: impressionType === 'top_result' ? 1 : 0,
          sponsorSectionCount: impressionType === 'sponsor_section' ? 1 : 0,
          totalImpressions: 1,
          uniqueUsers: context.userId || context.sessionId ? 1 : 0
        },
        update: {
          topResultCount: impressionType === 'top_result'
            ? { increment: 1 }
            : undefined,
          sponsorSectionCount: impressionType === 'sponsor_section'
            ? { increment: 1 }
            : undefined,
          totalImpressions: { increment: 1 }
          // Note: uniqueUsers tracking requires more complex logic
        }
      });
    }

    console.log(`[SponsoredService] Recorded ${activityIds.length} ${impressionType} impressions`);
  }

  /**
   * Get analytics for a sponsored activity.
   */
  async getActivityAnalytics(activityId: string, months: number = 6) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Get monthly stats
    const monthlyStats = await this.prisma.sponsoredMonthlyStats.findMany({
      where: {
        activityId,
        OR: [
          { year: { gt: startDate.getFullYear() } },
          {
            year: startDate.getFullYear(),
            month: { gte: startDate.getMonth() + 1 }
          }
        ]
      },
      orderBy: [
        { year: 'asc' },
        { month: 'asc' }
      ]
    });

    // Get activity info with tier
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        name: true,
        isFeatured: true,
        featuredTier: true,
        featuredStartDate: true,
        featuredEndDate: true
      }
    });

    if (!activity) {
      return null;
    }

    const tier = (activity.featuredTier?.toLowerCase() || 'bronze') as keyof typeof TIER_CONFIG;
    const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;

    // Current month stats
    const currentMonthStats = monthlyStats.find(
      s => s.year === now.getFullYear() && s.month === now.getMonth() + 1
    );

    const currentMonthImpressions = currentMonthStats?.totalImpressions || 0;
    const monthlyLimit = config.monthlyLimit;
    const remainingQuota = monthlyLimit === null ? null : monthlyLimit - currentMonthImpressions;

    return {
      activity: {
        id: activity.id,
        name: activity.name,
        tier: activity.featuredTier,
        featuredStartDate: activity.featuredStartDate,
        featuredEndDate: activity.featuredEndDate
      },
      currentMonth: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        impressions: currentMonthImpressions,
        topResultCount: currentMonthStats?.topResultCount || 0,
        sponsorSectionCount: currentMonthStats?.sponsorSectionCount || 0,
        monthlyLimit,
        remainingQuota,
        usagePercent: monthlyLimit ? Math.round((currentMonthImpressions / monthlyLimit) * 100) : null
      },
      history: monthlyStats.map(s => ({
        year: s.year,
        month: s.month,
        impressions: s.totalImpressions,
        topResultCount: s.topResultCount,
        sponsorSectionCount: s.sponsorSectionCount,
        uniqueUsers: s.uniqueUsers
      })),
      tierConfig: {
        tier,
        monthlyLimit: config.monthlyLimit,
        weight: config.weight
      }
    };
  }

  /**
   * Get analytics for all sponsored activities of a provider.
   */
  async getProviderSponsoredAnalytics(providerId: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get all featured activities for this provider
    const sponsoredActivities = await this.prisma.activity.findMany({
      where: {
        providerId,
        isFeatured: true
      },
      include: {
        sponsoredMonthlyStats: {
          where: {
            year: currentYear,
            month: currentMonth
          }
        }
      }
    });

    const analytics = sponsoredActivities.map(activity => {
      const tier = (activity.featuredTier?.toLowerCase() || 'bronze') as keyof typeof TIER_CONFIG;
      const config = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
      const monthlyStats = activity.sponsoredMonthlyStats[0];
      const currentImpressions = monthlyStats?.totalImpressions || 0;

      return {
        activityId: activity.id,
        activityName: activity.name,
        tier: activity.featuredTier,
        currentMonthImpressions: currentImpressions,
        topResultCount: monthlyStats?.topResultCount || 0,
        sponsorSectionCount: monthlyStats?.sponsorSectionCount || 0,
        monthlyLimit: config.monthlyLimit,
        remainingQuota: config.monthlyLimit === null ? null : config.monthlyLimit - currentImpressions,
        usagePercent: config.monthlyLimit ? Math.round((currentImpressions / config.monthlyLimit) * 100) : null,
        isActive: activity.isActive,
        featuredStartDate: activity.featuredStartDate,
        featuredEndDate: activity.featuredEndDate
      };
    });

    // Summary stats
    const totalImpressions = analytics.reduce((sum, a) => sum + a.currentMonthImpressions, 0);
    const byTier = {
      gold: analytics.filter(a => a.tier === 'gold'),
      silver: analytics.filter(a => a.tier === 'silver'),
      bronze: analytics.filter(a => a.tier === 'bronze')
    };

    return {
      providerId,
      currentMonth: { year: currentYear, month: currentMonth },
      totalActivities: sponsoredActivities.length,
      totalImpressions,
      byTier: {
        gold: {
          count: byTier.gold.length,
          impressions: byTier.gold.reduce((sum, a) => sum + a.currentMonthImpressions, 0)
        },
        silver: {
          count: byTier.silver.length,
          impressions: byTier.silver.reduce((sum, a) => sum + a.currentMonthImpressions, 0)
        },
        bronze: {
          count: byTier.bronze.length,
          impressions: byTier.bronze.reduce((sum, a) => sum + a.currentMonthImpressions, 0)
        }
      },
      activities: analytics
    };
  }
}

// Singleton instance
export const sponsoredActivityService = new SponsoredActivityService();
