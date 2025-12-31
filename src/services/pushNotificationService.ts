/**
 * PushNotificationService
 * Handles push notification setup, token management, and notification handling
 * Works on both iOS and Android using Firebase Cloud Messaging and Notifee
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  EventType,
  Event,
  AndroidStyle,
} from '@notifee/react-native';
import { apiClient } from './api';
import DeviceInfo from 'react-native-device-info';

// Navigation reference - will be set from RootNavigator
let navigationRef: any = null;

export interface NotificationData {
  type: 'spots_available' | 'capacity_alert' | 'price_drop' | 'general';
  activityId?: string;
  activityName?: string;
  screen?: string;
  [key: string]: any;
}

export interface PushNotification {
  title?: string;
  body?: string;
  data?: NotificationData;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private isInitialized: boolean = false;
  private currentToken: string | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Set navigation reference for handling notification taps
   */
  setNavigationRef(ref: any): void {
    navigationRef = ref;
  }

  /**
   * Initialize push notification service
   * Call this early in app lifecycle (e.g., App.tsx useEffect)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Push] Already initialized');
      return;
    }

    try {
      console.log('[Push] Initializing push notification service...');

      // Create notification channel for Android
      await this.createNotificationChannel();

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('[Push] Permission denied, skipping token registration');
        return;
      }

      // Get FCM token
      const token = await this.getFCMToken();
      if (token) {
        await this.registerToken(token);
      }

      // Set up message handlers
      this.setupMessageHandlers();

      // Set up Notifee event handlers
      this.setupNotifeeHandlers();

      this.isInitialized = true;
      console.log('[Push] Push notification service initialized');
    } catch (error) {
      console.error('[Push] Failed to initialize:', error);
    }
  }

  /**
   * Create Android notification channel
   */
  private async createNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    await notifee.createChannel({
      id: 'activity-alerts',
      name: 'Activity Alerts',
      description: 'Notifications for activity availability and updates',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    });

    await notifee.createChannel({
      id: 'general',
      name: 'General Notifications',
      description: 'General app notifications',
      importance: AndroidImportance.DEFAULT,
    });

    console.log('[Push] Android notification channels created');
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        console.log('[Push] iOS permission status:', authStatus, 'enabled:', enabled);
        return enabled;
      }

      if (Platform.OS === 'android') {
        // Android 13+ requires POST_NOTIFICATIONS permission
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          console.log('[Push] Android permission result:', granted);
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true; // Older Android versions don't need runtime permission
      }

      return false;
    } catch (error) {
      console.error('[Push] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().hasPermission();
        return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
               authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      }

      if (Platform.OS === 'android') {
        const settings = await notifee.getNotificationSettings();
        return settings.authorizationStatus >= 1; // AUTHORIZED or PROVISIONAL
      }

      return false;
    } catch (error) {
      console.error('[Push] Error checking notification status:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken(): Promise<string | null> {
    try {
      // Check if messaging is available (Firebase configured)
      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }

      const token = await messaging().getToken();
      this.currentToken = token;
      console.log('[Push] FCM Token obtained:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('[Push] Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register push token with backend
   */
  async registerToken(token: string): Promise<void> {
    try {
      const deviceId = await DeviceInfo.getUniqueId();

      await apiClient.post('/api/push-tokens', {
        token,
        platform: Platform.OS,
        deviceId,
      });

      console.log('[Push] Token registered with backend');
    } catch (error) {
      console.error('[Push] Failed to register token:', error);
      // Don't throw - token will be registered on next app launch
    }
  }

  /**
   * Unregister push token (call on logout)
   */
  async unregisterToken(): Promise<void> {
    try {
      if (this.currentToken) {
        await apiClient.delete(`/api/push-tokens/${encodeURIComponent(this.currentToken)}`);
        console.log('[Push] Token unregistered');
      }
    } catch (error) {
      console.error('[Push] Failed to unregister token:', error);
    }
  }

  /**
   * Set up Firebase message handlers
   */
  private setupMessageHandlers(): void {
    // Handle token refresh
    messaging().onTokenRefresh(async (token) => {
      console.log('[Push] Token refreshed');
      this.currentToken = token;
      await this.registerToken(token);
    });

    // Handle foreground messages - display with Notifee
    messaging().onMessage(async (remoteMessage) => {
      console.log('[Push] Foreground message received:', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    // Handle background message tap (when app is in background)
    messaging().onNotificationOpenedApp(async (remoteMessage) => {
      console.log('[Push] Notification opened app from background:', remoteMessage);
      this.handleNotificationTap(remoteMessage.data as NotificationData);
    });

    // Check if app was opened from a quit state notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[Push] App opened from quit state notification:', remoteMessage);
          // Delay navigation to ensure navigation is ready
          setTimeout(() => {
            this.handleNotificationTap(remoteMessage.data as NotificationData);
          }, 1000);
        }
      });
  }

  /**
   * Set up Notifee event handlers for foreground notification interactions
   */
  private setupNotifeeHandlers(): void {
    // Handle foreground notification events (taps, dismissals)
    notifee.onForegroundEvent(({ type, detail }: Event) => {
      switch (type) {
        case EventType.PRESS:
          console.log('[Push] Notifee notification pressed:', detail);
          if (detail.notification?.data) {
            this.handleNotificationTap(detail.notification.data as NotificationData);
          }
          break;
        case EventType.DISMISSED:
          console.log('[Push] Notification dismissed');
          break;
      }
    });
  }

  /**
   * Display a notification using Notifee (for foreground messages)
   */
  private async displayNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ): Promise<void> {
    try {
      const { notification, data } = remoteMessage;

      if (!notification) {
        console.log('[Push] No notification payload in message');
        return;
      }

      const channelId = data?.type === 'spots_available' ||
                        data?.type === 'capacity_alert'
                        ? 'activity-alerts'
                        : 'general';

      await notifee.displayNotification({
        title: notification.title || 'Kids Activity Tracker',
        body: notification.body || '',
        data: data as Record<string, string>,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          style: notification.body && notification.body.length > 40
            ? { type: AndroidStyle.BIGTEXT, text: notification.body }
            : undefined,
          smallIcon: 'ic_notification', // Make sure this icon exists in android/app/src/main/res/
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            badge: true,
            sound: true,
            banner: true,
            list: true,
          },
        },
      });

      console.log('[Push] Notification displayed');
    } catch (error) {
      console.error('[Push] Error displaying notification:', error);
    }
  }

  /**
   * Handle notification tap - navigate to appropriate screen
   */
  private handleNotificationTap(data: NotificationData | undefined): void {
    if (!data || !navigationRef) {
      console.log('[Push] No data or navigation ref available');
      return;
    }

    console.log('[Push] Handling notification tap:', data);

    switch (data.type) {
      case 'spots_available':
        if (data.activityId) {
          // Navigate to activity detail
          navigationRef.navigate('ActivityDetail', { activityId: data.activityId });
        } else {
          // Navigate to waiting list screen
          navigationRef.navigate('WaitingList');
        }
        break;

      case 'capacity_alert':
      case 'price_drop':
        if (data.activityId) {
          navigationRef.navigate('ActivityDetail', { activityId: data.activityId });
        }
        break;

      default:
        // Navigate to specified screen or default to waiting list
        if (data.screen) {
          navigationRef.navigate(data.screen);
        } else {
          navigationRef.navigate('WaitingList');
        }
    }
  }

  /**
   * Display a local notification (for testing or local alerts)
   */
  async displayLocalNotification(
    title: string,
    body: string,
    data?: NotificationData
  ): Promise<void> {
    try {
      await notifee.displayNotification({
        title,
        body,
        data: data as Record<string, string>,
        android: {
          channelId: 'general',
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
        },
      });
    } catch (error) {
      console.error('[Push] Error displaying local notification:', error);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    await notifee.cancelAllNotifications();
  }

  /**
   * Get badge count (iOS only)
   */
  async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'ios') {
      return await notifee.getBadgeCount();
    }
    return 0;
  }

  /**
   * Set badge count (iOS only)
   */
  async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      await notifee.setBadgeCount(count);
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// Background message handler - must be registered outside of component
// This should be called in index.js
export const registerBackgroundHandler = (): void => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[Push] Background message received:', remoteMessage);
    // Background messages are automatically displayed by FCM
    // We can do additional processing here if needed
  });
};
