import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { subscriptionService } from '../../services/subscriptionService';
import {
  SubscriptionPlan,
  SubscriptionInfo,
  PlanFeatures,
  SubscriptionTier,
  SubscriptionUsage,
  UserSubscription,
} from '../../types/subscription';

interface PlanInfo {
  code: SubscriptionTier;
  name: string;
  description?: string | null;
  monthlyPrice?: number;
  annualPrice?: number;
}

interface SubscriptionState {
  // Current subscription info
  currentSubscription: UserSubscription | null;
  currentPlan: PlanInfo | null;
  limits: PlanFeatures | null;
  usage: SubscriptionUsage | null;
  isTrialing: boolean;
  trialDaysRemaining: number | null;

  // Trial eligibility (abuse prevention)
  trialEligible: boolean | null; // null = not checked yet
  trialUsedAt: string | null; // ISO date string if trial already used

  // Available plans
  availablePlans: SubscriptionPlan[];

  // Loading states
  isLoading: boolean;
  isLoadingPlans: boolean;
  isPurchasing: boolean;
  isCheckingTrialEligibility: boolean;

  // Error state
  error: string | null;

  // Last fetch timestamp
  lastFetched: number | null;
}

const initialState: SubscriptionState = {
  currentSubscription: null,
  currentPlan: null,
  limits: null,
  usage: null,
  isTrialing: false,
  trialDaysRemaining: null,
  trialEligible: null,
  trialUsedAt: null,
  availablePlans: [],
  isLoading: false,
  isLoadingPlans: false,
  isPurchasing: false,
  isCheckingTrialEligibility: false,
  error: null,
  lastFetched: null,
};

// Default free limits (fallback if API fails)
const DEFAULT_FREE_LIMITS: PlanFeatures = {
  maxChildren: 2,
  maxFavorites: 10,
  maxSharedUsers: 1,
  maxWaitlistItems: 4,
  hasAdvancedFilters: false,
  hasCalendarExport: false,
  hasInstantAlerts: false,
  hasSavedSearches: false,
  savedSearchLimit: 0,
};

// Async thunks
export const fetchSubscription = createAsyncThunk(
  'subscription/fetchSubscription',
  async () => {
    const response = await subscriptionService.getCurrentSubscription();
    return response;
  }
);

export const fetchAvailablePlans = createAsyncThunk(
  'subscription/fetchAvailablePlans',
  async () => {
    const response = await subscriptionService.getAvailablePlans();
    return response;
  }
);

export const verifyPurchase = createAsyncThunk(
  'subscription/verifyPurchase',
  async (data: {
    externalId: string;
    externalProvider: 'revenuecat' | 'stripe';
    planCode?: string;
    billingCycle?: 'monthly' | 'annual';
  }) => {
    const response = await subscriptionService.verifyPurchase(data);
    return response;
  }
);

export const restorePurchases = createAsyncThunk(
  'subscription/restorePurchases',
  async (data: {
    externalId: string;
    externalProvider: 'revenuecat' | 'stripe';
    planCode?: string;
    billingCycle?: 'monthly' | 'annual';
  }) => {
    const response = await subscriptionService.restorePurchases(data);
    return response;
  }
);

export const startTrial = createAsyncThunk(
  'subscription/startTrial',
  async () => {
    const response = await subscriptionService.startTrial();
    return response;
  }
);

export const cancelSubscription = createAsyncThunk(
  'subscription/cancelSubscription',
  async () => {
    const response = await subscriptionService.cancelSubscription();
    return response;
  }
);

export const checkTrialEligibility = createAsyncThunk(
  'subscription/checkTrialEligibility',
  async () => {
    const response = await subscriptionService.checkTrialEligibility();
    return response;
  }
);

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSubscription: (state) => {
      // Reset to initial state on logout
      return initialState;
    },
    updateUsage: (state, action: PayloadAction<Partial<SubscriptionUsage>>) => {
      if (state.usage) {
        state.usage = { ...state.usage, ...action.payload };
      }
    },
    incrementUsage: (state, action: PayloadAction<keyof SubscriptionUsage>) => {
      if (state.usage) {
        state.usage[action.payload] += 1;
      }
    },
    decrementUsage: (state, action: PayloadAction<keyof SubscriptionUsage>) => {
      if (state.usage && state.usage[action.payload] > 0) {
        state.usage[action.payload] -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch Subscription
    builder
      .addCase(fetchSubscription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSubscription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSubscription = action.payload.subscription;
        state.currentPlan = action.payload.plan;
        state.limits = action.payload.limits;
        state.usage = action.payload.usage;
        state.isTrialing = action.payload.isTrialing;
        state.trialDaysRemaining = action.payload.trialDaysRemaining;
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(fetchSubscription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch subscription';
        // Set default free limits on error
        if (!state.limits) {
          state.limits = DEFAULT_FREE_LIMITS;
          state.currentPlan = {
            code: 'free',
            name: 'Discovery',
          };
        }
      });

    // Fetch Available Plans
    builder
      .addCase(fetchAvailablePlans.pending, (state) => {
        state.isLoadingPlans = true;
      })
      .addCase(fetchAvailablePlans.fulfilled, (state, action) => {
        state.isLoadingPlans = false;
        state.availablePlans = action.payload;
      })
      .addCase(fetchAvailablePlans.rejected, (state, action) => {
        state.isLoadingPlans = false;
        state.error = action.error.message || 'Failed to fetch plans';
      });

    // Verify Purchase
    builder
      .addCase(verifyPurchase.pending, (state) => {
        state.isPurchasing = true;
        state.error = null;
      })
      .addCase(verifyPurchase.fulfilled, (state, action) => {
        state.isPurchasing = false;
        state.currentSubscription = action.payload.subscription;
        state.currentPlan = {
          ...action.payload.plan,
          code: action.payload.plan.code as SubscriptionTier,
        };
        state.limits = action.payload.limits;
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(verifyPurchase.rejected, (state, action) => {
        state.isPurchasing = false;
        state.error = action.error.message || 'Failed to verify purchase';
      });

    // Restore Purchases
    builder
      .addCase(restorePurchases.pending, (state) => {
        state.isPurchasing = true;
        state.error = null;
      })
      .addCase(restorePurchases.fulfilled, (state, action) => {
        state.isPurchasing = false;
        if (action.payload.restored) {
          state.currentSubscription = action.payload.subscription;
          state.currentPlan = {
            ...action.payload.plan,
            code: action.payload.plan.code as SubscriptionTier,
          };
          state.limits = action.payload.limits;
        }
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(restorePurchases.rejected, (state, action) => {
        state.isPurchasing = false;
        state.error = action.error.message || 'Failed to restore purchases';
      });

    // Start Trial
    builder
      .addCase(startTrial.pending, (state) => {
        state.isPurchasing = true;
        state.error = null;
      })
      .addCase(startTrial.fulfilled, (state, action) => {
        state.isPurchasing = false;
        state.currentSubscription = action.payload.subscription;
        state.currentPlan = {
          ...action.payload.plan,
          code: action.payload.plan.code as SubscriptionTier,
        };
        state.limits = action.payload.limits;
        state.isTrialing = true;
        state.trialDaysRemaining = action.payload.trialDaysRemaining;
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(startTrial.rejected, (state, action) => {
        state.isPurchasing = false;
        state.error = action.error.message || 'Failed to start trial';
      });

    // Cancel Subscription
    builder
      .addCase(cancelSubscription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelSubscription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentPlan = {
          ...action.payload.plan,
          code: action.payload.plan.code as SubscriptionTier,
        };
        state.limits = action.payload.limits;
        state.isTrialing = false;
        state.trialDaysRemaining = null;
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(cancelSubscription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to cancel subscription';
      });

    // Check Trial Eligibility
    builder
      .addCase(checkTrialEligibility.pending, (state) => {
        state.isCheckingTrialEligibility = true;
      })
      .addCase(checkTrialEligibility.fulfilled, (state, action) => {
        state.isCheckingTrialEligibility = false;
        state.trialEligible = action.payload.eligible;
        state.trialUsedAt = action.payload.trialUsedAt || null;
      })
      .addCase(checkTrialEligibility.rejected, (state) => {
        state.isCheckingTrialEligibility = false;
        // Default to eligible if check fails (fail open)
        state.trialEligible = true;
      });
  },
});

export const {
  clearError,
  clearSubscription,
  updateUsage,
  incrementUsage,
  decrementUsage,
} = subscriptionSlice.actions;

export default subscriptionSlice.reducer;

// Selectors - with null safety for when subscription slice hasn't loaded yet
export const selectSubscription = (state: { subscription?: SubscriptionState }) =>
  state.subscription;

export const selectCurrentTier = (state: { subscription?: SubscriptionState }): SubscriptionTier =>
  state.subscription?.currentPlan?.code || 'free';

export const selectIsPremium = (state: { subscription?: SubscriptionState }): boolean =>
  state.subscription?.currentPlan?.code === 'premium';

export const selectIsTrialing = (state: { subscription?: SubscriptionState }): boolean =>
  state.subscription?.isTrialing ?? false;

export const selectLimits = (state: { subscription?: SubscriptionState }): PlanFeatures =>
  state.subscription?.limits || DEFAULT_FREE_LIMITS;

export const selectUsage = (state: { subscription?: SubscriptionState }): SubscriptionUsage | null =>
  state.subscription?.usage ?? null;

export const selectCanAddChild = (state: { subscription?: SubscriptionState }): boolean => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  return !usage || usage.childrenCount < limits.maxChildren;
};

export const selectCanAddFavorite = (state: { subscription?: SubscriptionState }): boolean => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  return !usage || usage.favoritesCount < limits.maxFavorites;
};

export const selectCanShare = (state: { subscription?: SubscriptionState }): boolean => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  return !usage || usage.sharedUsersCount < limits.maxSharedUsers;
};

export const selectHasFeature = (
  state: { subscription?: SubscriptionState },
  feature: keyof PlanFeatures
): boolean => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const value = limits[feature];
  return typeof value === 'boolean' ? value : value > 0;
};

export const selectChildrenRemaining = (state: { subscription?: SubscriptionState }): number => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  return Math.max(0, limits.maxChildren - (usage?.childrenCount || 0));
};

export const selectFavoritesRemaining = (state: { subscription?: SubscriptionState }): number => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  return Math.max(0, limits.maxFavorites - (usage?.favoritesCount || 0));
};

export const selectSharesRemaining = (state: { subscription?: SubscriptionState }): number => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  return Math.max(0, limits.maxSharedUsers - (usage?.sharedUsersCount || 0));
};

export const selectCanAddToWaitlist = (state: { subscription?: SubscriptionState }): boolean => {
  // Notifications/waitlist is a premium-only feature
  const isPremium = state.subscription?.currentPlan?.code === 'premium';
  const isTrialing = state.subscription?.isTrialing ?? false;
  return isPremium || isTrialing;
};

export const selectWaitlistRemaining = (state: { subscription?: SubscriptionState }): number => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  const usage = state.subscription?.usage;
  // Unlimited for premium
  if (limits.maxWaitlistItems === -1 || limits.maxWaitlistItems >= 1000) return 999;
  return Math.max(0, limits.maxWaitlistItems - (usage?.waitlistCount || 0));
};

export const selectWaitlistLimit = (state: { subscription?: SubscriptionState }): number => {
  const limits = state.subscription?.limits || DEFAULT_FREE_LIMITS;
  return limits.maxWaitlistItems;
};

export const selectTrialEligible = (state: { subscription?: SubscriptionState }): boolean | null =>
  state.subscription?.trialEligible ?? null;

export const selectTrialUsedAt = (state: { subscription?: SubscriptionState }): string | null =>
  state.subscription?.trialUsedAt ?? null;

export const selectTrialDaysRemaining = (state: { subscription?: SubscriptionState }): number | null =>
  state.subscription?.trialDaysRemaining ?? null;
