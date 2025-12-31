import { User, Activity, EmailNotificationLog } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../utils/emailService';
import { userPreferenceMatcherService } from './userPreferenceMatcherService';
import { activitySnapshotService, PriceDropEvent, CapacityChangeEvent } from './activitySnapshotService';

type NotificationType = 'daily_digest' | 'weekly_digest' | 'capacity_alert' | 'price_drop' | 'spots_available';

interface EmailNotificationResult {
  success: boolean;
  logId?: string;
  error?: string;
}

/**
 * Service for orchestrating email notifications to users
 */
export class NotificationService {
  private readonly baseUrl: string;
  private readonly deduplicationHours: number = 24;

  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'https://kidsactivitytracker.com';
  }

  /**
   * Generate a unique unsubscribe token for a user
   */
  async generateUnsubscribeToken(userId: string, type: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

    await prisma.unsubscribeToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt
      }
    });

    return token;
  }

  /**
   * Generate unsubscribe URL for email footer
   */
  async generateUnsubscribeUrl(userId: string, type: string): Promise<string> {
    const token = await this.generateUnsubscribeToken(userId, type);
    return `${this.baseUrl}/unsubscribe?token=${token}`;
  }

  /**
   * Check if a notification was recently sent to prevent duplicates
   */
  async hasRecentNotification(
    userId: string,
    type: NotificationType,
    activityId?: string,
    hours: number = 24
  ): Promise<boolean> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const where: any = {
      userId,
      type,
      sentAt: { gte: since },
      status: 'sent'
    };

    // For activity-specific notifications, check if this activity was included
    if (activityId) {
      where.activityIds = { has: activityId };
    }

    const existing = await prisma.emailNotificationLog.findFirst({ where });
    return !!existing;
  }

  /**
   * Log a notification attempt
   */
  private async logNotification(
    userId: string,
    email: string,
    type: NotificationType,
    activityIds: string[],
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<string> {
    const log = await prisma.emailNotificationLog.create({
      data: {
        userId,
        emailTo: email,
        type,
        activityIds,
        status,
        errorMessage
      }
    });
    return log.id;
  }

  /**
   * Send daily digest email to a user
   */
  async sendDailyDigest(userId: string): Promise<EmailNotificationResult> {
    try {
      // Check for recent digest
      if (await this.hasRecentNotification(userId, 'daily_digest')) {
        return { success: false, error: 'Daily digest already sent recently' };
      }

      // Check quiet hours
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.email) {
        return { success: false, error: 'User not found or has no email' };
      }

      if (userPreferenceMatcherService.isInQuietHours(user)) {
        return { success: false, error: 'User is in quiet hours' };
      }

      // Get matching activities from last 24 hours
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const activities = await userPreferenceMatcherService.getMatchingActivities(userId, since);

      if (activities.length === 0) {
        return { success: false, error: 'No matching activities found' };
      }

      // Generate unsubscribe URL
      const unsubscribeUrl = await this.generateUnsubscribeUrl(userId, 'daily_digest');

      // Send email
      await emailService.sendDailyDigest(user, activities, unsubscribeUrl);

      // Log the notification
      const logId = await this.logNotification(
        userId,
        user.email,
        'daily_digest',
        activities.map(a => a.id),
        'sent'
      );

      return { success: true, logId };
    } catch (error) {
      console.error(`Failed to send daily digest to user ${userId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send weekly digest email to a user
   */
  async sendWeeklyDigest(userId: string): Promise<EmailNotificationResult> {
    try {
      if (await this.hasRecentNotification(userId, 'weekly_digest', undefined, 168)) {
        return { success: false, error: 'Weekly digest already sent recently' };
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.email) {
        return { success: false, error: 'User not found or has no email' };
      }

      // Get matching activities from last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const activities = await userPreferenceMatcherService.getMatchingActivities(userId, since);

      if (activities.length === 0) {
        return { success: false, error: 'No matching activities found' };
      }

      const unsubscribeUrl = await this.generateUnsubscribeUrl(userId, 'weekly_digest');

      // Get favorites count for the summary
      const favoritesCount = await prisma.favorite.count({ where: { userId } });

      await emailService.sendWeeklyDigest(user, {
        newActivitiesCount: activities.length,
        topActivities: activities.slice(0, 10),
        favoritesCount,
        weekStart: since,
        weekEnd: new Date()
      }, unsubscribeUrl);

      const logId = await this.logNotification(
        userId,
        user.email,
        'weekly_digest',
        activities.map(a => a.id),
        'sent'
      );

      return { success: true, logId };
    } catch (error) {
      console.error(`Failed to send weekly digest to user ${userId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send capacity alert for a specific activity
   */
  async sendCapacityAlert(
    userId: string,
    activityId: string,
    spotsRemaining: number
  ): Promise<EmailNotificationResult> {
    try {
      // Check for recent notification about this activity
      if (await this.hasRecentNotification(userId, 'capacity_alert', activityId, 4)) {
        return { success: false, error: 'Capacity alert already sent recently for this activity' };
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.email) {
        return { success: false, error: 'User not found or has no email' };
      }

      if (userPreferenceMatcherService.isInQuietHours(user)) {
        return { success: false, error: 'User is in quiet hours' };
      }

      const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: { provider: true, location: true }
      });

      if (!activity) {
        return { success: false, error: 'Activity not found' };
      }

      const unsubscribeUrl = await this.generateUnsubscribeUrl(userId, 'capacity_alerts');

      await emailService.sendCapacityAlert(user, activity, spotsRemaining, unsubscribeUrl);

      const logId = await this.logNotification(
        userId,
        user.email,
        'capacity_alert',
        [activityId],
        'sent'
      );

      return { success: true, logId };
    } catch (error) {
      console.error(`Failed to send capacity alert to user ${userId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send price drop alert for a specific activity
   */
  async sendPriceDropAlert(
    userId: string,
    activityId: string,
    oldPrice: number,
    newPrice: number
  ): Promise<EmailNotificationResult> {
    try {
      if (await this.hasRecentNotification(userId, 'price_drop', activityId, 24)) {
        return { success: false, error: 'Price drop alert already sent recently for this activity' };
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.email) {
        return { success: false, error: 'User not found or has no email' };
      }

      if (!userPreferenceMatcherService.userWantsPriceDropAlerts(user)) {
        return { success: false, error: 'User has not enabled price drop alerts' };
      }

      const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: { provider: true, location: true }
      });

      if (!activity) {
        return { success: false, error: 'Activity not found' };
      }

      const unsubscribeUrl = await this.generateUnsubscribeUrl(userId, 'price_drops');

      await emailService.sendPriceDropAlert(user, activity, oldPrice, newPrice, unsubscribeUrl);

      const logId = await this.logNotification(
        userId,
        user.email,
        'price_drop',
        [activityId],
        'sent'
      );

      return { success: true, logId };
    } catch (error) {
      console.error(`Failed to send price drop alert to user ${userId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send spots available alert (for waitlist users)
   */
  async sendSpotsAvailableAlert(userId: string, activityId: string): Promise<EmailNotificationResult> {
    try {
      if (await this.hasRecentNotification(userId, 'spots_available', activityId, 24)) {
        return { success: false, error: 'Spots available alert already sent recently' };
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.email) {
        return { success: false, error: 'User not found or has no email' };
      }

      const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        include: { provider: true, location: true }
      });

      if (!activity || !activity.spotsAvailable || activity.spotsAvailable <= 0) {
        return { success: false, error: 'Activity not found or no spots available' };
      }

      const unsubscribeUrl = await this.generateUnsubscribeUrl(userId, 'all');

      await emailService.sendSpotsAvailableAlert(user, activity, unsubscribeUrl);

      // Mark waitlist entry as notified
      await prisma.waitlistEntry.updateMany({
        where: { userId, activityId },
        data: { notifiedAt: new Date() }
      });

      const logId = await this.logNotification(
        userId,
        user.email,
        'spots_available',
        [activityId],
        'sent'
      );

      return { success: true, logId };
    } catch (error) {
      console.error(`Failed to send spots available alert to user ${userId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Process capacity changes and send alerts to affected users
   */
  async processCapacityChanges(changes: CapacityChangeEvent[]): Promise<void> {
    for (const change of changes) {
      // Get users who have favorited this activity and want capacity alerts
      const users = await userPreferenceMatcherService.getUsersWithFavoriteCapacityAlerts(change.activityId);

      for (const user of users) {
        const threshold = userPreferenceMatcherService.getCapacityThreshold(user);

        // Only send if spots are at or below user's threshold
        if (change.newSpots <= threshold) {
          await this.sendCapacityAlert(user.id, change.activityId, change.newSpots);
        }
      }
    }
  }

  /**
   * Process price drops and send alerts to interested users
   */
  async processPriceDrops(drops: PriceDropEvent[]): Promise<void> {
    for (const drop of drops) {
      // Get users who have favorited this activity
      const favorites = await prisma.favorite.findMany({
        where: { activityId: drop.activityId, notifyOnChange: true },
        include: { user: true }
      });

      for (const favorite of favorites) {
        if (userPreferenceMatcherService.userWantsPriceDropAlerts(favorite.user)) {
          await this.sendPriceDropAlert(
            favorite.user.id,
            drop.activityId,
            drop.oldPrice,
            drop.newPrice
          );
        }
      }
    }
  }

  /**
   * Process waitlist and notify users when spots become available
   */
  async processWaitlistNotifications(activityId: string): Promise<void> {
    // Get all waitlist entries for this activity that haven't been notified
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        activityId,
        notifiedAt: null
      },
      include: { user: true }
    });

    for (const entry of entries) {
      await this.sendSpotsAvailableAlert(entry.userId, activityId);
    }
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<EmailNotificationLog[]> {
    return prisma.emailNotificationLog.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  /**
   * Handle unsubscribe request
   */
  async processUnsubscribe(token: string): Promise<{ success: boolean; type?: string; error?: string }> {
    const unsubToken = await prisma.unsubscribeToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!unsubToken) {
      return { success: false, error: 'Invalid token' };
    }

    if (unsubToken.usedAt) {
      return { success: false, error: 'Token already used' };
    }

    if (unsubToken.expiresAt && unsubToken.expiresAt < new Date()) {
      return { success: false, error: 'Token expired' };
    }

    // Mark token as used
    await prisma.unsubscribeToken.update({
      where: { id: unsubToken.id },
      data: { usedAt: new Date() }
    });

    // Update user preferences based on unsubscribe type
    const prefs = unsubToken.user.preferences as any || {};
    const notifications = prefs.notifications || {};

    if (unsubToken.type === 'all') {
      notifications.enabled = false;
    } else if (unsubToken.type === 'daily_digest') {
      notifications.dailyDigest = false;
    } else if (unsubToken.type === 'weekly_digest') {
      notifications.weeklyDigest = false;
    } else if (unsubToken.type === 'capacity_alerts') {
      notifications.favoriteCapacity = false;
    } else if (unsubToken.type === 'price_drops') {
      notifications.priceDrops = false;
    }

    await prisma.user.update({
      where: { id: unsubToken.userId },
      data: { preferences: { ...prefs, notifications } }
    });

    return { success: true, type: unsubToken.type };
  }
}

export const notificationService = new NotificationService();
