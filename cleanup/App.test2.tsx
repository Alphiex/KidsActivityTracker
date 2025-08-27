import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useStore } from './src/store';

export default function App() {
  const [message, setMessage] = useState('Testing Store...');
  const { hydrate } = useStore();
  
  useEffect(() => {
    try {
      hydrate();
      setMessage('Store works!');
    } catch (error) {
      setMessage('Store error: ' + error.message);
    }
  }, [hydrate]);
  
  return (
    <View style={{ flex: 1, backgroundColor: 'purple', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 30 }}>{message}</Text>
    </View>
  );
}