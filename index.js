/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/services/pushNotificationService';

// Disable yellow box warnings in development
if (__DEV__) {
  LogBox.ignoreAllLogs();
  // Disable the inspector
  global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
}

// Register background message handler for push notifications
// Must be called outside of any component
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);