import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityCard from '../components/modern/ActivityCard';
import { Activity } from '../types';
import ActivityService from '../services/activityService';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import { placeholderImages } from '../assets/images/placeholder-images';
import FavoritesService from '../services/favoritesService';
import { useAppSelector } from '../store';

const { width, height } = Dimensions.get('window');

type RouteParams = {
  UnifiedResults: {
    type: 'budget' | 'new' | 'recommended' | 'activityType' | 'ageGroup';
    title?: string;
    subtitle?: string;
    activityType?: string;
    subtype?: string;
    ageMin?: number;
    ageMax?: number;
    ageGroupName?: string;
  };
};

const UnifiedResultsScreenTest: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'UnifiedResults'>>();

  const type = route?.params?.type || 'budget';
  const customTitle = route?.params?.title;
  const customSubtitle = route?.params?.subtitle;
  const activityType = route?.params?.activityType;
  const subtype = route?.params?.subtype;
  const ageMin = route?.params?.ageMin;
  const ageMax = route?.params?.ageMax;
  const ageGroupName = route?.params?.ageGroupName;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const { user } = useAppSelector((state) => state.auth);

  const getConfig = () => {
    if (type === 'activityType') {
      return {
        title: customTitle || subtype || activityType || 'Activities',
        subtitle: customSubtitle || `${activityType || 'All'} activities`,
        icon: 'shape',
        image: placeholderImages.recommended,
        description: `Explore ${subtype || activityType || 'all'} activities in your area`,
      };
    }

    if (type === 'ageGroup') {
      return {
        title: customTitle || ageGroupName || 'Age Group',
        subtitle: customSubtitle || 'Perfect for this age range',
        icon: 'human-child',
        image: placeholderImages.budget,
        description: `Activities suitable for ${ageGroupName || 'this age group'}`,
      };
    }

    const configMap = {
      budget: {
        title: 'Budget Friendly',
        subtitle: 'Amazing activities under $20',
        icon: 'tag',
        image: placeholderImages.budget,
        description: 'Discover affordable fun for the whole family',
      },
      new: {
        title: 'New This Week',
        subtitle: 'Fresh activities just added',
        icon: 'new-box',
        image: placeholderImages.new,
        description: 'Be the first to try these exciting new activities',
      },
      recommended: {
        title: 'Recommended for You',
        subtitle: 'Personalized based on your preferences',
        icon: 'star',
        image: placeholderImages.recommended,
        description: 'Hand-picked activities we think you\'ll love',
      },
    };

    return configMap[type] || configMap.budget;
  };

  const config = getConfig();

  const loadActivities = async () => {
    try {
      setLoading(true);

      const baseParams: any = {
        limit: 20,
        offset: 0,
        hideFullActivities: true,
      };

      if (type === 'budget') {
        baseParams.maxCost = 20;
      } else if (type === 'new') {
        baseParams.sortBy = 'createdAt';
        baseParams.sortOrder = 'desc';
      } else if (type === 'activityType') {
        if (activityType) {
          baseParams.activityType = activityType;
        }
        if (subtype) {
          baseParams.subtype = subtype;
        }
      } else if (type === 'ageGroup') {
        if (ageMin !== undefined) {
          baseParams.ageMin = ageMin;
        }
        if (ageMax !== undefined) {
          baseParams.ageMax = ageMax;
        }
      }

      const activityService = ActivityService.getInstance();
      const response = await activityService.searchActivitiesPaginated(baseParams);

      if (response && response.items) {
        setActivities(response.items);
        setTotalCount(response.total || 0);
      } else {
        setActivities([]);
        setTotalCount(0);
      }
    } catch (error) {
      setActivities([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
    loadFavorites();
  }, [type]);

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

  const toggleFavorite = async (activity: Activity) => {
    if (!user) return;
    try {
      const favoritesService = FavoritesService.getInstance();
      const isFavorite = favoriteIds.has(activity.id);

      if (isFavorite) {
        await favoritesService.removeFavorite(activity.id);
        setFavoriteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(activity.id);
          return newSet;
        });
      } else {
        await favoritesService.addFavorite(activity.id);
        setFavoriteIds(prev => new Set(prev).add(activity.id));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadActivities();
    } finally {
      setRefreshing(false);
    }
  };

  const renderActivity = ({ item }: { item: Activity }) => {
    if (!item || !item.id) return null;
    const isFavorite = favoriteIds.has(item.id);
    return (
      <ActivityCard
        activity={item}
        onPress={() => navigation.navigate('ActivityDetail', { activity: item })}
        variant="default"
        isFavorite={isFavorite}
        onFavoritePress={() => toggleFavorite(item)}
      />
    );
  };

  const renderHeader = () => {
    if (!config) return null;

    return (
      <View style={styles.headerContainer}>
        <View style={styles.heroSection}>
          {config.image && <Image source={config.image} style={styles.heroImage} />}
          <View style={styles.heroOverlay} />
          <TouchableOpacity style={styles.backButtonHero} onPress={() => navigation.goBack()}>
            <View style={styles.backButtonInner}>
              <Icon name="arrow-left" size={20} color={ModernColors.text} />
            </View>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <View style={styles.iconBadge}>
              <Icon name={config.icon || 'tag'} size={24} color="white" />
            </View>
            <Text style={styles.heroTitle}>{String(config.title || '')}</Text>
            <Text style={styles.heroSubtitle}>{String(config.subtitle || '')}</Text>
          </View>
        </View>
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{String(totalCount)}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{String(activities.length)}</Text>
            <Text style={styles.statLabel}>Loaded</Text>
          </View>
        </View>
        <View style={styles.descriptionSection}>
          <Text style={styles.description}>{String(config.description || '')}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Finding activities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ModernColors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="magnify-off" size={80} color={ModernColors.border} />
            <Text style={styles.emptyTitle}>No activities found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  headerContainer: {
    marginBottom: ModernSpacing.lg,
  },
  heroSection: {
    height: height * 0.25,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backButtonHero: {
    position: 'absolute',
    top: ModernSpacing.xl,
    left: ModernSpacing.lg,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...ModernShadows.md,
  },
  heroContent: {
    position: 'absolute',
    bottom: ModernSpacing.lg,
    left: ModernSpacing.lg,
    right: ModernSpacing.lg,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ModernSpacing.sm,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: ModernTypography.sizes.base,
    color: 'rgba(255,255,255,0.9)',
  },
  statsSection: {
    flexDirection: 'row',
    backgroundColor: ModernColors.surface,
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: ModernTypography.sizes.xl,
    fontWeight: 'bold',
    color: ModernColors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: ModernColors.border,
    marginHorizontal: ModernSpacing.md,
  },
  descriptionSection: {
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.md,
    backgroundColor: ModernColors.surface,
  },
  description: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: ModernSpacing.md,
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
  },
  emptyContainer: {
    padding: ModernSpacing.xxl * 2,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: ModernSpacing.lg,
  },
});

export default UnifiedResultsScreenTest;