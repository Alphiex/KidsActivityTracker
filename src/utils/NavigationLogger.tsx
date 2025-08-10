import React, { useEffect, useRef } from 'react';
import { useNavigationState, useRoute } from '@react-navigation/native';

export const NavigationLogger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigationState = useNavigationState(state => state);
  const route = useRoute();
  const previousState = useRef<any>();

  useEffect(() => {
    if (previousState.current && navigationState) {
      console.log('\n========== NAVIGATION STATE CHANGE ==========');
      console.log('Previous state:', JSON.stringify(previousState.current, null, 2));
      console.log('Current state:', JSON.stringify(navigationState, null, 2));
      console.log('Current route:', route.name);
      console.log('Route params:', route.params);
      console.log('==========================================\n');
    }
    previousState.current = navigationState;
  }, [navigationState, route]);

  return <>{children}</>;
};

export const useNavigationDebug = () => {
  const state = useNavigationState(state => state);
  
  const logNavigationAttempt = (screenName: string, params?: any) => {
    console.log('\n========== NAVIGATION ATTEMPT ==========');
    console.log(`Attempting to navigate to: ${screenName}`);
    console.log('With params:', params);
    console.log('Current navigation state:');
    console.log('- Current route:', state?.routes[state.index]?.name);
    console.log('- Available routes:', state?.routes.map(r => r.name).join(', '));
    console.log('- Route stack depth:', state?.routes.length);
    console.log('======================================\n');
  };

  return { logNavigationAttempt };
};