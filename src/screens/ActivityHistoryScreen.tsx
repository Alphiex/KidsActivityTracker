import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors } from '../theme';
import { Activity } from '../types';
import ActivityService from '../services/activityService';

const ActivityHistoryScreen = () => {
  const navigation = useNavigation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: 'Activity History',
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadActivityHistory();
  }, [navigation]);

  const loadActivityHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load past activities (activities with end date before today)
      const activityService = ActivityService.getInstance();
      const today = new Date();
      const response = await activityService.searchActivitiesPaginated({
        dateEndBefore: today.toISOString(),
        sortBy: 'dateEnd',
        sortOrder: 'desc',
        limit: 50,
      });
      
      setActivities(response.items);
    } catch (err: any) {
      console.error('Error loading activity history:', err);
      setError(err.message || 'Failed to load activity history');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityHistory();
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <ActivityCard
      activity={item}
      onPress={() => {
        const serializedActivity = {
          ...item,
          dateRange: item.dateRange ? {
            start: item.dateRange.start.toISOString(),
            end: item.dateRange.end.toISOString(),
          } : null,
          scrapedAt: item.scrapedAt ? item.scrapedAt.toISOString() : null,
        };
        navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
      }}
    />
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#9C27B0', '#7B1FA2']}
      style={styles.header}
    >
      <Icon name="history" size={50} color="#fff" />
      <Text style={styles.headerTitle}>Activity History</Text>
      <Text style={styles.headerSubtitle}>
        Your past activities and experiences
      </Text>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="calendar-blank" size={80} color={Colors.textSecondary} />
      <Text style={styles.emptyText}>No activity history yet</Text>
      <Text style={styles.emptySubtext}>
        Your completed activities will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading activity history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadActivityHistory}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
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
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ActivityHistoryScreen;