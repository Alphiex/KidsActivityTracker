import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';

const NavigationStructureTest = () => {
  const navigation = useNavigation();
  const state = useNavigationState(state => state);
  
  // Get all available screens in current navigator
  const getAvailableScreens = () => {
    try {
      const parent = navigation.getParent();
      console.log('Has parent navigator:', !!parent);
      
      // Log the full navigation structure
      console.log('\n====== NAVIGATION STRUCTURE ======');
      console.log('Current state:', JSON.stringify(state, null, 2));
      
      // Check if we can access route names
      if (state && 'routeNames' in state) {
        console.log('Route names in current navigator:', state.routeNames);
      }
      
      // Try to get parent state
      if (parent) {
        try {
          const parentState = parent.getState();
          console.log('Parent state:', JSON.stringify(parentState, null, 2));
        } catch (e) {
          console.log('Could not get parent state:', e.message);
        }
      }
      
      console.log('================================\n');
      
      return state?.routeNames || [];
    } catch (error) {
      console.error('Error getting navigation structure:', error);
      return [];
    }
  };

  const availableScreens = getAvailableScreens();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Navigation Structure</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Navigator Info:</Text>
        <Text style={styles.info}>Type: {state?.type || 'unknown'}</Text>
        <Text style={styles.info}>Current Route: {state?.routes[state.index]?.name || 'unknown'}</Text>
        <Text style={styles.info}>Route Count: {state?.routes.length || 0}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Screens in Current Navigator:</Text>
        {availableScreens.map((screen, index) => (
          <Text key={index} style={styles.screenName}>• {screen}</Text>
        ))}
        {availableScreens.length === 0 && (
          <Text style={styles.info}>No screens found or unable to access</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Route Stack:</Text>
        {state?.routes.map((route, index) => (
          <View key={index} style={styles.route}>
            <Text style={styles.routeName}>
              {index === state.index ? '→ ' : '  '}{route.name}
            </Text>
            {route.params && (
              <Text style={styles.routeParams}>
                Params: {JSON.stringify(route.params).substring(0, 50)}...
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigation Hierarchy:</Text>
        <Text style={styles.info}>
          {state?.type === 'stack' && 'Stack Navigator'}
          {state?.type === 'tab' && 'Tab Navigator'}
          {state?.type === 'drawer' && 'Drawer Navigator'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  screenName: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 3,
  },
  route: {
    marginBottom: 10,
    paddingLeft: 10,
  },
  routeName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  routeParams: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default NavigationStructureTest;