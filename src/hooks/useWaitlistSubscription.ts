/**
 * useWaitlistSubscription Hook
 * Provides subscription-aware props for waitlist functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import {
  selectCanAddToWaitlist,
  selectWaitlistLimit,
  selectWaitlistRemaining,
  selectUsage,
  updateUsage,
} from '../store/slices/subscriptionSlice';
import WaitlistService from '../services/waitlistService';

interface UseWaitlistSubscriptionReturn {
  // Props to pass to components
  canAddToWaitlist: boolean;
  onWaitlistLimitReached: () => void;

  // Modal state
  showUpgradeModal: boolean;
  hideUpgradeModal: () => void;

  // Current usage info
  waitlistCount: number;
  waitlistLimit: number;
  waitlistRemaining: number;

  // Sync function
  syncWaitlistCount: () => void;
}

const useWaitlistSubscription = (): UseWaitlistSubscriptionReturn => {
  const dispatch = useAppDispatch();
  const canAddToWaitlist = useAppSelector(selectCanAddToWaitlist);
  const waitlistLimit = useAppSelector(selectWaitlistLimit);
  const waitlistRemaining = useAppSelector(selectWaitlistRemaining);
  const usage = useAppSelector(selectUsage);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Sync waitlist count from WaitlistService to Redux
  const syncWaitlistCount = useCallback(() => {
    const waitlistService = WaitlistService.getInstance();
    const count = waitlistService.getWaitlistCount();
    dispatch(updateUsage({ waitlistCount: count }));
  }, [dispatch]);

  // Sync on mount
  useEffect(() => {
    syncWaitlistCount();
  }, [syncWaitlistCount]);

  const onWaitlistLimitReached = useCallback(() => {
    setShowUpgradeModal(true);
  }, []);

  const hideUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
  }, []);

  const waitlistCount = usage?.waitlistCount || 0;

  return {
    canAddToWaitlist,
    onWaitlistLimitReached,
    showUpgradeModal,
    hideUpgradeModal,
    waitlistCount,
    waitlistLimit,
    waitlistRemaining,
    syncWaitlistCount,
  };
};

export default useWaitlistSubscription;
