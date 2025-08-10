import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const NavigationTestScreen = () => {
  const navigation = useNavigation();

  const testNavigations = () => {
    console.log('\n====== NAVIGATION TEST ======');
    
    // Test 1: Can we navigate to Settings?
    try {
      console.log('Test 1: Navigating to Settings...');
      navigation.navigate('Settings' as never);
      console.log('✅ Settings navigation successful');
    } catch (e) {
      console.log('❌ Settings navigation failed:', e.message);
    }

    // Test 2: Can we go back?
    try {
      console.log('\nTest 2: Testing goBack...');
      if (navigation.canGoBack()) {
        navigation.goBack();
        console.log('✅ GoBack successful');
      } else {
        console.log('⚠️  Cannot go back from here');
      }
    } catch (e) {
      console.log('❌ GoBack failed:', e.message);
    }

    // Test 3: What routes are available?
    try {
      console.log('\nTest 3: Getting navigation state...');
      const state = navigation.getState();
      console.log('Current routes:', state.routes.map(r => r.name));
      console.log('Route names in current navigator:', state.routeNames);
    } catch (e) {
      console.log('❌ Could not get state:', e.message);
    }

    console.log('============================\n');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation Debug Screen</Text>
      
      <TouchableOpacity style={styles.button} onPress={testNavigations}>
        <Text style={styles.buttonText}>Run Navigation Tests</Text>
      </TouchableOpacity>

      <View style={styles.separator} />

      <Text style={styles.subtitle}>Direct Navigation Tests:</Text>
      
      <Button 
        title="Navigate to Settings"
        onPress={() => {
          try {
            navigation.navigate('Settings' as never);
          } catch (e) {
            console.error('Settings nav error:', e);
          }
        }}
      />

      <View style={{ height: 10 }} />

      <Button 
        title="Navigate to Dashboard"
        onPress={() => {
          try {
            navigation.navigate('Dashboard' as never);
          } catch (e) {
            console.error('Dashboard nav error:', e);
          }
        }}
      />

      <View style={{ height: 10 }} />

      <Button 
        title="Go Back"
        onPress={() => {
          try {
            navigation.goBack();
          } catch (e) {
            console.error('GoBack error:', e);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    marginTop: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 20,
  },
});

export default NavigationTestScreen;