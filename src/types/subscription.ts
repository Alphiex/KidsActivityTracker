/**
 * Subscription Types for Kids Activity Tracker
 * Defines types for the freemium subscription system
 */

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'expired';
export type BillingCycle = 'monthly' | 'annual';

/**
 * Features and limits for a subscription plan
 */
export interface PlanFeatures {
  maxChildren: number;
  maxFavorites: number;
  maxSharedUsers: number;
  hasAdvancedFilters: boolean;
  hasCalendarExport: boolean;
  hasInstantAlerts: boolean;
  hasSavedSearches: boolean;
  savedSearchLimit: number;
}

/**
 * Subscription plan definition
 */
export interface SubscriptionPlan {
  code: SubscriptionTier;
  name: string;
  description: string | null;
  monthlyPrice: number;
  annualPrice: number;
  features: PlanFeatures;
}

/**
 * User's current subscription
 */
export interface UserSubscription {
  id: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle | null;
  startDate: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  externalProvider: 'revenuecat' | 'stripe' | null;
}

/**
 * Usage statistics for the current user
 */
export interface SubscriptionUsage {
  childrenCount: number;
  favoritesCount: number;
  sharedUsersCount: number;
  savedSearchesCount: number;
}

/**
 * Full subscription info returned from API
 */
export interface SubscriptionInfo {
  subscription: UserSubscription | null;
  plan: {
    code: SubscriptionTier;
    name: string;
    description: string | null;
    monthlyPrice: number;
    annualPrice: number;
  };
  limits: PlanFeatures;
  usage: SubscriptionUsage;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

/**
 * Limit check result from API
 */
export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * API error response for subscription limits
 */
export interface SubscriptionLimitError {
  success: false;
  error: 'SUBSCRIPTION_LIMIT_REACHED';
  message: string;
  limit: number;
  current: number;
}

/**
 * Check if an error is a subscription limit error
 */
export function isSubscriptionLimitError(error: any): error is SubscriptionLimitError {
  return error?.error === 'SUBSCRIPTION_LIMIT_REACHED';
}

/**
 * Feature names that can be checked
 */
export type FeatureName =
  | 'hasAdvancedFilters'
  | 'hasCalendarExport'
  | 'hasInstantAlerts'
  | 'hasSavedSearches';

/**
 * Resource names for limit checks
 */
export type ResourceName = 'children' | 'favorites' | 'shares' | 'saved-searches';
