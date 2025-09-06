import { NavigationProp } from '@react-navigation/native';

export const debugNavigation = (navigation: NavigationProp<any>, screenName: string, params?: any) => {
  console.log(`\n========== NAVIGATION DEBUG ==========`);
  console.log(`From Screen: ${screenName}`);
  console.log(`Target: ActivityDetail`);
  console.log(`Params:`, params ? Object.keys(params) : 'none');
  
  try {
    const state = navigation.getState();
    console.log(`Current Stack: ${state?.routes?.map(r => r.name).join(' -> ')}`);
    console.log(`Current Index: ${state?.index}`);
    console.log(`Type: ${state?.type}`);
  } catch (e) {
    console.log('Could not get navigation state:', e);
  }
  
  console.log(`Can Go Back: ${navigation.canGoBack()}`);
  console.log(`======================================\n`);
};