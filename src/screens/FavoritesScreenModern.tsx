import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenBackground from '../components/ScreenBackground';
import TopTabNavigation from '../components/TopTabNavigation';
import ActivityCard from '../components/ActivityCard';
import EmptyState from '../components/EmptyState';
import UpgradePromptModal from '../components/UpgradePromptModal';
import FavoritesService from '../services/favoritesService';
import WaitlistService, { CachedWaitlistEntry } from '../services/waitlistService';
import ActivityService from '../services/activityService';
import { Activity } from '../types';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import { formatActivityPrice } from '../utils/formatters';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import useFavoriteSubscription from '../hooks/useFavoriteSubscription';

const { width, height } = Dimensions.get('window');

const FavoritesHeaderImage = require('../assets/images/favorites-header.png');

type TabType = 'favorites' | 'watching' | 'available';

const FavoritesScreenModern: React.FC = () => {
  const navigation = useNavigation<any>();
  const favoritesService = FavoritesService.getInstance();
  const waitlistService = WaitlistService.getInstance();
  const activityService = ActivityService.getInstance();

  const [activeTab, setActiveTab] = useState<TabType>('favorites');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Favorites data
  const [favoriteActivities, setFavoriteActivities] = useState<Activity[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Waitlist/Watching data
  const [watchingEntries, setWatchingEntries] = useState<CachedWaitlistEntry[]>([]);
  const [availableEntries, setAvailableEntries] = useState<CachedWaitlistEntry[]>([]);

  // Subscription hooks
  const {
    canAddToWaitlist,
    onWaitlistLimitReached,
    showUpgradeModal: showWaitlistUpgradeModal,
    hideUpgradeModal: hideWaitlistUpgradeModal,
    syncWaitlistCount,
  } = useWaitlistSubscription();

  const {
    canAddFavorite,
    onFavoriteLimitReached,
    showUpgradeModal: showFavoritesUpgradeModal,
    hideUpgradeModal: hideFavoritesUpgradeModal,
  } = useFavoriteSubscription();

  const loadData = async (forceRefresh: boolean = false) => {
    try {
      // Load favorites
      const favorites = favoritesService.getFavorites();
      const ids = new Set(favorites.map(fav => fav.activityId));
      setFavoriteIds(ids);

      // Load favorite activities details
      if (favorites.length > 0) {
        const activities: Activity[] = [];
        for (const fav of favorites) {
          try {
            const activity = await activityService.getActivityDetails(fav.activityId);
            if (activity) {
              activities.push(activity);
            }
          } catch (err) {
            console.error('Error loading favorite activity:', fav.activityId, err);
          }
        }
        setFavoriteActivities(activities);
      } else {
        setFavoriteActivities([]);
      }

      // Load waitlist entries
      const waitlistEntries = await waitlistService.getWaitlist(forceRefresh);
      const watching = waitlistEntries.filter(e => !e.hasAvailability);
      const available = waitlistEntries.filter(e => e.hasAvailability);
      setWatchingEntries(watching);
      setAvailableEntries(available);
    } catch (error) {
      console.error('[FavoritesScreen] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const toggleFavorite = async (activity: Activity) => {
    const isCurrentlyFavorite = favoriteIds.has(activity.id);

    if (!isCurrentlyFavorite && !canAddFavorite) {
      onFavoriteLimitReached();
      return;
    }

    if (isCurrentlyFavorite) {
      favoritesService.removeFavorite(activity.id);
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(activity.id);
        return newSet;
      });
      setFavoriteActivities(prev => prev.filter(a => a.id !== activity.id));
    } else {
      favoritesService.addFavorite(activity);
      setFavoriteIds(prev => new Set([...prev, activity.id]));
      setFavoriteActivities(prev => [...prev, activity]);
    }
  };

  const handleRemoveFromWaitlist = async (activityId: string) => {
    Alert.alert(
      'Stop Watching',
      'Are you sure you want to stop watching this activity for availability?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await waitlistService.leaveWaitlist(activityId);
            if (result.success) {
              setWatchingEntries(prev => prev.filter(e => e.activityId !== activityId));
              setAvailableEntries(prev => prev.filter(e => e.activityId !== activityId));
              syncWaitlistCount();
            } else {
              Alert.alert('Error', result.message || 'Failed to remove from watch list');
            }
          },
        },
      ]
    );
  };

  const handleActivityPress = (activity: Activity) => {
    navigation.navigate('ActivityDetail', { activity });
  };

  const handleWaitlistActivityPress = async (entry: CachedWaitlistEntry) => {
    try {
      const activity = await activityService.getActivityDetails(entry.activityId);
      if (activity) {
        navigation.navigate('ActivityDetail', { activity });
      } else {
        Alert.alert('Error', 'Activity not found');
      }
    } catch (error) {
      console.error('[FavoritesScreen] Error loading activity:', error);
      Alert.alert('Error', 'Failed to load activity details');
    }
  };

  const handleRegister = (entry: CachedWaitlistEntry) => {
    const url = entry.activity?.directRegistrationUrl || entry.activity?.registrationUrl;
    if (url) {
      Linking.openURL(url).catch(() => {
        handleWaitlistActivityPress(entry);
      });
    } else {
      handleWaitlistActivityPress(entry);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderFavoriteItem = ({ item }: { item: Activity }) => (
    <ActivityCard
      activity={item}
      onPress={() => handleActivityPress(item)}
      isFavorite={favoriteIds.has(item.id)}
      onFavoritePress={() => toggleFavorite(item)}
      imageHeight={90}
      canAddToWaitlist={canAddToWaitlist}
      onWaitlistLimitReached={onWaitlistLimitReached}
    />
  );

  const renderWatchingItem = ({ item }: { item: CachedWaitlistEntry }) => (
    <TouchableOpacity
      style={styles.watchingCard}
      onPress={() => handleWaitlistActivityPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.watchingContent}>
        <View style={styles.watchingHeader}>
          <View style={styles.watchingInfo}>
            <Text style={styles.watchingName} numberOfLines={2}>
              {item.activity?.name || 'Unknown Activity'}
            </Text>
            {item.activity?.provider && (
              <Text style={styles.watchingProvider} numberOfLines={1}>
                {item.activity.provider}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFromWaitlist(item.activityId)}
          >
            <Icon name="bell-off" size={20} color={ModernColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.watchingDetails}>
          {item.activity?.location && (
            <View style={styles.detailRow}>
              <Icon name="map-marker" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.activity.location}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Icon name="calendar-clock" size={14} color={ModernColors.textSecondary} />
            <Text style={styles.detailText}>
              Watching since {formatDate(item.joinedAt)}
            </Text>
          </View>
          {item.activity?.cost !== undefined && item.activity.cost !== null && (
            <View style={styles.detailRow}>
              <Icon name="tag" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.detailText}>
                {formatActivityPrice(item.activity.cost)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.watchingFooter}>
          <View style={styles.waitingBadge}>
            <Icon name="clock-outline" size={14} color="#F59E0B" />
            <Text style={styles.waitingBadgeText}>Waiting for spots</Text>
          </View>
          {item.activity?.spotsAvailable !== undefined && (
            <Text style={styles.spotsText}>
              {item.activity.spotsAvailable} spots
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAvailableItem = ({ item }: { item: CachedWaitlistEntry }) => (
    <TouchableOpacity
      style={[styles.watchingCard, styles.availableCard]}
      onPress={() => handleWaitlistActivityPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.availableBanner}>
        <Icon name="check-circle" size={16} color="#FFFFFF" />
        <Text style={styles.availableBannerText}>Spots Available!</Text>
      </View>

      <View style={styles.watchingContent}>
        <View style={styles.watchingHeader}>
          <View style={styles.watchingInfo}>
            <Text style={styles.watchingName} numberOfLines={2}>
              {item.activity?.name || 'Unknown Activity'}
            </Text>
            {item.activity?.provider && (
              <Text style={styles.watchingProvider} numberOfLines={1}>
                {item.activity.provider}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFromWaitlist(item.activityId)}
          >
            <Icon name="close" size={20} color={ModernColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.watchingDetails}>
          {item.activity?.location && (
            <View style={styles.detailRow}>
              <Icon name="map-marker" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.activity.location}
              </Text>
            </View>
          )}
          {item.activity?.cost !== undefined && item.activity.cost !== null && (
            <View style={styles.detailRow}>
              <Icon name="tag" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.detailText}>
                {formatActivityPrice(item.activity.cost)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.watchingFooter}>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => handleRegister(item)}
          >
            <Icon name="open-in-new" size={16} color="#FFFFFF" />
            <Text style={styles.registerButtonText}>Register Now</Text>
          </TouchableOpacity>
          {item.activity?.spotsAvailable !== undefined && (
            <Text style={styles.spotsTextAvailable}>
              {item.activity.spotsAvailable} spots available
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    switch (activeTab) {
      case 'favorites':
        return (
          <EmptyState
            icon="heart-outline"
            title="No favourites yet"
            subtitle="Tap the heart icon on activities to save them here"
            actionLabel="Browse Activities"
            onAction={() => navigation.navigate('Dashboard')}
          />
        );
      case 'watching':
        return (
          <EmptyState
            icon="bell-outline"
            title="Not watching any activities"
            subtitle="Tap the bell icon on activities to get notified when spots become available"
            actionLabel="Browse Activities"
            onAction={() => navigation.navigate('Dashboard')}
          />
        );
      case 'available':
        return (
          <EmptyState
            icon="bell-check-outline"
            title="No spots opened yet"
            subtitle="When activities you're watching have spots open up, they'll appear here"
          />
        );
    }
  };

  const getTabCount = (tab: TabType): number => {
    switch (tab) {
      case 'favorites':
        return favoriteActivities.length;
      case 'watching':
        return watchingEntries.length;
      case 'available':
        return availableEntries.length;
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
        </View>
      );
    }

    switch (activeTab) {
      case 'favorites':
        return favoriteActivities.length > 0 ? (
          <FlatList
            data={favoriteActivities}
            renderItem={renderFavoriteItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={ModernColors.primary}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>{renderEmptyState()}</View>
        );

      case 'watching':
        return watchingEntries.length > 0 ? (
          <FlatList
            data={watchingEntries}
            renderItem={renderWatchingItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={ModernColors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyContainer}>{renderEmptyState()}</View>
        );

      case 'available':
        return availableEntries.length > 0 ? (
          <FlatList
            data={availableEntries}
            renderItem={renderAvailableItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={ModernColors.primary}
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyContainer}>{renderEmptyState()}</View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground>
        {/* Top Tab Navigation */}
        <TopTabNavigation />

        {/* Hero Header */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={FavoritesHeaderImage}
            style={styles.heroSection}
            imageStyle={styles.heroImageStyle}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>My Collection</Text>
                <Text style={styles.heroSubtitle}>
                  {favoriteActivities.length} favourites • {watchingEntries.length + availableEntries.length} watching
                </Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
            onPress={() => setActiveTab('favorites')}
          >
            <Icon
              name="heart"
              size={18}
              color={activeTab === 'favorites' ? ModernColors.primary : ModernColors.textSecondary}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>
              Favourites
            </Text>
            {getTabCount('favorites') > 0 && (
              <View style={[styles.tabBadge, activeTab === 'favorites' && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, activeTab === 'favorites' && styles.activeTabBadgeText]}>
                  {getTabCount('favorites')}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'watching' && styles.activeTab]}
            onPress={() => setActiveTab('watching')}
          >
            <Icon
              name="bell"
              size={18}
              color={activeTab === 'watching' ? ModernColors.primary : ModernColors.textSecondary}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'watching' && styles.activeTabText]}>
              Watching
            </Text>
            {getTabCount('watching') > 0 && (
              <View style={[styles.tabBadge, activeTab === 'watching' && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, activeTab === 'watching' && styles.activeTabBadgeText]}>
                  {getTabCount('watching')}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'available' && styles.activeTab]}
            onPress={() => setActiveTab('available')}
          >
            <Icon
              name="check-circle"
              size={18}
              color={activeTab === 'available' ? '#22C55E' : ModernColors.textSecondary}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabTextGreen]}>
              Waiting List
            </Text>
            {getTabCount('available') > 0 && (
              <View style={[styles.tabBadge, styles.availableBadge]}>
                <Text style={styles.availableBadgeText}>
                  {getTabCount('available')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        {renderContent()}

        {/* Upgrade Modals */}
        <UpgradePromptModal
          visible={showWaitlistUpgradeModal}
          feature="notifications"
          onClose={hideWaitlistUpgradeModal}
        />
        <UpgradePromptModal
          visible={showFavoritesUpgradeModal}
          feature="favorites"
          onClose={hideFavoritesUpgradeModal}
        />
      </ScreenBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  heroContainer: {
    marginBottom: 0,
  },
  heroSection: {
    height: height * 0.14,
    width: width,
  },
  heroImageStyle: {
    borderRadius: 0,
  },
  heroGradient: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'flex-end',
  },
  heroContent: {
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
    backgroundColor: ModernColors.surface,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: ModernColors.primary,
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: ModernColors.primary,
    fontWeight: '600',
  },
  activeTabTextGreen: {
    color: '#22C55E',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: ModernColors.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: ModernColors.primary + '20',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ModernColors.textSecondary,
  },
  activeTabBadgeText: {
    color: ModernColors.primary,
  },
  availableBadge: {
    backgroundColor: '#22C55E',
  },
  availableBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ModernSpacing.xl,
  },
  listContent: {
    padding: ModernSpacing.md,
    paddingBottom: ModernSpacing.xl * 2,
  },
  separator: {
    height: ModernSpacing.md,
  },
  watchingCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
    ...ModernShadows.sm,
  },
  availableCard: {
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  availableBanner: {
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.md,
  },
  availableBannerText: {
    color: '#FFFFFF',
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '700',
    marginLeft: ModernSpacing.xs,
  },
  watchingContent: {
    padding: ModernSpacing.md,
  },
  watchingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  watchingInfo: {
    flex: 1,
    marginRight: ModernSpacing.md,
  },
  watchingName: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 4,
  },
  watchingProvider: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ModernColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watchingDetails: {
    marginTop: ModernSpacing.md,
    marginBottom: ModernSpacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginLeft: ModernSpacing.sm,
    flex: 1,
  },
  watchingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: ModernSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  waitingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.xs,
    paddingHorizontal: ModernSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingBadgeText: {
    color: '#F59E0B',
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '500',
    marginLeft: 4,
  },
  spotsText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  spotsTextAvailable: {
    fontSize: ModernTypography.sizes.sm,
    color: '#22C55E',
    fontWeight: '600',
  },
  registerButton: {
    backgroundColor: '#22C55E',
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '600',
    marginLeft: ModernSpacing.xs,
  },
});

export default FavoritesScreenModern;
