/**
 * useSubscription Hook
 * Provides convenient access to subscription state and limit checking
 */

import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../store';
import {
  selectCurrentTier,
  selectIsPremium,
  selectIsTrialing,
  selectLimits,
  selectUsage,
  selectCanAddChild,
  selectCanAddFavorite,
  selectCanShare,
  selectHasFeature,
  selectChildrenRemaining,
  selectFavoritesRemaining,
  selectSharesRemaining,
  fetchSubscription,
} from '../store/slices/subscriptionSlice';
import { PlanFeatures, SubscriptionTier } from '../types/subscription';
import { UpgradeFeature } from '../components/UpgradePromptModal';

interface UseSubscriptionReturn {
  // State
  tier: SubscriptionTier;
  isPremium: boolean;
  isTrialing: boolean;
  limits: PlanFeatures;
  usage: {
    childrenCount: number;
    favoritesCount: number;
    sharedUsersCount: number;
    savedSearchesCount: number;
  } | null;

  // Limit checks
  canAddChild: boolean;
  canAddFavorite: boolean;
  canShare: boolean;
  childrenRemaining: number;
  favoritesRemaining: number;
  sharesRemaining: number;

  // Feature checks
  hasAdvancedFilters: boolean;
  hasCalendarExport: boolean;
  hasInstantAlerts: boolean;
  hasSavedSearches: boolean;

  // Modal state (for showing upgrade prompt)
  showUpgradeModal: boolean;
  upgradeFeature: UpgradeFeature | null;

  // Actions
  checkAndShowUpgrade: (feature: UpgradeFeature) => boolean;
  openPaywall: () => void;
  hideUpgradeModal: () => void;
  refreshSubscription: () => Promise<void>;
}

const useSubscription = (): UseSubscriptionReturn => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();

  // State from Redux
  const tier = useAppSelector(selectCurrentTier);
  const isPremium = useAppSelector(selectIsPremium);
  const isTrialing = useAppSelector(selectIsTrialing);
  const limits = useAppSelector(selectLimits);
  const usage = useAppSelector(selectUsage);

  // Limit checks
  const canAddChild = useAppSelector(selectCanAddChild);
  const canAddFavorite = useAppSelector(selectCanAddFavorite);
  const canShare = useAppSelector(selectCanShare);
  const childrenRemaining = useAppSelector(selectChildrenRemaining);
  const favoritesRemaining = useAppSelector(selectFavoritesRemaining);
  const sharesRemaining = useAppSelector(selectSharesRemaining);

  // Feature checks
  const hasAdvancedFilters = useAppSelector((state) => selectHasFeature(state, 'hasAdvancedFilters'));
  const hasCalendarExport = useAppSelector((state) => selectHasFeature(state, 'hasCalendarExport'));
  const hasInstantAlerts = useAppSelector((state) => selectHasFeature(state, 'hasInstantAlerts'));
  const hasSavedSearches = useAppSelector((state) => selectHasFeature(state, 'hasSavedSearches'));

  // Local modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<UpgradeFeature | null>(null);

  /**
   * Check if a feature/limit is available and show upgrade modal if not
   * Returns true if the action should proceed, false if blocked
   */
  const checkAndShowUpgrade = useCallback(
    (feature: UpgradeFeature): boolean => {
      let isAllowed = false;

      switch (feature) {
        case 'children':
          isAllowed = canAddChild;
          break;
        case 'favorites':
          isAllowed = canAddFavorite;
          break;
        case 'sharing':
          isAllowed = canShare;
          break;
        case 'filters':
          isAllowed = hasAdvancedFilters;
          break;
        case 'calendar':
          isAllowed = hasCalendarExport;
          break;
        case 'alerts':
          isAllowed = hasInstantAlerts;
          break;
        case 'savedSearches':
          isAllowed = hasSavedSearches;
          break;
        default:
          isAllowed = isPremium;
      }

      if (!isAllowed) {
        setUpgradeFeature(feature);
        setShowUpgradeModal(true);
        return false;
      }

      return true;
    },
    [
      canAddChild,
      canAddFavorite,
      canShare,
      hasAdvancedFilters,
      hasCalendarExport,
      hasInstantAlerts,
      hasSavedSearches,
      isPremium,
    ]
  );

  const openPaywall = useCallback(() => {
    navigation.navigate('Paywall');
  }, [navigation]);

  const hideUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
    setUpgradeFeature(null);
  }, []);

  const refreshSubscription = useCallback(async () => {
    await dispatch(fetchSubscription());
  }, [dispatch]);

  return {
    // State
    tier,
    isPremium,
    isTrialing,
    limits,
    usage,

    // Limit checks
    canAddChild,
    canAddFavorite,
    canShare,
    childrenRemaining,
    favoritesRemaining,
    sharesRemaining,

    // Feature checks
    hasAdvancedFilters,
    hasCalendarExport,
    hasInstantAlerts,
    hasSavedSearches,

    // Modal state
    showUpgradeModal,
    upgradeFeature,

    // Actions
    checkAndShowUpgrade,
    openPaywall,
    hideUpgradeModal,
    refreshSubscription,
  };
};

export default useSubscription;
