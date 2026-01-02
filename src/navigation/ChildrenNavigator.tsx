import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ChildrenListScreen from '../screens/children/ChildrenListScreen';
import AddEditChildScreen from '../screens/children/AddEditChildScreen';
import ChildProfileScreen from '../screens/children/ChildProfileScreen';
import ChildActivityHistoryScreen from '../screens/children/ChildActivityHistoryScreen';
import ChildProgressScreen from '../screens/children/ChildProgressScreen';
import ChildPreferencesSettingsScreen from '../screens/children/ChildPreferencesSettingsScreen';

export type ChildrenStackParamList = {
  ChildrenList: undefined;
  AddEditChild: { childId?: string };
  ChildProfile: { childId: string };
  ChildActivityHistory: { childId: string; childName: string };
  ChildProgress: { child: { id: string; name: string; dateOfBirth: string } };
  ChildPreferencesSettings: { childId: string };
};

const Stack = createStackNavigator<ChildrenStackParamList>();

const ChildrenNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="ChildrenList"
        component={ChildrenListScreen}
        options={{
          title: 'My Children',
        }}
      />
      <Stack.Screen
        name="AddEditChild"
        component={AddEditChildScreen}
        options={{
          title: 'Add Child',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="ChildProfile"
        component={ChildProfileScreen}
        options={{
          title: 'Child Profile',
        }}
      />
      <Stack.Screen
        name="ChildActivityHistory"
        component={ChildActivityHistoryScreen}
        options={{
          title: 'Activity History',
        }}
      />
      <Stack.Screen
        name="ChildProgress"
        component={ChildProgressScreen}
        options={{
          title: 'Skill Progress',
        }}
      />
      <Stack.Screen
        name="ChildPreferencesSettings"
        component={ChildPreferencesSettingsScreen}
        options={{
          title: 'Activity Preferences',
        }}
      />
    </Stack.Navigator>
  );
};

export default ChildrenNavigator;