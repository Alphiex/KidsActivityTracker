import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import PreferencesService from '../services/preferencesService';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { Colors } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Alert, ActivityIndicator } from 'react-native';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const [preferences, setPreferences] = useState(preferencesService.getPreferences());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { colors, isDark } = useTheme();
  const { isConnected } = useNetworkStatus();
  const [recommendedCount, setRecommendedCount] = useState(0);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  const [stats, setStats] = useState({
    matchingActivities: 0,
    newThisWeek: 0,
    savedFavorites: 0,
    upcomingEvents: 0,
  });
  const [categories, setCategories] = useState<Array<{ name: string; count: number; icon: string }>>([]);
  const [activityTypes, setActivityTypes] = useState<Array<{ name: string; count: number; icon: string }>>([]);

  // Define category configurations
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
    'Team Sports': 'basketball',
    'Racquet Sports': 'tennis',
    'Aquatic Leadership': 'pool',
    'Camps': 'tent',
  };

  // Define activity type icons
  const activityTypeIcons = {
    // Water sports
    'Swimming': 'swim',
    'Swimming Lessons': 'swim',
    'Private Lessons Swimming': 'swim',
    'Swimming - Aquatic Leadership': 'whistle',
    
    // Sports
    'Tennis': 'tennis',
    'Basketball': 'basketball',
    'Soccer': 'soccer',
    'Baseball': 'baseball',
    'Football': 'football',
    'Hockey': 'hockey-sticks',
    'Golf': 'golf',
    'Sports': 'basketball',
    'Skating': 'skate',
    'Climbing': 'terrain',
    
    // Arts & Music
    'Dance': 'dance-ballroom',
    'Art': 'palette',
    'Visual Arts': 'palette',
    'Music': 'music-note',
    'Private Lessons Music': 'piano',
    'Drama': 'drama-masks',
    'Pottery': 'pot',
    
    // Fitness & Movement
    'Gymnastics': 'gymnastics',
    'Martial Arts': 'karate',
    'Yoga': 'yoga',
    'Fitness': 'dumbbell',
    'Spin': 'bike',
    
    // Education & Skills
    'Cooking': 'chef-hat',
    'STEM': 'flask',
    'Learn & Play': 'puzzle',
    'General Programs': 'star',
    'Certifications & Leadership': 'certificate',
    'School Programs': 'school',
    
    // Camps
    'Camp': 'tent',
    'Part Day Camp': 'clock-time-three',
    'Full Day Camp': 'clock-time-eight',
    'Single Day': 'calendar-today',
    'Outdoor Adventure': 'hiking',
    
    // Special Events
    'Community & Special Events': 'calendar-star',
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
      
      // Get activities based on preferences - use higher limit to get actual count
      const activities = await activityService.searchActivities({ ...filters, limit: 1000 });
      setRecommendedCount(activities.length);
    } catch (error) {
      console.error('Error loading recommended count:', error);
      setRecommendedCount(0);
    } finally {
      setLoadingRecommended(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setError(null);
      
      // Check network status first
      if (isConnected === false) {
        setError('No internet connection');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const activityService = ActivityService.getInstance();
      const favoritesService = FavoritesService.getInstance();
      
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
      }
      
      // Fetch activity types
      try {
        const activityTypesData = await activityService.getActivityTypes();
        console.log('Activity types from API:', activityTypesData.filter(t => t.name.toLowerCase().includes('swim')));
        const activityTypesWithIcons = activityTypesData
          .slice(0, 6) // Show only top 6 activity types
          .map(type => ({
            ...type,
            icon: activityTypeIcons[type.name] || 'tag',
          }));
        setActivityTypes(activityTypesWithIcons);
      } catch (typeError) {
        console.error('Error fetching activity types:', typeError);
      }
      
      // Load activities with pagination limit
      const searchParams: any = { limit: 200 };
      if (preferences.hideClosedActivities) {
        searchParams.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        searchParams.hideFullActivities = true;
      }
      
      const allActivities = await activityService.searchActivities(searchParams);
      
      // Get favorites count
      const favorites = await favoritesService.getFavorites();
      
      // Calculate stats based on preferences
      const matchingActivities = allActivities.filter(activity => 
        preferencesService.matchesPreferences(activity)
      ).length;

      // Get new activities count (last 7 days)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newThisWeek = allActivities.filter(activity => {
        try {
          const activityDate = new Date(activity.scrapedAt || activity.createdAt || 0);
          return activityDate >= oneWeekAgo;
        } catch (e) {
          return false;
        }
      }).length;

      setStats({
        matchingActivities,
        newThisWeek,
        savedFavorites: favorites.length,
        upcomingEvents: allActivities.filter(activity => {
          if (!activity.dateRange) return false;
          try {
            const startDate = new Date(activity.dateRange.start);
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);
            return startDate >= today && startDate <= nextWeek;
          } catch (e) {
            return false;
          }
        }).length,
      });
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError(error.message || 'Failed to load activities');
      // Set default stats on error
      setStats({
        matchingActivities: 0,
        newThisWeek: 0,
        savedFavorites: 0,
        upcomingEvents: 0,
      });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const navigateToRecommended = () => {
    navigation.navigate('RecommendedActivities');
  };

  const navigateToActivityType = (activityType: string) => {
    navigation.navigate('ActivityType', { 
      category: activityType,
      isActivityType: true 
    });
  };

  const navigateToAllActivityTypes = () => {
    navigation.navigate('AllActivityTypes');
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.greeting}>Discover Activities</Text>
          <Text style={styles.subtitle}>
            Find the perfect activities for your kids
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="cog" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderRecommended = () => (
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
  );

  const renderQuickActions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('LocationBrowse')}
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
          onPress={() => navigation.navigate('Favorites')}
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
  );

  const renderDiscoverActivities = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Discover Activities</Text>
      
      {/* New This Week Card */}
      <TouchableOpacity onPress={() => navigation.navigate('NewActivities')} activeOpacity={0.8}>
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
                <Text style={styles.discoverSubtext}>{stats.newThisWeek} new activities</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Budget Friendly Card */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('ActivityType', { 
          category: 'Budget Friendly',
          filters: { maxCost: preferences.maxBudgetFriendlyAmount || 20 }
        })} 
        activeOpacity={0.8} 
        style={styles.discoverCardWrapper}
      >
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
  );

  const renderActivityTypes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Activity Type</Text>
        <TouchableOpacity onPress={navigateToAllActivityTypes}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoriesGrid}>
        {activityTypes.map((type, index) => (
          <TouchableOpacity
            key={index}
            style={styles.categoryCard}
            onPress={() => navigateToActivityType(type.name)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.cardBackground, colors.background]}
              style={styles.categoryGradient}
            >
              <Icon name={type.icon} size={40} color={colors.primary} />
              <Text style={[styles.categoryName, { color: colors.text }]}>{type.name}</Text>
              <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                {type.count} activities
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Category</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AllCategories')}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoriesGrid}>
        {categories.map((category, index) => (
          <TouchableOpacity
            key={index}
            style={styles.categoryCard}
            onPress={() => navigation.navigate('ActivityType', { category: category.name })}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.cardBackground, colors.background]}
              style={styles.categoryGradient}
            >
              <Icon name={category.icon} size={40} color={colors.primary} />
              <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
              <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                {category.count} activities
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading activities...</Text>
      </View>
    );
  }

  if (error && !refreshing) {
    const isOffline = isConnected === false;
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <Icon 
          name={isOffline ? "wifi-off" : "alert-circle"} 
          size={60} 
          color={isOffline ? colors.textSecondary : colors.error} 
        />
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={loadDashboardData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {renderHeader()}
      {renderRecommended()}
      {renderQuickActions()}
      {renderDiscoverActivities()}
      {renderActivityTypes()}
      {renderCategories()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  settingsButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
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
    marginTop: 25,
    paddingHorizontal: 20,
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
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#667eea',
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
    justifyContent: 'center',
    height: 110,
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
    marginTop: 10,
  },
  categoryCount: {
    fontSize: 14,
    marginTop: 5,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DashboardScreen;