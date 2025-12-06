import notifee, {
  TriggerType,
  TimestampTrigger,
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  NOTIFICATION_SETTINGS: '@kids_tracker/notification_settings',
  SCHEDULED_REMINDERS: '@kids_tracker/scheduled_reminders',
};

export interface NotificationSettings {
  enabled: boolean;
  defaultReminderMinutes: number;
  soundEnabled: boolean;
}

export interface ScheduledReminder {
  activityId: string;
  notificationId: string;
  scheduledFor: Date;
  childName: string;
  activityName: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  defaultReminderMinutes: 60,
  soundEnabled: true,
};

class NotificationService {
  private static instance: NotificationService;
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  private scheduledReminders: Map<string, ScheduledReminder> = new Map();
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Load settings from storage
      const settingsData = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (settingsData) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) };
      }

      // Load scheduled reminders
      const remindersData = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_REMINDERS);
      if (remindersData) {
        const reminders: ScheduledReminder[] = JSON.parse(remindersData);
        reminders.forEach(r => this.scheduledReminders.set(r.activityId, {
          ...r,
          scheduledFor: new Date(r.scheduledFor),
        }));
      }

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await this.createChannel();
      }

      this.initialized = true;
      console.log('[NotificationService] Initialized with', this.scheduledReminders.size, 'reminders');
    } catch (error) {
      console.error('[NotificationService] Initialization error:', error);
      this.initialized = true;
    }
  }

  private async waitForInit(): Promise<void> {
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      const authorized = settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      console.log('[NotificationService] Permission status:', authorized ? 'granted' : 'denied');
      return authorized;
    } catch (error) {
      console.error('[NotificationService] Permission request failed:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const settings = await notifee.getNotificationSettings();
      return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
    } catch (error) {
      console.error('[NotificationService] Check permissions failed:', error);
      return false;
    }
  }

  private async createChannel(): Promise<void> {
    await notifee.createChannel({
      id: 'activity-reminders',
      name: 'Activity Reminders',
      description: 'Reminders for upcoming kids activities',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
  }

  async getSettings(): Promise<NotificationSettings> {
    await this.waitForInit();
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
    await this.waitForInit();
    this.settings = { ...this.settings, ...updates };
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_SETTINGS,
      JSON.stringify(this.settings)
    );
    console.log('[NotificationService] Settings updated:', this.settings);
  }

  async scheduleActivityReminder(
    activityId: string,
    activityName: string,
    childName: string,
    scheduledDate: Date,
    startTime: string,
    minutesBefore: number = this.settings.defaultReminderMinutes
  ): Promise<string | null> {
    await this.waitForInit();

    if (!this.settings.enabled) {
      console.log('[NotificationService] Notifications disabled, skipping reminder');
      return null;
    }

    // Cancel any existing reminder for this activity
    await this.cancelReminder(activityId);

    // Parse start time and calculate reminder time
    const [hours, minutes] = startTime.split(':').map(Number);
    const activityTime = new Date(scheduledDate);
    activityTime.setHours(hours, minutes, 0, 0);

    const reminderTime = new Date(activityTime.getTime() - minutesBefore * 60000);

    // Don't schedule if reminder time is in the past
    if (reminderTime <= new Date()) {
      console.log('[NotificationService] Reminder time is in the past, skipping');
      return null;
    }

    try {
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: reminderTime.getTime(),
      };

      const notificationId = await notifee.createTriggerNotification(
        {
          id: `reminder-${activityId}`,
          title: `${childName}'s activity starting soon!`,
          body: `${activityName} starts in ${this.formatMinutes(minutesBefore)}`,
          data: {
            activityId,
            childName,
            type: 'activity-reminder',
          },
          ios: {
            sound: this.settings.soundEnabled ? 'default' : undefined,
            categoryId: 'activity-reminder',
          },
          android: {
            channelId: 'activity-reminders',
            pressAction: { id: 'default' },
            smallIcon: 'ic_notification',
          },
        },
        trigger
      );

      // Store the reminder
      const reminder: ScheduledReminder = {
        activityId,
        notificationId,
        scheduledFor: reminderTime,
        childName,
        activityName,
      };
      this.scheduledReminders.set(activityId, reminder);
      await this.saveReminders();

      console.log('[NotificationService] Scheduled reminder for', activityName, 'at', reminderTime);
      return notificationId;
    } catch (error) {
      console.error('[NotificationService] Failed to schedule reminder:', error);
      return null;
    }
  }

  async cancelReminder(activityId: string): Promise<void> {
    await this.waitForInit();

    const reminder = this.scheduledReminders.get(activityId);
    if (reminder) {
      try {
        await notifee.cancelNotification(reminder.notificationId);
        this.scheduledReminders.delete(activityId);
        await this.saveReminders();
        console.log('[NotificationService] Cancelled reminder for activity:', activityId);
      } catch (error) {
        console.error('[NotificationService] Failed to cancel reminder:', error);
      }
    }
  }

  async cancelAllReminders(): Promise<void> {
    await this.waitForInit();

    try {
      await notifee.cancelAllNotifications();
      this.scheduledReminders.clear();
      await this.saveReminders();
      console.log('[NotificationService] Cancelled all reminders');
    } catch (error) {
      console.error('[NotificationService] Failed to cancel all reminders:', error);
    }
  }

  async getScheduledReminders(): Promise<ScheduledReminder[]> {
    await this.waitForInit();
    return Array.from(this.scheduledReminders.values());
  }

  async hasReminder(activityId: string): Promise<boolean> {
    await this.waitForInit();
    return this.scheduledReminders.has(activityId);
  }

  private async saveReminders(): Promise<void> {
    const reminders = Array.from(this.scheduledReminders.values());
    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEDULED_REMINDERS,
      JSON.stringify(reminders)
    );
  }

  private formatMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
  }

  // Schedule reminders for multiple activities
  async scheduleRemindersForActivities(
    activities: Array<{
      id: string;
      name: string;
      childName: string;
      scheduledDate: Date;
      startTime: string;
    }>,
    minutesBefore?: number
  ): Promise<void> {
    await this.waitForInit();

    for (const activity of activities) {
      await this.scheduleActivityReminder(
        activity.id,
        activity.name,
        activity.childName,
        activity.scheduledDate,
        activity.startTime,
        minutesBefore
      );
    }
  }

  // Display an immediate notification (for testing)
  async displayTestNotification(): Promise<void> {
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.log('[NotificationService] Cannot display test notification - no permission');
        return;
      }
    }

    await notifee.displayNotification({
      title: 'Test Notification',
      body: 'Activity reminders are working!',
      ios: {
        sound: 'default',
      },
      android: {
        channelId: 'activity-reminders',
        pressAction: { id: 'default' },
      },
    });
  }
}

export default NotificationService.getInstance();
