import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Share,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Activity } from '../types';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import { formatActivityPrice, cleanActivityName } from '../utils/formatters';
import { useAppSelector } from '../store';

const { width } = Dimensions.get('window');

const FeaturedPartnersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((state) => state.auth);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const ITEMS_PER_PAGE = 20;

  // Load favorites
  const loadFavorites = async () => {
    if (!user) return;
    try {
      const favoritesService = FavoritesService.getInstance();
      const favorites = await favoritesService.getFavorites();
      setFavoriteIds(new Set(favorites.map(f => f.activityId)));
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (activity: Activity) => {
    if (!user) return;
    try {
      const favoritesService = FavoritesService.getInstance();
      const isFavorite = favoriteIds.has(activity.id);

      if (isFavorite) {
        await favoritesService.removeFavorite(activity.id);
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(activity.id);
          return next;
        });
      } else {
        await favoritesService.addFavorite(activity);
        setFavoriteIds(prev => new Set(prev).add(activity.id));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const loadActivities = async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setCurrentOffset(0);
      } else {
        setLoadingMore(true);
      }

      const offset = isLoadMore ? currentOffset : 0;
      const activityService = ActivityService.getInstance();

      // Get sponsored activities with pagination
      // The API should return activities sorted by tier (gold, silver, bronze)
      const result = await activityService.getSponsoredActivitiesPaginated(
        ITEMS_PER_PAGE,
        offset
      );

      if (result) {
        const newActivities = result.activities || [];
        const total = result.total || 0;

        if (isLoadMore) {
          setActivities(prev => [...prev, ...newActivities]);
        } else {
          setActivities(newActivities);
        }

        setTotalCount(total);
        setCurrentOffset(offset + newActivities.length);
        setHasMore(offset + newActivities.length < total);
      }
    } catch (error) {
      console.error('Error loading featured partners:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
    loadFavorites();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [user])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadActivities(true);
    }
  };


  const renderActivityCard = ({ item: activity }: { item: Activity }) => {
    const activityTypeName = Array.isArray(activity.activityType)
      ? (typeof activity.activityType[0] === 'string' ? activity.activityType[0] : (activity.activityType[0] as any)?.name)
      : (activity.activityType as any)?.name || activity.category || 'general';
    const subcategory = activity.activitySubtype?.name || activity.subcategory;
    const imageKey = getActivityImageKey(activityTypeName, subcategory, activity.name);
    const imageSource = getActivityImageByKey(imageKey, activityTypeName);
    const isFavorite = favoriteIds.has(activity.id);
    const price = activity.cost || 0;

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

    const handleShare = async () => {
      try {
        const locationName = typeof activity.location === 'string'
          ? activity.location
          : activity.location?.name || activity.locationName || '';

        const message = `Check out this activity: ${activity.name}${locationName ? ` at ${locationName}` : ''}`;

        await Share.share({
          message,
          title: activity.name,
        });
      } catch (error) {
        console.error('Error sharing activity:', error);
      }
    };

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ActivityDetail', { activity })}
        activeOpacity={0.9}
      >
        <View style={styles.cardImageContainer}>
          <Image source={imageSource} style={styles.cardImage} />

          {/* Featured badge */}
          {activity.isFeatured && (
            <View style={styles.featuredBadge}>
              <Icon name="star" size={10} color="#FFF" />
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
          )}

          {/* Action buttons row - favorites, share, calendar */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                toggleFavorite(activity);
              }}
            >
              <Icon
                name={isFavorite ? "heart" : "heart-outline"}
                size={16}
                color={isFavorite ? "#FF385C" : "#FFF"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Icon name="share-variant" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="calendar-plus" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Price overlay */}
          <View style={styles.priceOverlay}>
            <Text style={styles.priceText}>{formatActivityPrice(price)}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{cleanActivityName(activity.name)}</Text>
          <View style={styles.cardLocationRow}>
            <Icon name="map-marker" size={12} color="#717171" />
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {typeof activity.location === 'string' ? activity.location : activity.location?.name || activity.locationName || 'Location TBD'}
            </Text>
          </View>
          <View style={styles.cardInfoRow}>
            <Icon name="account-child" size={12} color="#717171" />
            <Text style={styles.cardDetails}>{ageText}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['#FF385C', '#E91E63']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Icon name="star-circle" size={48} color="#FFF" />
        <Text style={styles.headerTitle}>Featured Partners</Text>
        <Text style={styles.headerSubtitle}>
          Discover sponsored activities from our trusted partners
        </Text>
      </LinearGradient>


      {totalCount > 0 && (
        <Text style={styles.resultCount}>{totalCount} featured {totalCount === 1 ? 'activity' : 'activities'}</Text>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#FF385C" />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Icon name="star-off-outline" size={64} color="#CCC" />
        <Text style={styles.emptyTitle}>No Featured Partners</Text>
        <Text style={styles.emptySubtitle}>
          There are no sponsored activities matching your current filters
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Featured Partners</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF385C" />
          <Text style={styles.loadingText}>Loading featured partners...</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityCard}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF385C"
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
    backgroundColor: '#F7F7F7',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#717171',
  },
  listContent: {
    paddingBottom: 24,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerGradient: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  resultCount: {
    fontSize: 14,
    color: '#717171',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    ...ModernShadows.sm,
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FF385C',
    gap: 4,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  actionButtonsRow: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 14,
    padding: 3,
  },
  actionButton: {
    padding: 5,
    marginHorizontal: 1,
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
    lineHeight: 18,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#717171',
    flex: 1,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDetails: {
    fontSize: 12,
    color: '#717171',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#717171',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default FeaturedPartnersScreen;
