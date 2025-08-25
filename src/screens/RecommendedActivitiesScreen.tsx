import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import LoadingIndicator from '../components/LoadingIndicator';
import { ActivityCard } from '../components/ActivityCard';
import { Colors } from '../theme';
import { Activity } from '../types';

const RecommendedActivitiesScreen = () => {
  const navigation = useNavigation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const preferencesService = PreferencesService.getInstance();
  const preferences = preferencesService.getPreferences();

  const loadRecommendedActivities = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      
      // Create filters based on user preferences
      const filters: any = { limit: 1000 };
      
      // Apply user preference filters
      if (preferences.hideClosedActivities) {
        filters.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        filters.hideFullActivities = true;
      }
      
      // Apply other preference filters
      if (preferences.preferredCategories && preferences.preferredCategories.length > 0) {
        filters.categories = preferences.preferredCategories.join(',');
      }
      if (preferences.locations && preferences.locations.length > 0) {
        filters.locations = preferences.locations;
      }
      if (preferences.priceRange) {
        filters.maxCost = preferences.priceRange.max;
      }
      
      // Apply age range if set
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        // Use the first age range
        const ageRange = preferences.ageRanges[0];
        filters.ageRange = {
          min: ageRange.min,
          max: ageRange.max
        };
      }
      
      const fetchedActivities = await activityService.searchActivities(filters);
      setActivities(fetchedActivities);
    } catch (err: any) {
      console.error('Error loading recommended activities:', err);
      setError(err.message || 'Failed to load recommended activities. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Recommended for You',
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadRecommendedActivities();
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRecommendedActivities();
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <ActivityCard 
      activity={item}
      onPress={() => {
        // Convert Date objects to ISO strings to avoid non-serializable warning
        const serializedActivity = {
          ...item,
          dateRange: item.dateRange ? {
            start: item.dateRange.start.toISOString(),
            end: item.dateRange.end.toISOString(),
          } : null,
          scrapedAt: item.scrapedAt ? item.scrapedAt.toISOString() : null,
        };
        navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
      }}
    />
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#9C27B0', '#7B1FA2']}
      style={styles.header}
    >
      <Icon name="star" size={50} color="#fff" />
      <Text style={styles.headerTitle}>Recommended Activities</Text>
      <Text style={styles.headerSubtitle}>
        Based on your preferences
      </Text>
      <View style={styles.preferencesInfo}>
        {preferences.preferredCategories && preferences.preferredCategories.length > 0 && (
          <View style={styles.preferenceChip}>
            <Icon name="tag" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              {preferences.preferredCategories.length} categories
            </Text>
          </View>
        )}
        {preferences.locations && preferences.locations.length > 0 && (
          <View style={styles.preferenceChip}>
            <Icon name="location-on" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              {preferences.locations.length} locations
            </Text>
          </View>
        )}
        {preferences.priceRange && (
          <View style={styles.preferenceChip}>
            <Icon name="attach-money" size={16} color="#fff" />
            <Text style={styles.preferenceText}>
              Max ${preferences.priceRange.max}
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding activities for you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRecommendedActivities}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="search-off" size={60} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No activities match your preferences</Text>
        <Text style={styles.emptySubtext}>Try adjusting your preferences in settings</Text>
        <TouchableOpacity 
          style={styles.settingsButton} 
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsButtonText}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Text style={styles.footerText}>
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'} found
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  header: {
    padding: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
  },
  preferencesInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  preferenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  preferenceText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 18,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 20,
    marginBottom: 30,
  },
});

export default RecommendedActivitiesScreen;