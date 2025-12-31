import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { MMKV } from 'react-native-mmkv';
import RootNavigator from './src/navigation/RootNavigator';
import NetworkStatus from './src/components/NetworkStatus';
import { store, persistor } from './src/store';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import ActivityService from './src/services/activityService';
import { revenueCatService } from './src/services/revenueCatService';
import { pushNotificationService } from './src/services/pushNotificationService';

// Lazy MMKV initialization for Android JSI compatibility
let _defaultStorage: MMKV | null = null;
let _storageInitAttempted = false;

const getDefaultStorage = (): MMKV | null => {
  if (_defaultStorage) return _defaultStorage;
  if (_storageInitAttempted) return null;

  try {
    _defaultStorage = new MMKV();
    return _defaultStorage;
  } catch (error) {
    _storageInitAttempted = true;
    console.warn('[App] MMKV initialization failed:', error);
    return null;
  }
};

function App() {
  // Initialize RevenueCat and Push Notifications on app start
  useEffect(() => {
    const initServices = async () => {
      // Initialize RevenueCat
      try {
        await revenueCatService.initialize();
        console.log('[App] RevenueCat initialized successfully');
      } catch (error) {
        console.error('[App] RevenueCat initialization failed:', error);
      }

      // Initialize Push Notifications
      try {
        await pushNotificationService.initialize();
        console.log('[App] Push notifications initialized successfully');
      } catch (error) {
        console.error('[App] Push notification initialization failed:', error);
      }
    };

    initServices();
  }, []);

  // Note: Removed automatic clearing of MMKV storage to allow persistent authentication
  useEffect(() => {
    // Reset ActivityService instance to ensure it uses the latest API configuration
    ActivityService.resetInstance();

    if (__DEV__) {
      console.log('Development mode: MMKV storage persists for authentication');
      console.log('ActivityService reset to use latest API configuration');

      // Force clear preferences to ensure clean state
      const defaultStorage = getDefaultStorage();
      if (defaultStorage) {
        const hasCleared = defaultStorage.getString('preferences_cleared_v5');
        if (!hasCleared) {
          console.log('🧹 Force clearing preferences to ensure hideClosedOrFull is false');
          // Just delete the preferences key
          defaultStorage.delete('user_preferences');
          defaultStorage.set('preferences_cleared_v5', 'true');
          console.log('✅ Preferences cleared - will use defaults with hideClosedOrFull=false');

          // Also set hasCompletedOnboarding to skip onboarding
          const defaultPrefs = {
            id: `user_${Date.now()}`,
            locations: [],
            ageRanges: [{ min: 0, max: 18 }],
            priceRange: { min: 0, max: 1000 },
            daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            timePreferences: {
              morning: true,
              afternoon: true,
              evening: true,
            },
            preferredCategories: [],
            preferredActivityTypes: [],
            excludedCategories: [],
            notifications: {
              enabled: true,
              newActivities: true,
              favoriteCapacity: true,
              capacityThreshold: 3,
              priceDrops: true,
              weeklyDigest: true,
            },
            theme: 'dark',
            viewType: 'card',
            hideClosedActivities: false,
            hideFullActivities: false,
            hideClosedOrFull: false, // Explicitly set to false!
            maxBudgetFriendlyAmount: 20,
            hasCompletedOnboarding: true, // Skip onboarding
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          defaultStorage.set('user_preferences', JSON.stringify(defaultPrefs));
          console.log('✅ Set default preferences with hideClosedOrFull=false and skipped onboarding');
        }
      } else {
        console.log('[App] MMKV not available, skipping preference initialization');
      }
    }
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <SubscriptionProvider>
              <RootNavigator />
              <NetworkStatus />
            </SubscriptionProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

export default App;