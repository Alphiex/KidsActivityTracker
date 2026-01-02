/**
 * Temporal Expression Resolver
 *
 * Converts natural language time expressions into date ranges.
 * Handles: spring break, summer, this weekend, next week, after school, etc.
 */

// Types
export interface TemporalResolution {
  expression: string;
  startDate?: Date;
  endDate?: Date;
  timeOfDay?: { start: string; end: string }; // For "after school" type expressions
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  suggestedDates?: Array<{ start: Date; end: Date; label: string }>;
}

// Regional spring break dates (varies by province/school district)
// These are approximate - actual dates vary by year and district
const SPRING_BREAK_DEFAULTS: Record<string, { month: number; startWeek: number }> = {
  BC: { month: 3, startWeek: 2 }, // Mid-March
  ON: { month: 3, startWeek: 2 }, // Mid-March (March Break)
  AB: { month: 3, startWeek: 4 }, // Late March
  QC: { month: 3, startWeek: 1 }, // Early March
  default: { month: 3, startWeek: 2 }, // Default to mid-March
};

// Helper to get Monday of a given week in a month
function getWeekStart(year: number, month: number, weekNumber: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const firstMonday = new Date(firstDay);

  // Find first Monday
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }

  // Add weeks
  firstMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);

  return firstMonday;
}

// Get this coming weekend
function getThisWeekend(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Calculate days until Saturday (day 6)
  const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek;

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);

  return { start: saturday, end: sunday };
}

// Get next week (Monday to Sunday)
function getNextWeek(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Days until next Monday
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

// Get this week (current Monday to Sunday)
function getThisWeek(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Days since Monday (Monday = 0 for this calculation)
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

// Get summer break (June 15 - August 31 approximately)
function getSummer(year?: number): { start: Date; end: Date } {
  const targetYear = year || new Date().getFullYear();

  // If we're past August, assume next year's summer
  const now = new Date();
  const actualYear = now.getMonth() >= 8 ? targetYear + 1 : targetYear;

  return {
    start: new Date(actualYear, 5, 15), // June 15
    end: new Date(actualYear, 7, 31), // August 31
  };
}

// Get winter break (Dec 20 - Jan 5 approximately)
function getWinterBreak(): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;

  return {
    start: new Date(year, 11, 20), // Dec 20
    end: new Date(year + 1, 0, 5), // Jan 5
  };
}

// Generate spring break options
function getSpringBreakOptions(year: number): Array<{ start: Date; end: Date; label: string }> {
  const options: Array<{ start: Date; end: Date; label: string }> = [];

  // Generate 4 weeks of options in March
  for (let week = 1; week <= 4; week++) {
    const start = getWeekStart(year, 3, week);
    const end = new Date(start);
    end.setDate(start.getDate() + 4); // 5-day break (Mon-Fri)

    const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    options.push({ start, end, label });
  }

  return options;
}

// Parse specific date mentions
function parseSpecificDate(text: string): Date | null {
  // Try common formats
  const formats = [
    // "March 10" or "Mar 10"
    /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i,
    // "10 March" or "10 Mar"
    /(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)(?:\s*,?\s*(\d{4}))?/i,
    // "3/10" or "03/10" (US format)
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
  ];

  const monthNames: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  for (const format of formats) {
    const match = text.match(format);
    if (match) {
      let month: number;
      let day: number;
      let year = new Date().getFullYear();

      if (isNaN(parseInt(match[1], 10))) {
        // "March 10" format
        month = monthNames[match[1].toLowerCase()];
        day = parseInt(match[2], 10);
        if (match[3]) year = parseInt(match[3], 10);
      } else if (match[2] && isNaN(parseInt(match[2], 10))) {
        // "10 March" format
        day = parseInt(match[1], 10);
        month = monthNames[match[2].toLowerCase()];
        if (match[3]) year = parseInt(match[3], 10);
      } else {
        // "3/10" format (month/day)
        month = parseInt(match[1], 10) - 1;
        day = parseInt(match[2], 10);
        if (match[3]) {
          year = parseInt(match[3], 10);
          if (year < 100) year += 2000;
        }
      }

      if (month !== undefined && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
  }

  return null;
}

// Parse date range from text
function parseDateRange(text: string): { start: Date; end: Date } | null {
  // Look for patterns like "March 10-14" or "March 10 to March 14"
  const rangePatterns = [
    // "March 10-14" or "Mar 10-14"
    /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?[\s-]+(?:to\s+)?(\d{1,2})(?:st|nd|rd|th)?/i,
    // "March 10 to March 14"
    /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?[\s-]+(?:to\s+)?(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
  ];

  const monthNames: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  // Try first pattern: "March 10-14"
  const match1 = text.match(rangePatterns[0]);
  if (match1) {
    const month = monthNames[match1[1].toLowerCase()];
    if (month !== undefined) {
      const startDay = parseInt(match1[2], 10);
      const endDay = parseInt(match1[3], 10);
      const year = new Date().getFullYear();

      return {
        start: new Date(year, month, startDay),
        end: new Date(year, month, endDay),
      };
    }
  }

  // Try second pattern: "March 10 to March 14"
  const match2 = text.match(rangePatterns[1]);
  if (match2) {
    const startMonth = monthNames[match2[1].toLowerCase()];
    const endMonth = monthNames[match2[3].toLowerCase()];
    if (startMonth !== undefined && endMonth !== undefined) {
      const startDay = parseInt(match2[2], 10);
      const endDay = parseInt(match2[4], 10);
      const year = new Date().getFullYear();

      return {
        start: new Date(year, startMonth, startDay),
        end: new Date(year, endMonth, endDay),
      };
    }
  }

  return null;
}

/**
 * Resolve a temporal expression to date ranges
 */
export function resolveTemporalExpression(
  expression: string,
  region?: string
): TemporalResolution {
  const exprLower = expression.toLowerCase().trim();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Try to parse as specific date range first
  const dateRange = parseDateRange(expression);
  if (dateRange) {
    return {
      expression,
      startDate: dateRange.start,
      endDate: dateRange.end,
      confidence: 0.95,
      needsClarification: false,
    };
  }

  // This weekend
  if (exprLower.includes('this weekend') || exprLower === 'weekend') {
    const weekend = getThisWeekend();
    return {
      expression,
      startDate: weekend.start,
      endDate: weekend.end,
      confidence: 0.95,
      needsClarification: false,
    };
  }

  // Next weekend
  if (exprLower.includes('next weekend')) {
    const thisWeekend = getThisWeekend();
    const nextWeekend = {
      start: new Date(thisWeekend.start.getTime() + 7 * 24 * 60 * 60 * 1000),
      end: new Date(thisWeekend.end.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
    return {
      expression,
      startDate: nextWeekend.start,
      endDate: nextWeekend.end,
      confidence: 0.95,
      needsClarification: false,
    };
  }

  // This week
  if (exprLower.includes('this week')) {
    const week = getThisWeek();
    return {
      expression,
      startDate: week.start,
      endDate: week.end,
      confidence: 0.9,
      needsClarification: false,
    };
  }

  // Next week
  if (exprLower.includes('next week')) {
    const week = getNextWeek();
    return {
      expression,
      startDate: week.start,
      endDate: week.end,
      confidence: 0.9,
      needsClarification: false,
    };
  }

  // Summer / summer vacation / summer break
  if (exprLower.includes('summer')) {
    const summer = getSummer();
    return {
      expression,
      startDate: summer.start,
      endDate: summer.end,
      confidence: 0.85,
      needsClarification: false,
    };
  }

  // Winter break / winter vacation / christmas break
  if (exprLower.includes('winter') || exprLower.includes('christmas') || exprLower.includes('holiday')) {
    const winter = getWinterBreak();
    return {
      expression,
      startDate: winter.start,
      endDate: winter.end,
      confidence: 0.8,
      needsClarification: false,
    };
  }

  // Spring break / March break - NEEDS CLARIFICATION
  if (exprLower.includes('spring break') || exprLower.includes('march break')) {
    const options = getSpringBreakOptions(currentYear);

    // If region provided, use default for that region
    const regionDefaults = SPRING_BREAK_DEFAULTS[region?.toUpperCase() || 'default'];
    const defaultStart = getWeekStart(currentYear, regionDefaults.month, regionDefaults.startWeek);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultStart.getDate() + 4);

    return {
      expression,
      startDate: defaultStart, // Provide default but ask for confirmation
      endDate: defaultEnd,
      confidence: 0.5, // Low confidence - needs confirmation
      needsClarification: true,
      clarificationQuestion: 'When is your spring break?',
      suggestedDates: options,
    };
  }

  // After school
  if (exprLower.includes('after school') || exprLower.includes('afterschool')) {
    return {
      expression,
      timeOfDay: { start: '15:00', end: '18:00' }, // 3pm - 6pm
      confidence: 0.9,
      needsClarification: false,
    };
  }

  // Before school / morning
  if (exprLower.includes('before school') || exprLower.includes('morning')) {
    return {
      expression,
      timeOfDay: { start: '07:00', end: '09:00' },
      confidence: 0.85,
      needsClarification: false,
    };
  }

  // Today
  if (exprLower === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      expression,
      startDate: today,
      endDate: endOfDay,
      confidence: 1.0,
      needsClarification: false,
    };
  }

  // Tomorrow
  if (exprLower === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      expression,
      startDate: tomorrow,
      endDate: endOfDay,
      confidence: 1.0,
      needsClarification: false,
    };
  }

  // Specific month (e.g., "in March", "during April")
  const monthMatch = exprLower.match(/(?:in|during)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/);
  if (monthMatch) {
    const monthNames: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };
    const month = monthNames[monthMatch[1]];
    const year = month < now.getMonth() ? currentYear + 1 : currentYear;

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // Last day of month

    return {
      expression,
      startDate: start,
      endDate: end,
      confidence: 0.85,
      needsClarification: false,
    };
  }

  // PA day / PD day - needs clarification (varies by school)
  if (exprLower.includes('pa day') || exprLower.includes('pd day') || exprLower.includes('pro-d')) {
    return {
      expression,
      confidence: 0.3,
      needsClarification: true,
      clarificationQuestion: 'Which date is your PA/PD day?',
      suggestedDates: [], // Can't suggest without knowing
    };
  }

  // Unknown temporal expression
  return {
    expression,
    confidence: 0.2,
    needsClarification: true,
    clarificationQuestion: `When would you like to find activities? (You mentioned "${expression}")`,
  };
}

/**
 * Check if a date falls within a temporal resolution
 */
export function dateWithinResolution(
  date: Date,
  resolution: TemporalResolution
): boolean {
  if (!resolution.startDate || !resolution.endDate) return true;

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const start = new Date(resolution.startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(resolution.endDate);
  end.setHours(23, 59, 59, 999);

  return dateOnly >= start && dateOnly <= end;
}

/**
 * Format a date range for display
 */
export function formatDateRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${end.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  }

  if (start.getMonth() !== end.getMonth()) {
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  }

  return `${start.toLocaleDateString('en-US', options)} - ${end.getDate()}`;
}

export default {
  resolveTemporalExpression,
  dateWithinResolution,
  formatDateRange,
};
