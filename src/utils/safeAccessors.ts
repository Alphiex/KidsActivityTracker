/**
 * Safe accessor utilities for defensive programming
 * Prevents crashes from null/undefined values in data structures
 */

import { isValid, parseISO, format } from 'date-fns';

// ============================================================================
// SAFE ARRAY OPERATIONS
// ============================================================================

/**
 * Safely map over an array that might be undefined or null
 * @returns Empty array if input is not a valid array
 */
export function safeMap<T, R>(
  arr: T[] | undefined | null,
  fn: (item: T, index: number) => R
): R[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(fn);
}

/**
 * Safely filter an array that might be undefined or null
 * @returns Empty array if input is not a valid array
 */
export function safeFilter<T>(
  arr: T[] | undefined | null,
  fn: (item: T, index: number) => boolean
): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(fn);
}

/**
 * Safely find in an array that might be undefined or null
 * @returns undefined if input is not a valid array or item not found
 */
export function safeFind<T>(
  arr: T[] | undefined | null,
  fn: (item: T, index: number) => boolean
): T | undefined {
  if (!Array.isArray(arr)) return undefined;
  return arr.find(fn);
}

/**
 * Safely get first element of an array
 * @returns undefined if array is empty or not valid
 */
export function safeFirst<T>(arr: T[] | undefined | null): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[0];
}

/**
 * Safely get element at index
 * @returns undefined if index is out of bounds or array is invalid
 */
export function safeAt<T>(arr: T[] | undefined | null, index: number): T | undefined {
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) return undefined;
  return arr[index];
}

/**
 * Safely get array length
 * @returns 0 if input is not a valid array
 */
export function safeLength(arr: unknown[] | undefined | null): number {
  if (!Array.isArray(arr)) return 0;
  return arr.length;
}

// ============================================================================
// SAFE DATE OPERATIONS
// ============================================================================

/**
 * Safely convert a date to ISO string
 * @returns null if date is invalid or undefined
 */
export function safeToISOString(date: Date | string | undefined | null): string | null {
  if (date === undefined || date === null) return null;

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      // Try parsing as ISO string first
      dateObj = parseISO(date);
      if (!isValid(dateObj)) {
        // Fallback to Date constructor
        dateObj = new Date(date);
      }
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return null;
    }

    if (!isValid(dateObj)) return null;
    return dateObj.toISOString();
  } catch {
    return null;
  }
}

/**
 * Safely parse an ISO date string
 * @returns null if string is invalid or undefined
 */
export function safeParseDateISO(dateStr: string | undefined | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  try {
    const date = parseISO(dateStr);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Safely parse any date input to a Date object
 * @returns null if input is invalid
 */
export function safeParseDate(input: Date | string | number | undefined | null): Date | null {
  if (input === undefined || input === null) return null;

  try {
    let date: Date;

    if (input instanceof Date) {
      date = input;
    } else if (typeof input === 'string') {
      date = parseISO(input);
      if (!isValid(date)) {
        date = new Date(input);
      }
    } else if (typeof input === 'number') {
      date = new Date(input);
    } else {
      return null;
    }

    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Safely format a date
 * @returns fallback string if date is invalid
 */
export function safeFormatDate(
  date: Date | string | undefined | null,
  formatStr: string,
  fallback: string = ''
): string {
  const parsed = safeParseDate(date);
  if (!parsed) return fallback;

  try {
    return format(parsed, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Safely get timestamp from date
 * @returns 0 if date is invalid
 */
export function safeGetTime(date: Date | string | undefined | null): number {
  const parsed = safeParseDate(date);
  return parsed ? parsed.getTime() : 0;
}

// ============================================================================
// SAFE PROPERTY ACCESS
// ============================================================================

/**
 * Safely get nested property using dot notation path
 * @example safeGet(obj, 'user.address.city', 'Unknown')
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue: T): T {
  if (obj === undefined || obj === null) return defaultValue;

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === undefined || current === null) return defaultValue;
    if (typeof current !== 'object') return defaultValue;
    current = (current as Record<string, unknown>)[key];
  }

  return (current as T) ?? defaultValue;
}

/**
 * Safely convert value to string
 * @returns defaultValue if input is undefined/null
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return defaultValue;
}

/**
 * Safely convert value to number
 * @returns defaultValue if input is not a valid number
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Safely convert value to boolean
 * @returns defaultValue if input is undefined/null
 */
export function safeBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return defaultValue;
}

// ============================================================================
// SAFE STRING OPERATIONS
// ============================================================================

/**
 * Safely get substring
 * @returns empty string if input is invalid
 */
export function safeSubstring(
  str: string | undefined | null,
  start: number,
  end?: number
): string {
  if (!str || typeof str !== 'string') return '';
  return str.substring(start, end);
}

/**
 * Safely split a string
 * @returns empty array if input is invalid
 */
export function safeSplit(
  str: string | undefined | null,
  separator: string | RegExp
): string[] {
  if (!str || typeof str !== 'string') return [];
  return str.split(separator);
}

/**
 * Safely trim a string
 * @returns empty string if input is invalid
 */
export function safeTrim(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Safely get initials from a name
 * @returns fallback if name is invalid
 */
export function safeInitials(name: string | undefined | null, fallback: string = '?'): string {
  if (!name || typeof name !== 'string') return fallback;

  const trimmed = name.trim();
  if (!trimmed) return fallback;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;

  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if value is a valid non-empty array
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if value is a valid object (not null, not array)
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is a valid non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid Date object
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && isValid(value);
}

/**
 * Check if object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isValidObject(obj) && key in obj;
}

// ============================================================================
// COMPOSITE HELPERS
// ============================================================================

/**
 * Safely format a time range string
 * @returns formatted time range or fallback
 */
export function safeTimeRange(
  startTime: string | undefined | null,
  endTime: string | undefined | null,
  fallback: string = 'Time TBD'
): string {
  const start = safeTrim(startTime);
  const end = safeTrim(endTime);

  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return fallback;
}

/**
 * Safely format an age range string
 * @returns formatted age range
 */
export function safeAgeRange(
  ageRange: { min?: number; max?: number } | undefined | null,
  fallback: string = 'All ages'
): string {
  if (!ageRange) return fallback;

  const min = ageRange.min ?? 0;
  const max = ageRange.max ?? 18;

  if (min === 0 && max >= 18) return fallback;
  return `Ages ${min} - ${max}`;
}

/**
 * Safely format a date range for display
 */
export function safeDateRangeDisplay(
  startDate: Date | string | undefined | null,
  endDate: Date | string | undefined | null,
  formatStr: string = 'MMM d, yyyy',
  fallback: string = 'Date TBD'
): string {
  const start = safeFormatDate(startDate, formatStr);
  const end = safeFormatDate(endDate, formatStr);

  if (start && end) {
    return start === end ? start : `${start} - ${end}`;
  }
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  return fallback;
}
