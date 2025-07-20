import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import FilterScreen from '../screens/FilterScreen';
import ChildrenScreen from '../screens/ChildrenScreen';
import SiteAccountsScreen from '../screens/SiteAccountsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const HomeStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen 
      name="HomeMain" 
      component={HomeScreen} 
      options={{ 
        title: 'Kids Activity Tracker',
        headerLeft: () => (
          <Icon name="tent" size={24} color={Colors.white} style={{ marginLeft: 16 }} />
        ),
      }} 
    />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ title: 'Activity Details' }} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="SearchMain" component={SearchScreen} options={{ title: 'Search Activities' }} />
    <Stack.Screen name="Filter" component={FilterScreen} options={{ title: 'Filters' }} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ title: 'Activity Details' }} />
  </Stack.Navigator>
);

const FavoritesStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="FavoritesMain" component={FavoritesScreen} options={{ title: 'My Favorites' }} />
    <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ title: 'Activity Details' }} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'My Profile' }} />
    <Stack.Screen name="Children" component={ChildrenScreen} options={{ title: 'My Children' }} />
    <Stack.Screen name="SiteAccounts" component={SiteAccountsScreen} options={{ title: 'Site Accounts' }} />
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

const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.gray[500],
          tabBarStyle: {
            backgroundColor: Colors.white,
            borderTopWidth: 0,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarLabel: 'Discover',
            tabBarIcon: ({ color, size, focused }) => (
              <Icon 
                name={focused ? "compass" : "compass-outline"} 
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
    </NavigationContainer>
  );
};

export default RootNavigator;