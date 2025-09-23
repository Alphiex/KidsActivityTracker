import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import { Activity } from '../types';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import { formatPrice } from '../utils/formatters';
import { API_CONFIG } from '../config/api';
import axios from 'axios';

const DashboardScreenModern = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [recommendedActivities, setRecommendedActivities] = useState<Activity[]>([]);
  const [budgetFriendlyActivities, setBudgetFriendlyActivities] = useState<Activity[]>([]);
  const [newActivities, setNewActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [ageGroups, setAgeGroups] = useState<any[]>([]);
  const activityService = ActivityService.getInstance();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRecommendedActivities(),
        loadBudgetFriendlyActivities(),
        loadNewActivities(),
        loadActivityTypes(),
        loadAgeGroups(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendedActivities = async () => {
    try {
      const response = await activityService.searchActivities({ limit: 6 });
      if (response?.activities && Array.isArray(response.activities)) {
        setRecommendedActivities(response.activities.slice(0, 6));
      }
    } catch (error) {
      console.error('Error loading recommended activities:', error);
    }
  };

  const loadBudgetFriendlyActivities = async () => {
    try {
      const response = await activityService.searchActivities({ 
        limit: 6, 
        maxPrice: 20 
      });
      if (response?.activities && Array.isArray(response.activities)) {
        setBudgetFriendlyActivities(response.activities.slice(0, 6));
      }
    } catch (error) {
      console.error('Error loading budget activities:', error);
    }
  };

  const loadNewActivities = async () => {
    try {
      const response = await activityService.searchActivities({ 
        limit: 6, 
        sortBy: 'newest' 
      });
      if (response?.activities && Array.isArray(response.activities)) {
        setNewActivities(response.activities.slice(0, 6));
      }
    } catch (error) {
      console.error('Error loading new activities:', error);
    }
  };

  const loadActivityTypes = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/activity-types`);
      if (response.data && Array.isArray(response.data)) {
        setActivityTypes(response.data.slice(0, 6));
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
      // Fallback to default types
      setActivityTypes([
        { id: 1, name: 'Swimming', icon: '🏊', code: 'swimming' },
        { id: 2, name: 'Sports', icon: '⚽', code: 'sports' },
        { id: 3, name: 'Arts', icon: '🎨', code: 'arts' },
        { id: 4, name: 'Dance', icon: '💃', code: 'dance' },
        { id: 5, name: 'Music', icon: '🎵', code: 'music' },
        { id: 6, name: 'Education', icon: '📚', code: 'education' },
      ]);
    }
  };

  const loadAgeGroups = async () => {
    setAgeGroups([
      { id: 1, name: '0-2 years', range: '0-2' },
      { id: 2, name: '3-5 years', range: '3-5' },
      { id: 3, name: '6-8 years', range: '6-8' },
      { id: 4, name: '9-12 years', range: '9-12' },
      { id: 5, name: '13+ years', range: '13+' },
      { id: 6, name: 'All Ages', range: 'all' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF385C" />
      </View>
    );
  }

  const handleNavigate = (screen: string, params?: any) => {
    try {
      navigation.navigate(screen as any, params);
    } catch (error) {
      console.log('Navigation error:', error);
    }
  };

  const renderActivityCard = (activity: Activity) => {
    const imageKey = getActivityImageKey(activity.category || 'general', activity.subcategory);
    const imageSource = getActivityImageByKey(imageKey);
    
    // Format schedule display
    let scheduleText = 'Schedule varies';
    if (activity.schedule && Array.isArray(activity.schedule) && activity.schedule.length > 0) {
      const firstSchedule = activity.schedule[0];
      scheduleText = firstSchedule.dayOfWeek || 'Schedule available';
    }
    
    // Format age display
    let ageText = 'All ages';
    if (activity.ageMin && activity.ageMax) {
      ageText = `Ages ${activity.ageMin}-${activity.ageMax}`;
    } else if (activity.ageMin) {
      ageText = `Ages ${activity.ageMin}+`;
    }
    
    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.card}
        onPress={() => handleNavigate('ActivityDetail', { activity })}
      >
        <View style={styles.cardImageContainer}>
          <Image source={imageSource} style={styles.cardImage} />
          {activity.price && (
            <View style={styles.priceOverlay}>
              <Text style={styles.priceText}>{formatPrice(activity.price)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{activity.name}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {activity.locationName || 'Location TBD'}
        </Text>
        <Text style={styles.cardDetails}>{scheduleText}</Text>
        <Text style={styles.cardDetails}>{ageText}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kids Activity Tracker</Text>
        </View>

        {/* Search Bar */}
        <TouchableOpacity 
          style={styles.searchBar}
          onPress={() => handleNavigate('Search')}
        >
          <Icon name="magnify" size={20} color="#717171" />
          <Text style={styles.searchText}>Start your search</Text>
        </TouchableOpacity>

        {/* Top Buttons */}
        <View style={styles.topButtons}>
          <TouchableOpacity 
            style={styles.topButton}
            onPress={() => handleNavigate('AllActivityTypes')}
          >
            <Icon name="shape" size={24} color="#FF385C" />
            <Text style={styles.topButtonText}>Activities</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.topButton}
            onPress={() => handleNavigate('LocationBrowse')}
          >
            <Icon name="map-marker" size={24} color="#717171" />
            <Text style={styles.topButtonText}>Location</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.topButton}
            onPress={() => handleNavigate('Calendar')}
          >
            <Icon name="calendar" size={24} color="#717171" />
            <Text style={styles.topButtonText}>Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Type Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Activity Type</Text>
            <TouchableOpacity onPress={() => handleNavigate('AllActivityTypes')}>
              <Icon name="chevron-right" size={24} color="#222" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {activityTypes.map((type) => {
              const imageKey = type.code || 'sports_general';
              const imageSource = getActivityImageByKey(imageKey);
              return (
                <TouchableOpacity
                  key={type.id}
                  style={styles.typeCard}
                  onPress={() => handleNavigate('ActivityTypeDetail', { activityType: type })}
                >
                  <Image source={imageSource} style={styles.typeImage} />
                  <Text style={styles.typeTitle}>{type.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Age Group Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Age Group</Text>
            <Icon name="chevron-right" size={24} color="#222" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ageGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.ageCard}
                onPress={() => handleNavigate('Search', { ageGroup: group.range })}
              >
                <View style={styles.ageIconContainer}>
                  <Icon name="account-child" size={32} color="#FF385C" />
                </View>
                <Text style={styles.ageTitle}>{group.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recommended Activities Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for You</Text>
            <TouchableOpacity onPress={() => handleNavigate('RecommendedActivities')}>
              <Icon name="chevron-right" size={24} color="#222" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recommendedActivities.length > 0 ? (
              recommendedActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Budget Friendly Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Friendly</Text>
            <Icon name="chevron-right" size={24} color="#222" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {budgetFriendlyActivities.length > 0 ? (
              budgetFriendlyActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* New This Week Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>New This Week</Text>
            <Icon name="chevron-right" size={24} color="#222" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {newActivities.length > 0 ? (
              newActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  searchText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#717171',
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  topButton: {
    alignItems: 'center',
    padding: 8,
  },
  topButtonText: {
    marginTop: 4,
    fontSize: 12,
    color: '#717171',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
  },
  card: {
    width: 160,
    marginLeft: 20,
  },
  cardImageContainer: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#717171',
    marginBottom: 2,
  },
  cardDetails: {
    fontSize: 11,
    color: '#717171',
    marginBottom: 1,
  },
  typeCard: {
    width: 120,
    marginLeft: 20,
    alignItems: 'center',
  },
  typeImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  typeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  ageCard: {
    width: 100,
    marginLeft: 20,
    alignItems: 'center',
  },
  ageIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ageTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  emptyCard: {
    width: 160,
    height: 160,
    marginLeft: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#717171',
  },
});

export default DashboardScreenModern;