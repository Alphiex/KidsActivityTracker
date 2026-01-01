import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreenModern from '../screens/OnboardingScreenModern';
import OnboardingActivityTypesScreen from '../screens/onboarding/OnboardingActivityTypesScreen';
import OnboardingAgeScreen from '../screens/onboarding/OnboardingAgeScreen';
import OnboardingLocationScreen from '../screens/onboarding/OnboardingLocationScreen';
import OnboardingSubscriptionScreen from '../screens/onboarding/OnboardingSubscriptionScreen';
import OnboardingCompleteScreen from '../screens/onboarding/OnboardingCompleteScreen';

export type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  OnboardingActivityTypes: undefined;
  OnboardingAge: undefined;
  OnboardingLocation: undefined;
  OnboardingSubscription: undefined;
  OnboardingComplete: undefined;
};

const Stack = createStackNavigator<OnboardingStackParamList>();

const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="OnboardingIntro" component={OnboardingScreenModern} />
      <Stack.Screen name="OnboardingActivityTypes" component={OnboardingActivityTypesScreen} />
      <Stack.Screen name="OnboardingAge" component={OnboardingAgeScreen} />
      <Stack.Screen name="OnboardingLocation" component={OnboardingLocationScreen} />
      <Stack.Screen name="OnboardingSubscription" component={OnboardingSubscriptionScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
