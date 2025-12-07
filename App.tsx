import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { MMKV } from 'react-native-mmkv';
import RootNavigator from './src/navigation/RootNavigator';
import NetworkStatus from './src/components/NetworkStatus';
import { store, persistor } from './src/store';
import { ThemeProvider } from './src/contexts/ThemeContext';
import ActivityService from './src/services/activityService';

function App() {
  // Note: Removed automatic clearing of MMKV storage to allow persistent authentication
  useEffect(() => {
    // Reset ActivityService instance to ensure it uses the latest API configuration
    ActivityService.resetInstance();

    if (__DEV__) {
      console.log('Development mode: MMKV storage persists for authentication');
      console.log('ActivityService reset to use latest API configuration');

      // Force clear preferences to ensure clean state
      const defaultStorage = new MMKV();
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
    }
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <RootNavigator />
            <NetworkStatus />
          </ThemeProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

export default App;