import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getABTestAssignment, ABTestAssignment } from '../services/sponsorAnalytics';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface UseABTestResult {
  isLoading: boolean;
  inTest: boolean;
  variant: string | null;
  testConfig: Record<string, any> | null;
}

/**
 * Hook to get A/B test variant assignment for the current user/device
 *
 * @param testId - The ID of the A/B test
 * @returns Object containing test assignment info
 *
 * @example
 * ```tsx
 * function ActivityList() {
 *   const { variant, testConfig } = useABTest('sponsor-placement-test');
 *
 *   if (variant === 'A') {
 *     return <StandardLayout />;
 *   } else if (variant === 'B') {
 *     return <NewLayout config={testConfig} />;
 *   }
 * }
 * ```
 */
export function useABTest(testId: string): UseABTestResult {
  const [isLoading, setIsLoading] = useState(true);
  const [assignment, setAssignment] = useState<ABTestAssignment>({
    inTest: false,
    variant: null,
    testConfig: null,
  });

  // Get user ID if authenticated
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  useEffect(() => {
    let isMounted = true;

    const fetchAssignment = async () => {
      try {
        // Use user ID if available, otherwise use device ID
        let identifier: string;
        let identifierType: 'user_id' | 'device_id';

        if (userId) {
          identifier = userId;
          identifierType = 'user_id';
        } else {
          // Get unique device ID
          identifier = await DeviceInfo.getUniqueId();
          identifierType = 'device_id';
        }

        const result = await getABTestAssignment(testId, identifier, identifierType);

        if (isMounted) {
          setAssignment(result);
        }
      } catch (error) {
        console.warn('[useABTest] Failed to fetch assignment:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAssignment();

    return () => {
      isMounted = false;
    };
  }, [testId, userId]);

  return {
    isLoading,
    inTest: assignment.inTest,
    variant: assignment.variant,
    testConfig: assignment.testConfig,
  };
}

/**
 * Hook to check if a specific feature variant is active
 *
 * @example
 * ```tsx
 * function SponsoredBadge() {
 *   const showBadge = useABTestVariant('badge-test', 'show_badge');
 *
 *   if (!showBadge) return null;
 *   return <Badge>Sponsored</Badge>;
 * }
 * ```
 */
export function useABTestVariant(testId: string, expectedVariant: string): boolean {
  const { variant } = useABTest(testId);
  return variant === expectedVariant;
}

export default useABTest;
