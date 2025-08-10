import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  ActivityIndicator,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ActivityCard from './ActivityCard';
import { Activity } from '../types';
import ActivityService from '../services/activityService';
import { ActivitySearchParams } from '../types/api';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PaginatedActivityListProps {
  filters?: ActivitySearchParams;
  onActivityPress?: (activity: Activity) => void;
  emptyMessage?: string;
  header?: React.ReactElement;
}

const PaginatedActivityList: React.FC<PaginatedActivityListProps> = ({
  filters = {},
  onActivityPress,
  emptyMessage = 'No activities found',
  header,
}) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isConnected } = useNetworkStatus();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  
  const ITEMS_PER_PAGE = 20;
  const activityService = ActivityService.getInstance();

  const loadActivities = useCallback(async (isRefresh = false, loadMore = false) => {
    if (loadMore && !hasMore) return;
    
    // Check network status
    if (isConnected === false) {
      setError('No internet connection');
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      return;
    }
    
    try {
      setError(null);
      
      if (loadMore) {
        setLoadingMore(true);
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const currentOffset = loadMore ? offset : 0;
      const params: ActivitySearchParams = {
        ...filters,
        limit: ITEMS_PER_PAGE,
        offset: currentOffset,
      };
      
      const response = await activityService.searchActivitiesPaginated(params);
      
      if (loadMore) {
        setActivities(prev => [...prev, ...response.items]);
      } else {
        setActivities(response.items);
      }
      
      setTotal(response.total);
      setHasMore(response.hasMore);
      setOffset(currentOffset + response.items.length);
      
    } catch (err: any) {
      console.error('Error loading activities:', err);
      setError(err.message || 'Failed to load activities');
      if (!loadMore) {
        setActivities([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filters, offset, hasMore, isConnected]);

  useEffect(() => {
    loadActivities();
  }, [filters]);

  const handleRefresh = () => {
    setOffset(0);
    setHasMore(true);
    loadActivities(true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadActivities(false, true);
    }
  };

  const handleActivityPress = (activity: Activity) => {
    console.log('PaginatedActivityList handleActivityPress called for:', activity.name);
    console.log('onActivityPress prop exists:', !!onActivityPress);
    console.log('Navigation object exists:', !!navigation);
    
    if (onActivityPress) {
      console.log('Using custom onActivityPress handler');
      onActivityPress(activity);
    } else {
      console.log('Navigating to ActivityDetail');
      navigation.navigate('ActivityDetail' as never, { activity } as never);
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingMoreText, { color: colors.text }]}>
          Loading more activities...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    
    const isOffline = isConnected === false;
    const iconName = isOffline ? 'wifi-off' : error ? 'alert-circle' : 'calendar-blank';
    const message = isOffline ? 'No internet connection' : error || emptyMessage;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name={iconName} size={60} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.text }]}>
          {message}
        </Text>
        {(error || isOffline) && (
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => loadActivities()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading activities...
        </Text>
      </View>
    );
  }

  if (error && activities.length === 0 && !refreshing) {
    const isOffline = isConnected === false;
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Icon 
          name={isOffline ? 'wifi-off' : 'alert-circle'} 
          size={60} 
          color={isOffline ? colors.textSecondary : colors.error} 
        />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {isOffline ? 'No internet connection' : error}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => loadActivities()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ActivityCard
          activity={item}
          onPress={() => handleActivityPress(item)}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      contentContainerStyle={[
        styles.listContent,
        activities.length === 0 && styles.emptyListContent
      ]}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default PaginatedActivityList;