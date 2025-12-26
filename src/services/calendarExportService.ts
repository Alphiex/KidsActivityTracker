/**
 * Calendar Export Service
 * Handles exporting activities to native iOS/Android calendars
 */

import RNCalendarEvents, {
  CalendarEventWritable,
  RecurrenceRule,
} from 'react-native-calendar-events';
import { Platform, Alert, Share } from 'react-native';
import { format, parseISO, addDays, addWeeks, addMonths, isValid } from 'date-fns';
import { parseTimeString, DAY_MAP } from '../utils/calendarUtils';

// Store event IDs for later deletion/update
interface ExportedEvent {
  activityId: string;
  childActivityId: string;
  nativeEventId: string;
  calendarId: string;
}

// Simple in-memory store (could be replaced with AsyncStorage for persistence)
let exportedEvents: ExportedEvent[] = [];

/**
 * Request calendar permission from the user
 */
export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const status = await RNCalendarEvents.requestPermissions();
    return status === 'authorized';
  } catch (error) {
    console.error('[CalendarExport] Permission request failed:', error);
    return false;
  }
}

/**
 * Check if calendar permission is granted
 */
export async function checkCalendarPermission(): Promise<boolean> {
  try {
    const status = await RNCalendarEvents.checkPermissions();
    return status === 'authorized';
  } catch (error) {
    console.error('[CalendarExport] Permission check failed:', error);
    return false;
  }
}

/**
 * Get available calendars on the device
 */
export async function getAvailableCalendars() {
  try {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) {
      return [];
    }
    return await RNCalendarEvents.findCalendars();
  } catch (error) {
    console.error('[CalendarExport] Failed to get calendars:', error);
    return [];
  }
}

/**
 * Get the default calendar for adding events
 */
export async function getDefaultCalendar() {
  const calendars = await getAvailableCalendars();

  // Prefer the primary calendar
  const primary = calendars.find(c => c.isPrimary);
  if (primary) return primary;

  // Fall back to first writable calendar
  const writable = calendars.find(c => c.allowsModifications !== false);
  if (writable) return writable;

  // Return first calendar
  return calendars[0] || null;
}

interface ActivityToExport {
  id: string;
  childActivityId: string;
  name: string;
  description?: string;
  location?: string;
  scheduledDate?: Date | string;
  dateStart?: Date | string;
  dateEnd?: Date | string;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string[];
  childName?: string;
}

/**
 * Create a Date object from date string and time string
 */
function createDateTime(
  dateStr: string | Date,
  timeStr: string | null | undefined
): Date {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;

  if (!isValid(date)) {
    return new Date();
  }

  if (!timeStr) {
    // Default to 9:00 AM if no time specified
    date.setHours(9, 0, 0, 0);
    return date;
  }

  const parsed = parseTimeString(timeStr);
  if (parsed) {
    date.setHours(parsed.hours, parsed.minutes, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0);
  }

  return date;
}

/**
 * Convert dayOfWeek array to RRULE BYDAY string
 */
function dayOfWeekToRRuleDays(dayOfWeek: string[]): string {
  const dayToRRule: { [key: string]: string } = {
    'sunday': 'SU',
    'monday': 'MO',
    'tuesday': 'TU',
    'wednesday': 'WE',
    'thursday': 'TH',
    'friday': 'FR',
    'saturday': 'SA',
  };

  return dayOfWeek
    .map(day => dayToRRule[day.toLowerCase()])
    .filter(Boolean)
    .join(',');
}

/**
 * Export a single activity to the native calendar
 */
export async function exportActivityToCalendar(
  activity: ActivityToExport,
  calendarId?: string
): Promise<string | null> {
  try {
    const hasPermission = await requestCalendarPermission();
    if (!hasPermission) {
      Alert.alert(
        'Calendar Permission Required',
        'Please grant calendar access in Settings to export activities.'
      );
      return null;
    }

    // Get calendar to use
    let targetCalendarId = calendarId;
    if (!targetCalendarId) {
      const defaultCalendar = await getDefaultCalendar();
      if (!defaultCalendar) {
        Alert.alert('Error', 'No calendar available on this device.');
        return null;
      }
      targetCalendarId = defaultCalendar.id;
    }

    // Determine event date and time
    const eventDate = activity.scheduledDate || activity.dateStart;
    if (!eventDate) {
      console.warn('[CalendarExport] Activity has no date:', activity.id);
      return null;
    }

    const startDate = createDateTime(eventDate, activity.startTime);
    const endDate = createDateTime(eventDate, activity.endTime);

    // Ensure end is after start (minimum 1 hour duration)
    if (endDate <= startDate) {
      endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
    }

    // Build event title
    const eventTitle = activity.name + (activity.childName ? ` (${activity.childName})` : '');

    // Build event details (without title - it's passed separately)
    const eventDetails: CalendarEventWritable = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: activity.description || '',
      location: activity.location || '',
      calendarId: targetCalendarId,
    };

    // Add recurrence if activity has dayOfWeek
    if (activity.dayOfWeek && activity.dayOfWeek.length > 0 && activity.dateEnd) {
      const endDateObj = typeof activity.dateEnd === 'string'
        ? parseISO(activity.dateEnd)
        : activity.dateEnd;

      // Calculate approximate number of occurrences
      const daysInRange = Math.ceil((endDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksInRange = Math.ceil(daysInRange / 7);

      // Create recurrence rule with required fields
      eventDetails.recurrenceRule = {
        frequency: 'weekly',
        endDate: endDateObj.toISOString(),
        occurrence: weeksInRange,
        interval: 1,
      };
    }

    // Save the event - title is passed as first argument
    const eventId = await RNCalendarEvents.saveEvent(
      eventTitle,
      eventDetails
    );

    // Store the mapping
    exportedEvents.push({
      activityId: activity.id,
      childActivityId: activity.childActivityId,
      nativeEventId: eventId,
      calendarId: targetCalendarId,
    });

    console.log('[CalendarExport] Exported event:', eventId);
    return eventId;
  } catch (error) {
    console.error('[CalendarExport] Failed to export activity:', error);
    return null;
  }
}

/**
 * Export multiple activities to the native calendar
 */
export async function exportActivitiesToCalendar(
  activities: ActivityToExport[],
  calendarId?: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const activity of activities) {
    const eventId = await exportActivityToCalendar(activity, calendarId);
    if (eventId) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Remove an exported event from the native calendar
 */
export async function removeExportedEvent(childActivityId: string): Promise<boolean> {
  const exported = exportedEvents.find(e => e.childActivityId === childActivityId);
  if (!exported) {
    return false;
  }

  try {
    await RNCalendarEvents.removeEvent(exported.nativeEventId);
    exportedEvents = exportedEvents.filter(e => e.childActivityId !== childActivityId);
    return true;
  } catch (error) {
    console.error('[CalendarExport] Failed to remove event:', error);
    return false;
  }
}

/**
 * Generate ICS content for activities
 */
export function generateICSContent(activities: ActivityToExport[]): string {
  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kids Activity Tracker//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Kids Activities
`;

  activities.forEach((activity, index) => {
    const eventDate = activity.scheduledDate || activity.dateStart;
    if (!eventDate) return;

    const startDate = createDateTime(eventDate, activity.startTime);
    const endDate = createDateTime(eventDate, activity.endTime);

    // Ensure end is after start
    if (endDate <= startDate) {
      endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
    }

    const uid = `${activity.id}-${index}@kidsactivitytracker`;
    const now = new Date();

    // Format dates for ICS (YYYYMMDDTHHmmss)
    const formatICSDate = (date: Date) => {
      return format(date, "yyyyMMdd'T'HHmmss");
    };

    // Escape special characters in ICS fields
    const escapeICS = (str: string | undefined) => {
      if (!str) return '';
      return str.replace(/[\\;,\n]/g, (match) => {
        if (match === '\n') return '\\n';
        return '\\' + match;
      });
    };

    ics += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatICSDate(now)}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${escapeICS(activity.name)}${activity.childName ? ` (${escapeICS(activity.childName)})` : ''}
`;

    if (activity.description) {
      ics += `DESCRIPTION:${escapeICS(activity.description)}\n`;
    }

    if (activity.location) {
      ics += `LOCATION:${escapeICS(activity.location)}\n`;
    }

    // Add RRULE for recurring activities
    if (activity.dayOfWeek && activity.dayOfWeek.length > 0 && activity.dateEnd) {
      const byDay = dayOfWeekToRRuleDays(activity.dayOfWeek);
      const endDateObj = typeof activity.dateEnd === 'string'
        ? parseISO(activity.dateEnd)
        : activity.dateEnd;
      const until = format(endDateObj, "yyyyMMdd'T'235959'Z'");

      if (byDay) {
        ics += `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${until}\n`;
      }
    }

    ics += `END:VEVENT\n`;
  });

  ics += 'END:VCALENDAR';
  return ics;
}

/**
 * Share ICS content via system share sheet
 */
export async function shareICSContent(
  activities: ActivityToExport[],
  filename: string = 'activities.ics'
): Promise<boolean> {
  try {
    const icsContent = generateICSContent(activities);

    // Use base64 data URL for sharing
    const base64Content = Buffer.from(icsContent, 'utf-8').toString('base64');
    const dataUrl = `data:text/calendar;base64,${base64Content}`;

    await Share.share({
      title: 'Kids Activities',
      message: 'Here are the scheduled activities',
      url: Platform.OS === 'ios' ? dataUrl : undefined,
    });

    return true;
  } catch (error) {
    console.error('[CalendarExport] Share failed:', error);
    return false;
  }
}

export default {
  requestCalendarPermission,
  checkCalendarPermission,
  getAvailableCalendars,
  getDefaultCalendar,
  exportActivityToCalendar,
  exportActivitiesToCalendar,
  removeExportedEvent,
  generateICSContent,
  shareICSContent,
};
