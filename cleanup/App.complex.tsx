import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import SplashScreen from './src/components/SplashScreen';
import { useStore } from './src/store';
import { ThemeProvider } from './src/contexts/ThemeContext';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const { hydrate } = useStore();

  useEffect(() => {
    // Load persisted data on app start with delay to avoid initialization issues
    const timer = setTimeout(() => {
      try {
        hydrate();
      } catch (error) {
        console.warn('Error during hydration:', error);
      }
    }, 500); // Increased delay for New Architecture
    
    return () => clearTimeout(timer);
  }, [hydrate]);

  const handleSplashFinish = () => {
    console.log('Splash screen finished, transitioning to main app');
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SplashScreen onFinish={handleSplashFinish} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <RootNavigator />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default App;
