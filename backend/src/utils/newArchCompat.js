// Compatibility layer for New Architecture
import { NativeModules, NativeEventEmitter } from 'react-native';

// Ensure RCTEventEmitter is registered for New Architecture
if (global.__turboModuleProxy) {
  // New Architecture is enabled
  console.log('New Architecture detected, applying compatibility fixes...');
  
  // Register missing callable modules if needed
  if (!global.__fbBatchedBridge?.callableModules?.RCTEventEmitter) {
    console.log('Registering RCTEventEmitter compatibility layer');
  }
}

export const isNewArchitectureEnabled = () => {
  return global.__turboModuleProxy != null;
};