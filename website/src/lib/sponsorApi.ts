/**
 * Sponsor Portal API Client
 * Handles all API calls for the sponsor/partner portal
 */

import { API_URL } from './constants';

// Types
export interface Plan {
  id: string;
  name: string;
  tier: string;
  monthlyPrice: string;
  yearlyPrice: string;
  impressionLimit: number | null;
  features: {
    priority?: boolean;
    analytics?: boolean;
    targeting?: boolean;
    badge?: string;
  };
}

export interface SponsorInfo {
  id: string;
  provider: {
    id: string;
    name: string;
  };
  plan: Plan | null;
  subscriptionStatus: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  targetCities: string[];
  targetProvinces: string[];
  billingEmail: string;
  billingName: string | null;
}

export interface BillingUpdatePayload {
  billingEmail?: string;
  billingName?: string;
}

export interface SubscriptionRequestPayload {
  planId: string;
  billingCycle: 'monthly' | 'annual';
  message?: string;
}

export interface CheckoutPayload {
  tier: 'bronze' | 'silver' | 'gold';
  billingCycle: 'monthly' | 'annual';
}

export interface CheckoutResponse {
  success: boolean;
  checkoutUrl: string;
  sessionId: string;
  tier: string;
  billingCycle: string;
  price: number;
}

export interface SubscriptionDetails {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: string | null;
}

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sponsor_token');
}

// API Client class
class SponsorApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = getAuthToken();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  }

  /**
   * Get current sponsor account info
   */
  async getCurrentSponsor(): Promise<{ success: boolean; sponsor: SponsorInfo }> {
    return this.fetch('/api/sponsor/auth/me');
  }

  /**
   * Get available plans
   */
  async getPlans(): Promise<{ success: boolean; plans: Plan[] }> {
    return this.fetch('/api/sponsor/plans');
  }

  /**
   * Update billing information
   */
  async updateBilling(data: BillingUpdatePayload): Promise<{
    success: boolean;
    billing: { billingEmail: string; billingName: string | null };
  }> {
    return this.fetch('/api/sponsor/billing', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Request a subscription upgrade
   */
  async requestSubscription(data: SubscriptionRequestPayload): Promise<{
    success: boolean;
    message: string;
    requestDetails: {
      requestedPlan: string;
      billingCycle: string;
      price: string;
    };
  }> {
    return this.fetch('/api/sponsor/subscription/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Cancel current subscription
   */
  async cancelSubscription(): Promise<{
    success: boolean;
    message: string;
    subscription: {
      status: string;
      endDate: string | null;
    };
  }> {
    return this.fetch('/api/sponsor/subscription/cancel', {
      method: 'POST',
    });
  }

  /**
   * Create Stripe Checkout session for subscription
   */
  async createCheckoutSession(data: CheckoutPayload): Promise<CheckoutResponse> {
    return this.fetch('/api/sponsor/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get Stripe Customer Portal session for managing subscription
   */
  async getCustomerPortal(): Promise<{ success: boolean; portalUrl: string }> {
    return this.fetch('/api/sponsor/subscription/portal', {
      method: 'POST',
    });
  }

  /**
   * Get detailed subscription information from Stripe
   */
  async getSubscriptionDetails(): Promise<{ success: boolean; subscription: SubscriptionDetails }> {
    return this.fetch('/api/sponsor/subscription/details');
  }

  /**
   * Update targeting settings
   */
  async updateSettings(data: {
    targetCities?: string[];
    targetProvinces?: string[];
  }): Promise<{
    success: boolean;
    settings: {
      targetCities: string[];
      targetProvinces: string[];
    };
  }> {
    return this.fetch('/api/sponsor/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get dashboard data
   */
  async getDashboard(): Promise<{
    success: boolean;
    dashboard: {
      today: { impressions: number; clicks: number; ctr: string };
      last7Days: { impressions: number; clicks: number; ctr: string };
      last30Days: { impressions: number; clicks: number; ctr: string };
      dailyTrend: Array<{ date: string; impressionsTotal: number; clicksTotal: number }>;
      subscription: { plan: Plan | null; status: string; endsAt: string | null };
    };
  }> {
    return this.fetch('/api/sponsor/dashboard');
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/api/sponsor/auth/forgot-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    return data;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/api/sponsor/auth/reset-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Reset failed');
    }
    return data;
  }

  /**
   * Get detailed analytics
   */
  async getAnalytics(startDate?: string, endDate?: string): Promise<{
    success: boolean;
    analytics: {
      period: { start: string; end: string };
      totals: { impressions: number; clicks: number; ctr: string };
      timeSeries: Array<{ date: string; impressionsTotal: number; clicksTotal: number }>;
      breakdown: {
        byPlacement: {
          impressions: Array<{ placement: string; _count: number }>;
          clicks: Array<{ placement: string; _count: number }>;
        };
        byCity: {
          impressions: Array<{ city: string; _count: number }>;
          clicks: Array<{ city: string; _count: number }>;
        };
      };
    };
  }> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const queryString = params.toString();
    return this.fetch(`/api/sponsor/analytics${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get analytics broken down by activity
   */
  async getActivityAnalytics(startDate?: string, endDate?: string, limit?: number): Promise<{
    success: boolean;
    period: { start: string; end: string };
    activities: Array<{
      activityId: string;
      name: string;
      activityType: string | null;
      location: string | null;
      city: string | null;
      impressions: number;
      clicks: number;
      ctr: string;
    }>;
    totalActivities: number;
  }> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (limit) params.set('limit', limit.toString());
    const queryString = params.toString();
    return this.fetch(`/api/sponsor/analytics/activities${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get detailed analytics for a specific activity
   */
  async getSingleActivityAnalytics(activityId: string, startDate?: string, endDate?: string): Promise<{
    success: boolean;
    activity: {
      id: string;
      name: string;
      activityType: string;
      location: { name: string; city: string; province: string } | null;
    };
    period: { start: string; end: string };
    totals: { impressions: number; clicks: number; ctr: string };
    breakdown: {
      byDestination: Array<{ type: string; count: number }>;
      byPlacement: Array<{ placement: string; count: number }>;
    };
  }> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const queryString = params.toString();
    return this.fetch(`/api/sponsor/analytics/activity/${activityId}${queryString ? `?${queryString}` : ''}`);
  }
}

export const sponsorApi = new SponsorApiClient();
