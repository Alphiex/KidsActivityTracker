import RNCalendarEvents, {
  CalendarEventReadable,
  Calendar,
} from 'react-native-calendar-events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO, addHours } from 'date-fns';
import { ChildActivity } from './childrenService';

const STORAGE_KEYS = {
  SYNC_SETTINGS: '@kids_tracker/calendar_sync_settings',
  EVENT_MAPPINGS: '@kids_tracker/calendar_event_mappings',
};

export interface CalendarSyncSettings {
  enabled: boolean;
  calendarId: string | null;
  calendarName: string | null;
  autoSync: boolean;
  includeReminders: boolean;
  reminderMinutes: number;
}

export interface EventMapping {
  childActivityId: string;
  calendarEventId: string;
  lastSyncedAt: Date;
}

const DEFAULT_SETTINGS: CalendarSyncSettings = {
  enabled: false,
  calendarId: null,
  calendarName: null,
  autoSync: false,
  includeReminders: true,
  reminderMinutes: 60,
};

const CALENDAR_COLOR = '#4ECDC4';
const CALENDAR_TITLE = 'Kids Activities';

class CalendarSyncService {
  private static instance: CalendarSyncService;
  private settings: CalendarSyncSettings = DEFAULT_SETTINGS;
  private eventMappings: Map<string, EventMapping> = new Map();
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): CalendarSyncService {
    if (!CalendarSyncService.instance) {
      CalendarSyncService.instance = new CalendarSyncService();
    }
    return CalendarSyncService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Load settings
      const settingsData = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_SETTINGS);
      if (settingsData) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsData) };
      }

      // Load event mappings
      const mappingsData = await AsyncStorage.getItem(STORAGE_KEYS.EVENT_MAPPINGS);
      if (mappingsData) {
        const mappings: EventMapping[] = JSON.parse(mappingsData);
        mappings.forEach(m => this.eventMappings.set(m.childActivityId, {
          ...m,
          lastSyncedAt: new Date(m.lastSyncedAt),
        }));
      }

      this.initialized = true;
      console.log('[CalendarSyncService] Initialized with', this.eventMappings.size, 'mappings');
    } catch (error) {
      console.error('[CalendarSyncService] Initialization error:', error);
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
      const status = await RNCalendarEvents.requestPermissions();
      const authorized = status === 'authorized';
      console.log('[CalendarSyncService] Permission status:', authorized ? 'granted' : 'denied');
      return authorized;
    } catch (error) {
      console.error('[CalendarSyncService] Permission request failed:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const status = await RNCalendarEvents.checkPermissions();
      return status === 'authorized';
    } catch (error) {
      console.error('[CalendarSyncService] Check permissions failed:', error);
      return false;
    }
  }

  async getAvailableCalendars(): Promise<Calendar[]> {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) return [];
      }

      const calendars = await RNCalendarEvents.findCalendars();
      // Filter to only writable calendars
      return calendars.filter(c => c.allowsModifications);
    } catch (error) {
      console.error('[CalendarSyncService] Get calendars failed:', error);
      return [];
    }
  }

  async getOrCreateKidsCalendar(): Promise<string | null> {
    await this.waitForInit();

    try {
      // If we already have a calendar ID, verify it still exists
      if (this.settings.calendarId) {
        const calendars = await RNCalendarEvents.findCalendars();
        const exists = calendars.find(c => c.id === this.settings.calendarId);
        if (exists) return this.settings.calendarId;
      }

      // Look for existing "Kids Activities" calendar
      const calendars = await RNCalendarEvents.findCalendars();
      const existing = calendars.find(c => c.title === CALENDAR_TITLE);
      if (existing) {
        await this.updateSettings({
          calendarId: existing.id,
          calendarName: existing.title
        });
        return existing.id;
      }

      // Create new calendar (iOS only supports creating via saveEvent)
      // For now, we'll use the default calendar
      const defaultCalendar = calendars.find(c => c.isPrimary) || calendars[0];
      if (defaultCalendar) {
        await this.updateSettings({
          calendarId: defaultCalendar.id,
          calendarName: defaultCalendar.title,
        });
        return defaultCalendar.id;
      }

      return null;
    } catch (error) {
      console.error('[CalendarSyncService] Get/create calendar failed:', error);
      return null;
    }
  }

  async getSettings(): Promise<CalendarSyncSettings> {
    await this.waitForInit();
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<CalendarSyncSettings>): Promise<void> {
    await this.waitForInit();
    this.settings = { ...this.settings, ...updates };
    await AsyncStorage.setItem(
      STORAGE_KEYS.SYNC_SETTINGS,
      JSON.stringify(this.settings)
    );
    console.log('[CalendarSyncService] Settings updated');
  }

  async syncActivityToCalendar(
    activity: ChildActivity,
    childName: string
  ): Promise<string | null> {
    await this.waitForInit();

    if (!this.settings.enabled) {
      console.log('[CalendarSyncService] Sync disabled, skipping');
      return null;
    }

    const calendarId = await this.getOrCreateKidsCalendar();
    if (!calendarId) {
      console.error('[CalendarSyncService] No calendar available');
      return null;
    }

    try {
      // Build event dates
      const startDate = this.buildDateTime(activity.scheduledDate, activity.startTime);
      const endDate = this.buildDateTime(activity.scheduledDate, activity.endTime);

      // If no valid dates, skip
      if (!startDate || !endDate) {
        console.warn('[CalendarSyncService] Invalid dates for activity:', activity.id);
        return null;
      }

      // Check if we already have this event synced
      const existingMapping = this.eventMappings.get(activity.id);
      if (existingMapping) {
        // Update existing event
        await RNCalendarEvents.saveEvent(
          `${activity.activity?.name || 'Activity'} - ${childName}`,
          {
            id: existingMapping.calendarEventId,
            calendarId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            location: activity.activity?.location || '',
            notes: this.buildEventNotes(activity, childName),
            alarms: this.settings.includeReminders
              ? [{ date: -this.settings.reminderMinutes }]
              : [],
          }
        );

        // Update mapping
        existingMapping.lastSyncedAt = new Date();
        await this.saveMappings();

        console.log('[CalendarSyncService] Updated event:', existingMapping.calendarEventId);
        return existingMapping.calendarEventId;
      }

      // Create new event
      const eventId = await RNCalendarEvents.saveEvent(
        `${activity.activity?.name || 'Activity'} - ${childName}`,
        {
          calendarId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          location: activity.activity?.location || '',
          notes: this.buildEventNotes(activity, childName),
          alarms: this.settings.includeReminders
            ? [{ date: -this.settings.reminderMinutes }]
            : [],
        }
      );

      // Store mapping
      const mapping: EventMapping = {
        childActivityId: activity.id,
        calendarEventId: eventId,
        lastSyncedAt: new Date(),
      };
      this.eventMappings.set(activity.id, mapping);
      await this.saveMappings();

      console.log('[CalendarSyncService] Created event:', eventId);
      return eventId;
    } catch (error) {
      console.error('[CalendarSyncService] Sync failed:', error);
      return null;
    }
  }

  async removeFromCalendar(activityId: string): Promise<void> {
    await this.waitForInit();

    const mapping = this.eventMappings.get(activityId);
    if (!mapping) return;

    try {
      await RNCalendarEvents.removeEvent(mapping.calendarEventId);
      this.eventMappings.delete(activityId);
      await this.saveMappings();
      console.log('[CalendarSyncService] Removed event:', mapping.calendarEventId);
    } catch (error) {
      console.error('[CalendarSyncService] Remove failed:', error);
    }
  }

  async syncAllActivities(
    activities: ChildActivity[],
    childrenMap: Map<string, string>
  ): Promise<void> {
    await this.waitForInit();

    if (!this.settings.enabled) {
      console.log('[CalendarSyncService] Sync disabled');
      return;
    }

    console.log('[CalendarSyncService] Syncing', activities.length, 'activities');

    for (const activity of activities) {
      const childName = childrenMap.get(activity.childId) || 'Child';
      await this.syncActivityToCalendar(activity, childName);
    }
  }

  async getEventForActivity(activityId: string): Promise<CalendarEventReadable | null> {
    await this.waitForInit();

    const mapping = this.eventMappings.get(activityId);
    if (!mapping) return null;

    try {
      const events = await RNCalendarEvents.fetchAllEvents(
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      );
      return events.find(e => e.id === mapping.calendarEventId) || null;
    } catch (error) {
      console.error('[CalendarSyncService] Fetch event failed:', error);
      return null;
    }
  }

  async isSynced(activityId: string): Promise<boolean> {
    await this.waitForInit();
    return this.eventMappings.has(activityId);
  }

  private buildDateTime(date: Date | string | undefined, time: string | undefined): Date | null {
    if (!date) return null;

    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      if (!time) {
        return dateObj;
      }

      const [hours, minutes] = time.split(':').map(Number);
      const result = new Date(dateObj);
      result.setHours(hours, minutes, 0, 0);
      return result;
    } catch (error) {
      console.error('[CalendarSyncService] Date parsing error:', error);
      return null;
    }
  }

  private buildEventNotes(activity: ChildActivity, childName: string): string {
    const parts = [
      `Child: ${childName}`,
    ];

    if (activity.activity?.description) {
      parts.push(`Description: ${activity.activity.description}`);
    }

    if (activity.activity?.category) {
      parts.push(`Category: ${activity.activity.category}`);
    }

    if (activity.notes) {
      parts.push(`Notes: ${activity.notes}`);
    }

    parts.push('', 'Synced from Kids Activity Tracker');

    return parts.join('\n');
  }

  private async saveMappings(): Promise<void> {
    const mappings = Array.from(this.eventMappings.values());
    await AsyncStorage.setItem(
      STORAGE_KEYS.EVENT_MAPPINGS,
      JSON.stringify(mappings)
    );
  }
}

export default CalendarSyncService.getInstance();
