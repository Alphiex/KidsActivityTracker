import { Platform } from 'react-native';
import api from './api';

export type ClickDestinationType = 'activity_detail' | 'external_url' | 'registration';
export type PlacementType = 'activity_list' | 'activity_detail' | 'search_results' | 'dashboard';

export interface ClickEvent {
  activityId?: string;
  placement: PlacementType;
  destinationType: ClickDestinationType;
  destinationUrl?: string;
  city?: string;
  province?: string;
  abTestId?: string;
  abVariant?: string;
}

export interface ABTestAssignment {
  inTest: boolean;
  variant: string | null;
  testConfig: Record<string, any> | null;
}

/**
 * Track a click on a sponsored activity
 */
export async function trackClick(event: ClickEvent): Promise<void> {
  try {
    await api.post('/api/v1/analytics/clicks', {
      ...event,
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn('[SponsorAnalytics] Failed to track click:', error);
    // Don't throw - clicks are fire-and-forget
  }
}

/**
 * Track when user taps on a sponsored activity to view details
 */
export function trackActivityDetailClick(
  activityId: string,
  placement: PlacementType,
  context?: { city?: string; province?: string }
): void {
  trackClick({
    activityId,
    placement,
    destinationType: 'activity_detail',
    city: context?.city,
    province: context?.province,
  });
}

/**
 * Track when user taps registration button for a sponsored activity
 */
export function trackRegistrationClick(
  activityId: string,
  registrationUrl: string,
  context?: { city?: string; province?: string }
): void {
  trackClick({
    activityId,
    placement: 'activity_detail',
    destinationType: 'registration',
    destinationUrl: registrationUrl,
    city: context?.city,
    province: context?.province,
  });
}

/**
 * Track when user opens external link for a sponsored activity
 */
export function trackExternalUrlClick(
  activityId: string,
  url: string,
  placement: PlacementType,
  context?: { city?: string; province?: string }
): void {
  trackClick({
    activityId,
    placement,
    destinationType: 'external_url',
    destinationUrl: url,
    city: context?.city,
    province: context?.province,
  });
}

// Cache for A/B test assignments
const abTestCache = new Map<string, ABTestAssignment>();

/**
 * Get A/B test variant assignment for a user/device
 */
export async function getABTestAssignment(
  testId: string,
  identifier: string,
  identifierType: 'user_id' | 'device_id' = 'device_id'
): Promise<ABTestAssignment> {
  const cacheKey = `${testId}:${identifier}`;

  // Check cache first
  if (abTestCache.has(cacheKey)) {
    return abTestCache.get(cacheKey)!;
  }

  try {
    const response = await api.get(`/api/v1/analytics/ab-test/${testId}/assignment`, {
      params: { identifier, identifierType },
    });

    const assignment: ABTestAssignment = {
      inTest: response.data.inTest,
      variant: response.data.variant,
      testConfig: response.data.testConfig,
    };

    // Cache the assignment
    abTestCache.set(cacheKey, assignment);

    return assignment;
  } catch (error) {
    console.warn('[SponsorAnalytics] Failed to get A/B test assignment:', error);
    // Return default (not in test) on error
    return { inTest: false, variant: null, testConfig: null };
  }
}

/**
 * Get all active A/B tests
 */
export async function getActiveABTests(): Promise<Array<{
  id: string;
  name: string;
  testType: string;
}>> {
  try {
    const response = await api.get('/api/v1/analytics/ab-tests/active');
    return response.data.tests || [];
  } catch (error) {
    console.warn('[SponsorAnalytics] Failed to get active tests:', error);
    return [];
  }
}

/**
 * Clear A/B test cache (useful when user logs out)
 */
export function clearABTestCache(): void {
  abTestCache.clear();
}
