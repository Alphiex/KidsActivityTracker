import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import PreferencesService from '../services/preferencesService';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import { loadStoredAuth } from '../store/slices/authSlice';
import { fetchSubscription } from '../store/slices/subscriptionSlice';
import { appEventEmitter, APP_EVENTS } from '../utils/eventEmitter';
import { pushNotificationService } from '../services/pushNotificationService';

// Import screens
import DashboardScreen from '../screens/DashboardScreenModern';
import SearchScreen from '../screens/SearchScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import FiltersScreen from '../screens/FiltersScreen';
import FavoritesRedirect from '../screens/FavoritesRedirect';
import FriendsAndFamilyScreenModern from '../screens/FriendsAndFamilyScreenModern';
import ChildDetailScreen from '../screens/ChildDetailScreen';
import ShareChildScreen from '../screens/ShareChildScreen';
import ProfileScreen from '../screens/ProfileScreenModern';
import ActivityDetailScreen from '../screens/activities/ActivityDetailScreenModern';
import FilterScreen from '../screens/FilterScreen';
import SiteAccountsScreen from '../screens/SiteAccountsScreen';
import ActivityListScreen from '../screens/ActivityListScreen';
import NewActivitiesScreen from '../screens/NewActivitiesScreen';
import OnboardingNavigator from './OnboardingNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import LocationBrowseScreen from '../screens/LocationBrowseScreen';
import CityBrowseScreen from '../screens/CityBrowseScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreenModern';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import NavigationErrorBoundary from '../components/NavigationErrorBoundary';
import SharingManagementScreen from '../screens/SharingManagementScreen';
import AllCategoriesScreen from '../screens/AllCategoriesScreen';
import RecommendedActivitiesScreen from '../screens/RecommendedActivitiesScreen';
import AllActivityTypesScreen from '../screens/AllActivityTypesScreen';
import AllAgeGroupsScreen from '../screens/AllAgeGroupsScreen';
import ActivityTypeDetailScreen from '../screens/ActivityTypeDetailScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import ActivityHistoryScreen from '../screens/ActivityHistoryScreen';
import SharedActivitiesScreen from '../screens/SharedActivitiesScreen';
import CalendarScreenModern from '../screens/CalendarScreenModernFixed';
import UnifiedResultsScreen from '../screens/UnifiedResultsScreen';
import FeaturedPartnersScreen from '../screens/FeaturedPartnersScreen';
import LegalScreen from '../screens/legal/LegalScreen';
import PaywallScreen from '../screens/PaywallScreen';
import CustomerCenterScreen from '../screens/CustomerCenterScreen';
import AIRecommendationsScreen from '../screens/AIRecommendationsScreen';
import WeeklyPlannerScreen from '../screens/WeeklyPlannerScreen';
import WaitingListScreen from '../screens/WaitingListScreen';

// Import Preference Screens
import ActivityTypePreferencesScreen from '../screens/preferences/ActivityTypePreferencesScreen';
import AgePreferencesScreen from '../screens/preferences/AgePreferencesScreen';
import LocationPreferencesScreen from '../screens/preferences/LocationPreferencesScreen';
import DistancePreferencesScreen from '../screens/preferences/DistancePreferencesScreen';
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
    }}
  >
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="SearchMain" component={SearchScreen} />
    <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
    <Stack.Screen name="Filters" component={FiltersScreen} />
    <Stack.Screen name="Calendar" component={CalendarScreenModern} />
    <Stack.Screen name="ActivityList" component={ActivityListScreen} />
    <Stack.Screen name="NewActivities" component={NewActivitiesScreen} />
    <Stack.Screen name="CityBrowse" component={CityBrowseScreen} />
    <Stack.Screen name="LocationBrowse" component={LocationBrowseScreen} />
    <Stack.Screen name="AllCategories" component={AllCategoriesScreen} />
    <Stack.Screen name="AllActivityTypes" component={AllActivityTypesScreen} />
    <Stack.Screen name="AllAgeGroups" component={AllAgeGroupsScreen} />
    <Stack.Screen name="ActivityTypeDetail" component={ActivityTypeDetailScreen} />
    <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
    <Stack.Screen name="RecommendedActivities" component={RecommendedActivitiesScreen} />
    <Stack.Screen name="UnifiedResults" component={UnifiedResultsScreen} />
    <Stack.Screen name="FeaturedPartners" component={FeaturedPartnersScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    <Stack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
    <Stack.Screen name="WeeklyPlanner" component={WeeklyPlannerScreen} />
    <Stack.Screen name="WaitingList" component={WaitingListScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SearchMain" component={SearchScreen} />
    <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
    <Stack.Screen name="Filter" component={FilterScreen as any} />
    <Stack.Screen name="ActivityList" component={ActivityListScreen} />
    <Stack.Screen name="ActivityTypeDetail" component={ActivityTypeDetailScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    <Stack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
  </Stack.Navigator>
);

const FavoritesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="FavoritesMain" component={FavoritesRedirect} />
    <Stack.Screen name="UnifiedResults" component={UnifiedResultsScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
  </Stack.Navigator>
);

const FriendsAndFamilyStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="FriendsAndFamilyMain" component={FriendsAndFamilyScreenModern} />
    <Stack.Screen name="ChildDetail" component={ChildDetailScreen} />
    <Stack.Screen name="ShareChild" component={ShareChildScreen} />
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
    <Stack.Screen name="DistancePreferences" component={DistancePreferencesScreen} />
    <Stack.Screen name="BudgetPreferences" component={BudgetPreferencesScreen} />
    <Stack.Screen name="SchedulePreferences" component={SchedulePreferencesScreen} />
    <Stack.Screen name="ViewSettings" component={ViewSettingsScreen} />
    <Stack.Screen name="Legal" component={LegalScreen} />
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
        tabBarActiveTintColor: '#FF385C',
        tabBarInactiveTintColor: '#717171',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EBEBEB',
          elevation: 0,
          shadowOpacity: 0,
          height: 85,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 5,
        },
        headerShown: false,
      }}
    >
    <Tab.Screen
      name="Explore"
      component={HomeStack}
      options={{
        tabBarLabel: 'Explore',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "compass" : "compass-outline"} 
            color={color} 
            size={26} 
          />
        ),
      }}
    />
    <Tab.Screen
      name="Favourites"
      component={FavoritesStack}
      options={{
        tabBarLabel: 'Favourites',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "heart" : "heart-outline"} 
            color={color} 
            size={26} 
          />
        ),
      }}
    />
    <Tab.Screen
      name="FriendsAndFamily"
      component={FriendsAndFamilyStack}
      options={{
        tabBarLabel: 'Friends & Family',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "account-group" : "account-group-outline"} 
            color={color} 
            size={26} 
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
            name={focused ? "account" : "account-outline"} 
            color={color} 
            size={26} 
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
  const isAuthenticated = useAppSelector((state) => state.auth?.isAuthenticated ?? false);
  const authLoading = useAppSelector((state) => state.auth?.isLoading ?? true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const { isDark, colors } = useTheme();
  console.log('Theme loaded:', { isDark, hasColors: !!colors });

  // Navigation ref for push notification handling
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Set navigation ref for push notifications when ready
  const onNavigationReady = () => {
    if (navigationRef.current) {
      pushNotificationService.setNavigationRef(navigationRef.current);
      console.log('[Navigation] Navigation ref set for push notifications');
    }
  };

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
      const authResult = await dispatch(loadStoredAuth());

      // If user is authenticated, fetch their subscription
      if (authResult.payload) {
        console.log('User authenticated, fetching subscription...');
        dispatch(fetchSubscription());
      }

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
        ref={navigationRef}
        onReady={onNavigationReady}
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
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
              <Stack.Screen
                name="Paywall"
                component={PaywallScreen}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen
                name="CustomerCenter"
                component={CustomerCenterScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationErrorBoundary>
  );
};

export default RootNavigator;