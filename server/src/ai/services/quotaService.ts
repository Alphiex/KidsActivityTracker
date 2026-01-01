/**
 * AI Quota Service
 *
 * Tracks and enforces AI usage limits for free and pro users.
 */

import { PrismaClient } from '../../../generated/prisma';

// Singleton prisma instance
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export interface QuotaStatus {
  allowed: boolean;
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
  isPro: boolean;
  message?: string;
}

// Quota limits
const LIMITS = {
  free: {
    daily: 3,
    monthly: 30,
    turnsPerConversation: 1,
  },
  pro: {
    daily: 30,
    monthly: 1000,
    turnsPerConversation: 5,
  },
};

/**
 * Check if user has AI quota remaining
 */
export async function checkAIQuota(userId: string): Promise<QuotaStatus> {
  const prisma = getPrisma();

  try {
    // Get user subscription status via subscription relation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    // Check if user has active subscription (not free plan)
    const subscription = user?.subscription;
    const isPro = subscription?.status === 'active' &&
                  subscription.plan?.name !== 'free' &&
                  subscription.plan?.name !== 'Free';

    const limits = isPro ? LIMITS.pro : LIMITS.free;

    // Get today's start
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get this month's start
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Count daily usage (using AIUsageLog model with endpoint='chat')
    const dailyUsage = await prisma.aIUsageLog.count({
      where: {
        userId,
        endpoint: 'chat',
        createdAt: { gte: todayStart },
      },
    });

    // Count monthly usage
    const monthlyUsage = await prisma.aIUsageLog.count({
      where: {
        userId,
        endpoint: 'chat',
        createdAt: { gte: monthStart },
      },
    });

    const allowed = dailyUsage < limits.daily && monthlyUsage < limits.monthly;

    let message: string | undefined;
    if (!allowed) {
      if (dailyUsage >= limits.daily) {
        message = isPro
          ? 'Daily limit reached. Try again tomorrow!'
          : 'Daily limit reached. Upgrade to Pro for more searches!';
      } else {
        message = isPro
          ? 'Monthly limit reached. Contact support if you need more.'
          : 'Monthly limit reached. Upgrade to Pro for unlimited searches!';
      }
    }

    return {
      allowed,
      daily: { used: dailyUsage, limit: limits.daily },
      monthly: { used: monthlyUsage, limit: limits.monthly },
      isPro,
      message,
    };
  } catch (error) {
    console.error('[QuotaService] Error checking quota:', error);
    // Fail open - allow the request but log the error
    return {
      allowed: true,
      daily: { used: 0, limit: 3 },
      monthly: { used: 0, limit: 30 },
      isPro: false,
    };
  }
}

/**
 * Record AI usage
 */
export async function recordAIUsage(
  userId: string,
  options: {
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
    cost?: number;
    latencyMs?: number;
    success?: boolean;
    errorMessage?: string;
    metadata?: any;
  } = {}
): Promise<void> {
  const prisma = getPrisma();

  try {
    await prisma.aIUsageLog.create({
      data: {
        requestId: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        model: options.model || 'gpt-4o-mini',
        tokensIn: options.tokensIn || 0,
        tokensOut: options.tokensOut || 0,
        costUsd: options.cost || 0,
        endpoint: 'chat',
        latencyMs: options.latencyMs,
        success: options.success ?? true,
        errorMessage: options.errorMessage,
        metadata: options.metadata,
      },
    });
  } catch (error) {
    console.error('[QuotaService] Error recording usage:', error);
    // Don't throw - usage recording shouldn't break the API
  }
}

/**
 * Get user's usage statistics
 */
export async function getUsageStats(userId: string): Promise<{
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  lastQuery?: Date;
}> {
  const prisma = getPrisma();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [today, thisWeek, thisMonth, allTime, lastUsage] = await Promise.all([
    prisma.aIUsageLog.count({
      where: { userId, endpoint: 'chat', createdAt: { gte: todayStart } },
    }),
    prisma.aIUsageLog.count({
      where: { userId, endpoint: 'chat', createdAt: { gte: weekStart } },
    }),
    prisma.aIUsageLog.count({
      where: { userId, endpoint: 'chat', createdAt: { gte: monthStart } },
    }),
    prisma.aIUsageLog.count({
      where: { userId, endpoint: 'chat' },
    }),
    prisma.aIUsageLog.findFirst({
      where: { userId, endpoint: 'chat' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    today,
    thisWeek,
    thisMonth,
    allTime,
    lastQuery: lastUsage?.createdAt,
  };
}

/**
 * Get turn limit for a user
 */
export function getTurnLimit(isPro: boolean): number {
  return isPro ? LIMITS.pro.turnsPerConversation : LIMITS.free.turnsPerConversation;
}
