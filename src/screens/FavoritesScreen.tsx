import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import PreferencesService from '../services/preferencesService';
import { Activity } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const FavoritesScreen = () => {
  const navigation = useNavigation();
  const favoritesService = FavoritesService.getInstance();
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();
  const { colors, isDark } = useTheme();
  
  const [favorites, setFavorites] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [capacityAlerts, setCapacityAlerts] = useState<any[]>([]);
  const [showCapacityFilter, setShowCapacityFilter] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
      checkCapacityAlerts();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      
      // Get locally stored favorite IDs
      const favoritesList = favoritesService.getFavorites();
      console.log('Loading favorites from local storage, found:', favoritesList.length);
      
      if (favoritesList.length === 0) {
        setFavorites([]);
        setIsLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Fetch the actual activity details for each favorite
      const favoriteActivities: Activity[] = [];
      
      for (const fav of favoritesList) {
        try {
          // Fetch activity details by ID
          console.log('Fetching activity details for favorite:', fav.activityId);
          const activity = await activityService.getActivityDetails(fav.activityId);
          if (activity) {
            console.log('Successfully fetched activity:', activity.name);
            favoriteActivities.push(activity);
            // Check capacity for each favorite
            favoritesService.checkCapacityChange(activity);
          } else {
            console.warn(`Activity ${fav.activityId} not found in backend`);
          }
        } catch (error) {
          console.error(`Error loading favorite activity ${fav.activityId}:`, error);
          // Continue loading other favorites even if one fails
        }
      }
      
      setFavorites(favoriteActivities);
      console.log('Loaded favorite activities:', favoriteActivities.length);
    } catch (error) {
      console.error('Error loading favorites:', error);
      // Don't show alert for expected errors like no auth
      if (error?.response?.status !== 401) {
        Alert.alert('Error', 'Failed to load favorites');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const checkCapacityAlerts = () => {
    const alerts = favoritesService.getUnnotifiedAlerts();
    setCapacityAlerts(alerts);
    
    // Show alert for critical capacity
    alerts.forEach(alert => {
      const activity = favorites.find(fav => fav.id === alert.activityId);
      if (activity && alert.capacity === 1) {
        Alert.alert(
          '⚠️ Last Spot Available!',
          `${activity.name} has only 1 spot remaining!`,
          [
            { text: 'View Details', onPress: () => navigateToActivity(activity) },
            { text: 'OK' }
          ]
        );
      }
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const navigateToActivity = (activity: Activity) => {
    const serializedActivity = {
      ...activity,
      dateRange: activity.dateRange ? {
        start: activity.dateRange.start.toISOString(),
        end: activity.dateRange.end.toISOString(),
      } : null,
      scrapedAt: activity.scrapedAt ? activity.scrapedAt.toISOString() : null,
    };
    navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
  };

  const removeFavorite = (activity: Activity) => {
    Alert.alert(
      'Remove Favorite',
      `Remove ${activity.name} from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            favoritesService.toggleFavorite(activity);
            loadFavorites();
          }
        }
      ]
    );
  };

  const getCapacityColor = (spotsLeft?: number) => {
    if (!spotsLeft) return '#4CAF50';
    if (spotsLeft <= 1) return '#FF5252';
    if (spotsLeft <= 3) return '#FF9800';
    return '#4CAF50';
  };

  const renderHeader = () => (
    <LinearGradient
      colors={['#FF6B6B', '#FF8787']}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.headerTitle}>My Favorites</Text>
          <Text style={styles.headerSubtitle}>
            {favorites.length} saved {favorites.length === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowCapacityFilter(!showCapacityFilter)}
        >
          <Icon 
            name="filter-variant" 
            size={24} 
            color="#fff" 
          />
          {capacityAlerts.length > 0 && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{capacityAlerts.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {capacityAlerts.length > 0 && (
        <View style={styles.alertsContainer}>
          <Icon name="alert-circle" size={20} color="#FFF3CD" />
          <Text style={styles.alertsText}>
            {capacityAlerts.length} {capacityAlerts.length === 1 ? 'activity is' : 'activities are'} almost full!
          </Text>
        </View>
      )}
    </LinearGradient>
  );

  const renderFavoriteCard = ({ item }: { item: Activity }) => (
    <View style={styles.cardWrapper}>
      <ActivityCard 
        activity={item}
        onPress={() => navigateToActivity(item)}
        isFavorite={true}
        onToggleFavorite={() => removeFavorite(item)}
      />
    </View>
  );

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      Sports: 'basketball',
      Arts: 'palette',
      Music: 'music-note',
      Science: 'flask',
      Dance: 'dance-ballroom',
      Education: 'school',
      Swimming: 'swim',
      Outdoor: 'tree',
    };
    return icons[category] || 'tag';
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={['#FF6B6B', '#FF8787']}
        style={styles.emptyStateGradient}
      >
        <Icon name="heart-outline" size={80} color="#fff" />
        <Text style={styles.emptyStateTitle}>No Favorites Yet</Text>
        <Text style={styles.emptyStateText}>
          Start exploring activities and tap the heart icon to save your favorites here
        </Text>
      </LinearGradient>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Search' as never)}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.exploreButtonGradient}
        >
          <Icon name="magnify" size={20} color="#fff" />
          <Text style={styles.exploreButtonText}>Explore Activities</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const filteredFavorites = showCapacityFilter
    ? favorites.filter(fav => fav.spotsLeft !== undefined && fav.spotsLeft <= 3)
    : favorites;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading favorites...</Text>
        </View>
      ) : filteredFavorites.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredFavorites}
          renderItem={renderFavoriteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filterButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  alertBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFC107',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alertsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 20,
    marginTop: 15,
  },
  alertsText: {
    color: '#FFF3CD',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  capacityBadge: {
    position: 'absolute',
    top: -10,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
  },
  capacityBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  categoryText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  favoriteButton: {
    padding: 5,
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  provider: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  detailsRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceLabel: {
    fontSize: 12,
    color: '#999',
    marginRight: 5,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  capacityIndicator: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginLeft: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    borderRadius: 3,
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
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateGradient: {
    padding: 40,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  exploreButton: {
    width: '100%',
  },
  exploreButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default FavoritesScreen;