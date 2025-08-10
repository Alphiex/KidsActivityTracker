import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface SimplifiedActivityCardProps {
  activity: {
    id: string;
    name: string;
    location: string;
    cost: number;
  };
}

const SimplifiedActivityCard: React.FC<SimplifiedActivityCardProps> = ({ activity }) => {
  const navigation = useNavigation();

  const handlePress = () => {
    console.log('SimplifiedActivityCard - Attempting navigation for:', activity.name);
    
    // Create minimal activity data
    const minimalActivity = {
      id: activity.id,
      name: activity.name,
      provider: 'NVRC',
      description: 'Test description',
      activityType: ['general'],
      ageRange: { min: 5, max: 12 },
      dateRange: null,
      schedule: 'TBD',
      location: activity.location || 'TBD',
      cost: activity.cost || 0,
      scrapedAt: new Date().toISOString(),
      registrationUrl: 'https://example.com',
    };

    try {
      console.log('Navigating with minimal data:', minimalActivity);
      navigation.navigate('ActivityDetail', { activity: minimalActivity });
    } catch (error) {
      console.error('SimplifiedActivityCard navigation error:', error);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <Text style={styles.name}>{activity.name}</Text>
      <Text style={styles.location}>{activity.location}</Text>
      <Text style={styles.cost}>${activity.cost}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    padding: 15,
    margin: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  cost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
});

export default SimplifiedActivityCard;