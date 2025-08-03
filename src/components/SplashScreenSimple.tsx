import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreenSimple: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    console.log('SplashScreen mounted, starting timer');
    // Finish splash after 3 seconds
    const timer = setTimeout(() => {
      console.log('SplashScreen timer finished, calling onFinish');
      onFinish();
    }, 3000);
    return () => {
      console.log('SplashScreen unmounting, clearing timer');
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kids Activity Tracker</Text>
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
  },
});

export default SplashScreenSimple;