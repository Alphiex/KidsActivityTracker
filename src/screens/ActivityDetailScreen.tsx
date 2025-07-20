import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoute } from '@react-navigation/native';
import { Activity } from '../types';
import { useStore } from '../store';

const ActivityDetailScreen = () => {
  const route = useRoute();
  const { favoriteActivities, toggleFavorite } = useStore();
  
  // Parse the serialized dates back to Date objects
  const serializedActivity = route.params?.activity;
  const activity: Activity = {
    ...serializedActivity,
    dateRange: {
      start: new Date(serializedActivity.dateRange.start),
      end: new Date(serializedActivity.dateRange.end),
    },
    scrapedAt: new Date(serializedActivity.scrapedAt),
  };
  const isFavorite = favoriteActivities.includes(activity.id);

  const handleRegister = () => {
    Alert.alert(
      'Register for Activity',
      'This will open the NVRC website to complete registration. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => Linking.openURL(activity.registrationUrl),
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{activity.name}</Text>
        <TouchableOpacity
          onPress={() => toggleFavorite(activity.id)}
          style={styles.favoriteButton}
        >
          <Icon
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={28}
            color={isFavorite ? '#e74c3c' : '#666'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.description}>{activity.description}</Text>
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Icon name="location-on" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailText}>{activity.location.name}</Text>
            <Text style={styles.detailSubtext}>{activity.location.address}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="calendar-today" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Dates</Text>
            <Text style={styles.detailText}>
              {formatDate(activity.dateRange.start)} - {formatDate(activity.dateRange.end)}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="schedule" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Schedule</Text>
            <Text style={styles.detailText}>
              {activity.schedule.days.join(', ')}
            </Text>
            <Text style={styles.detailSubtext}>
              {activity.schedule.startTime} - {activity.schedule.endTime}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="child-care" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Age Range</Text>
            <Text style={styles.detailText}>
              {activity.ageRange.min} - {activity.ageRange.max} years
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="attach-money" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Cost</Text>
            <Text style={styles.detailText}>${activity.cost}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="event-seat" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Availability</Text>
            <Text style={[
              styles.detailText,
              activity.spotsAvailable === 0 && styles.fullText
            ]}>
              {activity.spotsAvailable === 0
                ? 'Activity Full'
                : `${activity.spotsAvailable} of ${activity.totalSpots} spots available`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.activitiesSection}>
        <Text style={styles.sectionTitle}>Activities Included</Text>
        <View style={styles.activityTags}>
          {activity.activityType.map((type) => (
            <View key={type} style={styles.activityTag}>
              <Text style={styles.activityTagText}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.registerButton,
          activity.spotsAvailable === 0 && styles.registerButtonDisabled
        ]}
        onPress={handleRegister}
        disabled={activity.spotsAvailable === 0}
      >
        <Text style={styles.registerButtonText}>
          {activity.spotsAvailable === 0 ? 'Activity Full' : 'Register Now'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  favoriteButton: {
    padding: 8,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  detailsSection: {
    backgroundColor: 'white',
    marginTop: 10,
    paddingVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailContent: {
    marginLeft: 15,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
  },
  detailSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  fullText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  activitiesSection: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  activityTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityTag: {
    backgroundColor: '#3F51B5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  activityTagText: {
    color: 'white',
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ActivityDetailScreen;