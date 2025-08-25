import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useStore } from '../store';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { setLoading } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedCount, setRecommendedCount] = useState(0);
  const [stats, setStats] = useState({
    newActivitiesCount: 0,
    totalActivities: 0,
    lastUpdated: null as Date | null,
  });
  const [categories, setCategories] = useState<Array<{ name: string; count: number; icon: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  
  const preferencesService = PreferencesService.getInstance();
  const preferences = preferencesService.getPreferences();

  // Define category icons
  const categoryIcons = {
    'Sports': 'basketball',
    'Arts': 'palette',
    'Music': 'music-note',
    'Science': 'flask',
    'Dance': 'dance-ballroom',
    'Education': 'school',
    'Outdoor': 'tree',
    'Indoor': 'home',
    'Swimming': 'swim',
    'Martial Arts': 'karate',
    'Drama': 'drama-masks',
    'Technology': 'laptop',
  };

  const loadRecommendedCount = async () => {
    try {
      setLoadingRecommended(true);
      const activityService = ActivityService.getInstance();
      
      // Create filters based on user preferences
      const filters: any = {};
      
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
      
      // Get activities based on preferences
      const activities = await activityService.searchActivities(filters);
      setRecommendedCount(activities.length);
    } catch (error) {
      console.error('Error loading recommended count:', error);
      setRecommendedCount(0);
    } finally {
      setLoadingRecommended(false);
    }
  };

  const loadHomeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const activityService = ActivityService.getInstance();
      
      // Load recommended count
      loadRecommendedCount();
      
      // Fetch categories
      try {
        const categoriesData = await activityService.getCategories();
        const categoriesWithIcons = categoriesData
          .slice(0, 5) // Show only top 5 categories
          .map(cat => ({
            ...cat,
            icon: categoryIcons[cat.name] || 'tag',
          }));
        setCategories(categoriesWithIcons);
      } catch (catError) {
        console.error('Error fetching categories:', catError);
        // Use fallback categories if API fails
        const fallbackCategories = [
          { name: 'Sports', count: 0 },
          { name: 'Arts', count: 0 },
          { name: 'Music', count: 0 },
          { name: 'Science', count: 0 },
          { name: 'Dance', count: 0 },
        ];
        const categoriesWithIcons = fallbackCategories.map(cat => ({
          ...cat,
          icon: categoryIcons[cat.name] || 'tag',
        }));
        setCategories(categoriesWithIcons);
      }

      // Fetch statistics for new activities count
      try {
        // Get activities from last 7 days
        const searchParams: any = { limit: 200 };
        if (preferences.hideClosedActivities) {
          searchParams.hideClosedActivities = true;
        }
        if (preferences.hideFullActivities) {
          searchParams.hideFullActivities = true;
        }
        
        const allActivities = await activityService.searchActivities(searchParams);
        
        // Filter activities added in the last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const newActivities = allActivities.filter(activity => {
          const activityDate = activity.scrapedAt || activity.createdAt;
          if (activityDate) {
            return new Date(activityDate) >= oneWeekAgo;
          }
          return false;
        });
        
        const statsData = await activityService.getStatistics();
        setStats({
          newActivitiesCount: newActivities.length,
          totalActivities: statsData.totalActive || 0,
          lastUpdated: new Date(),
        });
      } catch (statsError) {
        console.error('Error fetching statistics:', statsError);
        setStats({
          newActivitiesCount: 0,
          totalActivities: 0,
          lastUpdated: new Date(),
        });
      }
    } catch (err: any) {
      console.error('Error loading home data:', err);
      if (categories.length === 0) {
        setError(err.message || 'Failed to load data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadHomeData();
  };

  const navigateToActivityType = (category: string) => {
    navigation.navigate('ActivityType', { category });
  };

  const navigateToNewActivities = () => {
    navigation.navigate('NewActivities');
  };

  const navigateToBudgetFriendly = () => {
    navigation.navigate('ActivityType', { 
      category: 'Budget Friendly',
      filters: { maxCost: preferences.maxBudgetFriendlyAmount || 20 }
    });
  };

  const navigateToLocationBrowse = () => {
    navigation.navigate('LocationBrowse');
  };

  const navigateToFavorites = () => {
    navigation.navigate('Favorites');
  };

  const navigateToAllCategories = () => {
    navigation.navigate('AllCategories');
  };

  const navigateToRecommended = () => {
    // Navigate to search with user preferences applied
    navigation.navigate('Search', { applyPreferences: true });
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadHomeData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Section */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.header}
      >
        <Text style={styles.welcomeText}>Discover Activities</Text>
        <Text style={styles.subText}>Find the perfect activities for your kids</Text>
      </LinearGradient>

      {/* Recommended for You Section */}
      <TouchableOpacity onPress={navigateToRecommended} activeOpacity={0.8}>
        <LinearGradient
          colors={['#9C27B0', '#7B1FA2']}
          style={styles.recommendedCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.recommendedContent}>
            <View style={styles.recommendedLeft}>
              <Icon name="star" size={40} color="#fff" />
              <View style={styles.recommendedTextContainer}>
                <Text style={styles.recommendedTitle}>Recommended for You</Text>
                <Text style={styles.recommendedCount}>
                  {loadingRecommended ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    `${recommendedCount} activities match your preferences`
                  )}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={30} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick Actions Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={navigateToLocationBrowse}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#2196F3', '#1976D2']}
              style={styles.quickActionGradient}
            >
              <Icon name="map-marker" size={30} color="#fff" />
              <Text style={styles.quickActionText}>Browse by Location</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={navigateToFavorites}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#FF5722', '#E64A19']}
              style={styles.quickActionGradient}
            >
              <Icon name="heart" size={30} color="#fff" />
              <Text style={styles.quickActionText}>Favourites</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Discover Activities Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discover Activities</Text>
        
        {/* New This Week Card */}
        <TouchableOpacity onPress={navigateToNewActivities} activeOpacity={0.8}>
          <LinearGradient
            colors={['#4CAF50', '#45a049']}
            style={styles.discoverCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.discoverContent}>
              <View style={styles.discoverLeft}>
                <Icon name="new-box" size={35} color="#fff" />
                <View style={styles.discoverTextContainer}>
                  <Text style={styles.discoverTitle}>New This Week</Text>
                  <Text style={styles.discoverSubtext}>{stats.newActivitiesCount} new activities</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Budget Friendly Card */}
        <TouchableOpacity onPress={navigateToBudgetFriendly} activeOpacity={0.8} style={styles.discoverCardWrapper}>
          <LinearGradient
            colors={['#FFC107', '#F57C00']}
            style={styles.discoverCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.discoverContent}>
              <View style={styles.discoverLeft}>
                <Icon name="cash" size={35} color="#fff" />
                <View style={styles.discoverTextContainer}>
                  <Text style={styles.discoverTitle}>Budget Friendly</Text>
                  <Text style={styles.discoverSubtext}>Under ${preferences.maxBudgetFriendlyAmount || 20}</Text>
                </View>
              </View>
              <Icon name="chevron-right" size={24} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Browse by Category Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <TouchableOpacity onPress={navigateToAllCategories}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.categoriesGrid}>
          {categories.map((category, index) => (
            <TouchableOpacity
              key={index}
              style={styles.categoryCard}
              onPress={() => navigateToActivityType(category.name)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[Colors.cardBackground, Colors.background]}
                style={styles.categoryGradient}
              >
                <Icon name={category.icon} size={40} color={Colors.primary} />
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.count} activities</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Last Updated */}
      {stats.lastUpdated && (
        <Text style={styles.lastUpdated}>
          Last updated: {stats.lastUpdated.toLocaleString()}
        </Text>
      )}
    </ScrollView>
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
    paddingTop: 50,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  recommendedCard: {
    margin: 20,
    marginBottom: 10,
    padding: 20,
    borderRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recommendedContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recommendedTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  recommendedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  recommendedCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    padding: 20,
    paddingTop: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  seeAllText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickActionCard: {
    width: '48%',
  },
  quickActionGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  discoverCardWrapper: {
    marginTop: 12,
  },
  discoverCard: {
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  discoverContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discoverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  discoverTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  discoverTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  discoverSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    marginBottom: 15,
  },
  categoryGradient: {
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 10,
  },
  categoryCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
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
  lastUpdated: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
});

export default HomeScreen;