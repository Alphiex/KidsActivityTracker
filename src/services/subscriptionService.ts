import apiClient from './apiClient';
import {
  SubscriptionPlan,
  SubscriptionInfo,
  LimitCheckResult,
  PlanFeatures,
  ResourceName,
  FeatureName,
  UserSubscription,
  SubscriptionTier,
} from '../types/subscription';

interface VerifyPurchaseParams {
  externalId: string;
  externalProvider: 'revenuecat' | 'stripe';
  planCode?: string;
  billingCycle?: 'monthly' | 'annual';
  currentPeriodEnd?: string;
}

interface PlanInfo {
  code: string;
  name: string;
  description?: string | null;
  monthlyPrice?: number;
  annualPrice?: number;
}

interface VerifyPurchaseResponse {
  success: boolean;
  message: string;
  subscription: UserSubscription;
  plan: PlanInfo;
  limits: PlanFeatures;
}

interface RestorePurchasesResponse extends VerifyPurchaseResponse {
  restored: boolean;
}

interface StartTrialResponse {
  success: boolean;
  message: string;
  subscription: UserSubscription;
  plan: PlanInfo;
  limits: PlanFeatures;
  trialDaysRemaining: number;
}

interface CancelResponse {
  success: boolean;
  message: string;
  plan: PlanInfo;
  limits: PlanFeatures;
}

interface PlansResponse {
  success: boolean;
  plans: SubscriptionPlan[];
}

interface CurrentSubscriptionResponse {
  success: boolean;
  subscription: UserSubscription | null;
  plan: {
    code: string;
    name: string;
    description: string | null;
    monthlyPrice: number;
    annualPrice: number;
  };
  limits: PlanFeatures;
  usage: {
    childrenCount: number;
    favoritesCount: number;
    sharedUsersCount: number;
    savedSearchesCount: number;
    waitlistCount: number;
  };
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

interface LimitCheckResponse {
  success: boolean;
  resource: ResourceName;
  allowed: boolean;
  current: number;
  limit: number;
}

interface FeatureCheckResponse {
  success: boolean;
  feature: FeatureName;
  hasAccess: boolean;
}

class SubscriptionService {
  private api = apiClient;

  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await this.api.get<PlansResponse>('/api/subscriptions/plans');
      return response.plans;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to fetch plans:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to fetch subscription plans');
    }
  }

  /**
   * Get current user's subscription info
   */
  async getCurrentSubscription(): Promise<SubscriptionInfo> {
    try {
      const response = await this.api.get<CurrentSubscriptionResponse>('/api/subscriptions/current');
      return {
        subscription: response.subscription,
        plan: {
          ...response.plan,
          code: response.plan.code as SubscriptionTier,
        },
        limits: response.limits,
        usage: response.usage,
        isTrialing: response.isTrialing,
        trialDaysRemaining: response.trialDaysRemaining,
      };
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to fetch subscription:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to fetch subscription');
    }
  }

  /**
   * Get just the limits (faster endpoint)
   */
  async getLimits(): Promise<PlanFeatures> {
    try {
      const response = await this.api.get<{ success: boolean; limits: PlanFeatures }>(
        '/api/subscriptions/limits'
      );
      return response.limits;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to fetch limits:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to fetch limits');
    }
  }

  /**
   * Check if user can add more of a resource
   */
  async checkLimit(resource: ResourceName): Promise<LimitCheckResult> {
    try {
      const response = await this.api.get<LimitCheckResponse>(
        `/api/subscriptions/check/${resource}`
      );
      return {
        allowed: response.allowed,
        current: response.current,
        limit: response.limit,
      };
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to check limit:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to check limit');
    }
  }

  /**
   * Check if user has access to a feature
   */
  async checkFeature(feature: FeatureName): Promise<boolean> {
    try {
      const response = await this.api.get<FeatureCheckResponse>(
        `/api/subscriptions/feature/${feature}`
      );
      return response.hasAccess;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to check feature:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to check feature');
    }
  }

  /**
   * Verify a purchase from RevenueCat/Stripe
   */
  async verifyPurchase(params: VerifyPurchaseParams): Promise<VerifyPurchaseResponse> {
    try {
      const response = await this.api.post<VerifyPurchaseResponse>(
        '/api/subscriptions/verify',
        params
      );
      return response;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to verify purchase:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to verify purchase');
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(params: VerifyPurchaseParams): Promise<RestorePurchasesResponse> {
    try {
      const response = await this.api.post<RestorePurchasesResponse>(
        '/api/subscriptions/restore',
        params
      );
      return response;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to restore purchases:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to restore purchases');
    }
  }

  /**
   * Start a free trial
   */
  async startTrial(): Promise<StartTrialResponse> {
    try {
      const response = await this.api.post<StartTrialResponse>(
        '/api/subscriptions/start-trial',
        {}
      );
      return response;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to start trial:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to start trial');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<CancelResponse> {
    try {
      const response = await this.api.post<CancelResponse>(
        '/api/subscriptions/cancel',
        {}
      );
      return response;
    } catch (error: any) {
      console.error('[SubscriptionService] Failed to cancel subscription:', error.message);
      throw new Error(error.response?.data?.error || 'Failed to cancel subscription');
    }
  }
}

export const subscriptionService = new SubscriptionService();
export default SubscriptionService;
