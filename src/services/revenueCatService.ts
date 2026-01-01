/**
 * RevenueCat Service
 * Handles in-app purchases and subscription management via RevenueCat SDK
 *
 * Configuration:
 * - Entitlement: KidsActivityTracker Premium
 * - Products: monthly, yearly
 */

import { Platform } from 'react-native';
import Config from 'react-native-config';
import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesError,
} from 'react-native-purchases';
import { store } from '../store';
import { fetchSubscription, verifyPurchase } from '../store/slices/subscriptionSlice';
import { SubscriptionTier } from '../types/subscription';
import apiClient from './apiClient';

interface TrialEligibility {
  eligible: boolean;
  reason?: string;
  trialUsedAt?: string;
}

// Lazy load RevenueCat UI to avoid Android linking errors
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = null;
let revenueCatUIAvailable = false;

const loadRevenueCatUI = async (): Promise<boolean> => {
  if (RevenueCatUI !== null) return revenueCatUIAvailable;

  try {
    const module = require('react-native-purchases-ui');
    RevenueCatUI = module.default;
    PAYWALL_RESULT = module.PAYWALL_RESULT;
    revenueCatUIAvailable = true;
    console.log('[RevenueCat] UI module loaded successfully');
    return true;
  } catch (error) {
    console.warn('[RevenueCat] UI module not available:', error);
    revenueCatUIAvailable = false;
    return false;
  }
};

// RevenueCat API Keys - loaded from environment variables
// iOS: appl_* key from RevenueCat dashboard
// Android: goog_* key from RevenueCat dashboard (falls back to iOS key if not set)
// Note: For production Android builds, set REVENUECAT_ANDROID_API_KEY in .env
const REVENUECAT_IOS_API_KEY = Config.REVENUECAT_IOS_API_KEY || '';
const REVENUECAT_ANDROID_API_KEY = Config.REVENUECAT_ANDROID_API_KEY || Config.REVENUECAT_IOS_API_KEY || '';

// Get the appropriate API key based on platform
const getApiKey = (): string => {
  return Platform.OS === 'ios' ? REVENUECAT_IOS_API_KEY : REVENUECAT_ANDROID_API_KEY;
};

// Product identifiers (must match RevenueCat dashboard configuration)
export const PRODUCT_IDS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

// Entitlement identifier (must match RevenueCat dashboard configuration)
export const ENTITLEMENTS = {
  PRO: 'KidsActivityTracker Pro',
} as const;

// Paywall result types for external use
// Re-export dynamically loaded PAYWALL_RESULT
export const getPaywallResult = () => PAYWALL_RESULT;

export type PaywallResultType = 'NOT_PRESENTED' | 'PURCHASED' | 'CANCELLED' | 'RESTORED' | 'ERROR';

interface RevenueCatState {
  isConfigured: boolean;
  isInitializing: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  isPro: boolean;
}

class RevenueCatService {
  private state: RevenueCatState = {
    isConfigured: false,
    isInitializing: false,
    customerInfo: null,
    offerings: null,
    isPro: false,
  };

  private listeners: Set<(state: RevenueCatState) => void> = new Set();

  /**
   * Initialize RevenueCat SDK
   * Call this once when the app starts
   */
  async initialize(userId?: string): Promise<void> {
    if (this.state.isConfigured || this.state.isInitializing) {
      console.log('[RevenueCat] Already configured or initializing');
      return;
    }

    this.state.isInitializing = true;

    try {
      // Enable debug logs in development
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure RevenueCat with platform-specific API key
      await Purchases.configure({
        apiKey: getApiKey(),
        appUserID: userId || null, // null = anonymous user
      });

      this.state.isConfigured = true;
      console.log('[RevenueCat] Initialized successfully');

      // Set up listener for customer info updates
      Purchases.addCustomerInfoUpdateListener((customerInfo: CustomerInfo) => {
        console.log('[RevenueCat] Customer info updated');
        this.handleCustomerInfoUpdate(customerInfo);
      });

      // Get initial customer info
      const customerInfo = await Purchases.getCustomerInfo();
      this.handleCustomerInfoUpdate(customerInfo);

      // Pre-fetch offerings
      await this.refreshOfferings();
    } catch (error: any) {
      console.error('[RevenueCat] Failed to initialize:', error.message);
      this.state.isConfigured = false;
    } finally {
      this.state.isInitializing = false;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: RevenueCatState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  /**
   * Check if RevenueCat is configured
   */
  isReady(): boolean {
    return this.state.isConfigured;
  }

  /**
   * Check if user has Pro entitlement
   */
  isPro(): boolean {
    return this.state.isPro;
  }

  /**
   * Get current state
   */
  getState(): Readonly<RevenueCatState> {
    return { ...this.state };
  }

  /**
   * Get available offerings (subscription options)
   */
  async getOfferings(): Promise<PurchasesOfferings | null> {
    if (!this.isReady()) {
      console.warn('[RevenueCat] Not configured, cannot get offerings');
      return null;
    }

    try {
      const offerings = await Purchases.getOfferings();
      this.state.offerings = offerings;
      this.notifyListeners();
      console.log('[RevenueCat] Offerings loaded:', offerings.current?.identifier);
      return offerings;
    } catch (error: any) {
      console.error('[RevenueCat] Failed to get offerings:', error.message);
      throw new Error('Failed to load subscription options');
    }
  }

  /**
   * Refresh offerings
   */
  async refreshOfferings(): Promise<void> {
    await this.getOfferings();
  }

  /**
   * Get monthly package from current offering
   */
  getMonthlyPackage(): PurchasesPackage | null {
    return this.state.offerings?.current?.monthly ?? null;
  }

  /**
   * Get annual/yearly package from current offering
   */
  getYearlyPackage(): PurchasesPackage | null {
    return this.state.offerings?.current?.annual ?? null;
  }

  /**
   * Purchase a package
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    if (!this.isReady()) {
      throw new Error('RevenueCat not configured');
    }

    try {
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Update local state
      this.handleCustomerInfoUpdate(customerInfo);

      // Verify the purchase with our backend
      await this.syncWithBackend(customerInfo);

      return customerInfo;
    } catch (error: any) {
      const purchasesError = error as PurchasesError;

      if (purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        throw new Error('Purchase cancelled');
      }

      console.error('[RevenueCat] Purchase failed:', error.message);
      throw new Error(error.message || 'Purchase failed');
    }
  }

  /**
   * Present the RevenueCat Paywall
   * Returns the result of the paywall interaction
   */
  async presentPaywall(): Promise<PaywallResultType> {
    if (!this.isReady()) {
      throw new Error('RevenueCat not configured');
    }

    // Load UI module if not already loaded
    const uiAvailable = await loadRevenueCatUI();
    if (!uiAvailable || !RevenueCatUI) {
      console.warn('[RevenueCat] UI module not available, cannot present paywall');
      throw new Error('Paywall not available on this platform');
    }

    try {
      console.log('[RevenueCat] Presenting paywall');
      const paywallResult = await RevenueCatUI.presentPaywall();

      console.log('[RevenueCat] Paywall result:', paywallResult);

      // If purchased or restored, sync with backend
      if (
        PAYWALL_RESULT &&
        (paywallResult === PAYWALL_RESULT.PURCHASED ||
          paywallResult === PAYWALL_RESULT.RESTORED)
      ) {
        const customerInfo = await this.getCustomerInfo();
        if (customerInfo) {
          await this.syncWithBackend(customerInfo);
        }
      }

      return paywallResult;
    } catch (error: any) {
      console.error('[RevenueCat] Paywall error:', error.message);
      throw error;
    }
  }

  /**
   * Present paywall if user is not entitled to Pro
   * Returns true if user is now entitled (either already was or just purchased)
   */
  async presentPaywallIfNeeded(): Promise<boolean> {
    if (!this.isReady()) {
      await this.initialize();
    }

    // Check if already Pro
    if (this.isPro()) {
      console.log('[RevenueCat] User already has Pro entitlement');
      return true;
    }

    // Load UI module if not already loaded
    const uiAvailable = await loadRevenueCatUI();
    if (!uiAvailable || !RevenueCatUI) {
      console.warn('[RevenueCat] UI module not available');
      return false;
    }

    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENTS.PRO,
      });

      console.log('[RevenueCat] Paywall if needed result:', result);

      // Refresh customer info after paywall
      await this.getCustomerInfo();

      return this.isPro();
    } catch (error: any) {
      console.error('[RevenueCat] Paywall if needed error:', error.message);
      return false;
    }
  }

  /**
   * Present the Customer Center for subscription management
   */
  async presentCustomerCenter(): Promise<void> {
    if (!this.isReady()) {
      throw new Error('RevenueCat not configured');
    }

    // Load UI module if not already loaded
    const uiAvailable = await loadRevenueCatUI();
    if (!uiAvailable || !RevenueCatUI) {
      console.warn('[RevenueCat] UI module not available, cannot present customer center');
      throw new Error('Customer center not available on this platform');
    }

    try {
      console.log('[RevenueCat] Presenting Customer Center');
      await RevenueCatUI.presentCustomerCenter();

      // Refresh customer info after Customer Center is closed
      await this.refreshCustomerInfo();
    } catch (error: any) {
      console.error('[RevenueCat] Customer Center error:', error.message);
      throw error;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<CustomerInfo> {
    if (!this.isReady()) {
      throw new Error('RevenueCat not configured');
    }

    try {
      console.log('[RevenueCat] Restoring purchases');
      const customerInfo = await Purchases.restorePurchases();

      // Update local state
      this.handleCustomerInfoUpdate(customerInfo);

      // Sync with backend
      await this.syncWithBackend(customerInfo);

      return customerInfo;
    } catch (error: any) {
      console.error('[RevenueCat] Restore failed:', error.message);
      throw new Error('Failed to restore purchases');
    }
  }

  /**
   * Get current customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      this.handleCustomerInfoUpdate(customerInfo);
      return customerInfo;
    } catch (error: any) {
      console.error('[RevenueCat] Failed to get customer info:', error.message);
      return null;
    }
  }

  /**
   * Refresh customer info from RevenueCat
   */
  async refreshCustomerInfo(): Promise<CustomerInfo | null> {
    return this.getCustomerInfo();
  }

  /**
   * Check if user has Pro entitlement (async version)
   */
  async checkProEntitlement(): Promise<boolean> {
    const customerInfo = await this.getCustomerInfo();
    if (!customerInfo) return false;

    return !!customerInfo.entitlements.active[ENTITLEMENTS.PRO];
  }

  /**
   * Map customer info to subscription tier
   */
  getSubscriptionTier(customerInfo: CustomerInfo): SubscriptionTier {
    if (customerInfo.entitlements.active[ENTITLEMENTS.PRO]) {
      return 'premium';
    }
    return 'free';
  }

  /**
   * Get billing cycle from customer info
   */
  getBillingCycle(customerInfo: CustomerInfo): 'monthly' | 'annual' | null {
    const proEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PRO];
    if (!proEntitlement) return null;

    // Check product identifier for billing cycle
    const productId = proEntitlement.productIdentifier;
    if (productId.includes('yearly') || productId.includes('annual')) {
      return 'annual';
    }
    return 'monthly';
  }

  /**
   * Get expiration date for Pro entitlement
   */
  getExpirationDate(): Date | null {
    const proEntitlement = this.state.customerInfo?.entitlements.active[ENTITLEMENTS.PRO];
    if (!proEntitlement?.expirationDate) return null;
    return new Date(proEntitlement.expirationDate);
  }

  /**
   * Check if subscription will auto-renew
   */
  willRenew(): boolean {
    const proEntitlement = this.state.customerInfo?.entitlements.active[ENTITLEMENTS.PRO];
    return proEntitlement?.willRenew ?? false;
  }

  /**
   * Handle customer info updates from RevenueCat
   */
  private handleCustomerInfoUpdate(customerInfo: CustomerInfo): void {
    const wasProBefore = this.state.isPro;
    const isProNow = !!customerInfo.entitlements.active[ENTITLEMENTS.PRO];

    this.state.customerInfo = customerInfo;
    this.state.isPro = isProNow;

    console.log('[RevenueCat] Pro status:', isProNow);

    // Notify listeners of state change
    this.notifyListeners();

    // Log if subscription status changed
    if (wasProBefore !== isProNow) {
      console.log('[RevenueCat] Subscription status changed:', wasProBefore ? 'Pro -> Free' : 'Free -> Pro');
    }
  }

  /**
   * Sync RevenueCat state with our backend
   */
  private async syncWithBackend(customerInfo: CustomerInfo): Promise<void> {
    try {
      const tier = this.getSubscriptionTier(customerInfo);
      const billingCycle = this.getBillingCycle(customerInfo);
      const proEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PRO];

      if (tier === 'premium' && proEntitlement) {
        // Check if this is a trial purchase - record it for abuse prevention
        if (proEntitlement.periodType === 'TRIAL') {
          await this.recordTrialStart();
        }

        // Verify purchase with backend
        await store.dispatch(
          verifyPurchase({
            externalId: customerInfo.originalAppUserId,
            externalProvider: 'revenuecat',
            planCode: 'premium',
            billingCycle: billingCycle || 'monthly',
          })
        );
      } else {
        // Just refresh subscription state from backend
        await store.dispatch(fetchSubscription());
      }
    } catch (error: any) {
      console.error('[RevenueCat] Failed to sync with backend:', error.message);
    }
  }

  /**
   * Log in with a user ID (call when user authenticates)
   */
  async login(userId: string): Promise<CustomerInfo | null> {
    if (!this.isReady()) {
      await this.initialize(userId);
      return this.state.customerInfo;
    }

    try {
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('[RevenueCat] Logged in as:', userId);
      this.handleCustomerInfoUpdate(customerInfo);
      return customerInfo;
    } catch (error: any) {
      console.error('[RevenueCat] Login failed:', error.message);
      return null;
    }
  }

  /**
   * Log out and clear RevenueCat state
   */
  async logout(): Promise<void> {
    if (!this.isReady()) return;

    try {
      const customerInfo = await Purchases.logOut();
      this.handleCustomerInfoUpdate(customerInfo);
      console.log('[RevenueCat] Logged out');
    } catch (error: any) {
      console.error('[RevenueCat] Logout failed:', error.message);
    }
  }

  /**
   * Get management URL for subscription
   * Opens native subscription management on iOS/Android
   */
  getManagementURL(): string | null {
    return this.state.customerInfo?.managementURL ?? null;
  }

  /**
   * Get the original purchase date
   */
  getOriginalPurchaseDate(): Date | null {
    const dateString = this.state.customerInfo?.originalPurchaseDate;
    if (!dateString) return null;
    return new Date(dateString);
  }

  /**
   * Set user attributes for better analytics
   */
  async setAttributes(attributes: { [key: string]: string }): Promise<void> {
    if (!this.isReady()) return;

    try {
      for (const [key, value] of Object.entries(attributes)) {
        await Purchases.setAttributes({ [key]: value });
      }
    } catch (error: any) {
      console.error('[RevenueCat] Failed to set attributes:', error.message);
    }
  }

  /**
   * Set email for user identification
   */
  async setEmail(email: string): Promise<void> {
    if (!this.isReady()) return;

    try {
      await Purchases.setEmail(email);
    } catch (error: any) {
      console.error('[RevenueCat] Failed to set email:', error.message);
    }
  }

  /**
   * Set display name for user
   */
  async setDisplayName(name: string): Promise<void> {
    if (!this.isReady()) return;

    try {
      await Purchases.setDisplayName(name);
    } catch (error: any) {
      console.error('[RevenueCat] Failed to set display name:', error.message);
    }
  }

  /**
   * Check if user is eligible for a free trial
   * Returns false if they've already used their trial
   */
  async checkTrialEligibility(): Promise<TrialEligibility> {
    try {
      const response = await apiClient.get('/subscriptions/trial-eligibility');
      return {
        eligible: response.data.eligible,
        reason: response.data.reason,
        trialUsedAt: response.data.trialUsedAt,
      };
    } catch (error: any) {
      console.error('[RevenueCat] Failed to check trial eligibility:', error.message);
      // Default to eligible if we can't check (fail open for better UX)
      // The backend will still prevent abuse when they try to start
      return { eligible: true };
    }
  }

  /**
   * Record that user started a trial
   * Called after RevenueCat confirms a trial purchase
   */
  async recordTrialStart(deviceId?: string): Promise<boolean> {
    try {
      await apiClient.post('/subscriptions/record-trial', { deviceId });
      console.log('[RevenueCat] Trial start recorded');
      return true;
    } catch (error: any) {
      console.error('[RevenueCat] Failed to record trial start:', error.message);
      return false;
    }
  }

  /**
   * Check if current subscription is a trial
   */
  isTrialing(): boolean {
    const proEntitlement = this.state.customerInfo?.entitlements.active[ENTITLEMENTS.PRO];
    if (!proEntitlement) return false;

    // RevenueCat uses periodType to indicate trial
    return proEntitlement.periodType === 'TRIAL';
  }

  /**
   * Get trial end date if user is trialing
   */
  getTrialEndDate(): Date | null {
    if (!this.isTrialing()) return null;

    const proEntitlement = this.state.customerInfo?.entitlements.active[ENTITLEMENTS.PRO];
    if (!proEntitlement?.expirationDate) return null;

    return new Date(proEntitlement.expirationDate);
  }

  /**
   * Get days remaining in trial
   */
  getTrialDaysRemaining(): number | null {
    const endDate = this.getTrialEndDate();
    if (!endDate) return null;

    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    if (diffMs <= 0) return 0;

    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

export const revenueCatService = new RevenueCatService();
export default RevenueCatService;
