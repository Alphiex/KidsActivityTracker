import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { revenueCatService, PRODUCT_IDS } from '../../services/revenueCatService';
import { useAppDispatch } from '../../store';
import { fetchSubscription, startTrial, checkTrialEligibility } from '../../store/slices/subscriptionSlice';
import ScreenBackground from '../../components/ScreenBackground';

const { width: screenWidth } = Dimensions.get('window');

const PREMIUM_FEATURES = [
  {
    icon: 'account-child-circle',
    title: 'Unlimited Child Profiles',
    description: 'Track activities for your entire family with individual preferences',
  },
  {
    icon: 'account-group',
    title: 'Friends & Family Sharing',
    description: 'Coordinate with grandparents, caregivers, and your child\'s friends\' parents',
  },
  {
    icon: 'bell-ring',
    title: 'Smart Notifications',
    description: 'Spot alerts, registration reminders, new activity matches & schedule changes',
  },
  {
    icon: 'robot',
    title: 'AI Recommendations & Chat',
    description: 'Personalized suggestions and natural language search powered by AI',
  },
  {
    icon: 'calendar-sync',
    title: 'Calendar Integration',
    description: 'Sync activities to Google Calendar, Apple Calendar & Outlook',
  },
  {
    icon: 'filter-variant',
    title: 'Advanced Filters',
    description: 'Filter by budget, schedule, distance, age group & activity type',
  },
  {
    icon: 'heart-multiple',
    title: 'Unlimited Favorites & Collections',
    description: 'Save and organize all activities you love into custom collections',
  },
  {
    icon: 'map-marker-radius',
    title: 'Multi-Location Search',
    description: 'Search activities near home, work, school, or grandparents\' house',
  },
];

const OnboardingSubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [trialEligible, setTrialEligible] = useState(true);
  const [monthlyPrice, setMonthlyPrice] = useState('$4.99');
  const [yearlyPrice, setYearlyPrice] = useState('$39.99');

  useEffect(() => {
    checkEligibilityAndPricing();
  }, []);

  const checkEligibilityAndPricing = async () => {
    try {
      // Check trial eligibility
      const result = await dispatch(checkTrialEligibility()).unwrap();
      setTrialEligible(result.eligible);

      // Get pricing from RevenueCat
      const offerings = await revenueCatService.getOfferings();
      if (offerings?.current?.availablePackages) {
        for (const pkg of offerings.current.availablePackages) {
          if (pkg.identifier === PRODUCT_IDS.MONTHLY) {
            setMonthlyPrice(pkg.product.priceString);
          } else if (pkg.identifier === PRODUCT_IDS.YEARLY) {
            setYearlyPrice(pkg.product.priceString);
          }
        }
      }
    } catch (error) {
      console.log('Error checking eligibility:', error);
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    try {
      const result = await dispatch(startTrial()).unwrap();
      if (result.success) {
        Alert.alert(
          'Trial Started!',
          'Enjoy 7 days of Premium features. Your subscription will begin automatically after the trial unless cancelled.',
          [{ text: 'Continue', onPress: () => navigation.navigate('OnboardingComplete') }]
        );
      } else {
        Alert.alert('Unable to Start Trial', result.error || 'Please try again later.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const success = await revenueCatService.purchaseYearlyPackage();
      if (success) {
        await dispatch(fetchSubscription());
        Alert.alert(
          'Welcome to Premium!',
          'You now have access to all features.',
          [{ text: 'Continue', onPress: () => navigation.navigate('OnboardingComplete') }]
        );
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingComplete');
  };

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#FFE5EC', '#E8F4FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <Icon name="crown" size={48} color="#E8638B" />
          </LinearGradient>
          <Text style={styles.title}>Unlock Premium</Text>
          <Text style={styles.subtitle}>
            Get the most out of KidsActivityTracker with unlimited access to all features
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={24} color="#E8638B" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              <Icon name="check" size={20} color="#10B981" />
            </View>
          ))}
        </View>

        {/* Pricing Info */}
        <View style={styles.pricingInfo}>
          <Text style={styles.pricingText}>
            {yearlyPrice}/year or {monthlyPrice}/month
          </Text>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={styles.ctaContainer}>
        {/* Trial CTA - Primary */}
        {trialEligible && (
          <>
            <TouchableOpacity
              style={styles.trialButton}
              onPress={handleStartTrial}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#E8638B', '#D53F8C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.trialButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.trialButtonText}>Start 7-Day Free Trial</Text>
                    <Icon name="arrow-right" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.trialDisclaimer}>
              After your trial, subscription auto-renews at {yearlyPrice}/year.{'\n'}
              Cancel anytime in your device settings.
            </Text>
          </>
        )}

        {/* Subscribe Now - Secondary */}
        {!trialEligible && (
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleSubscribe}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#E8638B" />
            ) : (
              <Text style={styles.subscribeButtonText}>Subscribe Now - {yearlyPrice}/year</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Skip - Tertiary */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Continue with Free Plan</Text>
        </TouchableOpacity>

        {/* Legal Links */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => revenueCatService.restorePurchases()}>
            <Text style={styles.legalLinkText}>Restore Purchases</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>•</Text>
          <TouchableOpacity>
            <Text style={styles.legalLinkText}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>•</Text>
          <TouchableOpacity>
            <Text style={styles.legalLinkText}>Privacy</Text>
          </TouchableOpacity>
        </View>
      </View>
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  featuresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  pricingInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(243, 244, 246, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  trialButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trialButtonGradient: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  trialButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  trialDisclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  subscribeButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8638B',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  subscribeButtonText: {
    color: '#E8638B',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  skipButtonText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  legalLinkText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  legalDivider: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
});

export default OnboardingSubscriptionScreen;
