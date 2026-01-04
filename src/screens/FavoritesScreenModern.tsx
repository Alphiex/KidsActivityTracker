import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenBackground from '../components/ScreenBackground';
import TopTabNavigation from '../components/TopTabNavigation';
import ActivityCard from '../components/ActivityCard';
import EmptyState from '../components/EmptyState';
import UpgradePromptModal from '../components/UpgradePromptModal';
import ChildFilterSelector from '../components/ChildFilterSelector';
import ActivityService from '../services/activityService';
import { Activity } from '../types';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import { formatActivityPrice } from '../utils/formatters';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import useFavoriteSubscription from '../hooks/useFavoriteSubscription';
import { useAppSelector, useAppDispatch } from '../store';
import { selectSelectedChildIds, selectAllChildren } from '../store/slices/childrenSlice';
import {
  fetchChildFavorites,
  fetchChildWatching,
  fetchChildWaitlist,
  removeChildFavorite,
  addChildFavorite,
  removeChildWatching,
  leaveChildWaitlist,
  selectFavoritesByChild,
  selectWatchingByChild,
  selectWaitlistByChild,
  selectFavoritesLoading,
  selectWatchingLoading,
  selectWaitlistLoading,
} from '../store/slices/childFavoritesSlice';
import { ChildWatching, ChildWaitlistEntry } from '../services/childFavoritesService';

const { width, height } = Dimensions.get('window');

const FavoritesHeaderImage = require('../assets/images/favorites-header.png');

type TabType = 'favorites' | 'watching' | 'available';

type FavoritesRouteParams = {
  Favorites: { tab?: TabType };
};

const FavoritesScreenModern: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<FavoritesRouteParams, 'Favorites'>>();
  const dispatch = useAppDispatch();
  const activityService = ActivityService.getInstance();

  // Get initial tab from route params or default to 'favorites'
  const initialTab = route.params?.tab || 'favorites';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Update tab when route params change
  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);
  const [refreshing, setRefreshing] = useState(false);

  // Redux state for child-centric data
  const rawSelectedChildIds = useAppSelector(selectSelectedChildIds);
  const selectedChildIds = React.useMemo(() => rawSelectedChildIds || [], [rawSelectedChildIds]);
  const allChildren = useAppSelector(selectAllChildren);
  const favoritesByChild = useAppSelector(selectFavoritesByChild);
  const watchingByChild = useAppSelector(selectWatchingByChild);
  const waitlistByChild = useAppSelector(selectWaitlistByChild);
  const favoritesLoading = useAppSelector(selectFavoritesLoading);
  const watchingLoading = useAppSelector(selectWatchingLoading);
  const waitlistLoading = useAppSelector(selectWaitlistLoading);

  const loading = favoritesLoading || watchingLoading || waitlistLoading;

  // Derive watching entries from Redux watching data
  const watchingEntries = React.useMemo(() => {
    const allWatchingEntries: ChildWatching[] = [];

    // Collect watching entries from all selected children
    for (const childId of selectedChildIds) {
      const childWatching = watchingByChild[childId] || [];
      for (const entry of childWatching) {
        // Deduplicate by activityId (activity may be watched by multiple children)
        if (!allWatchingEntries.some(e => e.activityId === entry.activityId)) {
          allWatchingEntries.push(entry);
        }
      }
    }

    return allWatchingEntries;
  }, [watchingByChild, selectedChildIds]);

  // Derive waitlist entries from Redux waitlist data
  const waitlistEntries = React.useMemo(() => {
    const allWaitlistEntries: ChildWaitlistEntry[] = [];

    // Collect waitlist entries from all selected children
    for (const childId of selectedChildIds) {
      const childWaitlist = waitlistByChild[childId] || [];
      for (const entry of childWaitlist) {
        // Deduplicate by activityId (activity may be on waitlist for multiple children)
        if (!allWaitlistEntries.some(e => e.activityId === entry.activityId)) {
          allWaitlistEntries.push(entry);
        }
      }
    }

    return allWaitlistEntries;
  }, [waitlistByChild, selectedChildIds]);

  // Split waitlist into available (spots opened up) and waiting
  const { availableEntries, waitingEntries } = React.useMemo(() => {
    const available: ChildWaitlistEntry[] = [];
    const waiting: ChildWaitlistEntry[] = [];

    for (const entry of waitlistEntries) {
      // Check if activity now has spots available
      if (entry.activity?.spotsAvailable && entry.activity.spotsAvailable > 0) {
        available.push(entry);
      } else {
        waiting.push(entry);
      }
    }

    return { availableEntries: available, waitingEntries: waiting };
  }, [waitlistEntries]);

  // Count of closed/unavailable waitlist activities
  const closedCount = waitingEntries.length;

  // Get unique favorited activities (deduplicated across children) for flat display
  const allFavoriteActivities: Activity[] = React.useMemo(() => {
    const activityMap = new Map<string, Activity>();
    for (const childId of selectedChildIds) {
      const childFavorites = favoritesByChild[childId] || [];
      for (const fav of childFavorites) {
        if (fav.activity && !activityMap.has(fav.activityId)) {
          activityMap.set(fav.activityId, fav.activity as unknown as Activity);
        }
      }
    }
    return Array.from(activityMap.values());
  }, [favoritesByChild, selectedChildIds]);

  // Create a set of favorite activity IDs for quick lookup
  const favoriteIds = React.useMemo(() => {
    return new Set(allFavoriteActivities.map(a => a.id));
  }, [allFavoriteActivities]);

  // Track which children have favorited each activity
  const activityChildMap = React.useMemo(() => {
    const map = new Map<string, { childId: string; childName: string }[]>();
    const childMap = new Map(allChildren.map(c => [c.id, c.name]));

    for (const childId of selectedChildIds) {
      const childFavorites = favoritesByChild[childId] || [];
      for (const fav of childFavorites) {
        if (!map.has(fav.activityId)) {
          map.set(fav.activityId, []);
        }
        map.get(fav.activityId)!.push({
          childId,
          childName: childMap.get(childId) || 'Unknown',
        });
      }
    }

    return map;
  }, [favoritesByChild, selectedChildIds, allChildren]);


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

  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    try {
      // Fetch child-centric favorites, watching, and waitlist via Redux
      if (selectedChildIds.length > 0) {
        dispatch(fetchChildFavorites(selectedChildIds));
        dispatch(fetchChildWatching(selectedChildIds));
        dispatch(fetchChildWaitlist(selectedChildIds));
      }
    } catch (error) {
      console.error('[FavoritesScreen] Error loading data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, selectedChildIds]);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  // Reload when selected children change
  useEffect(() => {
    if (selectedChildIds.length > 0) {
      dispatch(fetchChildFavorites(selectedChildIds));
    }
  }, [selectedChildIds, dispatch]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const toggleFavorite = async (activity: Activity) => {
    // Child-centric: toggle for all selected children
    const childrenWhoFavorited = activityChildMap.get(activity.id) || [];

    if (childrenWhoFavorited.length > 0) {
      // Activity is favorited by at least one selected child - remove from all
      for (const { childId } of childrenWhoFavorited) {
        dispatch(removeChildFavorite({ childId, activityId: activity.id }));
      }
    } else {
      // Not favorited - add for all selected children (or show picker if multiple)
      if (!canAddFavorite) {
        onFavoriteLimitReached();
        return;
      }

      // For simplicity, add for all selected children
      // Could show modal to select specific children
      for (const childId of selectedChildIds) {
        dispatch(addChildFavorite({ childId, activityId: activity.id }));
      }
    }
  };

  const handleRemoveFromWatching = async (activityId: string) => {
    Alert.alert(
      'Stop Watching',
      'Are you sure you want to stop watching this activity for notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Remove from watching for all selected children who have this activity
            for (const childId of selectedChildIds) {
              const childWatching = watchingByChild[childId] || [];
              if (childWatching.some(e => e.activityId === activityId)) {
                dispatch(removeChildWatching({ childId, activityId }));
              }
            }
            syncWaitlistCount();
          },
        },
      ]
    );
  };

  const handleRemoveFromWaitlist = async (activityId: string) => {
    Alert.alert(
      'Leave Waiting List',
      'Are you sure you want to remove this activity from your waiting list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Remove from waitlist for all selected children who have this activity
            for (const childId of selectedChildIds) {
              const childWaitlist = waitlistByChild[childId] || [];
              if (childWaitlist.some(e => e.activityId === activityId)) {
                dispatch(leaveChildWaitlist({ childId, activityId }));
              }
            }
          },
        },
      ]
    );
  };

  const handleActivityPress = (activity: Activity) => {
    navigation.navigate('ActivityDetail', { activity });
  };

  const handleWatchingActivityPress = async (entry: ChildWatching) => {
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

  const handleWaitlistActivityPress = async (entry: ChildWaitlistEntry) => {
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

  const handleRegister = (entry: ChildWatching) => {
    const url = entry.activity?.directRegistrationUrl || entry.activity?.registrationUrl;
    if (url) {
      Linking.openURL(url).catch(() => {
        handleWatchingActivityPress(entry);
      });
    } else {
      handleWatchingActivityPress(entry);
    }
  };

  const handleWaitlistRegister = (entry: ChildWaitlistEntry) => {
    const url = entry.activity?.directRegistrationUrl || entry.activity?.registrationUrl;
    if (url) {
      Linking.openURL(url).catch(() => {
        handleWaitlistActivityPress(entry);
      });
    } else {
      handleWaitlistActivityPress(entry);
    }
  };

  const handlePurgeClosedActivities = () => {
    // Note: closedCount functionality requires registrationStatus in ChildWaitlistEntry
    // For now, this is disabled as we moved to Redux-based waitlist
    Alert.alert('Info', 'Purge closed activities is not available in this version');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderFavoriteItem = ({ item }: { item: Activity }) => {
    const childrenForActivity = activityChildMap.get(item.id) || [];
    const childNames = childrenForActivity.map(c => c.childName);

    return (
      <View>
        <ActivityCard
          activity={item}
          onPress={() => handleActivityPress(item)}
          isFavorite={favoriteIds.has(item.id)}
          onFavoritePress={() => toggleFavorite(item)}
          imageHeight={90}
          canAddToWaitlist={canAddToWaitlist}
          onWaitlistLimitReached={onWaitlistLimitReached}
        />
        {/* Show which children saved this activity */}
        {childNames.length > 0 && allChildren.length > 1 && (
          <View style={styles.savedByContainer}>
            <Icon name="heart" size={12} color={ModernColors.primary} />
            <Text style={styles.savedByText}>
              Saved for {childNames.join(' & ')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderWatchingItem = ({ item }: { item: ChildWatching }) => (
    <TouchableOpacity
      style={styles.watchingCard}
      onPress={() => handleWatchingActivityPress(item)}
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
                {typeof item.activity.provider === 'string' ? item.activity.provider : (item.activity.provider as any)?.name || ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFromWatching(item.activityId)}
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
              Watching since {formatDate(item.createdAt)}
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
            <Icon name="bell-ring" size={14} color="#F59E0B" />
            <Text style={styles.waitingBadgeText}>Watching for notifications</Text>
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

  // Render waitlist item that has spots available
  const renderAvailableWaitlistItem = ({ item }: { item: ChildWaitlistEntry }) => (
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
                {typeof item.activity.provider === 'string' ? item.activity.provider : (item.activity.provider as any)?.name || ''}
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
            onPress={() => handleWaitlistRegister(item)}
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

  // Render waitlist item that's still waiting (no spots yet)
  const renderWaitingItem = ({ item }: { item: ChildWaitlistEntry }) => (
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
                {typeof item.activity.provider === 'string' ? item.activity.provider : (item.activity.provider as any)?.name || ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveFromWaitlist(item.activityId)}
          >
            <Icon name="account-clock-outline" size={20} color={ModernColors.textSecondary} />
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
              On waitlist since {formatDate(item.createdAt)}
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
          <View style={styles.waitlistBadge}>
            <Icon name="account-clock" size={14} color="#8B5CF6" />
            <Text style={styles.waitlistBadgeText}>On waiting list</Text>
          </View>
          <Text style={styles.spotsText}>
            {item.activity?.spotsAvailable === 0 ? 'Full' : `${item.activity?.spotsAvailable || 0} spots`}
          </Text>
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
          />
        );
      case 'watching':
        return (
          <EmptyState
            icon="bell-outline"
            title="Not watching any activities"
            subtitle="Tap the bell icon on activities to get notified when spots become available"
          />
        );
      case 'available':
        return (
          <EmptyState
            icon="account-clock-outline"
            title="No waiting list activities"
            subtitle="Tap the clock icon on full or waitlisted activities to add them here"
          />
        );
    }
  };

  const getTabCount = (tab: TabType): number => {
    switch (tab) {
      case 'favorites':
        return allFavoriteActivities.length;
      case 'watching':
        return watchingEntries.length;
      case 'available':
        // Show total waitlist count (available + waiting)
        return waitlistEntries.length;
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
        return allFavoriteActivities.length > 0 ? (
          <FlatList
            data={allFavoriteActivities}
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
        // Show all waitlist items: available ones first, then waiting ones
        const combinedWaitlist = [...availableEntries, ...waitingEntries];
        return combinedWaitlist.length > 0 ? (
          <FlatList
            data={combinedWaitlist}
            renderItem={({ item }) => {
              // Check if this item is available or waiting
              const isAvailable = item.activity?.spotsAvailable && item.activity.spotsAvailable > 0;
              return isAvailable
                ? renderAvailableWaitlistItem({ item })
                : renderWaitingItem({ item });
            }}
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
            ListHeaderComponent={
              availableEntries.length > 0 ? (
                <View style={styles.waitlistHeader}>
                  <Icon name="check-circle" size={16} color="#22C55E" />
                  <Text style={styles.waitlistHeaderText}>
                    {availableEntries.length} {availableEntries.length === 1 ? 'activity' : 'activities'} now available!
                  </Text>
                </View>
              ) : null
            }
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
                  {allFavoriteActivities.length} favourites • {watchingEntries.length} watching • {waitlistEntries.length} waitlist
                </Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* Child Filter Selector */}
        <ChildFilterSelector
          compact
          showModeToggle={false}
          onSelectionChange={() => {
            // Data will automatically refresh due to useEffect dependency
          }}
        />

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
              name="account-clock"
              size={18}
              color={activeTab === 'available' ? '#8B5CF6' : ModernColors.textSecondary}
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabTextPurple]}>
              Waiting List
            </Text>
            {getTabCount('available') > 0 && (
              <View style={[styles.tabBadge, activeTab === 'available' && styles.waitlistTabBadge]}>
                <Text style={[styles.tabBadgeText, activeTab === 'available' && styles.waitlistTabBadgeText]}>
                  {getTabCount('available')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Clear Closed Button - shows when Waiting List tab is active and there are closed activities */}
        {activeTab === 'available' && closedCount > 0 && (
          <View style={styles.clearClosedContainer}>
            <TouchableOpacity
              style={styles.clearClosedButton}
              onPress={handlePurgeClosedActivities}
            >
              <Icon name="close-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.clearClosedText}>
                Clear {closedCount} Closed {closedCount === 1 ? 'Activity' : 'Activities'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
  // Clear Closed Button styles
  clearClosedContainer: {
    paddingHorizontal: ModernSpacing.md,
    paddingVertical: ModernSpacing.sm,
  },
  clearClosedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.md,
    gap: 8,
  },
  clearClosedText: {
    color: '#DC2626',
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '600',
  },
  // Child favorites attribution
  savedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ModernSpacing.md,
    paddingVertical: ModernSpacing.xs,
    marginTop: -ModernSpacing.xs,
    marginBottom: ModernSpacing.sm,
  },
  savedByText: {
    fontSize: ModernTypography.sizes.xs,
    color: ModernColors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  // Waitlist-specific styles
  activeTabTextPurple: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  waitlistTabBadge: {
    backgroundColor: '#8B5CF6' + '20',
  },
  waitlistTabBadgeText: {
    color: '#8B5CF6',
  },
  waitlistBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: ModernBorderRadius.md,
    paddingVertical: ModernSpacing.xs,
    paddingHorizontal: ModernSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitlistBadgeText: {
    color: '#8B5CF6',
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '500',
    marginLeft: 4,
  },
  waitlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.md,
    borderRadius: ModernBorderRadius.md,
    marginBottom: ModernSpacing.md,
  },
  waitlistHeaderText: {
    fontSize: ModernTypography.sizes.sm,
    fontWeight: '600',
    color: '#22C55E',
    marginLeft: ModernSpacing.xs,
  },
});

export default FavoritesScreenModern;
