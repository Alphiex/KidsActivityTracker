import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const [message, setMessage] = useState('Testing GestureHandler...');
  
  useEffect(() => {
    setTimeout(() => {
      setMessage('GestureHandler works!');
    }, 1000);
  }, []);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: 'blue', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 30 }}>{message}</Text>
      </View>
    </GestureHandlerRootView>
  );
}