/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date of birth
 * @param inMonths - If true, returns age in months
 * @returns Age in years or months
 */
export function calculateAge(dateOfBirth: Date, inMonths = false): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  
  if (inMonths) {
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + 
                   (today.getMonth() - birthDate.getMonth());
    return months;
  }
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Check if a date falls within a range
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Format date for display
 */
export function formatDate(date: Date, format: 'short' | 'long' | 'iso' = 'short'): string {
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'iso':
      return date.toISOString();
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Get age-appropriate date range for activities
 */
export function getAgeAppropriateRange(age: number): { minAge: number; maxAge: number } {
  // Add some buffer for age ranges
  const buffer = 2;
  return {
    minAge: Math.max(0, age - buffer),
    maxAge: age + buffer
  };
}

/**
 * Parse date string safely
 */
export function parseDateSafely(dateString: string): Date | null {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * Get calendar week for a date
 */
export function getCalendarWeek(date: Date): { year: number; week: number } {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  
  return {
    year: date.getFullYear(),
    week: weekNumber
  };
}

/**
 * Get date range for calendar view
 */
export function getCalendarDateRange(view: 'week' | 'month' | 'year', date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(date);
  const end = new Date(date);
  
  switch (view) {
    case 'week':
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      end.setDate(end.getDate() + (6 - dayOfWeek));
      break;
      
    case 'month':
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      break;
      
    case 'year':
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      break;
  }
  
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}