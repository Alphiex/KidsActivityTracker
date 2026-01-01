/**
 * Analytics Service
 * Tracks subscription-related events and user behavior
 *
 * Connected to Firebase Analytics for production tracking.
 */

import { Platform } from 'react-native';
import { firebaseAnalyticsService } from './firebaseAnalyticsService';

// Event types for subscription tracking
export type SubscriptionEvent =
  | 'paywall_viewed'
  | 'paywall_dismissed'
  | 'plan_selected'
  | 'purchase_initiated'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'purchase_cancelled'
  | 'trial_started'
  | 'trial_converted'
  | 'trial_expired'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'restore_initiated'
  | 'restore_completed'
  | 'restore_failed'
  | 'upgrade_prompt_shown'
  | 'upgrade_prompt_dismissed'
  | 'upgrade_prompt_accepted';

export type FeatureEvent =
  | 'limit_reached'
  | 'feature_gated'
  | 'premium_feature_used';

export type UserEvent =
  | 'app_opened'
  | 'session_started'
  | 'user_registered'
  | 'user_logged_in'
  | 'user_logged_out';

type AnalyticsEvent = SubscriptionEvent | FeatureEvent | UserEvent;

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

interface UserProperties {
  userId?: string;
  subscriptionTier?: 'free' | 'premium';
  isTrialing?: boolean;
  billingCycle?: 'monthly' | 'annual';
  childrenCount?: number;
  favoritesCount?: number;
  platform?: string;
  appVersion?: string;
}

class AnalyticsService {
  private isInitialized = false;
  private userId: string | null = null;
  private userProperties: UserProperties = {};
  private eventQueue: Array<{ event: string; properties: EventProperties }> = [];

  // Analytics provider - using Firebase
  private provider: 'console' | 'firebase' | 'mixpanel' | 'amplitude' = 'firebase';

  /**
   * Initialize analytics with user ID
   */
  async initialize(userId?: string): Promise<void> {
    this.userId = userId || null;
    this.userProperties.platform = Platform.OS;

    // Set user ID in Firebase Analytics
    await firebaseAnalyticsService.setUserId(userId || null);

    this.isInitialized = true;
    console.log('[Analytics] Initialized with Firebase', { userId: userId ? 'set' : 'none' });

    // Flush queued events
    this.flushQueue();
  }

  /**
   * Set user properties for segmentation
   */
  setUserProperties(properties: Partial<UserProperties>): void {
    this.userProperties = { ...this.userProperties, ...properties };

    // Set properties in Firebase Analytics
    firebaseAnalyticsService.setUserProperties(this.userProperties);
  }

  /**
   * Track an event
   */
  track(event: AnalyticsEvent, properties?: EventProperties): void {
    const enrichedProperties: EventProperties = {
      ...properties,
      timestamp: Date.now(),
      platform: Platform.OS,
      userId: this.userId || undefined,
      subscriptionTier: this.userProperties.subscriptionTier,
    };

    if (!this.isInitialized) {
      // Queue event for later
      this.eventQueue.push({ event, properties: enrichedProperties });
      return;
    }

    this.logEvent(event, enrichedProperties);
  }

  /**
   * Log event to provider
   */
  private logEvent(event: string, properties: EventProperties): void {
    switch (this.provider) {
      case 'firebase':
        // Log to Firebase Analytics
        firebaseAnalyticsService.logEvent(event, properties);
        break;
      case 'mixpanel':
        // Mixpanel not implemented
        console.log(`[Analytics:Mixpanel] ${event}`, properties);
        break;
      case 'amplitude':
        // Amplitude not implemented
        console.log(`[Analytics:Amplitude] ${event}`, properties);
        break;
      case 'console':
      default:
        console.log(`[Analytics] ${event}`, properties);
    }
  }

  /**
   * Flush queued events
   */
  private flushQueue(): void {
    while (this.eventQueue.length > 0) {
      const { event, properties } = this.eventQueue.shift()!;
      this.logEvent(event, properties);
    }
  }

  // ==========================================
  // Subscription-specific tracking methods
  // ==========================================

  /**
   * Track paywall view
   */
  trackPaywallViewed(source: string, variant?: string): void {
    this.track('paywall_viewed', {
      source,
      variant: variant || 'default',
    });
  }

  /**
   * Track paywall dismissed
   */
  trackPaywallDismissed(source: string, timeSpentMs: number): void {
    this.track('paywall_dismissed', {
      source,
      timeSpentMs,
    });
  }

  /**
   * Track plan selection
   */
  trackPlanSelected(planCode: string, billingCycle: 'monthly' | 'annual'): void {
    this.track('plan_selected', {
      planCode,
      billingCycle,
    });
  }

  /**
   * Track purchase initiated
   */
  trackPurchaseInitiated(
    productId: string,
    price: number,
    currency: string
  ): void {
    this.track('purchase_initiated', {
      productId,
      price,
      currency,
    });
  }

  /**
   * Track purchase completed
   */
  trackPurchaseCompleted(
    productId: string,
    price: number,
    currency: string,
    isTrialConversion: boolean = false
  ): void {
    // Use Firebase's built-in purchase event for revenue tracking
    firebaseAnalyticsService.logPurchase(productId, price, currency);

    this.track('purchase_completed', {
      productId,
      price,
      currency,
      isTrialConversion,
    });

    // Update user properties
    this.setUserProperties({
      subscriptionTier: 'premium',
      billingCycle: productId.includes('annual') ? 'annual' : 'monthly',
    });
  }

  /**
   * Track purchase failed
   */
  trackPurchaseFailed(productId: string, errorCode: string, errorMessage: string): void {
    this.track('purchase_failed', {
      productId,
      errorCode,
      errorMessage,
    });
  }

  /**
   * Track purchase cancelled by user
   */
  trackPurchaseCancelled(productId: string): void {
    this.track('purchase_cancelled', {
      productId,
    });
  }

  /**
   * Track trial started
   */
  trackTrialStarted(trialDays: number): void {
    this.track('trial_started', {
      trialDays,
    });

    this.setUserProperties({
      subscriptionTier: 'premium',
      isTrialing: true,
    });
  }

  /**
   * Track restore purchases
   */
  trackRestoreInitiated(): void {
    this.track('restore_initiated', {});
  }

  trackRestoreCompleted(wasRestored: boolean): void {
    this.track('restore_completed', {
      wasRestored,
    });
  }

  trackRestoreFailed(errorMessage: string): void {
    this.track('restore_failed', {
      errorMessage,
    });
  }

  /**
   * Track upgrade prompt shown (when limit reached)
   */
  trackUpgradePromptShown(feature: string, currentCount?: number, limit?: number): void {
    this.track('upgrade_prompt_shown', {
      feature,
      currentCount,
      limit,
    });
  }

  /**
   * Track upgrade prompt dismissed
   */
  trackUpgradePromptDismissed(feature: string): void {
    this.track('upgrade_prompt_dismissed', {
      feature,
    });
  }

  /**
   * Track upgrade prompt accepted (user tapped upgrade)
   */
  trackUpgradePromptAccepted(feature: string): void {
    this.track('upgrade_prompt_accepted', {
      feature,
    });
  }

  /**
   * Track limit reached
   */
  trackLimitReached(resource: string, currentCount: number, limit: number): void {
    this.track('limit_reached', {
      resource,
      currentCount,
      limit,
    });
  }

  /**
   * Track premium feature usage
   */
  trackPremiumFeatureUsed(feature: string): void {
    this.track('premium_feature_used', {
      feature,
    });
  }

  // ==========================================
  // User lifecycle tracking
  // ==========================================

  trackAppOpened(): void {
    this.track('app_opened', {});
  }

  trackUserRegistered(method: 'email' | 'google' | 'apple'): void {
    // Use Firebase's built-in sign_up event for better analytics
    firebaseAnalyticsService.logSignUp(method);
    this.track('user_registered', {
      method,
    });
  }

  trackUserLoggedIn(method: 'email' | 'google' | 'apple'): void {
    // Use Firebase's built-in login event for better analytics
    firebaseAnalyticsService.logLogin(method);
    this.track('user_logged_in', {
      method,
    });
  }

  trackUserLoggedOut(): void {
    this.track('user_logged_out', {});
    this.userId = null;
    this.userProperties = {};
  }
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;
