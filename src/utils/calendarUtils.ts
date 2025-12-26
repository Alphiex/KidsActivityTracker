/**
 * Calendar utility functions for date/time parsing and formatting
 */

import { format, parseISO, addDays, isValid } from 'date-fns';

// Child color palette for calendar
export const CHILD_COLORS = [
  '#FF6B6B', // Coral red
  '#4ECDC4', // Teal
  '#45B7D1', // Sky blue
  '#96CEB4', // Sage green
  '#FECA57', // Golden yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#FFD93D', // Bright yellow
  '#6BCB77', // Green
  '#FF8CC8', // Pink
];

export interface ParsedTime {
  hours: number;
  minutes: number;
  formatted24h: string;
  formatted12h: string;
}

/**
 * Parse a time string like "9:30 AM" or "14:00" into components
 */
export function parseTimeString(time: string | null | undefined): ParsedTime | null {
  if (!time || typeof time !== 'string') return null;

  const cleanTime = time.trim().toLowerCase();

  // Try 12-hour format: "9:30 am", "12:00 PM", "9:30am"
  const match12h = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (match12h) {
    let hours = parseInt(match12h[1], 10);
    const minutes = parseInt(match12h[2], 10);
    const period = match12h[3]?.toLowerCase();

    // Convert to 24-hour if period specified
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return {
      hours,
      minutes,
      formatted24h: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      formatted12h: formatTo12Hour(hours, minutes),
    };
  }

  // Try 24-hour format: "14:00", "09:30"
  const match24h = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match24h) {
    const hours = parseInt(match24h[1], 10);
    const minutes = parseInt(match24h[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return {
        hours,
        minutes,
        formatted24h: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        formatted12h: formatTo12Hour(hours, minutes),
      };
    }
  }

  return null;
}

/**
 * Format hours and minutes to 12-hour format like "9:30 AM"
 */
function formatTo12Hour(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Convert time string to minutes since midnight for comparison
 */
export function timeToMinutes(time: string | null | undefined): number {
  const parsed = parseTimeString(time);
  if (!parsed) return 0;
  return parsed.hours * 60 + parsed.minutes;
}

/**
 * Sort activities by start time
 */
export function sortByTime<T extends { startTime?: string | null }>(activities: T[]): T[] {
  return [...activities].sort((a, b) => {
    const timeA = timeToMinutes(a.startTime);
    const timeB = timeToMinutes(b.startTime);
    return timeA - timeB;
  });
}

/**
 * Get consistent color for a child based on their index
 */
export function getChildColor(index: number): string {
  return CHILD_COLORS[index % CHILD_COLORS.length];
}

/**
 * Day of week mapping from string to JS day number (0 = Sunday)
 */
export const DAY_MAP: { [key: string]: number } = {
  'sunday': 0, 'sun': 0,
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2, 'tues': 2,
  'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6,
};

/**
 * Convert day name to JS day number
 */
export function dayNameToNumber(dayName: string): number | undefined {
  return DAY_MAP[dayName.toLowerCase()];
}

/**
 * Parse a date string in various formats and return a Date object
 */
export function parseDateFlexible(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  try {
    const isoDate = parseISO(dateStr);
    if (isValid(isoDate)) return isoDate;
  } catch {
    // Continue to other formats
  }

  // Try MM/DD/YY or MM/DD/YYYY format
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);

    // Convert 2-digit year to 4-digit
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    const date = new Date(year, month - 1, day);
    if (isValid(date)) return date;
  }

  // Try natural language format: "Jan 15, 2026"
  const naturalDate = new Date(dateStr);
  if (isValid(naturalDate)) return naturalDate;

  return null;
}

/**
 * Get all dates between start and end that match the given days of week
 */
export function expandDateRange(
  startDate: Date,
  endDate: Date,
  daysOfWeek?: string[]
): string[] {
  const dates: string[] = [];
  let currentDate = new Date(startDate);

  // If no days of week specified, return all dates in range
  if (!daysOfWeek || daysOfWeek.length === 0) {
    while (currentDate <= endDate) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }
    return dates;
  }

  // Convert day names to numbers
  const targetDays = daysOfWeek
    .map(day => dayNameToNumber(day))
    .filter((d): d is number => d !== undefined);

  if (targetDays.length === 0) {
    // Invalid day names, return all dates
    while (currentDate <= endDate) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }
    return dates;
  }

  // Get only matching days
  while (currentDate <= endDate) {
    if (targetDays.includes(currentDate.getDay())) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
    }
    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

/**
 * Format a date for display in the calendar
 */
export function formatCalendarDate(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) return '';
  return format(dateObj, formatStr);
}

/**
 * Check if an activity occurs on a specific date based on its schedule
 */
export interface ActivityScheduleInfo {
  scheduledDate?: Date | string;
  dateStart?: Date | string;
  dateEnd?: Date | string;
  dayOfWeek?: string[];
  sessions?: Array<{ date?: string; dayOfWeek?: string }>;
}

export function isActivityOnDate(
  activity: ActivityScheduleInfo,
  targetDate: string
): boolean {
  // If has specific scheduled date
  if (activity.scheduledDate) {
    const schedDate = typeof activity.scheduledDate === 'string'
      ? activity.scheduledDate.substring(0, 10)
      : format(activity.scheduledDate, 'yyyy-MM-dd');
    return schedDate === targetDate;
  }

  // If has sessions with specific dates
  if (activity.sessions && activity.sessions.length > 0) {
    for (const session of activity.sessions) {
      if (session.date) {
        const sessionDate = parseDateFlexible(session.date);
        if (sessionDate && format(sessionDate, 'yyyy-MM-dd') === targetDate) {
          return true;
        }
      }
    }
  }

  // If has date range with day of week
  if (activity.dateStart && activity.dateEnd) {
    const startDate = typeof activity.dateStart === 'string'
      ? parseISO(activity.dateStart)
      : activity.dateStart;
    const endDate = typeof activity.dateEnd === 'string'
      ? parseISO(activity.dateEnd)
      : activity.dateEnd;

    const target = parseISO(targetDate);

    if (target >= startDate && target <= endDate) {
      if (activity.dayOfWeek && activity.dayOfWeek.length > 0) {
        const targetDay = target.getDay();
        return activity.dayOfWeek.some(day => dayNameToNumber(day) === targetDay);
      }
      return true; // No day restriction, any date in range matches
    }
  }

  return false;
}
