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
import { useRoute, useNavigation } from '@react-navigation/native';
import { Camp } from '../types';
import { useStore } from '../store';

const CampDetailScreen = () => {
  const route = useRoute();
  const { favoriteCamps, toggleFavorite } = useStore();
  
  // Parse the serialized dates back to Date objects
  const serializedCamp = route.params?.camp;
  const camp: Camp = {
    ...serializedCamp,
    dateRange: {
      start: new Date(serializedCamp.dateRange.start),
      end: new Date(serializedCamp.dateRange.end),
    },
    scrapedAt: new Date(serializedCamp.scrapedAt),
  };
  const isFavorite = favoriteCamps.includes(camp.id);

  const handleRegister = () => {
    Alert.alert(
      'Register for Camp',
      'This will open the NVRC website to complete registration. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => Linking.openURL(camp.registrationUrl),
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
        <Text style={styles.title}>{camp.name}</Text>
        <TouchableOpacity
          onPress={() => toggleFavorite(camp.id)}
          style={styles.favoriteButton}
        >
          <Icon
            name={isFavorite ? 'favorite' : 'favorite-border'}
            size={28}
            color={isFavorite ? '#FF3B30' : '#666'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{camp.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        
        <View style={styles.detailRow}>
          <Icon name="location-on" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailText}>{camp.location.name}</Text>
            <Text style={styles.detailSubtext}>{camp.location.address}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="calendar-today" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Dates</Text>
            <Text style={styles.detailText}>
              {formatDate(camp.dateRange.start)} - {formatDate(camp.dateRange.end)}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="schedule" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Schedule</Text>
            <Text style={styles.detailText}>
              {camp.schedule.days.join(', ')}
            </Text>
            <Text style={styles.detailSubtext}>
              {camp.schedule.startTime} - {camp.schedule.endTime}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="child-care" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Age Range</Text>
            <Text style={styles.detailText}>
              {camp.ageRange.min} - {camp.ageRange.max} years
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="attach-money" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Cost</Text>
            <Text style={styles.detailText}>${camp.cost}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Icon name="group" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Availability</Text>
            <Text style={[
              styles.detailText,
              camp.spotsAvailable === 0 && styles.fullText
            ]}>
              {camp.spotsAvailable === 0
                ? 'FULL'
                : `${camp.spotsAvailable} of ${camp.totalSpots} spots available`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activities</Text>
        <View style={styles.tagsContainer}>
          {camp.activityType.map((type) => (
            <View key={type} style={styles.tag}>
              <Text style={styles.tagText}>
                {type.replace(/_/g, ' ').toLowerCase()}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.registerButton,
          camp.spotsAvailable === 0 && styles.registerButtonDisabled
        ]}
        onPress={handleRegister}
        disabled={camp.spotsAvailable === 0}
      >
        <Text style={styles.registerButtonText}>
          {camp.spotsAvailable === 0 ? 'Camp Full' : 'Register Now'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  favoriteButton: {
    padding: 4,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  detailSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  fullText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  registerButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
});

export default CampDetailScreen;