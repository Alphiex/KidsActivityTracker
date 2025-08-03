import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

function App() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Debug Info</Text>
        <Text style={styles.text}>✅ App.tsx is loading</Text>
        <Text style={styles.text}>✅ React is working</Text>
        <Text style={styles.text}>📱 Platform: iOS</Text>
        <Text style={styles.text}>🔧 React Native 0.80</Text>
        
        <Text style={styles.subtitle}>If you see this, the app is working!</Text>
        
        <View style={styles.box}>
          <Text style={styles.boxText}>Next Steps:</Text>
          <Text style={styles.step}>1. The splash screen works</Text>
          <Text style={styles.step}>2. Basic rendering works</Text>
          <Text style={styles.step}>3. Issue is with navigation/store</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingTop: 60,
  },
  scroll: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 20,
    color: '#666',
  },
  text: {
    fontSize: 16,
    marginBottom: 10,
    color: '#444',
  },
  box: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  boxText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  step: {
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 5,
    color: '#555',
  },
});

export default App;