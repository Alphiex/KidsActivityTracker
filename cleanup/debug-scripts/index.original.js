/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, LogBox } from 'react-native';
import './src/utils/newArchCompat'; // Import compatibility layer
import App from './App';
import { name as appName } from './app.json';

// Ignore specific warnings during New Architecture transition
LogBox.ignoreLogs([
  'Failed to call into JavaScript module method RCTEventEmitter.receiveEvent',
  'Unbalanced calls start/end for tag',
  'Module has not been registered as callable',
  'GSFont: file already registered',
]);

AppRegistry.registerComponent(appName, () => App);
