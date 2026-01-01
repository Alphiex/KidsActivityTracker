/**
 * Firebase Analytics Service
 * Handles analytics tracking via Firebase Analytics SDK
 */

import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

export interface UserProperties {
  userId?: string;
  subscriptionTier?: 'free' | 'premium';
  isTrialing?: boolean;
  billingCycle?: 'monthly' | 'annual';
  childrenCount?: number;
  favoritesCount?: number;
  platform?: string;
  appVersion?: string;
  authProvider?: 'email' | 'google' | 'apple';
}

class FirebaseAnalyticsService {
  private static instance: FirebaseAnalyticsService;
  private isInitialized = false;
  private userId: string | null = null;

  private constructor() {
    // Initialize on construction
    this.initialize();
  }

  static getInstance(): FirebaseAnalyticsService {
    if (!FirebaseAnalyticsService.instance) {
      FirebaseAnalyticsService.instance = new FirebaseAnalyticsService();
    }
    return FirebaseAnalyticsService.instance;
  }

  /**
   * Initialize Firebase Analytics
   */
  private async initialize(): Promise<void> {
    try {
      // Enable analytics collection
      await analytics().setAnalyticsCollectionEnabled(true);
      this.isInitialized = true;
      console.log('[FirebaseAnalytics] Initialized successfully');
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to initialize:', error);
    }
  }

  /**
   * Set the user ID for analytics
   */
  async setUserId(userId: string | null): Promise<void> {
    try {
      this.userId = userId;
      await analytics().setUserId(userId);
      console.log('[FirebaseAnalytics] User ID set:', userId ? 'set' : 'cleared');
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to set user ID:', error);
    }
  }

  /**
   * Set user properties for segmentation
   */
  async setUserProperties(properties: UserProperties): Promise<void> {
    try {
      // Firebase Analytics only accepts string values for user properties
      const analyticsProperties: Record<string, string> = {};

      if (properties.subscriptionTier) {
        analyticsProperties.subscription_tier = properties.subscriptionTier;
      }
      if (properties.isTrialing !== undefined) {
        analyticsProperties.is_trialing = String(properties.isTrialing);
      }
      if (properties.billingCycle) {
        analyticsProperties.billing_cycle = properties.billingCycle;
      }
      if (properties.childrenCount !== undefined) {
        analyticsProperties.children_count = String(properties.childrenCount);
      }
      if (properties.favoritesCount !== undefined) {
        analyticsProperties.favorites_count = String(properties.favoritesCount);
      }
      if (properties.authProvider) {
        analyticsProperties.auth_provider = properties.authProvider;
      }

      // Platform is always set
      analyticsProperties.platform = Platform.OS;

      // Set each property individually
      for (const [key, value] of Object.entries(analyticsProperties)) {
        await analytics().setUserProperty(key, value);
      }

      console.log('[FirebaseAnalytics] User properties updated');
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to set user properties:', error);
    }
  }

  /**
   * Log a custom event
   */
  async logEvent(eventName: string, params?: Record<string, any>): Promise<void> {
    try {
      // Firebase event names must be alphanumeric with underscores, max 40 chars
      const sanitizedEventName = eventName
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .substring(0, 40);

      // Sanitize params - Firebase only accepts primitive values
      const sanitizedParams: Record<string, string | number | boolean> = {};
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40);
            if (typeof value === 'object') {
              sanitizedParams[sanitizedKey] = JSON.stringify(value);
            } else {
              sanitizedParams[sanitizedKey] = value;
            }
          }
        }
      }

      await analytics().logEvent(sanitizedEventName, sanitizedParams);
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to log event:', eventName, error);
    }
  }

  /**
   * Log screen view
   */
  async logScreenView(screenName: string, screenClass?: string): Promise<void> {
    try {
      await analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to log screen view:', error);
    }
  }

  /**
   * Log login event
   */
  async logLogin(method: 'email' | 'google' | 'apple'): Promise<void> {
    try {
      await analytics().logLogin({ method });
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to log login:', error);
    }
  }

  /**
   * Log sign up event
   */
  async logSignUp(method: 'email' | 'google' | 'apple'): Promise<void> {
    try {
      await analytics().logSignUp({ method });
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to log sign up:', error);
    }
  }

  /**
   * Log purchase event
   */
  async logPurchase(
    productId: string,
    value: number,
    currency: string = 'CAD'
  ): Promise<void> {
    try {
      await analytics().logPurchase({
        value,
        currency,
        items: [{ item_id: productId, item_name: productId }],
      });
    } catch (error) {
      console.error('[FirebaseAnalytics] Failed to log purchase:', error);
    }
  }

  /**
   * Check if analytics is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

export const firebaseAnalyticsService = FirebaseAnalyticsService.getInstance();
export default FirebaseAnalyticsService;
