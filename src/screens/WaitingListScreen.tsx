import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import WaitlistService, { CachedWaitlistEntry } from '../services/waitlistService';
import ActivityService from '../services/activityService';
import { Activity } from '../types';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';
import { formatActivityPrice } from '../utils/formatters';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import { useAppSelector } from '../store';
import { selectIsPremium } from '../store/slices/subscriptionSlice';

const WaitingListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const waitlistService = WaitlistService.getInstance();
  const activityService = ActivityService.getInstance();
  const isPremium = useAppSelector(selectIsPremium);
  const { waitlistLimit, syncWaitlistCount } = useWaitlistSubscription();

  const [entries, setEntries] = useState<CachedWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWaitlist = async (forceRefresh: boolean = false) => {
    try {
      const waitlistEntries = await waitlistService.getWaitlist(forceRefresh);
      setEntries(waitlistEntries);
    } catch (error) {
      console.error('[WaitingListScreen] Error loading waitlist:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadWaitlist(true);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadWaitlist(true);
  };

  const handleRemove = async (activityId: string) => {
    Alert.alert(
      'Remove from Waiting List',
      'Are you sure you want to remove this activity from your waiting list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await waitlistService.leaveWaitlist(activityId);
            if (result.success) {
              setEntries(entries.filter(e => e.activityId !== activityId));
              syncWaitlistCount();
            } else {
              Alert.alert('Error', result.message || 'Failed to remove from waitlist');
            }
          },
        },
      ]
    );
  };

  const handleActivityPress = async (entry: CachedWaitlistEntry) => {
    try {
      const activity = await activityService.getActivityDetails(entry.activityId);
      if (activity) {
        navigation.navigate('ActivityDetail', { activity });
      } else {
        Alert.alert('Error', 'Activity not found');
      }
    } catch (error) {
      console.error('[WaitingListScreen] Error loading activity:', error);
      Alert.alert('Error', 'Failed to load activity details');
    }
  };

  const handleRegister = (entry: CachedWaitlistEntry) => {
    // Try to open registration URL if we have it
    const url = entry.activity?.directRegistrationUrl || entry.activity?.registrationUrl;
    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to activity detail if URL fails
        handleActivityPress(entry);
      });
    } else {
      // Fallback to activity detail
      handleActivityPress(entry);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const availableCount = entries.filter(e => e.hasAvailability).length;

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Icon name="bell-outline" size={48} color="#E8638B" />
      </View>
      <Text style={styles.emptyTitle}>No Activities on Waiting List</Text>
      <Text style={styles.emptySubtitle}>
        When you join a waiting list for a full activity, you'll be notified when spots become available.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Dashboard')}
      >
        <Icon name="magnify" size={20} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>Browse Activities</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEntry = ({ item }: { item: CachedWaitlistEntry }) => (
    <TouchableOpacity
      style={[
        styles.entryCard,
        item.hasAvailability && styles.entryCardAvailable,
      ]}
      onPress={() => handleActivityPress(item)}
      activeOpacity={0.8}
    >
      {item.hasAvailability && (
        <View style={styles.availableBanner}>
          <Icon name="check-circle" size={16} color="#FFFFFF" />
          <Text style={styles.availableBannerText}>Spots Available!</Text>
        </View>
      )}

      <View style={styles.entryContent}>
        <View style={styles.entryHeader}>
          <View style={styles.entryInfo}>
            <Text style={styles.entryName} numberOfLines={2}>
              {item.activity?.name || 'Unknown Activity'}
            </Text>
            {item.activity?.provider && (
              <Text style={styles.entryProvider} numberOfLines={1}>
                {typeof item.activity.provider === 'string' ? item.activity.provider : (item.activity.provider as any)?.name || ''}
              </Text>
            )}
          </View>
          <View style={styles.entryActions}>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemove(item.activityId)}
            >
              <Icon name="bell-off" size={20} color={ModernColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.entryDetails}>
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
              Joined {formatDate(item.joinedAt)}
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

        <View style={styles.entryFooter}>
          {item.hasAvailability ? (
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => handleRegister(item)}
            >
              <Icon name="open-in-new" size={16} color="#FFFFFF" />
              <Text style={styles.registerButtonText}>Register Now</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.waitingBadge}>
              <Icon name="clock-outline" size={14} color="#F59E0B" />
              <Text style={styles.waitingBadgeText}>Waiting for spots</Text>
            </View>
          )}

          <View style={styles.spotsInfo}>
            {item.activity?.spotsAvailable !== undefined && (
              <Text style={[
                styles.spotsText,
                item.hasAvailability && styles.spotsTextAvailable,
              ]}>
                {item.activity.spotsAvailable} spots
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Waiting List</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Waiting List</Text>
          {entries.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {isPremium
                ? `${entries.length} ${entries.length === 1 ? 'activity' : 'activities'}`
                : `${entries.length} of ${waitlistLimit}`}
              {availableCount > 0 && ` • ${availableCount} available`}
            </Text>
          )}
          {!isPremium && entries.length >= waitlistLimit && (
            <TouchableOpacity
              style={styles.upgradeHint}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Icon name="crown" size={12} color="#FFB800" />
              <Text style={styles.upgradeHintText}>Upgrade for unlimited</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerRight}>
          {availableCount > 0 && (
            <View style={styles.availableCountBadge}>
              <Text style={styles.availableCountText}>{availableCount}</Text>
            </View>
          )}
        </View>
      </View>

      {entries.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={entries}
          renderItem={renderEntry}
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
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
    backgroundColor: ModernColors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerSubtitle: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  upgradeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB800' + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  upgradeHintText: {
    fontSize: 11,
    color: '#B38600',
    fontWeight: '600',
    marginLeft: 4,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  availableCountBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  availableCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: ModernSpacing.lg,
    paddingBottom: ModernSpacing.xl * 2,
  },
  separator: {
    height: ModernSpacing.md,
  },
  entryCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
    ...ModernShadows.sm,
  },
  entryCardAvailable: {
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
  entryContent: {
    padding: ModernSpacing.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  entryInfo: {
    flex: 1,
    marginRight: ModernSpacing.md,
  },
  entryName: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 4,
  },
  entryProvider: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  entryActions: {
    flexDirection: 'row',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ModernColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryDetails: {
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
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: ModernSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
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
  spotsInfo: {
    alignItems: 'flex-end',
  },
  spotsText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
  },
  spotsTextAvailable: {
    color: '#22C55E',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ModernSpacing.xl * 2,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF5F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ModernSpacing.xl,
  },
  emptyTitle: {
    fontSize: ModernTypography.sizes.xl,
    fontWeight: '600',
    color: ModernColors.text,
    textAlign: 'center',
    marginBottom: ModernSpacing.md,
  },
  emptySubtitle: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: ModernSpacing.xl,
  },
  emptyButton: {
    backgroundColor: ModernColors.primary,
    borderRadius: ModernBorderRadius.lg,
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    marginLeft: ModernSpacing.sm,
  },
});

export default WaitingListScreen;
