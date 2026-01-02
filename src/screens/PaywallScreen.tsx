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
  selectTrialEligible,
  fetchSubscription,
  startTrial,
  checkTrialEligibility,
} from '../store/slices/subscriptionSlice';
import { revenueCatService, getPaywallResult } from '../services/revenueCatService';
import { analyticsService } from '../services/analyticsService';
import { abTestService } from '../services/abTestService';

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
    description: 'Track activities for your entire family with individual preferences and interests',
    highlight: true,
    badge: 'POPULAR',
  },
  {
    icon: 'account-group',
    title: 'Friends & Family Sharing',
    description: 'Coordinate with grandparents, caregivers, and your child\'s friends\' parents for playdates and group activities',
    highlight: true,
  },
  {
    icon: 'bell-ring',
    title: 'Smart Notifications',
    description: 'Spot availability alerts, registration deadline reminders, new activity matches, and schedule change notifications',
    highlight: true,
    badge: 'NEW',
  },
  {
    icon: 'robot-happy',
    title: 'AI Recommendations',
    description: 'Get personalized activity suggestions based on your children\'s ages, interests, and past favorites',
    highlight: true,
    badge: 'AI',
  },
  {
    icon: 'brain',
    title: 'AI Chat & Smart Search',
    description: 'Natural language search - just describe what you\'re looking for like "swimming lessons for my 5 year old on weekends"',
    badge: 'AI',
  },
  {
    icon: 'calendar-sync',
    title: 'Calendar Integration',
    description: 'Sync activities to Google Calendar, Apple Calendar, Outlook & more with automatic updates',
  },
  {
    icon: 'filter-variant-plus',
    title: 'Advanced Filters',
    description: 'Filter by budget, schedule, distance, age group, activity type, indoor/outdoor & more',
  },
  {
    icon: 'heart-multiple',
    title: 'Unlimited Favorites & Collections',
    description: 'Save and organize activities into custom collections like "Summer Camps" or "Weekend Activities"',
  },
  {
    icon: 'map-marker-radius',
    title: 'Multi-Location Search',
    description: 'Search activities near multiple locations - home, work, school, or grandparents\' house',
  },
  {
    icon: 'clipboard-list',
    title: 'Waitlist Management',
    description: 'Track waitlisted activities and get notified instantly when spots become available',
  },
  {
    icon: 'content-save-all',
    title: 'Saved Searches',
    description: 'Save your search criteria and get notified when new activities match',
  },
  {
    icon: 'eye-off',
    title: 'Hide Unavailable',
    description: 'Automatically hide full, cancelled, or closed activities from your results',
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
  { feature: 'Friends & family sharing', free: '1', pro: 'Unlimited' },
  { feature: 'AI recommendations', free: '3/day', pro: 'Unlimited' },
  { feature: 'AI chat & smart search', free: '-', pro: 'Yes' },
  { feature: 'Smart notifications', free: 'Basic', pro: 'Full' },
  { feature: 'Calendar sync', free: '-', pro: 'Yes' },
  { feature: 'Multi-location search', free: '-', pro: 'Yes' },
  { feature: 'Advanced filters', free: '-', pro: 'Yes' },
  { feature: 'Waitlist tracking', free: '-', pro: 'Yes' },
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
  const trialEligible = useAppSelector(selectTrialEligible);
  const { isPurchasing } = useAppSelector((state) => state.subscription);

  // Check trial eligibility on mount
  useEffect(() => {
    if (trialEligible === null && !isTrialing) {
      dispatch(checkTrialEligibility());
    }
  }, [trialEligible, isTrialing, dispatch]);

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

  // A/B test variant for analytics
  const headlineVariant = abTestService.getVariant('paywall_headline');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If using RevenueCat UI, present it immediately
  useEffect(() => {
    if (useRevenueCatUI && !showingRevenueCatPaywall) {
      presentRevenueCatPaywall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Check eligibility first
    if (trialEligible === false) {
      Alert.alert(
        'Trial Already Used',
        'You\'ve already used your free trial. Subscribe now to unlock all premium features!',
        [{ text: 'OK' }]
      );
      return;
    }

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
      // Check if error is about trial already used
      if (error.message?.includes('Trial already used')) {
        Alert.alert(
          'Trial Already Used',
          'You\'ve already used your free trial. Subscribe now to unlock all premium features!'
        );
      } else {
        Alert.alert('Error', error.message || 'Unable to start trial. Please try again.');
      }
    }
  };

  const handleRestore = async () => {
    analyticsService.trackRestoreInitiated();

    try {
      setIsRestoring(true);
      await revenueCatService.restorePurchases();
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

  // Get formatted trial end date (7 days from now)
  const getTrialEndDate = () => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    return endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          color={feature.highlight ? '#E8638B' : colors.primary}
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
            colors={['#E8638B', '#D53F8C']}
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
              colors={['#E8638B', '#D53F8C']}
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
                colors={['#E8638B', '#D53F8C']}
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
                { color: billingCycle === 'monthly' ? '#E8638B' : colors.textSecondary }
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
                { color: billingCycle === 'annual' ? '#E8638B' : colors.textSecondary }
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
                  <Text style={[styles.priceEquivalent, { color: '#E8638B' }]}>
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

        {/* Social Proof Section */}
        <View style={[styles.socialProofSection, { backgroundColor: isDark ? '#1a1a2e' : '#FFF5F7' }]}>
          <View style={styles.socialProofHeader}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Icon key={star} name="star" size={18} color="#FFB800" />
              ))}
            </View>
            <Text style={[styles.ratingText, { color: colors.text }]}>4.8 on App Store</Text>
          </View>
          <Text style={[styles.testimonialText, { color: colors.text }]}>
            "Finally an app that makes finding activities for my kids easy! The filters save me so much time."
          </Text>
          <Text style={[styles.testimonialAuthor, { color: colors.textSecondary }]}>
            — Sarah M., Mom of 3
          </Text>
          <View style={styles.familiesCount}>
            <Icon name="account-group" size={20} color="#E8638B" />
            <Text style={[styles.familiesCountText, { color: colors.textSecondary }]}>
              Join 10,000+ families using Kids Activity Tracker
            </Text>
          </View>
        </View>

        {/* Trust Badges Section */}
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
              {trialEligible !== false ? '7-day free trial' : 'No commitment'}
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
          <ActivityIndicator size="large" color="#E8638B" />
        ) : (
          <>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                onPress={handlePurchase}
                disabled={isPurchasing}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#E8638B', '#D53F8C']}
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

            {!isTrialing && trialEligible !== false && (
              <TouchableOpacity
                style={styles.trialButton}
                onPress={handleStartTrial}
                disabled={isPurchasing}
              >
                <Text style={styles.trialButtonText}>
                  Start 7-Day Free Trial
                </Text>
                <Text style={styles.trialSubtext}>
                  No charge until {getTrialEndDate()}
                </Text>
              </TouchableOpacity>
            )}

            {/* Auto-renewal notice */}
            <Text style={[styles.renewalNotice, { color: colors.textSecondary }]}>
              {billingCycle === 'annual'
                ? `Renews automatically at ${annualPrice}/year. Cancel anytime.`
                : `Renews automatically at ${monthlyPrice}/month. Cancel anytime.`}
            </Text>

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
    shadowColor: '#E8638B',
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
    color: '#E8638B',
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
    color: '#E8638B',
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
    backgroundColor: '#E8638B',
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
  // Social proof styles
  socialProofSection: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  socialProofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingStars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  testimonialText: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  testimonialAuthor: {
    fontSize: 13,
    marginBottom: 16,
  },
  familiesCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  familiesCountText: {
    fontSize: 13,
    marginLeft: 8,
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
    shadowColor: '#E8638B',
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
    borderColor: '#E8638B',
  },
  trialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8638B',
  },
  trialSubtext: {
    fontSize: 12,
    color: '#E8638B',
    marginTop: 4,
    opacity: 0.8,
  },
  renewalNotice: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
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
    shadowColor: '#E8638B',
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
