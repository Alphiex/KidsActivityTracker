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
import { Colors } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const [preferences, setPreferences] = useState(preferencesService.getPreferences());
  const [refreshing, setRefreshing] = useState(false);
  const { colors, isDark } = useTheme();
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
      title: 'Weekend Activities',
      icon: 'calendar-weekend',
      gradient: ['#f093fb', '#f5576c'],
      onPress: () => navigation.navigate('ActivityType', { 
        category: 'All',
        filters: { daysOfWeek: ['Saturday', 'Sunday'] }
      }),
    },
    {
      title: 'Budget Friendly',
      icon: 'cash-multiple',
      gradient: ['#4facfe', '#00f2fe'],
      onPress: () => navigation.navigate('ActivityType', { 
        category: 'All',
        filters: { priceRange: { min: 0, max: 100 } }
      }),
    },
    {
      title: 'New This Week',
      icon: 'new-box',
      gradient: ['#43e97b', '#38f9d7'],
      onPress: () => navigation.navigate('NewActivities'),
    },
  ];

  const loadDashboardData = async () => {
    try {
      const activityService = ActivityService.getInstance();
      const allActivities = await activityService.searchActivities({});
      
      // Calculate stats based on preferences
      const matchingActivities = allActivities.filter(activity => 
        preferencesService.matchesPreferences(activity)
      ).length;

      // Get new activities count
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const newThisWeek = allActivities.filter(activity => {
        const activityDate = new Date(activity.scrapedAt || activity.createdAt || 0);
        return activityDate >= oneWeekAgo;
      }).length;

      setStats({
        matchingActivities,
        newThisWeek,
        savedFavorites: 0, // TODO: Get from favorites service
        upcomingEvents: allActivities.filter(activity => {
          if (!activity.dateRange) return false;
          const startDate = new Date(activity.dateRange.start);
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          return startDate >= today && startDate <= nextWeek;
        }).length,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set default stats on error
      setStats({
        matchingActivities: 0,
        newThisWeek: 0,
        savedFavorites: 0,
        upcomingEvents: 0,
      });
    } finally {
      setRefreshing(false);
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

  const renderQuickFilters = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Filters</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        {preferences.ageRanges.map((range, index) => (
          <TouchableOpacity 
            key={index}
            style={[styles.filterChip, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('ActivityType', { 
              category: 'All',
              filters: { ageRange: range }
            })}
          >
            <Icon name="human-child" size={16} color={colors.primary} />
            <Text style={[styles.filterChipText, { color: colors.text }]}>
              Ages {range.min}-{range.max}
            </Text>
          </TouchableOpacity>
        ))}
        {preferences.locations.slice(0, 3).map((location, index) => (
          <TouchableOpacity 
            key={`loc-${index}`}
            style={[styles.filterChip, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate('ActivityType', { 
              category: 'All',
              filters: { location }
            })}
          >
            <Icon name="map-marker" size={16} color={colors.primary} />
            <Text style={[styles.filterChipText, { color: colors.text }]}>{location}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
      {renderQuickFilters()}
      {renderQuickActions()}
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
});

export default DashboardScreen;