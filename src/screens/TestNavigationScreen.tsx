import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import NavigationStructureTest from './NavigationStructureTest';
import { useNavigationDebug } from '../utils/NavigationLogger';
import { checkScreenRegistration, findActivityDetailScreen } from '../utils/checkScreenRegistration';

const TestNavigationScreen = () => {
  const navigation = useNavigation();
  const { logNavigationAttempt } = useNavigationDebug();

  const testNavigation = () => {
    console.log('Test navigation button pressed');
    console.log('Navigation object:', navigation);
    
    // Run diagnostic check
    checkScreenRegistration(navigation);
    
    // Try to find ActivityDetail screen
    const screenName = findActivityDetailScreen(navigation);
    console.log('Found ActivityDetail screen as:', screenName);
    
    // Create a dummy activity with minimal required fields
    const testActivity = {
      id: 'test-123',
      name: 'Test Swimming Activity',
      provider: 'NVRC',
      description: 'This is a test activity to check navigation',
      activityType: ['swimming'],
      ageRange: { min: 5, max: 12 },
      dateRange: null,
      schedule: 'Monday/Wednesday 4:00 PM - 5:00 PM',
      location: 'Test Recreation Center',
      cost: 150,
      spotsAvailable: 10,
      registrationUrl: 'https://example.com/register',
      scrapedAt: new Date(),
      
      // Enhanced fields
      fullDescription: 'This is a detailed description of the swimming activity. Learn basic swimming skills in a fun and safe environment.',
      directRegistrationUrl: 'https://www.nvrc.ca/register/12345',
      instructor: 'John Doe',
      registrationStatus: 'Open',
      registrationButtonText: 'Register Now',
      prerequisites: 'Must be comfortable in water',
      whatToBring: 'Swimsuit, towel, goggles',
      latitude: 49.2827,
      longitude: -123.1207,
    };
    
    const serializedActivity = {
      ...testActivity,
      scrapedAt: testActivity.scrapedAt.toISOString(),
    };
    
    console.log('Navigating with activity:', serializedActivity);
    
    // Log navigation attempt
    logNavigationAttempt('ActivityDetail', { activity: serializedActivity });
    
    try {
      navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
    } catch (error) {
      console.error('Navigation error:', error);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      
      // Try to understand the navigation structure
      try {
        const state = navigation.getState();
        console.error('Current navigation state:', JSON.stringify(state, null, 2));
      } catch (e) {
        console.error('Could not get navigation state:', e);
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <NavigationStructureTest />
      
      <View style={styles.separator} />
      
      <Text style={styles.title}>Activity Navigation Test</Text>
      <TouchableOpacity style={styles.button} onPress={testNavigation}>
        <Text style={styles.buttonText}>Test Activity Detail Navigation</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: 2,
    backgroundColor: '#ccc',
    width: '100%',
    marginVertical: 20,
  },
});

export default TestNavigationScreen;