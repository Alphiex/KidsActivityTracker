import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import { Activity } from '../types';
import { safeToISOString } from '../utils/safeAccessors';

const RecommendationsScreen = () => {
  const navigation = useNavigation<any>();
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();
  
  const [recommendations, setRecommendations] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setIsLoading(true);
      
      // Get user preferences
      const preferences = preferencesService.getPreferences();
      
      // Build filters from preferences for API-level filtering
      const filters: any = { limit: 20 };
      
      if (preferences.preferredCategories && preferences.preferredCategories.length > 0) {
        filters.activityTypes = preferences.preferredCategories;
      }
      if (preferences.ageRanges && preferences.ageRanges.length > 0) {
        // Use the first age range for simplicity
        const ageRange = preferences.ageRanges[0];
        filters.ageRange = ageRange;
      }
      if (preferences.locations && preferences.locations.length > 0) {
        filters.locations = preferences.locations;
      }
      if (preferences.priceRange) {
        filters.maxCost = preferences.priceRange.max;
      }
      if (preferences.hideClosedActivities) {
        filters.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        filters.hideFullActivities = true;
      }
      
      // Get activities matching preferences from API
      const recommended = await activityService.searchActivities(filters);
      
      setRecommendations(recommended);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecommendations();
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <View style={styles.activityWrapper}>
      <ActivityCard 
        activity={item}
        onPress={() => {
          const serializedActivity = {
            ...item,
            dateRange: item.dateRange ? {
              start: safeToISOString(item.dateRange.start),
              end: safeToISOString(item.dateRange.end),
            } : null,
            scrapedAt: safeToISOString(item.scrapedAt),
          };
          navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
        }}
      />
    </View>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#14B8A6', '#0D9488']}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recommended for You</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.headerSubtitle}>
        Activities based on your preferences
      </Text>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="lightbulb-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Recommendations Yet</Text>
      <Text style={styles.emptyText}>
        Update your preferences to get personalized recommendations
      </Text>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <LinearGradient
          colors={['#14B8A6', '#0D9488']}
          style={styles.settingsButtonGradient}
        >
          <Icon name="cog" size={20} color="#fff" />
          <Text style={styles.settingsButtonText}>Update Preferences</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding activities for you...</Text>
        </View>
      ) : recommendations.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={recommendations}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  activityWrapper: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  settingsButton: {
    marginTop: 20,
  },
  settingsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default RecommendationsScreen;