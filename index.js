/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Disable yellow box warnings in development
if (__DEV__) {
  LogBox.ignoreAllLogs();
  // Disable the inspector
  global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
}

AppRegistry.registerComponent(appName, () => App);