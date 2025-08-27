import React, { useState, useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from './src/components/SplashScreen';
import { useStore } from './src/store';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const { hydrate } = useStore();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        hydrate();
      } catch (error) {
        console.warn('Error during hydration:', error);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [hydrate]);
  
  const handleSplashFinish = () => {
    console.log('Splash screen finished');
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
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: 'teal', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 30 }}>Everything works!</Text>
          <Text style={{ color: 'white', fontSize: 20 }}>Issue is with Navigation/Theme</Text>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}