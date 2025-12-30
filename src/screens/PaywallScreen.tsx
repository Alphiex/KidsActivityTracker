/**
 * PaywallScreen - Premium subscription purchase screen
 * Enhanced with better feature highlighting and visual appeal
 * Supports both RevenueCat UI Paywall and custom paywall
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
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
import { revenueCatService, getPaywallResult, PaywallResultType } from '../services/revenueCatService';
import { analyticsService } from '../services/analyticsService';
import { abTestService, PAYWALL_VARIANTS } from '../services/abTestService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type BillingCycle = 'monthly' | 'annual';

interface ProFeature {
  icon: string;
  title: string;
  description: string;
  highlight?: boolean;
  badge?: string;
}

// Enhanced Pro features with better descriptions
const PRO_FEATURES: ProFeature[] = [
  {
    icon: 'account-child-circle',
    title: 'Unlimited Child Profiles',
    description: 'Track activities for your entire family without limits',
    highlight: true,
    badge: 'POPULAR',
  },
  {
    icon: 'heart-multiple',
    title: 'Unlimited Favorites',
    description: 'Save all your favorite activities and never miss an enrollment',
  },
  {
    icon: 'account-group',
    title: 'Family Sharing',
    description: 'Share your account with grandparents, nannies, and caregivers',
  },
  {
    icon: 'filter-variant-plus',
    title: 'Advanced Filters',
    description: 'Find the perfect activity with age, location, price & more',
    highlight: true,
  },
  {
    icon: 'calendar-export',
    title: 'Calendar Export',
    description: 'Sync activities to Google Calendar, Apple Calendar & more',
  },
  {
    icon: 'bell-ring',
    title: 'Instant Alerts',
    description: 'Get notified when spots open or new activities match your criteria',
    badge: 'NEW',
  },
  {
    icon: 'content-save-all',
    title: 'Saved Searches',
    description: 'Save your search criteria and find activities faster',
  },
  {
    icon: 'eye-off',
    title: 'Hide Unavailable',
    description: 'Automatically hide full or closed activities from results',
  },
  {
    icon: 'star-circle',
    title: 'Priority Support',
    description: 'Get faster responses from our dedicated support team',
  },
];

// Quick comparison features
const QUICK_COMPARE = [
  { feature: 'Child profiles', free: '2', pro: 'Unlimited' },
  { feature: 'Favorite activities', free: '10', pro: 'Unlimited' },
  { feature: 'Family sharing', free: '1', pro: 'Unlimited' },
  { feature: 'Saved searches', free: '-', pro: '10+' },
  { feature: 'Calendar export', free: '-', pro: 'Yes' },
  { feature: 'Advanced filters', free: '-', pro: 'Yes' },
  { feature: 'Instant alerts', free: '-', pro: 'Yes' },
];

// Configuration: Set to false to use custom paywall instead of RevenueCat UI
const USE_REVENUECAT_PAYWALL = false;

interface PaywallScreenProps {
  route?: {
    params?: {
      useRevenueCatUI?: boolean;
    };
  };
}

const PaywallScreen: React.FC<PaywallScreenProps> = ({ route }) => {
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
  const [showingRevenueCatPaywall, setShowingRevenueCatPaywall] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Check if we should use RevenueCat UI paywall
  const useRevenueCatUI = route?.params?.useRevenueCatUI ?? USE_REVENUECAT_PAYWALL;

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

  // Start animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for CTA button
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, []);

  // If using RevenueCat UI, present it immediately
  useEffect(() => {
    if (useRevenueCatUI && !showingRevenueCatPaywall) {
      presentRevenueCatPaywall();
    }
  }, [useRevenueCatUI]);

  // Track paywall view on mount (for custom paywall)
  useEffect(() => {
    if (!useRevenueCatUI) {
      analyticsService.trackPaywallViewed('paywall_screen', headlineVariant);
      loadOfferings();
    }
  }, [headlineVariant, useRevenueCatUI]);

  /**
   * Present RevenueCat's native paywall UI
   */
  const presentRevenueCatPaywall = async () => {
    try {
      setShowingRevenueCatPaywall(true);
      analyticsService.trackPaywallViewed('revenuecat_paywall', 'native');

      const result = await revenueCatService.presentPaywall();
      const PAYWALL_RESULT = getPaywallResult();

      console.log('[Paywall] RevenueCat paywall result:', result);

      // Handle result using string comparison for compatibility
      if (result === PAYWALL_RESULT?.PURCHASED || result === 'PURCHASED') {
        analyticsService.trackPurchaseCompleted('revenuecat_paywall', 0, 'USD', isTrialing);
        await dispatch(fetchSubscription());
        Alert.alert(
          'Welcome to Pro!',
          'Your subscription is now active. Enjoy all premium features!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (result === PAYWALL_RESULT?.RESTORED || result === 'RESTORED') {
        analyticsService.trackRestoreCompleted(true);
        await dispatch(fetchSubscription());
        Alert.alert(
          'Purchases Restored',
          'Your subscription has been restored!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else if (result === PAYWALL_RESULT?.CANCELLED || result === 'CANCELLED') {
        analyticsService.trackPurchaseCancelled('revenuecat_paywall');
        navigation.goBack();
      } else if (result === PAYWALL_RESULT?.ERROR || result === 'ERROR') {
        Alert.alert('Error', 'Something went wrong. Please try again.');
        navigation.goBack();
      } else if (result === PAYWALL_RESULT?.NOT_PRESENTED || result === 'NOT_PRESENTED') {
        // User already has entitlement
        navigation.goBack();
      } else {
        // Unknown result, just go back
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('[Paywall] RevenueCat paywall error:', error);
      Alert.alert('Error', error.message || 'Unable to show subscription options');
      navigation.goBack();
    } finally {
      setShowingRevenueCatPaywall(false);
    }
  };

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
        'Welcome to Pro!',
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

      const hasPro = revenueCatService.isPro();
      if (hasPro) {
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

  // If using RevenueCat UI, show loading while presenting
  if (useRevenueCatUI) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading subscription options...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const monthlyPrice = offerings?.current?.monthly?.product?.priceString || '$5.99';
  const annualPrice = offerings?.current?.annual?.product?.priceString || '$49.99';
  const annualMonthlyEquivalent = offerings?.current?.annual?.product?.price
    ? `$${(offerings.current.annual.product.price / 12).toFixed(2)}`
    : '$4.17';
  const savingsPercent = Math.round((1 - (4.17 / 5.99)) * 100);

  // Render feature item
  const renderFeatureItem = (feature: ProFeature, index: number) => (
    <Animated.View
      key={feature.title}
      style={[
        styles.featureItem,
        feature.highlight && styles.featureItemHighlight,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 50 + index * 10],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.featureIconContainer, feature.highlight && styles.featureIconHighlight]}>
        <Icon
          name={feature.icon}
          size={24}
          color={feature.highlight ? '#FF385C' : colors.primary}
        />
      </View>
      <View style={styles.featureContent}>
        <View style={styles.featureTitleRow}>
          <Text style={[styles.featureTitle, { color: colors.text }]}>
            {feature.title}
          </Text>
          {feature.badge && (
            <View style={[styles.featureBadge, feature.badge === 'NEW' && styles.featureBadgeNew]}>
              <Text style={styles.featureBadgeText}>{feature.badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>
          {feature.description}
        </Text>
      </View>
      <Icon name="check-circle" size={20} color={colors.success} />
    </Animated.View>
  );

  if (currentTier === 'premium' && !isTrialing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.alreadyPremiumContainer}>
          <LinearGradient
            colors={['#FF385C', '#FF6B6B']}
            style={styles.premiumIconGradient}
          >
            <Icon name="crown" size={48} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.alreadyPremiumTitle, { color: colors.text }]}>
            You're Already Pro!
          </Text>
          <Text style={[styles.alreadyPremiumText, { color: colors.textSecondary }]}>
            You have full access to all premium features.
          </Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['#FF385C', '#FF6B6B']}
              style={styles.doneButtonGradient}
            >
              <Text style={styles.doneButtonText}>Continue</Text>
            </LinearGradient>
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
        {/* Hero Section with Gradient */}
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e'] : ['#FFF5F7', '#FFFFFF']}
          style={styles.heroGradient}
        >
          <Animated.View style={[styles.heroSection, { opacity: fadeAnim }]}>
            <View style={styles.crownContainer}>
              <LinearGradient
                colors={['#FF385C', '#FF6B6B']}
                style={styles.crownGradient}
              >
                <Icon name="crown" size={36} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              Upgrade to Pro
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Unlock the full potential of KidsActivityTracker
            </Text>
          </Animated.View>

          {/* Billing Toggle */}
          <View style={[styles.billingToggle, { backgroundColor: isDark ? '#2a2a3e' : '#F0F0F0' }]}>
            <TouchableOpacity
              style={[
                styles.billingOption,
                billingCycle === 'monthly' && styles.billingOptionActive,
              ]}
              onPress={() => handleBillingCycleChange('monthly')}
            >
              <Text style={[
                styles.billingOptionText,
                { color: billingCycle === 'monthly' ? '#FF385C' : colors.textSecondary }
              ]}>
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.billingOption,
                billingCycle === 'annual' && styles.billingOptionActive,
              ]}
              onPress={() => handleBillingCycleChange('annual')}
            >
              <Text style={[
                styles.billingOptionText,
                { color: billingCycle === 'annual' ? '#FF385C' : colors.textSecondary }
              ]}>
                Annual
              </Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>SAVE {savingsPercent}%</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Price Display */}
          <View style={styles.priceContainer}>
            {billingCycle === 'annual' ? (
              <>
                <Text style={[styles.priceAmount, { color: colors.text }]}>{annualPrice}</Text>
                <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/year</Text>
                <View style={styles.priceEquivalentContainer}>
                  <Text style={[styles.priceEquivalent, { color: '#FF385C' }]}>
                    Just {annualMonthlyEquivalent}/month
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.priceAmount, { color: colors.text }]}>{monthlyPrice}</Text>
                <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/month</Text>
              </>
            )}
          </View>
        </LinearGradient>

        {/* Quick Compare Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            What You Get with Pro
          </Text>
          <View style={[styles.compareCard, { backgroundColor: isDark ? '#1a1a2e' : '#F8F9FA' }]}>
            <View style={styles.compareHeader}>
              <Text style={[styles.compareHeaderText, { color: colors.textSecondary }]}>Feature</Text>
              <Text style={[styles.compareHeaderText, { color: colors.textSecondary }]}>Free</Text>
              <Text style={[styles.compareHeaderTextPro]}>Pro</Text>
            </View>
            {QUICK_COMPARE.map((item, index) => (
              <View
                key={item.feature}
                style={[
                  styles.compareRow,
                  index < QUICK_COMPARE.length - 1 && styles.compareRowBorder,
                ]}
              >
                <Text style={[styles.compareFeature, { color: colors.text }]}>{item.feature}</Text>
                <Text style={[styles.compareFree, { color: colors.textSecondary }]}>{item.free}</Text>
                <Text style={styles.comparePro}>{item.pro}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pro Features Section */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Pro Features
          </Text>
          <View style={styles.featuresContainer}>
            {PRO_FEATURES.map((feature, index) => renderFeatureItem(feature, index))}
          </View>
        </View>

        {/* Testimonial/Trust Section */}
        <View style={styles.trustSection}>
          <View style={styles.trustItem}>
            <Icon name="shield-check" size={24} color={colors.success} />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              Cancel anytime
            </Text>
          </View>
          <View style={styles.trustItem}>
            <Icon name="lock" size={24} color={colors.success} />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              Secure payments
            </Text>
          </View>
          <View style={styles.trustItem}>
            <Icon name="refresh" size={24} color={colors.success} />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              7-day free trial
            </Text>
          </View>
        </View>

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

      {/* Sticky Bottom CTA */}
      <View style={[styles.bottomContainer, { backgroundColor: colors.background }]}>
        {isLoadingOfferings ? (
          <ActivityIndicator size="large" color="#FF385C" />
        ) : (
          <>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                onPress={handlePurchase}
                disabled={isPurchasing}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#FF385C', '#FF6B6B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.subscribeButton}
                >
                  {isPurchasing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Icon name="crown" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.subscribeButtonText}>
                        {billingCycle === 'annual'
                          ? `Start Pro - ${annualPrice}/year`
                          : `Start Pro - ${monthlyPrice}/month`}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {!isTrialing && (
              <TouchableOpacity
                style={styles.trialButton}
                onPress={handleStartTrial}
                disabled={isPurchasing}
              >
                <Text style={styles.trialButtonText}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
    paddingBottom: 20,
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  crownContainer: {
    marginBottom: 16,
  },
  crownGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF385C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  billingToggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    marginBottom: 20,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  billingOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  savingsBadge: {
    backgroundColor: '#00C853',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  savingsBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  priceContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: '800',
  },
  pricePeriod: {
    fontSize: 18,
    marginLeft: 4,
    marginTop: 16,
  },
  priceEquivalentContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  priceEquivalent: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  compareCard: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  compareHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 8,
  },
  compareHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  compareHeaderTextPro: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#FF385C',
    textAlign: 'right',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  compareRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  compareFeature: {
    flex: 1,
    fontSize: 14,
  },
  compareFree: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  comparePro: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF385C',
    textAlign: 'right',
  },
  featuresContainer: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  featureItemHighlight: {
    backgroundColor: 'rgba(255,56,92,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,56,92,0.2)',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,56,92,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureIconHighlight: {
    backgroundColor: 'rgba(255,56,92,0.2)',
  },
  featureContent: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureBadge: {
    backgroundColor: '#FF385C',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  featureBadgeNew: {
    backgroundColor: '#00C853',
  },
  featureBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  trustSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
  },
  trustItem: {
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontSize: 12,
    textAlign: 'center',
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  subscribeButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#FF385C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  trialButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#FF385C',
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF385C',
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
  premiumIconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#FF385C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  alreadyPremiumTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  alreadyPremiumText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  doneButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  doneButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default PaywallScreen;
