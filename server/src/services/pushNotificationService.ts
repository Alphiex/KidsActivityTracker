/**
 * PushNotificationService
 * Sends push notifications via Firebase Cloud Messaging (FCM)
 * Note: Activity notifications (spots, capacity, price drop) are paywalled for premium users only
 */

import { prisma } from '../lib/prisma';
import { Activity, User } from '../../generated/prisma';
import { initializeFirebase, getFirebaseMessaging, admin } from '../config/firebase';
import { subscriptionService } from './subscriptionService';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface SendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

class PushNotificationService {
  private static instance: PushNotificationService;

  private constructor() {
    initializeFirebase();
  }

  /**
   * Filter user IDs to only include premium subscribers
   * Activity notifications (spots, capacity, price drop) are paywalled
   */
  private async filterPremiumUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];

    const premiumUserIds: string[] = [];
    for (const userId of userIds) {
      const isPremium = await subscriptionService.isPremiumUser(userId);
      if (isPremium) {
        premiumUserIds.push(userId);
      }
    }

    if (premiumUserIds.length < userIds.length) {
      console.log(`[FCM] Filtered ${userIds.length - premiumUserIds.length} non-premium users from notification`);
    }

    return premiumUserIds;
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Send push notification to a specific user (all their devices)
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<SendResult> {
    if (!initializeFirebase()) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Get all active push tokens for the user
    const tokens = await prisma.devicePushToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });

    if (tokens.length === 0) {
      console.log(`[FCM] No active push tokens for user ${userId}`);
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const tokenStrings = tokens.map((t) => t.token);
    return this.sendToTokens(tokenStrings, payload);
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: PushNotificationPayload): Promise<SendResult> {
    if (!initializeFirebase()) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Get all active push tokens for the users
    const tokens = await prisma.devicePushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true },
    });

    if (tokens.length === 0) {
      console.log('[FCM] No active push tokens for specified users');
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const tokenStrings = tokens.map((t) => t.token);
    return this.sendToTokens(tokenStrings, payload);
  }

  /**
   * Send push notification to specific FCM tokens
   */
  async sendToTokens(tokens: string[], payload: PushNotificationPayload): Promise<SendResult> {
    if (!initializeFirebase()) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    console.log(`[FCM] Sending notification to ${tokens.length} tokens`);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        notification: {
          channelId: 'activity-alerts',
          priority: 'high' as const,
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(`[FCM] Sent: ${response.successCount} success, ${response.failureCount} failed`);

      // Collect invalid tokens for cleanup
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          // These error codes indicate the token is no longer valid
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
          console.log(`[FCM] Token ${idx} failed:`, resp.error?.message);
        }
      });

      // Mark invalid tokens as inactive
      if (invalidTokens.length > 0) {
        await this.deactivateInvalidTokens(invalidTokens);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error) {
      console.error('[FCM] Error sending notifications:', error);
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }

  /**
   * Mark invalid tokens as inactive
   */
  private async deactivateInvalidTokens(tokens: string[]): Promise<void> {
    try {
      await prisma.devicePushToken.updateMany({
        where: { token: { in: tokens } },
        data: { isActive: false },
      });
      console.log(`[FCM] Deactivated ${tokens.length} invalid tokens`);
    } catch (error) {
      console.error('[FCM] Error deactivating tokens:', error);
    }
  }

  /**
   * Send "spots available" notification to waitlist users for an activity
   * Note: Only premium users receive these notifications (paywalled)
   */
  async sendSpotsAvailableNotification(
    activityId: string,
    activity: Activity
  ): Promise<SendResult> {
    // Get all waitlist entries for this activity that haven't been notified
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        activityId,
        notifiedAt: null,
      },
      include: { user: true },
    });

    if (entries.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Filter to only premium users (notifications are paywalled)
    const allUserIds = entries.map((e) => e.userId);
    const userIds = await this.filterPremiumUsers(allUserIds);

    if (userIds.length === 0) {
      console.log('[FCM] No premium users on waitlist to notify');
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const payload: PushNotificationPayload = {
      title: 'Spot Available!',
      body: `A spot opened up in ${activity.name}. Register now before it fills up!`,
      data: {
        type: 'spots_available',
        activityId: activity.id,
        activityName: activity.name,
        screen: 'ActivityDetail',
      },
    };

    const result = await this.sendToUsers(userIds, payload);

    // Mark waitlist entries as notified (for push)
    // Note: Email notification has its own tracking via notifiedAt in sendSpotsAvailableAlert
    console.log(
      `[FCM] Spots available notification sent: ${result.successCount} success, ${result.failureCount} failed`
    );

    return result;
  }

  /**
   * Send capacity alert notification to users who favorited an activity
   * Note: Only premium users receive these notifications (paywalled)
   */
  async sendCapacityAlertNotification(
    activityId: string,
    activity: Activity,
    spotsRemaining: number
  ): Promise<SendResult> {
    // Get users who have favorited this activity with notifications enabled
    const favorites = await prisma.favorite.findMany({
      where: {
        activityId,
        notifyOnChange: true,
      },
      select: { userId: true },
    });

    if (favorites.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Filter to only premium users (notifications are paywalled)
    const allUserIds = favorites.map((f) => f.userId);
    const userIds = await this.filterPremiumUsers(allUserIds);

    if (userIds.length === 0) {
      console.log('[FCM] No premium users to notify for capacity alert');
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const payload: PushNotificationPayload = {
      title: 'Low Spots Alert!',
      body:
        spotsRemaining === 1
          ? `Only 1 spot left in ${activity.name}!`
          : `Only ${spotsRemaining} spots left in ${activity.name}!`,
      data: {
        type: 'capacity_alert',
        activityId: activity.id,
        activityName: activity.name,
        spotsRemaining: spotsRemaining.toString(),
        screen: 'ActivityDetail',
      },
    };

    return this.sendToUsers(userIds, payload);
  }

  /**
   * Send price drop notification to users who favorited an activity
   * Note: Only premium users receive these notifications (paywalled)
   */
  async sendPriceDropNotification(
    activityId: string,
    activity: Activity,
    oldPrice: number,
    newPrice: number
  ): Promise<SendResult> {
    // Get users who have favorited this activity with notifications enabled
    const favorites = await prisma.favorite.findMany({
      where: {
        activityId,
        notifyOnChange: true,
      },
      select: { userId: true },
    });

    if (favorites.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    // Filter to only premium users (notifications are paywalled)
    const allUserIds = favorites.map((f) => f.userId);
    const userIds = await this.filterPremiumUsers(allUserIds);

    if (userIds.length === 0) {
      console.log('[FCM] No premium users to notify for price drop');
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }
    const savings = Math.round((oldPrice - newPrice) * 100) / 100;

    const payload: PushNotificationPayload = {
      title: 'Price Drop!',
      body: `${activity.name} is now $${newPrice} (was $${oldPrice}). Save $${savings}!`,
      data: {
        type: 'price_drop',
        activityId: activity.id,
        activityName: activity.name,
        oldPrice: oldPrice.toString(),
        newPrice: newPrice.toString(),
        screen: 'ActivityDetail',
      },
    };

    return this.sendToUsers(userIds, payload);
  }

  /**
   * Send invitation notification to a user
   */
  async sendInvitationNotification(
    recipientUserId: string,
    senderName: string,
    token: string
  ): Promise<SendResult> {
    const payload: PushNotificationPayload = {
      title: 'New Activity Share Invitation',
      body: `${senderName} wants to share their children's activities with you`,
      data: {
        type: 'invitation',
        token: token,
        senderName: senderName,
        screen: 'InvitationAccept',
      },
    };

    return this.sendToUser(recipientUserId, payload);
  }

  /**
   * Send invitation accepted notification to the sender
   */
  async sendInvitationAcceptedNotification(
    senderUserId: string,
    acceptorName: string
  ): Promise<SendResult> {
    const payload: PushNotificationPayload = {
      title: 'Invitation Accepted!',
      body: `${acceptorName} accepted your activity share invitation`,
      data: {
        type: 'invitation_accepted',
        acceptorName: acceptorName,
        screen: 'SharingManagement',
      },
    };

    return this.sendToUser(senderUserId, payload);
  }

  /**
   * Send a test notification to a user (for debugging)
   */
  async sendTestNotification(userId: string): Promise<SendResult> {
    const payload: PushNotificationPayload = {
      title: 'Test Notification',
      body: 'If you see this, push notifications are working!',
      data: {
        type: 'general',
        timestamp: new Date().toISOString(),
      },
    };

    return this.sendToUser(userId, payload);
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
