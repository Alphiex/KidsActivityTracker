import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreenModern from '../screens/OnboardingScreenModern';
import OnboardingChildrenScreen from '../screens/onboarding/OnboardingChildrenScreen';
import ChildSetupWizardScreen from '../screens/onboarding/ChildSetupWizardScreen';
import OnboardingSubscriptionScreen from '../screens/onboarding/OnboardingSubscriptionScreen';
import OnboardingCompleteScreen from '../screens/onboarding/OnboardingCompleteScreen';

export type OnboardingStackParamList = {
  OnboardingIntro: undefined;
  OnboardingChildren: undefined;
  // Unified child setup wizard - combines profile, location, and activity preferences
  ChildSetupWizard: { childId?: string; isOnboarding?: boolean };
  OnboardingSubscription: undefined;
  OnboardingComplete: undefined;
};

const Stack = createStackNavigator<OnboardingStackParamList>();

/**
 * Onboarding flow (Child-Centric):
 * 1. Intro - Welcome screen
 * 2. Children - Add your children list
 * 3. ChildSetupWizard - Unified wizard for each child (profile + location + activities)
 * 4. Subscription - Choose plan
 * 5. Complete - All done!
 *
 * The wizard combines child profile (name, birthday, gender), location preferences,
 * and activity type preferences into a single multi-step flow.
 */
const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="OnboardingIntro" component={OnboardingScreenModern} />
      <Stack.Screen name="OnboardingChildren" component={OnboardingChildrenScreen} />
      <Stack.Screen name="ChildSetupWizard" component={ChildSetupWizardScreen} />
      <Stack.Screen name="OnboardingSubscription" component={OnboardingSubscriptionScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
    </Stack.Navigator>
  );
};

export default OnboardingNavigator;
