import { SubscriptionPlan, Subscription } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

// Default free plan limits (fallback if database lookup fails)
const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxChildren: 2,
  maxFavorites: 10,
  maxSharedUsers: 1,
  hasAdvancedFilters: false,
  hasCalendarExport: false,
  hasInstantAlerts: false,
  hasSavedSearches: false,
  savedSearchLimit: 0
};

export interface PlanLimits {
  maxChildren: number;
  maxFavorites: number;
  maxSharedUsers: number;
  hasAdvancedFilters: boolean;
  hasCalendarExport: boolean;
  hasInstantAlerts: boolean;
  hasSavedSearches: boolean;
  savedSearchLimit: number;
}

export interface UserSubscriptionInfo {
  subscription: Subscription | null;
  plan: SubscriptionPlan;
  limits: PlanLimits;
  usage: {
    childrenCount: number;
    favoritesCount: number;
    sharedUsersCount: number;
    savedSearchesCount: number;
  };
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

export interface CreateSubscriptionData {
  userId: string;
  planCode: string;
  billingCycle?: 'monthly' | 'annual';
  externalId?: string;
  externalProvider?: 'revenuecat' | 'stripe';
  trialDays?: number;
}

export class SubscriptionService {
  private readonly DEFAULT_TRIAL_DAYS = 7;

  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });
  }

  /**
   * Get a specific plan by code
   */
  async getPlanByCode(code: string): Promise<SubscriptionPlan | null> {
    return prisma.subscriptionPlan.findUnique({
      where: { code }
    });
  }

  /**
   * Get user's current subscription with full details
   */
  async getUserSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo> {
    // Get user's subscription with plan
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    // Get free plan as fallback
    const freePlan = await this.getPlanByCode('free');

    // Determine current plan
    const plan = subscription?.plan || freePlan;

    if (!plan) {
      throw new Error('No subscription plans configured in database');
    }

    // Get usage counts
    const [childrenCount, favoritesCount, sharedUsersCount, savedSearchesCount] = await Promise.all([
      prisma.child.count({ where: { userId, isActive: true } }),
      prisma.favorite.count({ where: { userId } }),
      prisma.activityShare.count({ where: { sharingUserId: userId, isActive: true } }),
      prisma.savedSearch.count({ where: { userId } })
    ]);

    // Calculate trial status
    const now = new Date();
    const isTrialing = subscription?.status === 'trialing' &&
      subscription.trialEndsAt !== null &&
      subscription.trialEndsAt > now;

    let trialDaysRemaining: number | null = null;
    if (isTrialing && subscription?.trialEndsAt) {
      const diffMs = subscription.trialEndsAt.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      subscription,
      plan,
      limits: this.extractLimits(plan),
      usage: {
        childrenCount,
        favoritesCount,
        sharedUsersCount,
        savedSearchesCount
      },
      isTrialing,
      trialDaysRemaining
    };
  }

  /**
   * Get just the limits for a user (faster query for limit checks)
   */
  async getUserLimits(userId: string): Promise<PlanLimits> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true }
    });

    if (subscription?.plan) {
      return this.extractLimits(subscription.plan);
    }

    // User has no subscription, use free plan limits
    const freePlan = await this.getPlanByCode('free');
    if (freePlan) {
      return this.extractLimits(freePlan);
    }

    // Fallback to hardcoded defaults
    return DEFAULT_FREE_LIMITS;
  }

  /**
   * Check if user can add more children
   */
  async canAddChild(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getUserLimits(userId);
    const currentCount = await prisma.child.count({
      where: { userId, isActive: true }
    });

    return {
      allowed: currentCount < limits.maxChildren,
      current: currentCount,
      limit: limits.maxChildren
    };
  }

  /**
   * Check if user can add more favorites
   */
  async canAddFavorite(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getUserLimits(userId);
    const currentCount = await prisma.favorite.count({ where: { userId } });

    return {
      allowed: currentCount < limits.maxFavorites,
      current: currentCount,
      limit: limits.maxFavorites
    };
  }

  /**
   * Check if user can share with more users
   */
  async canShareWithUser(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getUserLimits(userId);
    const currentCount = await prisma.activityShare.count({
      where: { sharingUserId: userId, isActive: true }
    });

    return {
      allowed: currentCount < limits.maxSharedUsers,
      current: currentCount,
      limit: limits.maxSharedUsers
    };
  }

  /**
   * Check if user can create more saved searches
   */
  async canCreateSavedSearch(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getUserLimits(userId);

    if (!limits.hasSavedSearches) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const currentCount = await prisma.savedSearch.count({ where: { userId } });

    return {
      allowed: currentCount < limits.savedSearchLimit,
      current: currentCount,
      limit: limits.savedSearchLimit
    };
  }

  /**
   * Check if user has access to a specific feature
   */
  async hasFeature(userId: string, feature: keyof PlanLimits): Promise<boolean> {
    const limits = await this.getUserLimits(userId);
    const value = limits[feature];

    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    return false;
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    const { userId, planCode, billingCycle, externalId, externalProvider, trialDays } = data;

    // Get the plan
    const plan = await this.getPlanByCode(planCode);
    if (!plan) {
      throw new Error(`Plan not found: ${planCode}`);
    }

    // Check if user already has a subscription
    const existing = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (existing) {
      throw new Error('User already has a subscription. Use updateSubscription instead.');
    }

    // Calculate trial end date
    const trialEndsAt = trialDays && trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
      : null;

    // Create subscription
    return prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: trialEndsAt ? 'trialing' : 'active',
        billingCycle: billingCycle || null,
        trialEndsAt,
        externalId,
        externalProvider
      }
    });
  }

  /**
   * Update subscription (plan change, status change)
   */
  async updateSubscription(
    userId: string,
    updates: {
      planCode?: string;
      status?: string;
      billingCycle?: string;
      currentPeriodEnd?: Date;
      externalId?: string;
    }
  ): Promise<Subscription> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      throw new Error('No subscription found for user');
    }

    const updateData: any = {};

    if (updates.planCode) {
      const plan = await this.getPlanByCode(updates.planCode);
      if (!plan) {
        throw new Error(`Plan not found: ${updates.planCode}`);
      }
      updateData.planId = plan.id;
    }

    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === 'cancelled') {
        updateData.cancelledAt = new Date();
      }
    }

    if (updates.billingCycle) {
      updateData.billingCycle = updates.billingCycle;
    }

    if (updates.currentPeriodEnd) {
      updateData.currentPeriodEnd = updates.currentPeriodEnd;
    }

    if (updates.externalId) {
      updateData.externalId = updates.externalId;
    }

    return prisma.subscription.update({
      where: { userId },
      data: updateData
    });
  }

  /**
   * Cancel a subscription (downgrade to free)
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (!subscription) {
      return; // No subscription to cancel
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date()
      }
    });
  }

  /**
   * Activate subscription (from RevenueCat webhook)
   */
  async activateFromExternal(
    userId: string,
    externalId: string,
    externalProvider: 'revenuecat' | 'stripe',
    planCode: string = 'premium',
    billingCycle: 'monthly' | 'annual' = 'monthly',
    currentPeriodEnd?: Date
  ): Promise<Subscription> {
    const plan = await this.getPlanByCode(planCode);
    if (!plan) {
      throw new Error(`Plan not found: ${planCode}`);
    }

    // Upsert subscription
    return prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        status: 'active',
        billingCycle,
        externalId,
        externalProvider,
        currentPeriodEnd,
        cancelledAt: null
      },
      create: {
        userId,
        planId: plan.id,
        status: 'active',
        billingCycle,
        externalId,
        externalProvider,
        currentPeriodEnd
      }
    });
  }

  /**
   * Deactivate subscription (from RevenueCat webhook - expiration/cancellation)
   */
  async deactivateFromExternal(userId: string): Promise<void> {
    const freePlan = await this.getPlanByCode('free');
    if (!freePlan) {
      throw new Error('Free plan not found');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { userId },
        data: {
          planId: freePlan.id,
          status: 'expired',
          billingCycle: null,
          currentPeriodEnd: null
        }
      });
    }
  }

  /**
   * Extract limits from a plan object
   */
  private extractLimits(plan: SubscriptionPlan): PlanLimits {
    return {
      maxChildren: plan.maxChildren,
      maxFavorites: plan.maxFavorites,
      maxSharedUsers: plan.maxSharedUsers,
      hasAdvancedFilters: plan.hasAdvancedFilters,
      hasCalendarExport: plan.hasCalendarExport,
      hasInstantAlerts: plan.hasInstantAlerts,
      hasSavedSearches: plan.hasSavedSearches,
      savedSearchLimit: plan.savedSearchLimit
    };
  }

  /**
   * Ensure user has a subscription record (create free if missing)
   * Call this after user registration
   */
  async ensureSubscription(userId: string): Promise<Subscription> {
    const existing = await prisma.subscription.findUnique({
      where: { userId }
    });

    if (existing) {
      return existing;
    }

    // Create free subscription
    const freePlan = await this.getPlanByCode('free');
    if (!freePlan) {
      throw new Error('Free plan not configured');
    }

    return prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: 'active',
        billingCycle: null
      }
    });
  }
}

export const subscriptionService = new SubscriptionService();
