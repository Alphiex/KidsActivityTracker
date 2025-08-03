import React, { useState, useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Starting timer...');
    const timer = setTimeout(() => {
      console.log('Timer finished, setting isLoading to false');
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  console.log('Rendering with isLoading:', isLoading);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'purple', justifyContent: 'center', alignItems: 'center' }}>
          <StatusBar barStyle="light-content" />
          <Text style={{ color: 'white', fontSize: 30 }}>Testing GestureHandler...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: 'green', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 30 }}>GestureHandler Works!</Text>
      </View>
    </GestureHandlerRootView>
  );
}

export default App;