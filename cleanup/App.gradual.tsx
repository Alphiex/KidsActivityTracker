import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

export default function App() {
  const [message, setMessage] = useState('Loading...');
  
  useEffect(() => {
    console.log('App mounted');
    setTimeout(() => {
      setMessage('App is working!');
    }, 1000);
  }, []);
  
  return (
    <View style={{ flex: 1, backgroundColor: 'green', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 30 }}>{message}</Text>
    </View>
  );
}