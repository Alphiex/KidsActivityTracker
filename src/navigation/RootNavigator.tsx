import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import PreferencesService from '../services/preferencesService';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SearchScreen from '../screens/SearchScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import FilterScreen from '../screens/FilterScreen';
import ChildrenScreen from '../screens/ChildrenScreen';
import SiteAccountsScreen from '../screens/SiteAccountsScreen';
import ActivityTypeScreen from '../screens/ActivityTypeScreen';
import NewActivitiesScreen from '../screens/NewActivitiesScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LocationBrowseScreen from '../screens/LocationBrowseScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="ActivityType" component={ActivityTypeScreen} />
    <Stack.Screen name="NewActivities" component={NewActivitiesScreen} />
    <Stack.Screen name="LocationBrowse" component={LocationBrowseScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SearchMain" component={SearchScreen} />
    <Stack.Screen name="Filter" component={FilterScreen} />
    <Stack.Screen name="ActivityType" component={ActivityTypeScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
  </Stack.Navigator>
);

const FavoritesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="FavoritesMain" component={FavoritesScreen} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    <Stack.Screen name="Children" component={ChildrenScreen} />
    <Stack.Screen name="SiteAccounts" component={SiteAccountsScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
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

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: '#667eea',
      tabBarInactiveTintColor: Colors.gray[500],
      tabBarStyle: {
        backgroundColor: Colors.white,
        borderTopWidth: 0,
        elevation: 20,
        shadowColor: '#000',
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
      name="Favorites"
      component={FavoritesStack}
      options={{
        tabBarLabel: 'Favorites',
        tabBarIcon: ({ color, size, focused }) => (
          <Icon 
            name={focused ? "heart" : "heart-outline"} 
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

const RootNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      setHasCompletedOnboarding(preferences.hasCompletedOnboarding || false);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : null}
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;