/**
 * RevenueCat Service
 * Handles in-app purchases and subscription management via RevenueCat SDK
 *
 * NOTE: This service requires react-native-purchases to be installed:
 * npm install react-native-purchases
 * cd ios && pod install
 */

import { Platform } from 'react-native';
import { store } from '../store';
import { fetchSubscription, verifyPurchase } from '../store/slices/subscriptionSlice';
import { SubscriptionTier } from '../types/subscription';

// RevenueCat API Keys - These should be in environment variables in production
const REVENUECAT_IOS_API_KEY = process.env.REVENUECAT_IOS_API_KEY || 'appl_YOUR_IOS_KEY';
const REVENUECAT_ANDROID_API_KEY = process.env.REVENUECAT_ANDROID_API_KEY || 'goog_YOUR_ANDROID_KEY';

// Product identifiers (must match RevenueCat/App Store/Play Store configuration)
export const PRODUCT_IDS = {
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_ANNUAL: 'premium_annual',
} as const;

// Entitlement identifier (must match RevenueCat configuration)
export const ENTITLEMENTS = {
  PREMIUM: 'premium',
} as const;

interface PurchasePackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
  offeringIdentifier: string;
}

interface CustomerInfo {
  entitlements: {
    active: {
      [key: string]: {
        identifier: string;
        isActive: boolean;
        willRenew: boolean;
        periodType: string;
        latestPurchaseDate: string;
        originalPurchaseDate: string;
        expirationDate: string | null;
        store: string;
        isSandbox: boolean;
        unsubscribeDetectedAt: string | null;
        billingIssueDetectedAt: string | null;
      };
    };
  };
  originalAppUserId: string;
  managementURL: string | null;
  originalPurchaseDate: string | null;
}

interface Offerings {
  current: {
    identifier: string;
    serverDescription: string;
    availablePackages: PurchasePackage[];
    monthly: PurchasePackage | null;
    annual: PurchasePackage | null;
  } | null;
  all: { [key: string]: any };
}

class RevenueCatService {
  private isConfigured = false;
  private Purchases: any = null;

  /**
   * Initialize RevenueCat SDK
   * Call this once when the app starts, after user authentication
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Dynamically import to avoid crash if package isn't installed
      const PurchasesModule = await import('react-native-purchases');
      this.Purchases = PurchasesModule.default;

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_API_KEY : REVENUECAT_ANDROID_API_KEY;

      // Configure RevenueCat
      await this.Purchases.configure({
        apiKey,
        appUserID: userId,
      });

      this.isConfigured = true;
      console.log('[RevenueCat] Initialized for user:', userId);

      // Set up listener for customer info updates
      this.Purchases.addCustomerInfoUpdateListener((customerInfo: CustomerInfo) => {
        console.log('[RevenueCat] Customer info updated');
        this.handleCustomerInfoUpdate(customerInfo);
      });
    } catch (error: any) {
      console.error('[RevenueCat] Failed to initialize:', error.message);
      // Don't throw - app should still work without RevenueCat
      this.isConfigured = false;
    }
  }

  /**
   * Check if RevenueCat is configured
   */
  isReady(): boolean {
    return this.isConfigured && this.Purchases !== null;
  }

  /**
   * Get available offerings (subscription options)
   */
  async getOfferings(): Promise<Offerings | null> {
    if (!this.isReady()) {
      console.warn('[RevenueCat] Not configured, cannot get offerings');
      return null;
    }

    try {
      const offerings = await this.Purchases.getOfferings();
      console.log('[RevenueCat] Offerings:', offerings);
      return offerings;
    } catch (error: any) {
      console.error('[RevenueCat] Failed to get offerings:', error.message);
      throw new Error('Failed to load subscription options');
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(pkg: PurchasePackage): Promise<CustomerInfo> {
    if (!this.isReady()) {
      throw new Error('RevenueCat not configured');
    }

    try {
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      const { customerInfo } = await this.Purchases.purchasePackage(pkg);

      // Verify the purchase with our backend
      await this.syncWithBackend(customerInfo);

      return customerInfo;
    } catch (error: any) {
      if (error.userCancelled) {
        throw new Error('Purchase cancelled');
      }
      console.error('[RevenueCat] Purchase failed:', error.message);
      throw new Error(error.message || 'Purchase failed');
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
      const customerInfo = await this.Purchases.restorePurchases();

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
      const customerInfo = await this.Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error: any) {
      console.error('[RevenueCat] Failed to get customer info:', error.message);
      return null;
    }
  }

  /**
   * Check if user has premium entitlement
   */
  async hasPremium(): Promise<boolean> {
    const customerInfo = await this.getCustomerInfo();
    if (!customerInfo) return false;

    return !!customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM];
  }

  /**
   * Map customer info to subscription tier
   */
  getSubscriptionTier(customerInfo: CustomerInfo): SubscriptionTier {
    if (customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM]) {
      return 'premium';
    }
    return 'free';
  }

  /**
   * Get billing cycle from customer info
   */
  getBillingCycle(customerInfo: CustomerInfo): 'monthly' | 'annual' | null {
    const premiumEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM];
    if (!premiumEntitlement) return null;

    // Determine billing cycle based on product identifier or period type
    // This depends on how your products are named
    const productId = premiumEntitlement.identifier;
    if (productId.includes('annual') || productId.includes('yearly')) {
      return 'annual';
    }
    return 'monthly';
  }

  /**
   * Handle customer info updates from RevenueCat
   */
  private async handleCustomerInfoUpdate(customerInfo: CustomerInfo): Promise<void> {
    const tier = this.getSubscriptionTier(customerInfo);
    console.log('[RevenueCat] Subscription tier:', tier);

    // Sync with our backend
    await this.syncWithBackend(customerInfo);
  }

  /**
   * Sync RevenueCat state with our backend
   */
  private async syncWithBackend(customerInfo: CustomerInfo): Promise<void> {
    try {
      const tier = this.getSubscriptionTier(customerInfo);
      const billingCycle = this.getBillingCycle(customerInfo);
      const premiumEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM];

      if (tier === 'premium' && premiumEntitlement) {
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
   * Log out and clear RevenueCat state
   */
  async logout(): Promise<void> {
    if (!this.isReady()) return;

    try {
      await this.Purchases.logOut();
      console.log('[RevenueCat] Logged out');
    } catch (error: any) {
      console.error('[RevenueCat] Logout failed:', error.message);
    }
  }

  /**
   * Update user ID (call when user logs in)
   */
  async login(userId: string): Promise<CustomerInfo | null> {
    if (!this.isReady()) {
      await this.initialize(userId);
      return this.getCustomerInfo();
    }

    try {
      const { customerInfo } = await this.Purchases.logIn(userId);
      console.log('[RevenueCat] Logged in as:', userId);
      return customerInfo;
    } catch (error: any) {
      console.error('[RevenueCat] Login failed:', error.message);
      return null;
    }
  }

  /**
   * Get management URL for subscription
   * Opens native subscription management on iOS/Android
   */
  async getManagementURL(): Promise<string | null> {
    const customerInfo = await this.getCustomerInfo();
    return customerInfo?.managementURL || null;
  }
}

export const revenueCatService = new RevenueCatService();
export default RevenueCatService;
