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
import PreferencesService from '../services/preferencesService';
import FavoritesService from '../services/favoritesService';

const DashboardScreenModern = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [recommendedActivities, setRecommendedActivities] = useState<Activity[]>([]);
  const [budgetFriendlyActivities, setBudgetFriendlyActivities] = useState<Activity[]>([]);
  const [newActivities, setNewActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [ageGroups, setAgeGroups] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const activityService = ActivityService.getInstance();
  const favoritesService = FavoritesService.getInstance();

  useEffect(() => {
    loadDashboardData();
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    try {
      const favorites = favoritesService.getFavorites();
      const ids = new Set(favorites.map(fav => fav.activityId));
      setFavoriteIds(ids);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (activity: Activity) => {
    try {
      const isCurrentlyFavorite = favoriteIds.has(activity.id);
      
      if (isCurrentlyFavorite) {
        await favoritesService.removeFavorite(activity.id);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(activity.id);
          return newSet;
        });
      } else {
        await favoritesService.addFavorite(activity);
        setFavoriteIds(prev => new Set([...prev, activity.id]));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Starting to load dashboard data...');
      
      // Load all data in parallel
      const results = await Promise.allSettled([
        loadRecommendedActivities(),
        loadBudgetFriendlyActivities(),
        loadNewActivities(),
        loadActivityTypes(),
        loadAgeGroups(),
      ]);
      
      // Log results of each promise
      results.forEach((result, index) => {
        const names = ['Recommended', 'Budget', 'New', 'ActivityTypes', 'AgeGroups'];
        if (result.status === 'rejected') {
          console.error(`Failed to load ${names[index]}:`, result.reason);
        } else {
          console.log(`Successfully loaded ${names[index]}`);
        }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendedActivities = async () => {
    try {
      // Use searchActivitiesPaginated to get activities (default order)
      const response = await activityService.searchActivitiesPaginated({ 
        limit: 6, 
        offset: 0,
        hideFullActivities: true  // Filter out activities with 0 spots
      });
      console.log('Recommended activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        firstItem: response?.items?.[0]?.name
      });
      if (response?.items && Array.isArray(response.items)) {
        setRecommendedActivities(response.items);
        console.log('Set recommended activities:', response.items.length);
      }
    } catch (error) {
      console.error('Error loading recommended activities:', error);
    }
  };

  const loadBudgetFriendlyActivities = async () => {
    try {
      // Get user's budget friendly amount from preferences
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      const maxBudgetAmount = preferences.maxBudgetFriendlyAmount || 20;
      
      // Use searchActivitiesPaginated with maxCost filter
      const response = await activityService.searchActivitiesPaginated({ 
        limit: 6, 
        offset: 0,
        maxCost: maxBudgetAmount,  // Use user's budget preference
        hideFullActivities: true   // Filter out activities with 0 spots
      });
      console.log('Budget friendly activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        maxBudget: maxBudgetAmount,
        firstItem: response?.items?.[0]?.name
      });
      if (response?.items && Array.isArray(response.items)) {
        setBudgetFriendlyActivities(response.items);
        console.log('Set budget friendly activities:', response.items.length);
      }
    } catch (error) {
      console.error('Error loading budget activities:', error);
    }
  };

  const loadNewActivities = async () => {
    try {
      // Use searchActivitiesPaginated with sortBy for newest activities
      const response = await activityService.searchActivitiesPaginated({ 
        limit: 6, 
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        hideFullActivities: true  // Filter out activities with 0 spots
      });
      console.log('New activities response:', {
        total: response?.total,
        itemsCount: response?.items?.length,
        firstItem: response?.items?.[0]?.name
      });
      if (response?.items && Array.isArray(response.items)) {
        setNewActivities(response.items);
        console.log('Set new activities:', response.items.length);
      }
    } catch (error) {
      console.error('Error loading new activities:', error);
    }
  };

  const loadActivityTypes = async () => {
    try {
      console.log('Loading activity types from database...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/activity-types`);
      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        let allTypes = result.data;
        console.log('Found', allTypes.length, 'activity types in database');
        
        // Get user preferences to show preferred types first
        const preferencesService = PreferencesService.getInstance();
        const preferences = preferencesService.getPreferences();
        const preferredTypes = preferences.preferredActivityTypes || [];
        
        console.log('User preferred activity types:', preferredTypes);
        
        let selectedTypes = [];
        
        // First, add user's preferred activity types
        if (preferredTypes.length > 0) {
          const preferred = allTypes.filter(type => 
            preferredTypes.some(pref => 
              pref.toLowerCase() === type.name.toLowerCase() || 
              pref.toLowerCase() === type.code.toLowerCase()
            )
          );
          selectedTypes = [...preferred];
          console.log('Added', preferred.length, 'preferred types');
        }
        
        // If we have less than 6, add more types by activity count (most popular first)
        if (selectedTypes.length < 6) {
          const remaining = allTypes
            .filter(type => !selectedTypes.some(selected => selected.id === type.id))
            .sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0));
          
          const needed = 6 - selectedTypes.length;
          selectedTypes = [...selectedTypes, ...remaining.slice(0, needed)];
          console.log('Added', Math.min(needed, remaining.length), 'additional types by popularity');
        }
        
        // Ensure we have exactly 6 types
        selectedTypes = selectedTypes.slice(0, 6);
        
        console.log('Final activity types:', selectedTypes.map(t => `${t.name} (${t.activityCount} activities)`));
        setActivityTypes(selectedTypes);
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
      // Fallback to default types
      setActivityTypes([
        { id: 1, name: 'Swimming & Aquatics', code: 'swimming-aquatics', activityCount: 0 },
        { id: 2, name: 'Team Sports', code: 'team-sports', activityCount: 0 },
        { id: 3, name: 'Visual Arts', code: 'visual-arts', activityCount: 0 },
        { id: 4, name: 'Dance', code: 'dance', activityCount: 0 },
        { id: 5, name: 'Music', code: 'music', activityCount: 0 },
        { id: 6, name: 'Martial Arts', code: 'martial-arts', activityCount: 0 },
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
    // Get image based on activityType or category
    const activityTypeName = activity.activityType?.name || activity.category || 'general';
    const subcategory = activity.activitySubtype?.name || activity.subcategory;
    const imageKey = getActivityImageKey(activityTypeName, subcategory);
    const imageSource = getActivityImageByKey(imageKey);
    const isFavorite = favoriteIds.has(activity.id);
    
    // Format schedule display - check for sessions array first (new format)
    let scheduleText = 'Schedule varies';
    if (activity.sessions && Array.isArray(activity.sessions) && activity.sessions.length > 0) {
      const firstSession = activity.sessions[0];
      scheduleText = firstSession.dayOfWeek || firstSession.date || 'Schedule available';
    } else if (activity.schedule && Array.isArray(activity.schedule) && activity.schedule.length > 0) {
      const firstSchedule = activity.schedule[0];
      scheduleText = firstSchedule.dayOfWeek || 'Schedule available';
    } else if (activity.dates) {
      scheduleText = activity.dates;
    }
    
    // Format age display
    let ageText = 'All ages';
    if (activity.ageRange) {
      if (activity.ageRange.min && activity.ageRange.max) {
        ageText = `Ages ${activity.ageRange.min}-${activity.ageRange.max}`;
      } else if (activity.ageRange.min) {
        ageText = `Ages ${activity.ageRange.min}+`;
      }
    } else if (activity.ageMin && activity.ageMax) {
      ageText = `Ages ${activity.ageMin}-${activity.ageMax}`;
    } else if (activity.ageMin) {
      ageText = `Ages ${activity.ageMin}+`;
    }
    
    // Get price - check both cost and price fields
    const price = activity.cost || activity.price;
    
    // Format spots remaining
    let spotsText = '';
    if (activity.spotsAvailable !== undefined && activity.spotsAvailable !== null) {
      if (activity.spotsAvailable === 0) {
        spotsText = 'Full';
      } else if (activity.spotsAvailable === 1) {
        spotsText = 'Only 1 spot left!';
      } else if (activity.spotsAvailable <= 5) {
        spotsText = `Only ${activity.spotsAvailable} spots left!`;
      } else {
        spotsText = `${activity.spotsAvailable} spots available`;
      }
    }
    
    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.card}
        onPress={() => handleNavigate('ActivityDetail', { activity })}
      >
        <View style={styles.cardImageContainer}>
          <Image source={imageSource} style={styles.cardImage} />
          
          {/* Heart icon for favorites */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(activity);
            }}
          >
            <Icon 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={20} 
              color={isFavorite ? "#FF385C" : "#FFF"} 
            />
          </TouchableOpacity>
          
          {/* Price overlay */}
          {price && price > 0 && (
            <View style={styles.priceOverlay}>
              <Text style={styles.priceText}>${formatPrice(price)}</Text>
              <Text style={styles.perChildText}>per child</Text>
            </View>
          )}
          
          {/* NEW badge if recently added */}
          {activity.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{activity.name}</Text>
          
          <View style={styles.cardLocationRow}>
            <Icon name="map-marker" size={12} color="#717171" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {typeof activity.location === 'string' ? activity.location : activity.location?.name || activity.locationName || 'Location TBD'}
            </Text>
          </View>
          
          <View style={styles.cardInfoRow}>
            <Icon name="calendar" size={12} color="#717171" />
            <Text style={styles.cardDetails}>{scheduleText}</Text>
          </View>
          
          <View style={styles.cardInfoRow}>
            <Icon name="clock" size={12} color="#717171" />
            <Text style={styles.cardDetails}>{activity.registrationStatus || 'In Progress'}</Text>
          </View>
          
          <View style={styles.cardInfoRow}>
            <Icon name="account-child" size={12} color="#717171" />
            <Text style={styles.cardDetails}>{ageText}</Text>
          </View>
          
          {/* Spots remaining */}
          {spotsText && (
            <View style={[styles.spotsContainer, activity.spotsAvailable <= 5 ? styles.spotsUrgent : styles.spotsNormal]}>
              <Icon 
                name={activity.spotsAvailable === 0 ? "close-circle" : "information"} 
                size={12} 
                color={activity.spotsAvailable <= 5 ? "#D93025" : "#717171"} 
              />
              <Text style={[styles.spotsText, activity.spotsAvailable <= 5 ? styles.spotsTextUrgent : styles.spotsTextNormal]}>
                {spotsText}
              </Text>
            </View>
          )}
        </View>
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
              // Use getActivityImageKey with type name to get proper image mapping
              const imageKey = getActivityImageKey(type.name, type.code);
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
            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#FF385C" />
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            ) : recommendedActivities.length > 0 ? (
              recommendedActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No activities found</Text>
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
            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#FF385C" />
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            ) : budgetFriendlyActivities.length > 0 ? (
              budgetFriendlyActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No budget friendly activities</Text>
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
            {loading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#FF385C" />
                <Text style={styles.emptyText}>Loading activities...</Text>
              </View>
            ) : newActivities.length > 0 ? (
              newActivities.map(renderActivityCard)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No new activities</Text>
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
    width: 280,
    marginLeft: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  perChildText: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    right: 55,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
    lineHeight: 20,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#717171',
    marginLeft: 4,
    flex: 1,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardDetails: {
    fontSize: 11,
    color: '#717171',
    marginLeft: 4,
    flex: 1,
  },
  spotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  spotsNormal: {
    backgroundColor: '#F0F9FF',
  },
  spotsUrgent: {
    backgroundColor: '#FEF2F2',
  },
  spotsText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  spotsTextNormal: {
    color: '#0369A1',
  },
  spotsTextUrgent: {
    color: '#D93025',
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