/**
 * Subscription Context
 * Provides app-wide access to RevenueCat subscription state and methods
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Alert, Linking, Platform } from 'react-native';
import {
  revenueCatService,
  ENTITLEMENTS,
  PAYWALL_RESULT,
  PaywallResultType,
} from '../services/revenueCatService';
import { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

interface SubscriptionState {
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  expirationDate: Date | null;
  willRenew: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  // Paywall methods
  presentPaywall: () => Promise<PaywallResultType>;
  presentPaywallIfNeeded: () => Promise<boolean>;

  // Customer Center
  presentCustomerCenter: () => Promise<void>;

  // Purchase methods
  purchaseMonthly: () => Promise<boolean>;
  purchaseYearly: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;

  // Utility methods
  refreshSubscription: () => Promise<void>;
  openManageSubscriptions: () => void;

  // Package getters
  getMonthlyPackage: () => PurchasesPackage | null;
  getYearlyPackage: () => PurchasesPackage | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [state, setState] = useState<SubscriptionState>({
    isInitialized: false,
    isLoading: true,
    isPro: false,
    customerInfo: null,
    offerings: null,
    expirationDate: null,
    willRenew: false,
  });

  // Subscribe to RevenueCat state changes
  useEffect(() => {
    const unsubscribe = revenueCatService.subscribe((rcState) => {
      setState((prev) => ({
        ...prev,
        isInitialized: rcState.isConfigured,
        isLoading: rcState.isInitializing,
        isPro: rcState.isPro,
        customerInfo: rcState.customerInfo,
        offerings: rcState.offerings,
        expirationDate: revenueCatService.getExpirationDate(),
        willRenew: revenueCatService.willRenew(),
      }));
    });

    return unsubscribe;
  }, []);

  // Initialize RevenueCat on mount
  useEffect(() => {
    const init = async () => {
      try {
        await revenueCatService.initialize();
      } catch (error) {
        console.error('[SubscriptionContext] Initialization failed:', error);
      }
    };

    init();
  }, []);

  /**
   * Present the RevenueCat Paywall
   */
  const presentPaywall = useCallback(async (): Promise<PaywallResultType> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const result = await revenueCatService.presentPaywall();
      return result;
    } catch (error: any) {
      console.error('[SubscriptionContext] Paywall error:', error);
      Alert.alert('Error', error.message || 'Unable to show subscription options');
      return PAYWALL_RESULT.ERROR;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Present paywall only if user doesn't have Pro entitlement
   */
  const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const hasPro = await revenueCatService.presentPaywallIfNeeded();
      return hasPro;
    } catch (error: any) {
      console.error('[SubscriptionContext] Paywall if needed error:', error);
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Present the Customer Center for subscription management
   */
  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    try {
      await revenueCatService.presentCustomerCenter();
    } catch (error: any) {
      console.error('[SubscriptionContext] Customer Center error:', error);
      // Fallback to management URL if Customer Center fails
      const url = revenueCatService.getManagementURL();
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open subscription management');
      }
    }
  }, []);

  /**
   * Purchase monthly subscription
   */
  const purchaseMonthly = useCallback(async (): Promise<boolean> => {
    const pkg = revenueCatService.getMonthlyPackage();
    if (!pkg) {
      Alert.alert('Error', 'Monthly subscription not available');
      return false;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      await revenueCatService.purchasePackage(pkg);
      Alert.alert('Success', 'Welcome to KidsActivityTracker Pro!');
      return true;
    } catch (error: any) {
      if (error.message !== 'Purchase cancelled') {
        Alert.alert('Purchase Failed', error.message || 'Unable to complete purchase');
      }
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Purchase yearly subscription
   */
  const purchaseYearly = useCallback(async (): Promise<boolean> => {
    const pkg = revenueCatService.getYearlyPackage();
    if (!pkg) {
      Alert.alert('Error', 'Yearly subscription not available');
      return false;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      await revenueCatService.purchasePackage(pkg);
      Alert.alert('Success', 'Welcome to KidsActivityTracker Pro!');
      return true;
    } catch (error: any) {
      if (error.message !== 'Purchase cancelled') {
        Alert.alert('Purchase Failed', error.message || 'Unable to complete purchase');
      }
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Restore previous purchases
   */
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const customerInfo = await revenueCatService.restorePurchases();

      if (customerInfo?.entitlements?.active?.[ENTITLEMENTS.PRO]) {
        Alert.alert('Success', 'Your subscription has been restored!');
        return true;
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found for this account.');
        return false;
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Unable to restore purchases');
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Refresh subscription state from RevenueCat
   */
  const refreshSubscription = useCallback(async (): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      await revenueCatService.refreshCustomerInfo();
      await revenueCatService.refreshOfferings();
    } catch (error) {
      console.error('[SubscriptionContext] Refresh error:', error);
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  /**
   * Open native subscription management
   */
  const openManageSubscriptions = useCallback(() => {
    const url = revenueCatService.getManagementURL();
    if (url) {
      Linking.openURL(url);
    } else {
      // Fallback URLs
      const fallbackUrl = Platform.select({
        ios: 'https://apps.apple.com/account/subscriptions',
        android: 'https://play.google.com/store/account/subscriptions',
      });
      if (fallbackUrl) {
        Linking.openURL(fallbackUrl);
      }
    }
  }, []);

  /**
   * Get monthly package
   */
  const getMonthlyPackage = useCallback((): PurchasesPackage | null => {
    return revenueCatService.getMonthlyPackage();
  }, []);

  /**
   * Get yearly package
   */
  const getYearlyPackage = useCallback((): PurchasesPackage | null => {
    return revenueCatService.getYearlyPackage();
  }, []);

  const value = useMemo<SubscriptionContextType>(
    () => ({
      ...state,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
      refreshSubscription,
      openManageSubscriptions,
      getMonthlyPackage,
      getYearlyPackage,
    }),
    [
      state,
      presentPaywall,
      presentPaywallIfNeeded,
      presentCustomerCenter,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
      refreshSubscription,
      openManageSubscriptions,
      getMonthlyPackage,
      getYearlyPackage,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

/**
 * Hook to access subscription context
 */
export const useSubscriptionContext = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
};

/**
 * Hook to check if user has Pro entitlement
 */
export const useIsPro = (): boolean => {
  const { isPro } = useSubscriptionContext();
  return isPro;
};

/**
 * Hook to present paywall when a Pro feature is accessed
 * Returns a function that checks entitlement and shows paywall if needed
 */
export const useRequirePro = () => {
  const { isPro, presentPaywallIfNeeded } = useSubscriptionContext();

  return useCallback(
    async (onSuccess?: () => void): Promise<boolean> => {
      if (isPro) {
        onSuccess?.();
        return true;
      }

      const hasPro = await presentPaywallIfNeeded();
      if (hasPro) {
        onSuccess?.();
      }
      return hasPro;
    },
    [isPro, presentPaywallIfNeeded]
  );
};

export default SubscriptionContext;
