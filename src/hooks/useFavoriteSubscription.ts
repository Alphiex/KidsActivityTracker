/**
 * useFavoriteSubscription Hook
 * Provides subscription-aware props for ActivityCard favorite functionality
 */

import { useState, useCallback } from 'react';
import { useAppSelector } from '../store';
import {
  selectCanAddFavorite,
  selectLimits,
  selectUsage,
} from '../store/slices/subscriptionSlice';

interface UseFavoriteSubscriptionReturn {
  // Props to pass to ActivityCard
  canAddFavorite: boolean;
  onFavoriteLimitReached: () => void;

  // Modal state
  showUpgradeModal: boolean;
  hideUpgradeModal: () => void;

  // Current usage info
  favoritesCount: number;
  favoritesLimit: number;
  favoritesRemaining: number;
}

const useFavoriteSubscription = (): UseFavoriteSubscriptionReturn => {
  const canAddFavorite = useAppSelector(selectCanAddFavorite);
  const limits = useAppSelector(selectLimits);
  const usage = useAppSelector(selectUsage);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const onFavoriteLimitReached = useCallback(() => {
    setShowUpgradeModal(true);
  }, []);

  const hideUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
  }, []);

  const favoritesCount = usage?.favoritesCount || 0;
  const favoritesLimit = limits.maxFavorites;
  const favoritesRemaining = Math.max(0, favoritesLimit - favoritesCount);

  return {
    canAddFavorite,
    onFavoriteLimitReached,
    showUpgradeModal,
    hideUpgradeModal,
    favoritesCount,
    favoritesLimit,
    favoritesRemaining,
  };
};

export default useFavoriteSubscription;
