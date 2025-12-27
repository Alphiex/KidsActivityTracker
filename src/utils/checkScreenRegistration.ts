import { CommonActions } from '@react-navigation/native';

export const checkScreenRegistration = (navigation: any) => {
  console.log('\n========== SCREEN REGISTRATION CHECK ==========');
  
  // Method 1: Try to get available routes
  try {
    const state = navigation.getState();
    console.log('Current navigator type:', state.type);
    console.log('Current routes:', state.routes.map((r: any) => r.name));
    
    if ('routeNames' in state) {
      console.log('Available route names:', state.routeNames);
    }
  } catch (e: any) {
    console.log('Could not get state:', e?.message);
  }

  // Method 2: Try to check if screen exists using canGoBack
  const screenNames = ['ActivityDetail', 'ActivityDetailScreen', 'ActivityDetails'];
  console.log('\nChecking screen variations:');
  
  screenNames.forEach(name => {
    try {
      // Try to get route config
      const action = CommonActions.navigate({ name });
      console.log(`- ${name}: Action created successfully`);
    } catch (e: any) {
      console.log(`- ${name}: Failed to create action -`, e?.message);
    }
  });

  // Method 3: Check parent navigators
  console.log('\nChecking parent navigators:');
  let currentNav = navigation;
  let level = 0;
  
  while (currentNav) {
    try {
      const parent = currentNav.getParent();
      if (parent) {
        level++;
        console.log(`Level ${level} parent found`);
        const parentState = parent.getState();
        console.log(`- Type: ${parentState.type}`);
        console.log(`- Routes: ${parentState.routes.map((r: any) => r.name).join(', ')}`);
        currentNav = parent;
      } else {
        console.log('No more parent navigators');
        break;
      }
    } catch (e: any) {
      console.log('Error checking parent:', e?.message);
      break;
    }
  }

  console.log('============================================\n');
};

export const findActivityDetailScreen = (navigation: any): string | null => {
  // Check current navigator
  try {
    const state = navigation.getState();
    if (state.routeNames && state.routeNames.includes('ActivityDetail')) {
      return 'ActivityDetail';
    }
  } catch (e) {
    // Continue checking
  }

  // Check parent navigators
  let currentNav = navigation;
  while (currentNav) {
    try {
      const parent = currentNav.getParent();
      if (parent) {
        const parentState = parent.getState();
        if (parentState.routeNames && parentState.routeNames.includes('ActivityDetail')) {
          return 'ActivityDetail';
        }
        currentNav = parent;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }

  return null;
};