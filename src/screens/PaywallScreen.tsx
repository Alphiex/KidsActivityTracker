/**
 * PaywallScreen - Premium subscription purchase screen
 * Shows plan comparison and handles purchases via RevenueCat
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import {
  selectCurrentTier,
  selectIsTrialing,
  selectLimits,
  fetchSubscription,
  startTrial,
} from '../store/slices/subscriptionSlice';
import { revenueCatService } from '../services/revenueCatService';
import { analyticsService } from '../services/analyticsService';
import { abTestService, PAYWALL_VARIANTS } from '../services/abTestService';

type BillingCycle = 'monthly' | 'annual';

interface FeatureItem {
  name: string;
  free: string | boolean;
  premium: string | boolean;
  icon: string;
}

const FEATURES: FeatureItem[] = [
  { name: 'Child profiles', free: '2', premium: 'Unlimited', icon: 'account-child' },
  { name: 'Favorite activities', free: '10', premium: 'Unlimited', icon: 'heart' },
  { name: 'Family sharing', free: '1 person', premium: 'Unlimited', icon: 'account-group' },
  { name: 'Advanced filters', free: false, premium: true, icon: 'filter-variant' },
  { name: 'Calendar export', free: false, premium: true, icon: 'calendar-export' },
  { name: 'Instant alerts', free: false, premium: true, icon: 'bell-ring' },
  { name: 'Saved searches', free: false, premium: '10', icon: 'bookmark' },
  { name: 'Hide closed/full', free: false, premium: true, icon: 'eye-off' },
];

const PaywallScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { colors, isDark } = useTheme();

  const currentTier = useAppSelector(selectCurrentTier);
  const isTrialing = useAppSelector(selectIsTrialing);
  const limits = useAppSelector(selectLimits);
  const { isPurchasing } = useAppSelector((state) => state.subscription);

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [offerings, setOfferings] = useState<any>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [paywallOpenTime] = useState(Date.now());

  // A/B test variants
  const headlineVariant = abTestService.getVariant('paywall_headline');
  const trialCtaVariant = abTestService.getVariant('trial_cta');

  // Get variant content
  const headlineContent = PAYWALL_VARIANTS.paywall_headline[
    headlineVariant as keyof typeof PAYWALL_VARIANTS.paywall_headline
  ] || PAYWALL_VARIANTS.paywall_headline.control;

  const trialCtaText = PAYWALL_VARIANTS.trial_cta[
    trialCtaVariant as keyof typeof PAYWALL_VARIANTS.trial_cta
  ] || PAYWALL_VARIANTS.trial_cta.control;

  // Track paywall view on mount
  useEffect(() => {
    analyticsService.trackPaywallViewed('paywall_screen', headlineVariant);
    loadOfferings();
  }, [headlineVariant]);

  // Track billing cycle changes
  const handleBillingCycleChange = (cycle: BillingCycle) => {
    setBillingCycle(cycle);
    analyticsService.trackPlanSelected('premium', cycle);
  };

  const loadOfferings = async () => {
    try {
      setIsLoadingOfferings(true);
      const offeringsData = await revenueCatService.getOfferings();
      setOfferings(offeringsData);
    } catch (error) {
      console.error('[Paywall] Failed to load offerings:', error);
    } finally {
      setIsLoadingOfferings(false);
    }
  };

  const getSelectedPackage = useCallback(() => {
    if (!offerings?.current) return null;
    return billingCycle === 'annual'
      ? offerings.current.annual
      : offerings.current.monthly;
  }, [offerings, billingCycle]);

  const handlePurchase = async () => {
    const pkg = getSelectedPackage();
    if (!pkg) {
      Alert.alert('Error', 'Unable to load subscription options. Please try again.');
      return;
    }

    // Track purchase initiated
    analyticsService.trackPurchaseInitiated(
      pkg.product.identifier,
      pkg.product.price,
      pkg.product.currencyCode
    );

    try {
      await revenueCatService.purchasePackage(pkg);
      await dispatch(fetchSubscription());

      // Track purchase completed
      analyticsService.trackPurchaseCompleted(
        pkg.product.identifier,
        pkg.product.price,
        pkg.product.currencyCode,
        isTrialing
      );

      Alert.alert(
        'Welcome to Premium!',
        'Your subscription is now active. Enjoy all premium features!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      if (error.message === 'Purchase cancelled') {
        analyticsService.trackPurchaseCancelled(pkg.product.identifier);
      } else {
        analyticsService.trackPurchaseFailed(
          pkg.product.identifier,
          'unknown',
          error.message || 'Unknown error'
        );
        Alert.alert('Purchase Failed', error.message || 'Unable to complete purchase. Please try again.');
      }
    }
  };

  const handleStartTrial = async () => {
    try {
      await dispatch(startTrial()).unwrap();

      // Track trial started
      analyticsService.trackTrialStarted(7);

      Alert.alert(
        'Trial Started!',
        'Your 7-day free trial has begun. Enjoy all premium features!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to start trial. Please try again.');
    }
  };

  const handleRestore = async () => {
    analyticsService.trackRestoreInitiated();

    try {
      setIsRestoring(true);
      const customerInfo = await revenueCatService.restorePurchases();
      await dispatch(fetchSubscription());

      if (customerInfo?.entitlements?.active?.premium) {
        analyticsService.trackRestoreCompleted(true);
        Alert.alert(
          'Purchases Restored',
          'Your premium subscription has been restored!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        analyticsService.trackRestoreCompleted(false);
        Alert.alert('No Purchases Found', 'No previous purchases were found for this account.');
      }
    } catch (error: any) {
      analyticsService.trackRestoreFailed(error.message || 'Unknown error');
      Alert.alert('Restore Failed', error.message || 'Unable to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleTerms = () => {
    Linking.openURL('https://kidsactivitytracker.com/terms');
  };

  const handlePrivacy = () => {
    Linking.openURL('https://kidsactivitytracker.com/privacy');
  };

  const handleClose = () => {
    const timeSpent = Date.now() - paywallOpenTime;
    analyticsService.trackPaywallDismissed('paywall_screen', timeSpent);
    navigation.goBack();
  };

  const monthlyPrice = offerings?.current?.monthly?.product?.priceString || '$5.99';
  const annualPrice = offerings?.current?.annual?.product?.priceString || '$49.99';
  const annualMonthlyEquivalent = offerings?.current?.annual?.product?.price
    ? `$${(offerings.current.annual.product.price / 12).toFixed(2)}`
    : '$4.17';
  const savingsPercent = Math.round((1 - (4.17 / 5.99)) * 100);

  const renderFeatureValue = (value: string | boolean, isPremium: boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Icon name="check-circle" size={20} color={colors.success} />
      ) : (
        <Icon name="close-circle" size={20} color={colors.textSecondary} />
      );
    }
    return (
      <Text style={[
        styles.featureValue,
        { color: isPremium ? colors.primary : colors.text }
      ]}>
        {value}
      </Text>
    );
  };

  if (currentTier === 'premium' && !isTrialing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.alreadyPremiumContainer}>
          <Icon name="crown" size={64} color={colors.warning} />
          <Text style={[styles.alreadyPremiumTitle, { color: colors.text }]}>
            You're Already Premium!
          </Text>
          <Text style={[styles.alreadyPremiumText, { color: colors.textSecondary }]}>
            You have full access to all features.
          </Text>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Icon name="crown" size={48} color={colors.warning} />
          <Text style={[styles.title, { color: colors.text }]}>
            {headlineContent.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {headlineContent.subtitle}
          </Text>
        </View>

        {/* Billing Toggle */}
        <View style={[styles.billingToggle, { backgroundColor: colors.surfaceVariant }]}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'monthly' && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleBillingCycleChange('monthly')}
          >
            <Text style={[
              styles.billingOptionText,
              { color: billingCycle === 'monthly' ? colors.primary : colors.textSecondary }
            ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'annual' && { backgroundColor: colors.surface },
            ]}
            onPress={() => handleBillingCycleChange('annual')}
          >
            <Text style={[
              styles.billingOptionText,
              { color: billingCycle === 'annual' ? colors.primary : colors.textSecondary }
            ]}>
              Annual
            </Text>
            <View style={[styles.savingsBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.savingsBadgeText}>Save {savingsPercent}%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Price Display */}
        <View style={[styles.priceCard, { backgroundColor: colors.surface }]}>
          {billingCycle === 'annual' ? (
            <>
              <Text style={[styles.priceAmount, { color: colors.text }]}>{annualPrice}</Text>
              <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>per year</Text>
              <Text style={[styles.priceEquivalent, { color: colors.primary }]}>
                Just {annualMonthlyEquivalent}/month
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.priceAmount, { color: colors.text }]}>{monthlyPrice}</Text>
              <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>per month</Text>
            </>
          )}
        </View>

        {/* Features Comparison */}
        <View style={[styles.featuresCard, { backgroundColor: colors.surface }]}>
          <View style={styles.featuresHeader}>
            <Text style={[styles.featuresHeaderText, { color: colors.textSecondary }]}>Feature</Text>
            <Text style={[styles.featuresHeaderText, { color: colors.textSecondary }]}>Free</Text>
            <Text style={[styles.featuresHeaderText, { color: colors.primary }]}>Premium</Text>
          </View>

          {FEATURES.map((feature, index) => (
            <View
              key={feature.name}
              style={[
                styles.featureRow,
                index < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
              ]}
            >
              <View style={styles.featureNameContainer}>
                <Icon name={feature.icon} size={18} color={colors.textSecondary} />
                <Text style={[styles.featureName, { color: colors.text }]}>{feature.name}</Text>
              </View>
              <View style={styles.featureValueContainer}>
                {renderFeatureValue(feature.free, false)}
              </View>
              <View style={styles.featureValueContainer}>
                {renderFeatureValue(feature.premium, true)}
              </View>
            </View>
          ))}
        </View>

        {/* Trial Banner */}
        {!isTrialing && (
          <View style={[styles.trialBanner, { backgroundColor: colors.info + '20' }]}>
            <Icon name="gift" size={24} color={colors.info} />
            <View style={styles.trialTextContainer}>
              <Text style={[styles.trialTitle, { color: colors.text }]}>7-Day Free Trial</Text>
              <Text style={[styles.trialSubtitle, { color: colors.textSecondary }]}>
                Try all premium features risk-free
              </Text>
            </View>
          </View>
        )}

        {/* Legal Links */}
        <View style={styles.legalContainer}>
          <TouchableOpacity onPress={handleTerms}>
            <Text style={[styles.legalLink, { color: colors.textSecondary }]}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={[styles.legalSeparator, { color: colors.textSecondary }]}>•</Text>
          <TouchableOpacity onPress={handlePrivacy}>
            <Text style={[styles.legalLink, { color: colors.textSecondary }]}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomContainer, { backgroundColor: colors.background }]}>
        {isLoadingOfferings ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
              onPress={handlePurchase}
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.subscribeButtonText}>
                  {billingCycle === 'annual' ? `Subscribe for ${annualPrice}/year` : `Subscribe for ${monthlyPrice}/month`}
                </Text>
              )}
            </TouchableOpacity>

            {!isTrialing && (
              <TouchableOpacity
                style={[styles.trialButton, { borderColor: colors.primary }]}
                onPress={handleStartTrial}
                disabled={isPurchasing}
              >
                <Text style={[styles.trialButtonText, { color: colors.primary }]}>
                  {trialCtaText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isRestoring || isPurchasing}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  billingToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  savingsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  savingsBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  priceCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  priceAmount: {
    fontSize: 40,
    fontWeight: '700',
  },
  pricePeriod: {
    fontSize: 16,
    marginTop: 4,
  },
  priceEquivalent: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  featuresCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  featuresHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8,
  },
  featuresHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureNameContainer: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureName: {
    fontSize: 14,
    marginLeft: 8,
  },
  featureValueContainer: {
    flex: 1,
    alignItems: 'center',
  },
  featureValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  trialTextContainer: {
    marginLeft: 12,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  trialSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  legalContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  legalLink: {
    fontSize: 12,
  },
  legalSeparator: {
    marginHorizontal: 8,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  subscribeButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  trialButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    marginTop: 12,
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  restoreButtonText: {
    fontSize: 14,
  },
  alreadyPremiumContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  alreadyPremiumTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
  },
  alreadyPremiumText: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginTop: 32,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaywallScreen;
