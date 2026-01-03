import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, NavigationContainerRef, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import PreferencesService from '../services/preferencesService';
import { shouldForceOnboarding } from '../config/development';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import { loadAuthState } from '../store/slices/authSlice';
import { fetchSubscription } from '../store/slices/subscriptionSlice';
import { appEventEmitter, APP_EVENTS } from '../utils/eventEmitter';
import { pushNotificationService } from '../services/pushNotificationService';

// Import screens
import DashboardScreen from '../screens/DashboardScreenModern';
import SearchScreen from '../screens/SearchScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import FiltersScreen from '../screens/FiltersScreen';
import FavoritesScreenModern from '../screens/FavoritesScreenModern';
import FriendsAndFamilyScreenModern from '../screens/FriendsAndFamilyScreenModern';
import ChildDetailScreen from '../screens/ChildDetailScreen';
import ShareChildScreen from '../screens/ShareChildScreen';
import ProfileScreen from '../screens/ProfileScreenModern';
import ActivityDetailScreen from '../screens/activities/ActivityDetailScreenModern';
import FilterScreen from '../screens/FilterScreen';
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
import SponsoredPartnersScreen from '../screens/SponsoredPartnersScreen';
import LegalScreen from '../screens/legal/LegalScreen';
import PaywallScreen from '../screens/PaywallScreen';
import CustomerCenterScreen from '../screens/CustomerCenterScreen';
import AIRecommendationsScreen from '../screens/AIRecommendationsScreen';
import AIChatScreen from '../screens/AIChatScreen';
import WeeklyPlannerScreen from '../screens/WeeklyPlannerScreen';
import WaitingListScreen from '../screens/WaitingListScreen';
import MapSearchScreen from '../screens/MapSearchScreen';
import InvitationAcceptScreen from '../screens/InvitationAcceptScreen';
import ChildPreferencesScreen from '../screens/ChildPreferencesScreen';

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
    <Stack.Screen name="SponsoredPartners" component={SponsoredPartnersScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    <Stack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
    <Stack.Screen name="AIChat" component={AIChatScreen} />
    <Stack.Screen name="WeeklyPlanner" component={WeeklyPlannerScreen} />
    <Stack.Screen name="MapSearch" component={MapSearchScreen} />
    <Stack.Screen name="WaitingList" component={WaitingListScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    <Stack.Screen name="ChildPreferences" component={ChildPreferencesScreen} />
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
    <Stack.Screen name="FavoritesMain" component={FavoritesScreenModern} />
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

// Screens that belong to top navigation (shouldn't highlight bottom tabs)
const TOP_TAB_SCREENS = ['Dashboard', 'MapSearch', 'AIChat', 'AIRecommendations', 'Calendar', 'WeeklyPlanner'];

// Get the current route name from nested navigation state
const getActiveRouteName = (state: any): string => {
  if (!state) return '';
  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
};

// Custom tab bar component that only highlights when on actual bottom tab screens
const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const activeRouteName = getActiveRouteName(state);
  const isTopTabActive = TOP_TAB_SCREENS.includes(activeRouteName);

  return (
    <View style={customTabBarStyles.container}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;

        // Determine if this tab should be highlighted
        // Only highlight if we're NOT on a top tab screen AND this is the focused tab
        const isFocused = state.index === index;
        const shouldHighlight = !isTopTabActive && isFocused;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Get icon based on route
        let iconName = 'tune-variant';
        if (route.name === 'Favourites') iconName = shouldHighlight ? 'folder-heart' : 'folder-heart-outline';
        else if (route.name === 'FriendsAndFamily') iconName = shouldHighlight ? 'account-group' : 'account-group-outline';
        else if (route.name === 'Profile') iconName = shouldHighlight ? 'account' : 'account-outline';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={shouldHighlight ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            style={customTabBarStyles.tab}
          >
            <Icon
              name={iconName}
              size={26}
              color={shouldHighlight ? '#E8638B' : '#717171'}
            />
            <Text style={[
              customTabBarStyles.label,
              { color: shouldHighlight ? '#E8638B' : '#717171' }
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const customTabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    height: 85,
    paddingBottom: 10,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
    <Tab.Screen
      name="FiltersTab"
      component={HomeStack}
      options={{
        tabBarLabel: 'Preferences',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon
            name="account-cog"
            color={color}
            size={26}
          />
        ),
      }}
      listeners={({ navigation }) => ({
        tabPress: (e) => {
          // Prevent default behavior
          e.preventDefault();
          // Navigate to ChildPreferences screen within HomeStack
          navigation.navigate('FiltersTab', { screen: 'ChildPreferences' });
        },
      })}
    />
    <Tab.Screen
      name="Favourites"
      component={FavoritesStack}
      options={{
        tabBarLabel: 'My Collection',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon
            name={focused ? "folder-heart" : "folder-heart-outline"}
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

// Deep linking configuration
const linking: LinkingOptions<any> = {
  prefixes: [
    'https://kidsactivitytracker.ca',
    'https://www.kidsactivitytracker.ca',
    'kidsactivitytracker://',
  ],
  config: {
    screens: {
      InvitationAccept: {
        path: 'invite/:token',
      },
      // Legacy support
      InvitationAcceptLegacy: {
        path: 'accept-invitation',
        parse: {
          token: (token: string) => token,
        },
      },
      // Activity deep link - opens activity detail screen
      ActivityDeepLink: {
        path: 'activity/:activityId',
      },
    },
  },
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
      // Force onboarding if dev flag is set
      const completed = shouldForceOnboarding() ? false : (preferences.hasCompletedOnboarding || false);
      setHasCompletedOnboarding(completed);
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
      // Check Firebase authentication status
      const authResult = await dispatch(loadAuthState());

      // If user is authenticated, subscription is already fetched by loadAuthState
      if (authResult.payload) {
        console.log('User authenticated via Firebase');
      }

      // Check onboarding status
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      console.log('Preferences loaded:', preferences);
      // Force onboarding if dev flag is set
      const completed = shouldForceOnboarding() ? false : (preferences.hasCompletedOnboarding || false);
      console.log('Force onboarding:', shouldForceOnboarding(), 'hasCompletedOnboarding:', completed);
      setHasCompletedOnboarding(completed);
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
        linking={linking}
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
            <>
              <Stack.Screen name="Auth" component={AuthNavigator} />
              <Stack.Screen
                name="InvitationAccept"
                component={InvitationAcceptScreen}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen
                name="ActivityDeepLink"
                component={ActivityDetailScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          ) : !hasCompletedOnboarding ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
              <Stack.Screen
                name="InvitationAccept"
                component={InvitationAcceptScreen}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen
                name="ActivityDeepLink"
                component={ActivityDetailScreen}
                options={{ presentation: 'modal' }}
              />
            </>
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
              <Stack.Screen
                name="InvitationAccept"
                component={InvitationAcceptScreen}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen
                name="ActivityDeepLink"
                component={ActivityDetailScreen}
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