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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { Activity } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const FavoritesScreenNew = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [favorites, setFavorites] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      const favoritesService = FavoritesService.getInstance();
      const activityService = ActivityService.getInstance();
      
      const favoritesList = favoritesService.getFavorites();
      console.log('Favorites list:', favoritesList);
      
      const allActivities = await activityService.searchActivities({});
      console.log('All activities count:', allActivities.length);
      
      const favoriteActivities = allActivities.filter(activity =>
        favoritesList.some(fav => fav.activityId === activity.id)
      );
      
      console.log('Favorite activities found:', favoriteActivities.length);
      setFavorites(favoriteActivities);
    } catch (error) {
      console.error('Error loading favorites:', error);
      Alert.alert('Error', 'Failed to load favorites');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const navigateToActivity = (activity: Activity) => {
    const serializedActivity = {
      ...activity,
      dateRange: activity.dateRange ? {
        start: activity.dateRange.start instanceof Date ? activity.dateRange.start.toISOString() : activity.dateRange.start,
        end: activity.dateRange.end instanceof Date ? activity.dateRange.end.toISOString() : activity.dateRange.end,
      } : null,
      scrapedAt: activity.scrapedAt instanceof Date ? activity.scrapedAt.toISOString() : activity.scrapedAt,
    };
    navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
  };

  const removeFavorite = async (activity: Activity) => {
    Alert.alert(
      'Remove Favorite',
      `Remove ${activity.name} from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const favoritesService = FavoritesService.getInstance();
              favoritesService.toggleFavorite(activity);
              await loadFavorites();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove favorite');
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <LinearGradient
      colors={[colors.primary, colors.primary + 'DD']}
      style={styles.header}
    >
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>My Favorites</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} saved {favorites.length === 1 ? 'activity' : 'activities'}
        </Text>
      </View>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading favorites...</Text>
        </View>
      ) : favorites.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderFavoriteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: 'center',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateGradient: {
    width: width - 80,
    aspectRatio: 1,
    borderRadius: (width - 80) / 2,
    justifyContent: 'center',
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
    paddingHorizontal: 20,
  },
  exploreButton: {
    marginTop: 20,
  },
  exploreButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContent: {
    paddingVertical: 20,
  },
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
});

export default FavoritesScreenNew;