/**
 * API Response Validation Utilities
 * Provides type-safe validation for API responses to prevent crashes
 */

import { isValidObject, isNonEmptyArray, safeString, safeNumber, safeParseDate } from './safeAccessors';

// ============================================================================
// TYPE GUARDS FOR API RESPONSES
// ============================================================================

/**
 * Check if value is a valid array (empty or with items)
 */
export function isValidArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if response has expected structure with success flag
 */
export function isSuccessResponse(response: unknown): response is { success: boolean } {
  return isValidObject(response) && 'success' in response;
}

/**
 * Check if response has data property
 */
export function hasDataProperty<T>(response: unknown): response is { data: T } {
  return isValidObject(response) && 'data' in response;
}

/**
 * Check if response has items array (paginated)
 */
export function hasPaginatedItems<T>(response: unknown): response is { items: T[] } {
  return isValidObject(response) && 'items' in response && Array.isArray(response.items);
}

// ============================================================================
// RESPONSE EXTRACTORS
// ============================================================================

/**
 * Safely extract array from various API response formats
 * Handles: { activities: [] }, { data: { activities: [] } }, { items: [] }, []
 */
export function extractArrayFromResponse<T>(
  response: unknown,
  key: string = 'items'
): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (!isValidObject(response)) {
    return [];
  }

  // Check direct key (e.g., response.activities)
  if (key in response && Array.isArray(response[key])) {
    return response[key] as T[];
  }

  // Check items key (paginated responses)
  if ('items' in response && Array.isArray(response.items)) {
    return response.items as T[];
  }

  // Check data wrapper (e.g., response.data.activities)
  if ('data' in response && isValidObject(response.data)) {
    const data = response.data as Record<string, unknown>;
    if (key in data && Array.isArray(data[key])) {
      return data[key] as T[];
    }
    if ('items' in data && Array.isArray(data.items)) {
      return data.items as T[];
    }
    // Check if data itself is an array
    if (Array.isArray(data)) {
      return data as T[];
    }
  }

  // Check success wrapper (e.g., response.success && response.activities)
  if ('success' in response && response.success === true) {
    if (key in response && Array.isArray(response[key])) {
      return response[key] as T[];
    }
  }

  return [];
}

/**
 * Safely extract single item from response
 */
export function extractItemFromResponse<T>(
  response: unknown,
  key: string = 'item'
): T | null {
  if (!isValidObject(response)) {
    return null;
  }

  // Direct key access
  if (key in response && response[key] !== null && response[key] !== undefined) {
    return response[key] as T;
  }

  // Check data wrapper
  if ('data' in response && isValidObject(response.data)) {
    const data = response.data as Record<string, unknown>;
    if (key in data && data[key] !== null && data[key] !== undefined) {
      return data[key] as T;
    }
  }

  return null;
}

// ============================================================================
// ACTIVITY VALIDATORS
// ============================================================================

/**
 * Validate and normalize an activity object
 */
export function validateActivity(item: unknown): Record<string, unknown> | null {
  if (!isValidObject(item)) return null;

  // Must have at least id and name
  if (!('id' in item) || !('name' in item)) return null;

  return {
    id: safeString(item.id),
    name: safeString(item.name),
    description: safeString(item.description, ''),
    category: safeString(item.category, ''),
    subcategory: safeString(item.subcategory, ''),
    provider: extractProvider(item),
    location: extractLocation(item),
    locationName: safeString(item.locationName, ''),
    cost: safeNumber(item.cost, 0),
    spotsAvailable: safeNumber(item.spotsAvailable, 0),
    totalSpots: safeNumber(item.totalSpots, 0),
    ageRange: extractAgeRange(item),
    dateRange: extractDateRange(item),
    startTime: safeString(item.startTime, ''),
    endTime: safeString(item.endTime, ''),
    registrationUrl: safeString(item.registrationUrl, ''),
    scrapedAt: item.scrapedAt ?? null,
    sessions: extractSessions(item),
    activityType: extractActivityType(item),
    ...item, // Preserve any additional fields
  };
}

/**
 * Extract provider info safely
 */
function extractProvider(item: Record<string, unknown>): string {
  if (typeof item.provider === 'string') return item.provider;
  if (isValidObject(item.provider) && 'name' in item.provider) {
    return safeString(item.provider.name, 'Unknown');
  }
  return 'Unknown';
}

/**
 * Extract location info safely
 */
function extractLocation(item: Record<string, unknown>): string {
  if (typeof item.location === 'string') return item.location;
  if (isValidObject(item.location)) {
    if ('name' in item.location) return safeString(item.location.name, '');
    if ('fullAddress' in item.location) return safeString(item.location.fullAddress, '');
  }
  return safeString(item.locationName, '');
}

/**
 * Extract age range safely
 */
function extractAgeRange(item: Record<string, unknown>): { min: number; max: number } {
  if (isValidObject(item.ageRange)) {
    return {
      min: safeNumber(item.ageRange.min, 0),
      max: safeNumber(item.ageRange.max, 18),
    };
  }
  return {
    min: safeNumber(item.ageMin, 0),
    max: safeNumber(item.ageMax, 18),
  };
}

/**
 * Extract date range safely
 */
function extractDateRange(item: Record<string, unknown>): { start: Date; end: Date } | null {
  // Check dateRange object
  if (isValidObject(item.dateRange)) {
    const start = safeParseDate(item.dateRange.start);
    const end = safeParseDate(item.dateRange.end);
    if (start && end) return { start, end };
  }

  // Check dateStart/dateEnd fields
  const dateStart = safeParseDate(item.dateStart);
  const dateEnd = safeParseDate(item.dateEnd);
  if (dateStart && dateEnd) return { start: dateStart, end: dateEnd };

  // Check startDate/endDate fields
  const startDate = safeParseDate(item.startDate);
  const endDate = safeParseDate(item.endDate);
  if (startDate && endDate) return { start: startDate, end: endDate };

  return null;
}

/**
 * Extract sessions array safely
 */
function extractSessions(item: Record<string, unknown>): unknown[] {
  if (Array.isArray(item.sessions)) {
    return item.sessions;
  }
  return [];
}

/**
 * Extract activity type safely (can be string, array, or object)
 */
function extractActivityType(item: Record<string, unknown>): string[] {
  if (Array.isArray(item.activityType)) {
    return item.activityType.map(t => safeString(t));
  }
  if (typeof item.activityType === 'string') {
    return [item.activityType];
  }
  if (isValidObject(item.activityType) && 'name' in item.activityType) {
    return [safeString(item.activityType.name)];
  }
  return [];
}

// ============================================================================
// CHILD VALIDATORS
// ============================================================================

/**
 * Validate and normalize a child object
 */
export function validateChild(item: unknown): Record<string, unknown> | null {
  if (!isValidObject(item)) return null;

  // Must have at least id and name
  if (!('id' in item) || !('name' in item)) return null;

  return {
    id: safeString(item.id),
    name: safeString(item.name),
    dateOfBirth: safeString(item.dateOfBirth, ''),
    interests: Array.isArray(item.interests) ? item.interests : [],
    avatar: safeString(item.avatar, ''),
    color: safeString(item.color, '#6366f1'),
    ...item, // Preserve any additional fields
  };
}

// ============================================================================
// CHILD ACTIVITY VALIDATORS
// ============================================================================

/**
 * Validate and normalize a child activity object
 */
export function validateChildActivity(item: unknown): Record<string, unknown> | null {
  if (!isValidObject(item)) return null;

  // Must have childId and activityId at minimum
  const hasRequiredFields = ('id' in item || ('childId' in item && 'activityId' in item));
  if (!hasRequiredFields) return null;

  return {
    id: safeString(item.id, ''),
    childId: safeString(item.childId, ''),
    activityId: safeString(item.activityId, ''),
    status: safeString(item.status, 'planned'),
    scheduledDate: item.scheduledDate ?? null,
    startTime: safeString(item.startTime, ''),
    endTime: safeString(item.endTime, ''),
    notes: safeString(item.notes, ''),
    activity: item.activity ?? null,
    child: item.child ?? null,
    ...item, // Preserve any additional fields
  };
}

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

/**
 * Extract pagination info from response
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  pages: number;
}

export function extractPagination(response: unknown): PaginationInfo {
  const defaults: PaginationInfo = {
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
    pages: 1,
  };

  if (!isValidObject(response)) return defaults;

  // Check for pagination object
  if (isValidObject(response.pagination)) {
    const p = response.pagination;
    return {
      total: safeNumber(p.total, defaults.total),
      limit: safeNumber(p.limit, defaults.limit),
      offset: safeNumber(p.offset, defaults.offset),
      hasMore: Boolean(p.hasMore ?? defaults.hasMore),
      pages: safeNumber(p.pages, defaults.pages),
    };
  }

  // Check for flat pagination fields
  return {
    total: safeNumber(response.total, defaults.total),
    limit: safeNumber(response.limit, defaults.limit),
    offset: safeNumber(response.offset, defaults.offset),
    hasMore: Boolean(response.hasMore ?? defaults.hasMore),
    pages: safeNumber(response.pages, defaults.pages),
  };
}

/**
 * Create a validated paginated response
 */
export function createPaginatedResponse<T>(
  response: unknown,
  itemKey: string,
  validator?: (item: unknown) => T | null
): { items: T[]; pagination: PaginationInfo } {
  const rawItems = extractArrayFromResponse<unknown>(response, itemKey);
  const pagination = extractPagination(response);

  let items: T[];
  if (validator) {
    items = rawItems
      .map(item => validator(item))
      .filter((item): item is T => item !== null);
  } else {
    items = rawItems as T[];
  }

  // Update total if we filtered out invalid items
  if (validator && items.length < rawItems.length) {
    pagination.total = Math.max(0, pagination.total - (rawItems.length - items.length));
  }

  return { items, pagination };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Extract error message from various error response formats
 */
export function extractErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  if (typeof error === 'string') return error;

  if (error instanceof Error) return error.message;

  if (isValidObject(error)) {
    // Axios error format
    if (isValidObject(error.response) && isValidObject(error.response.data)) {
      const data = error.response.data;
      if ('message' in data) return safeString(data.message, fallback);
      if ('error' in data) return safeString(data.error, fallback);
    }

    // Direct error object
    if ('message' in error) return safeString(error.message, fallback);
    if ('error' in error) return safeString(error.error, fallback);
  }

  return fallback;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!isValidObject(error)) return false;

  // Axios network error
  if (error.code === 'ERR_NETWORK') return true;
  if (error.message === 'Network Error') return true;

  // Check response status
  if (isValidObject(error.response)) {
    const status = safeNumber(error.response.status, 0);
    // 0 typically means no response (network issue)
    if (status === 0) return true;
  }

  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (!isValidObject(error)) return false;

  if (isValidObject(error.response)) {
    const status = safeNumber(error.response.status, 0);
    return status === 401 || status === 403;
  }

  return false;
}
