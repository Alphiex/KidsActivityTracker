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
  const [stats, setStats] = useState({
    matchingActivities: 0,
    newThisWeek: 0,
    savedFavorites: 0,
    upcomingEvents: 0,
  });

  const categoryColors = {
    'Team Sports': ['#FF6B6B', '#FF8787'],
    'Martial Arts': ['#4ECDC4', '#44A08D'],
    'Racquet Sports': ['#A8E6CF', '#7FD1B3'],
    'Aquatic Leadership': ['#FFD93D', '#FFB73D'],
    'Swimming': ['#00C9FF', '#0099CC'],
    'Camps': ['#C06EFF', '#9B59FF'],
    'All': ['#4B9BFF', '#2E7FFF'],
    'Other': ['#95E1D3', '#6FC9B8'],
  };

  const quickActionCards = [
    {
      title: 'Browse by Location',
      icon: 'map-marker-radius',
      gradient: ['#667eea', '#764ba2'],
      onPress: () => navigation.navigate('LocationBrowse'),
    },
    {
      title: 'Favorites',
      icon: 'heart',
      gradient: ['#f093fb', '#f5576c'],
      onPress: () => {
        try {
          navigation.navigate('Favorites' as never);
        } catch (error) {
          console.error('Navigation error:', error);
        }
      },
    },
  ];

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
      
      // Load activities with pagination limit
      const allActivities = await activityService.searchActivities({ limit: 100 });
      
      // Get favorites count
      const favorites = await favoritesService.getFavorites();
      
      // Calculate stats based on preferences
      const matchingActivities = allActivities.filter(activity => 
        preferencesService.matchesPreferences(activity)
      ).length;

      // Get new activities count
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

  const renderHeader = () => (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.subtitle}>
            {stats.matchingActivities} activities match your interests
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="cog" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Icon name="star" size={20} color="#FFD700" />
          <Text style={styles.statNumber}>{stats.savedFavorites}</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="new-box" size={20} color="#4CAF50" />
          <Text style={styles.statNumber}>{stats.newThisWeek}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="calendar-check" size={20} color="#FF9800" />
          <Text style={styles.statNumber}>{stats.upcomingEvents}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>
    </LinearGradient>
  );


  const renderQuickActions = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        {quickActionCards.map((card, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickActionCard}
            onPress={card.onPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={card.gradient}
              style={styles.quickActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name={card.icon} size={32} color="#fff" />
              <Text style={styles.quickActionText}>{card.title}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse Categories</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AllCategories')}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {Object.entries(categoryColors).map(([category, colors]) => (
          <TouchableOpacity
            key={category}
            style={styles.categoryCard}
            onPress={() => {
              if (category === 'All') {
                navigation.navigate('Search');
              } else {
                navigation.navigate('ActivityType', { category });
              }
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors}
              style={styles.categoryGradient}
            >
              <Icon 
                name={getCategoryIcon(category)} 
                size={40} 
                color="#fff" 
              />
              <Text style={styles.categoryName}>{category}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const getCategoryIcon = (category: string) => {
    const icons = {
      'Team Sports': 'basketball',
      'Martial Arts': 'karate',
      'Racquet Sports': 'tennis',
      'Aquatic Leadership': 'pool',
      'Swimming': 'swim',
      'Camps': 'tent',
      'All': 'star',
      'Other': 'tag',
    };
    return icons[category] || 'tag';
  };

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
      {renderQuickActions()}
      
      {/* Dashboard Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Discover Activities</Text>
        <View style={styles.dashboardActionsGrid}>

          {/* New This Week */}
          <TouchableOpacity
            style={styles.dashboardActionCard}
            onPress={() => navigation.navigate('NewActivities')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#43e97b', '#38f9d7']}
              style={styles.dashboardActionGradient}
            >
              <Icon name="new-box" size={32} color="#fff" />
              <Text style={styles.dashboardActionTitle}>New This Week</Text>
              <Text style={styles.dashboardActionCount}>{stats.newThisWeek} activities</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Budget Friendly */}
          <TouchableOpacity
            style={styles.dashboardActionCard}
            onPress={() => navigation.navigate('ActivityType', { 
              category: 'All',
              filters: { maxCost: preferences.budgetFriendlyThreshold || 20 }
            })}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4facfe', '#00f2fe']}
              style={styles.dashboardActionGradient}
            >
              <Icon name="cash-multiple" size={32} color="#fff" />
              <Text style={styles.dashboardActionTitle}>Budget Friendly</Text>
              <Text style={styles.dashboardActionCount}>Under ${preferences.budgetFriendlyThreshold || 20}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
      
      {renderCategories()}
      
      {/* Personalized Recommendations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended for You</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Recommendations')}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.recommendationCard}
          onPress={() => navigation.navigate('Recommendations')}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8787']}
            style={styles.recommendationGradient}
          >
            <Icon name="lightbulb-on" size={40} color="#fff" />
            <Text style={styles.recommendationText}>
              View personalized recommendations based on your preferences
            </Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    marginBottom: 20,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
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
  filterScroll: {
    marginTop: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterChipText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - 50) / 2,
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  quickActionGradient: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  dashboardActionsGrid: {
    marginTop: 10,
  },
  dashboardActionCard: {
    marginBottom: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  dashboardActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dashboardActionTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 15,
  },
  dashboardActionCount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryScroll: {
    marginTop: 10,
  },
  categoryCard: {
    marginRight: 15,
    width: 100,
    height: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  categoryGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  recommendationCard: {
    marginTop: 10,
    marginBottom: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  recommendationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  recommendationText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 15,
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