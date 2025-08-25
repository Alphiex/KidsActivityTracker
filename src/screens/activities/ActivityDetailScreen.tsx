import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ImageBackground,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useRoute } from '@react-navigation/native';
import { Activity } from '../../types';
import { useStore } from '../../store';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchActivityChildren } from '../../store/slices/childActivitiesSlice';
import ActivityService from '../../services/activityService';
import RegisterChildModal from '../../components/activities/RegisterChildModal';
import ChildActivityStatus from '../../components/activities/ChildActivityStatus';
import { formatPrice } from '../../utils/formatters';
import { getActivityImageByKey } from '../../assets/images';
import { getActivityImageKey } from '../../utils/activityHelpers';

const { width } = Dimensions.get('window');

const ActivityDetailScreen = () => {
  const route = useRoute();
  const dispatch = useAppDispatch();
  const { favoriteActivities, toggleFavorite } = useStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  
  // Parse the serialized dates back to Date objects
  const serializedActivity = route.params?.activity;
  const activity: Activity = {
    ...serializedActivity,
    dateRange: serializedActivity.dateRange ? {
      start: new Date(serializedActivity.dateRange.start),
      end: new Date(serializedActivity.dateRange.end),
    } : null,
    scrapedAt: new Date(serializedActivity.scrapedAt),
  };

  useEffect(() => {
    setIsFavorite(favoriteActivities.includes(activity.id) || activity.isFavorite);
    // Fetch children registered for this activity
    dispatch(fetchActivityChildren(activity.id));
  }, [activity.id, favoriteActivities, activity.isFavorite, dispatch]);

  const handleToggleFavorite = async () => {
    setLoading(true);
    try {
      const activityService = ActivityService.getInstance();
      if (isFavorite) {
        const success = await activityService.removeFavorite(activity.id);
        if (success) {
          setIsFavorite(false);
          toggleFavorite(activity.id);
        }
      } else {
        const success = await activityService.addFavorite(activity.id);
        if (success) {
          setIsFavorite(true);
          toggleFavorite(activity.id);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setLoading(false);
    }
  };

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
    try {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Date unavailable';
    }
  };

  // Debug logging
  console.log('Activity detail - category:', activity.category);
  console.log('Activity detail - subcategory:', activity.subcategory);
  console.log('Activity detail - activityType:', activity.activityType);
  
  const imageKey = getActivityImageKey(
    activity.category || (activity.activityType && activity.activityType[0]) || '', 
    activity.subcategory
  );
  console.log('Image key:', imageKey);
  
  const imageSource = getActivityImageByKey(imageKey);
  console.log('Image source:', imageSource);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ImageBackground 
        source={imageSource || require('../../assets/images/activities/sports_general.jpg')}
        style={styles.headerImage}
        resizeMode="cover"
        defaultSource={require('../../assets/images/activities/sports_general.jpg')}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>{activity.name}</Text>
            <TouchableOpacity
              onPress={handleToggleFavorite}
              style={styles.favoriteButton}
              disabled={loading}
            >
              <Icon
                name={isFavorite ? 'favorite' : 'favorite-border'}
                size={32}
                color={isFavorite ? '#FF6B6B' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.section}>
        <Text style={styles.description}>{activity.description}</Text>
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Icon name="location-on" size={20} color="#666" />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailText}>
              {typeof activity.location === 'string' 
                ? activity.location 
                : activity.location?.name || activity.locationName || 'Location TBD'}
            </Text>
            {typeof activity.location === 'object' && activity.location?.address && (
              <Text style={styles.detailSubtext}>{activity.location.address}</Text>
            )}
          </View>
        </View>

        {activity.dateRange && (
          <View style={styles.detailRow}>
            <Icon name="calendar-today" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Dates</Text>
              <Text style={styles.detailText}>
                {activity.dateRange.start && activity.dateRange.end
                  ? `${formatDate(activity.dateRange.start)} - ${formatDate(activity.dateRange.end)}`
                  : 'Dates TBD'}
              </Text>
            </View>
          </View>
        )}

        {activity.schedule && typeof activity.schedule === 'object' && activity.schedule.days ? (
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
        ) : activity.schedule && typeof activity.schedule === 'string' ? (
          <View style={styles.detailRow}>
            <Icon name="schedule" size={20} color="#666" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Schedule</Text>
              <Text style={styles.detailText}>{activity.schedule}</Text>
            </View>
          </View>
        ) : null}

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
            <Text style={styles.detailText}>${formatPrice(activity.cost)}</Text>
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
                : activity.totalSpots 
                  ? `${activity.spotsAvailable} of ${activity.totalSpots} spots available`
                  : `${activity.spotsAvailable} spots available`}
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

      {/* Child Registration Status */}
      <ChildActivityStatus 
        activityId={activity.id} 
        onPress={() => setShowRegisterModal(true)}
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.registerChildButton]}
          onPress={() => setShowRegisterModal(true)}
        >
          <Icon name="child-care" size={20} color="#fff" />
          <Text style={styles.registerChildButtonText}>Register Child</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.registerButton,
            activity.spotsAvailable === 0 && styles.registerButtonDisabled
          ]}
          onPress={handleRegister}
          disabled={activity.spotsAvailable === 0}
        >
          <Text style={styles.registerButtonText}>
            {activity.spotsAvailable === 0 ? 'Activity Full' : 'Register on NVRC'}
          </Text>
        </TouchableOpacity>
      </View>

      <RegisterChildModal
        visible={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        activityId={activity.id}
        activityName={activity.name}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerImage: {
    width: width,
    height: 250,
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  favoriteButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: -10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    borderRadius: 15,
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
    borderRadius: 15,
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
  buttonContainer: {
    padding: 20,
    gap: 12,
  },
  registerChildButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  registerChildButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ActivityDetailScreen;