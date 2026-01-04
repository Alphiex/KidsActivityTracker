import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PreferencesService from '../../services/preferencesService';
import { appEventEmitter, APP_EVENTS } from '../../utils/eventEmitter';
import { useAppDispatch } from '../../store';
import { fetchChildren } from '../../store/slices/childrenSlice';
import { fetchChildFavorites, fetchChildWatching, fetchChildWaitlist } from '../../store/slices/childFavoritesSlice';

const { width: screenWidth } = Dimensions.get('window');

// Use the family illustration
const familyImage = require('../../assets/illustrations/onboarding-3-family.png');

const OnboardingCompleteScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // CRITICAL: Fetch children and their data BEFORE completing onboarding
      // This ensures Redux state is fully synced before MainTabs is shown
      console.log('[OnboardingComplete] Fetching children before completing...');
      const childrenResult = await dispatch(fetchChildren()).unwrap();

      if (childrenResult && childrenResult.length > 0) {
        const childIds = childrenResult.map((c: any) => c.id);
        console.log('[OnboardingComplete] Loaded children:', childIds);

        // Pre-fetch child-related data
        await Promise.all([
          dispatch(fetchChildFavorites(childIds)),
          dispatch(fetchChildWatching(childIds)),
          dispatch(fetchChildWaitlist(childIds)),
        ]);
        console.log('[OnboardingComplete] Loaded child favorites/watching/waitlist');
      }

      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      const preferencesService = PreferencesService.getInstance();
      await preferencesService.updatePreferences({ hasCompletedOnboarding: true });
      appEventEmitter.emit(APP_EVENTS.ONBOARDING_COMPLETED);
    } catch (error) {
      console.log('Error completing onboarding:', error);
      // Still emit completion even if fetch fails - RootNavigator will re-fetch
      appEventEmitter.emit(APP_EVENTS.ONBOARDING_COMPLETED);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.imageContainer}>
          <Image source={familyImage} style={styles.image} resizeMode="contain" />
        </View>

        <View style={styles.successIcon}>
          <Icon name="check-circle" size={64} color="#10B981" />
        </View>

        <Text style={styles.title}>You're All Set!</Text>
        <Text style={styles.subtitle}>
          We've personalized your experience based on your preferences. You can always update these in Settings.
        </Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Icon name="magnify" size={24} color="#E8638B" />
            <Text style={styles.featureText}>Discover activities tailored to your interests</Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="calendar-check" size={24} color="#E8638B" />
            <Text style={styles.featureText}>Keep track of schedules and deadlines</Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="bell-ring" size={24} color="#E8638B" />
            <Text style={styles.featureText}>Get notified about new activities</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.startButton, isLoading && styles.startButtonDisabled]}
          onPress={handleComplete}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.startButtonText, { marginLeft: 8 }]}>Loading...</Text>
            </>
          ) : (
            <>
              <Text style={styles.startButtonText}>Start Exploring</Text>
              <Icon name="arrow-right" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: screenWidth * 0.6,
    height: 180,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  successIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  features: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  startButton: {
    backgroundColor: '#E8638B',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});

export default OnboardingCompleteScreen;
