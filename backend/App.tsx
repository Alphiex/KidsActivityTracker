import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { MMKV } from 'react-native-mmkv';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/components/SplashScreen';
import NetworkStatus from './src/components/NetworkStatus';
import { store, persistor } from './src/store';
import { ThemeProvider } from './src/contexts/ThemeContext';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  // Note: Removed automatic clearing of MMKV storage to allow persistent authentication
  useEffect(() => {
    if (__DEV__) {
      console.log('Development mode: MMKV storage persists for authentication');
      // Only clear storage if explicitly needed for debugging
      // Uncomment the following lines to clear storage:
      // const secureStorage = new MMKV({
      //   id: 'secure-storage',
      //   encryptionKey: 'kids-activity-tracker-secure-key'
      // });
      // secureStorage.clearAll();
      // const defaultStorage = new MMKV();
      // defaultStorage.clearAll();
    }
  }, []);

  const handleSplashFinish = () => {
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <SplashScreen onFinish={handleSplashFinish} />
      </GestureHandlerRootView>
    );
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <RootNavigator />
            <NetworkStatus />
          </ThemeProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

export default App;