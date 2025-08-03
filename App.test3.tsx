import React, { useState } from 'react';
import { View, Text } from 'react-native';
import SplashScreen from './src/components/SplashScreenSimple';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  
  const handleFinish = () => {
    setShowSplash(false);
  };
  
  if (showSplash) {
    return <SplashScreen onFinish={handleFinish} />;
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: 'orange', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 30 }}>Splash finished!</Text>
    </View>
  );
}