import React, { useState, useEffect } from 'react';
import { StatusBar, View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import PreferencesService from '../services/preferencesService';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import { loadStoredAuth } from '../store/slices/authSlice';
import { appEventEmitter, APP_EVENTS } from '../utils/eventEmitter';

// Import screens
import DashboardScreen from '../screens/DashboardScreenModern';
import SearchScreen from '../screens/SearchScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import FriendsAndFamilyScreen from '../screens/FriendsAndFamilyScreenSimple';
import ProfileScreen from '../screens/ProfileScreen';
import ActivityDetailScreen from '../screens/activities/ActivityDetailScreenEnhanced';
import FilterScreen from '../screens/FilterScreen';
import SiteAccountsScreen from '../screens/SiteAccountsScreen';
import ActivityListScreen from '../screens/ActivityListScreen';
import NewActivitiesScreen from '../screens/NewActivitiesScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LocationBrowseScreen from '../screens/LocationBrowseScreen';
import CityBrowseScreen from '../screens/CityBrowseScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import NavigationErrorBoundary from '../components/NavigationErrorBoundary';
import SharingManagementScreen from '../screens/SharingManagementScreen';
import AllCategoriesScreen from '../screens/AllCategoriesScreen';
import RecommendedActivitiesScreen from '../screens/RecommendedActivitiesScreen';
import AllActivityTypesScreen from '../screens/AllActivityTypesScreen';
import ActivityTypeDetailScreen from '../screens/ActivityTypeDetailScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import ActivityHistoryScreen from '../screens/ActivityHistoryScreen';
import SharedActivitiesScreen from '../screens/SharedActivitiesScreen';

// Import Preference Screens
import ActivityTypePreferencesScreen from '../screens/preferences/ActivityTypePreferencesScreen';
import AgePreferencesScreen from '../screens/preferences/AgePreferencesScreen';
import LocationPreferencesScreen from '../screens/preferences/LocationPreferencesScreen';
import BudgetPreferencesScreen from '../screens/preferences/BudgetPreferencesScreen';
import SchedulePreferencesScreen from '../screens/preferences/SchedulePreferencesScreen';
import ViewSettingsScreen from '../screens/preferences/ViewSettingsScreen';

// Import Navigators
import AuthNavigator from './AuthNavigator';
import ChildrenNavigator from './ChildrenNavigator';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator 
    screenOptions={{ 
      headerShown: false,
      presentation: 'card',
      animationEnabled: true,
    }}
  >
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="ActivityList" component={ActivityListScreen} />
    <Stack.Screen name="NewActivities" component={NewActivitiesScreen} />
    <Stack.Screen name="CityBrowse" component={CityBrowseScreen} />
    <Stack.Screen name="LocationBrowse" component={LocationBrowseScreen} />
    <Stack.Screen name="AllCategories" component={AllCategoriesScreen} />
    <Stack.Screen name="AllActivityTypes" component={AllActivityTypesScreen} />
    <Stack.Screen name="ActivityTypeDetail" component={ActivityTypeDetailScreen} />
    <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
    <Stack.Screen name="RecommendedActivities" component={RecommendedActivitiesScreen} />
    <Stack.Screen name="Favorites" component={FavoritesScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SearchMain" component={SearchScreen} />
    <Stack.Screen name="Filter" component={FilterScreen} />
    <Stack.Screen name="ActivityList" component={ActivityListScreen} />
    <Stack.Screen name="ActivityTypeDetail" component={ActivityTypeDetailScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
  </Stack.Navigator>
);

const FavoritesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="FavoritesMain" component={FavoritesScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
  </Stack.Navigator>
);

const FriendsAndFamilyStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="FriendsAndFamilyMain" component={FriendsAndFamilyScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    <Stack.Screen name="SharingManagement" component={SharingManagementScreen} />
    <Stack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
    <Stack.Screen name="SharedActivities" component={SharedActivitiesScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="Children" component={ChildrenNavigator} />
    <Stack.Screen name="SiteAccounts" component={SiteAccountsScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    <Stack.Screen name="ActivityTypePreferences" component={ActivityTypePreferencesScreen} />
    <Stack.Screen name="AgePreferences" component={AgePreferencesScreen} />
    <Stack.Screen name="LocationPreferences" component={LocationPreferencesScreen} />
    <Stack.Screen name="BudgetPreferences" component={BudgetPreferencesScreen} />
    <Stack.Screen name="SchedulePreferences" component={SchedulePreferencesScreen} />
    <Stack.Screen name="ViewSettings" component={ViewSettingsScreen} />
  </Stack.Navigator>
);

const screenOptions = {
  headerStyle: {
    backgroundColor: Colors.primary,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: Colors.white,
  headerTitleStyle: {
    fontWeight: '600',
  },
};

const MainTabs = () => {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: 65,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
    <Tab.Screen
      name="Home"
      component={HomeStack}
      options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "home" : "home-outline"} 
            color={color} 
            size={28} 
          />
        ),
      }}
    />
    <Tab.Screen
      name="Search"
      component={SearchStack}
      options={{
        tabBarLabel: 'Search',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "magnify-plus" : "magnify"} 
            color={color} 
            size={28} 
          />
        ),
      }}
    />
    <Tab.Screen
      name="FriendsAndFamily"
      component={FriendsAndFamilyScreen}
      options={{
        tabBarLabel: 'Friends & Family',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "account-group" : "account-group-outline"} 
            color={color} 
            size={28} 
          />
        ),
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileStack}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "account-circle" : "account-circle-outline"} 
            color={color} 
            size={28} 
          />
        ),
      }}
    />
    </Tab.Navigator>
  );
};

const RootNavigator = () => {
  console.log('RootNavigator rendering');
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { isDark, colors } = useTheme();
  console.log('Theme loaded:', { isDark, hasColors: !!colors });

  useEffect(() => {
    initializeApp();
  }, []);

  // Re-check onboarding status when auth changes
  useEffect(() => {
    if (isAuthenticated && !authLoading && !isLoading) {
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      console.log('Auth changed, checking onboarding status:', preferences.hasCompletedOnboarding);
      setHasCompletedOnboarding(preferences.hasCompletedOnboarding || false);
    }
  }, [isAuthenticated, authLoading, isLoading]);

  // Listen for onboarding completion event
  useEffect(() => {
    const handleOnboardingCompleted = () => {
      console.log('Onboarding completed event received');
      setHasCompletedOnboarding(true);
    };

    appEventEmitter.on(APP_EVENTS.ONBOARDING_COMPLETED, handleOnboardingCompleted);

    return () => {
      appEventEmitter.off(APP_EVENTS.ONBOARDING_COMPLETED, handleOnboardingCompleted);
    };
  }, []);

  const initializeApp = async () => {
    console.log('Initializing app...');
    try {
      // Check authentication status (will auto-login in dev mode)
      await dispatch(loadStoredAuth());
      
      // Check onboarding status
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      console.log('Preferences loaded:', preferences);
      setHasCompletedOnboarding(preferences.hasCompletedOnboarding || false);
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationErrorBoundary>
      <NavigationContainer
        theme={{
          dark: isDark,
          colors: {
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.primary,
          },
          fonts: {
            regular: {
              fontFamily: 'System',
              fontWeight: '400',
            },
            medium: {
              fontFamily: 'System',
              fontWeight: '500',
            },
            bold: {
              fontFamily: 'System',
              fontWeight: '700',
            },
            heavy: {
              fontFamily: 'System',
              fontWeight: '900',
            },
          },
        }}
      >
        <StatusBar 
          barStyle={isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={colors.background}
        />
        <Stack.Navigator 
          screenOptions={{ headerShown: false }}
        >
          {!isAuthenticated ? (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          ) : !hasCompletedOnboarding ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationErrorBoundary>
  );
};

export default RootNavigator;