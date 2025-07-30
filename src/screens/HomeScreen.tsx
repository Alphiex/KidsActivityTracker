import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useStore } from '../store';
import ActivityService from '../services/activityService';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { setLoading } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    newActivitiesCount: 0,
    totalActivities: 0,
    lastUpdated: null as Date | null,
  });
  const [categories, setCategories] = useState<Array<{ name: string; count: number; icon: string }>>([]);
  const [error, setError] = useState<string | null>(null);

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

  const loadHomeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const activityService = ActivityService.getInstance();
      
      // Fetch categories
      try {
        const categoriesData = await activityService.getCategories();
        const categoriesWithIcons = categoriesData.map(cat => ({
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
          { name: 'Education', count: 0 },
        ];
        const categoriesWithIcons = fallbackCategories.map(cat => ({
          ...cat,
          icon: categoryIcons[cat.name] || 'tag',
        }));
        setCategories(categoriesWithIcons);
      }

      // Fetch statistics
      try {
        const statsData = await activityService.getStatistics();
        
        // Calculate new activities (mocked for now - should come from API)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        setStats({
          newActivitiesCount: statsData.newActivitiesLastWeek || 15, // Mock value
          totalActivities: statsData.totalActivities || 0,
          lastUpdated: new Date(),
        });
      } catch (statsError) {
        console.error('Error fetching statistics:', statsError);
        // Use fallback stats if API fails
        setStats({
          newActivitiesCount: 0,
          totalActivities: 0,
          lastUpdated: new Date(),
        });
      }
    } catch (err: any) {
      console.error('Error loading home data:', err);
      // Don't show error if we have some data
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

      {/* New Activities Summary Card */}
      <TouchableOpacity onPress={navigateToNewActivities} activeOpacity={0.8}>
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryContent}>
            <View style={styles.summaryLeft}>
              <Icon name="new-box" size={40} color="#fff" />
              <View style={styles.summaryTextContainer}>
                <Text style={styles.summaryTitle}>New This Week</Text>
                <Text style={styles.summaryCount}>{stats.newActivitiesCount} activities</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={30} color="#fff" />
          </View>
          <Text style={styles.summarySubtext}>Tap to see all new activities</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Activity Categories Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by Category</Text>
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

      {/* Quick Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Icon name="counter" size={30} color={Colors.primary} />
          <Text style={styles.statNumber}>{stats.totalActivities}</Text>
          <Text style={styles.statLabel}>Total Activities</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="map-marker-radius" size={30} color={Colors.primary} />
          <Text style={styles.statNumber}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
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
  summaryCard: {
    margin: 20,
    padding: 20,
    borderRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryTextContainer: {
    marginLeft: 15,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryCount: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  summarySubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: 10,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
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
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 10,
  },
  statLabel: {
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