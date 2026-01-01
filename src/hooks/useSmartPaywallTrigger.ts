/**
 * useSmartPaywallTrigger Hook
 * Shows paywall at optimal moments based on user engagement milestones
 *
 * Trigger points:
 * 1. After adding first child profile
 * 2. After favoriting 5 activities
 * 3. After first calendar add
 * 4. On trial expiration
 */

import { useCallback, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSelector } from '../store';
import {
  selectIsPremium,
  selectIsTrialing,
  selectTrialDaysRemaining,
} from '../store/slices/subscriptionSlice';
import { analyticsService } from '../services/analyticsService';

// AsyncStorage keys for tracking triggers
const TRIGGER_KEYS = {
  FIRST_CHILD: '@paywall_trigger_first_child',
  FIVE_FAVORITES: '@paywall_trigger_five_favorites',
  FIRST_CALENDAR: '@paywall_trigger_first_calendar',
  TRIAL_EXPIRED: '@paywall_trigger_trial_expired',
};

// Milestone thresholds
const FAVORITES_MILESTONE = 5;

interface UseSmartPaywallTriggerReturn {
  /** Check and trigger paywall after adding a child */
  onChildAdded: (childCount: number) => Promise<void>;
  /** Check and trigger paywall after favoriting an activity */
  onFavoriteAdded: (favoriteCount: number) => Promise<void>;
  /** Check and trigger paywall after adding to calendar */
  onCalendarAdd: () => Promise<void>;
  /** Check if trial has expired and show paywall */
  checkTrialExpired: () => Promise<void>;
  /** Reset all triggers (for testing) */
  resetTriggers: () => Promise<void>;
}

const useSmartPaywallTrigger = (): UseSmartPaywallTriggerReturn => {
  const navigation = useNavigation<any>();
  const isPremium = useAppSelector(selectIsPremium);
  const isTrialing = useAppSelector(selectIsTrialing);
  const trialDaysRemaining = useAppSelector(selectTrialDaysRemaining);

  /**
   * Check if a trigger has already fired
   */
  const hasTriggerFired = async (key: string): Promise<boolean> => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value === 'true';
    } catch {
      return false;
    }
  };

  /**
   * Mark a trigger as fired
   */
  const markTriggerFired = async (key: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  /**
   * Navigate to paywall with source tracking
   */
  const showPaywall = useCallback(
    (source: string) => {
      analyticsService.trackPaywallViewed('smart_trigger', source);
      navigation.navigate('Paywall', { source });
    },
    [navigation]
  );

  /**
   * Trigger after adding first child
   */
  const onChildAdded = useCallback(
    async (childCount: number) => {
      // Only trigger for free users adding their first child
      if (isPremium || childCount !== 1) {
        return;
      }

      const alreadyFired = await hasTriggerFired(TRIGGER_KEYS.FIRST_CHILD);
      if (alreadyFired) {
        return;
      }

      await markTriggerFired(TRIGGER_KEYS.FIRST_CHILD);

      // Small delay to let user see the child was added
      setTimeout(() => {
        showPaywall('first_child_milestone');
      }, 1500);
    },
    [isPremium, showPaywall]
  );

  /**
   * Trigger after favoriting 5 activities
   */
  const onFavoriteAdded = useCallback(
    async (favoriteCount: number) => {
      // Only trigger for free users hitting the milestone
      if (isPremium || favoriteCount !== FAVORITES_MILESTONE) {
        return;
      }

      const alreadyFired = await hasTriggerFired(TRIGGER_KEYS.FIVE_FAVORITES);
      if (alreadyFired) {
        return;
      }

      await markTriggerFired(TRIGGER_KEYS.FIVE_FAVORITES);

      // Small delay to let user see the favorite was added
      setTimeout(() => {
        showPaywall('favorites_milestone');
      }, 1500);
    },
    [isPremium, showPaywall]
  );

  /**
   * Trigger after first calendar add
   */
  const onCalendarAdd = useCallback(async () => {
    // Only trigger for free users
    if (isPremium) {
      return;
    }

    const alreadyFired = await hasTriggerFired(TRIGGER_KEYS.FIRST_CALENDAR);
    if (alreadyFired) {
      return;
    }

    await markTriggerFired(TRIGGER_KEYS.FIRST_CALENDAR);

    // Small delay to let user see the calendar add succeeded
    setTimeout(() => {
      showPaywall('first_calendar_milestone');
    }, 1500);
  }, [isPremium, showPaywall]);

  /**
   * Check and show paywall if trial has expired
   */
  const checkTrialExpired = useCallback(async () => {
    // Only trigger if trial has ended (not trialing, was trialing before)
    if (isPremium || isTrialing) {
      return;
    }

    // Check if trial just expired (trialDaysRemaining is 0 or negative)
    if (trialDaysRemaining !== null && trialDaysRemaining <= 0) {
      const alreadyFired = await hasTriggerFired(TRIGGER_KEYS.TRIAL_EXPIRED);
      if (alreadyFired) {
        return;
      }

      await markTriggerFired(TRIGGER_KEYS.TRIAL_EXPIRED);
      showPaywall('trial_expired');
    }
  }, [isPremium, isTrialing, trialDaysRemaining, showPaywall]);

  /**
   * Reset all triggers (for testing)
   */
  const resetTriggers = useCallback(async () => {
    try {
      await Promise.all(
        Object.values(TRIGGER_KEYS).map((key) => AsyncStorage.removeItem(key))
      );
    } catch {
      // Ignore errors
    }
  }, []);

  // Check trial expiration on mount and when trial state changes
  useEffect(() => {
    checkTrialExpired();
  }, [checkTrialExpired]);

  return {
    onChildAdded,
    onFavoriteAdded,
    onCalendarAdd,
    checkTrialExpired,
    resetTriggers,
  };
};

export default useSmartPaywallTrigger;
