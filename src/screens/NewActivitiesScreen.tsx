import React, { useEffect, useState } from 'react';
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
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';
import { Activity } from '../types';

const NewActivitiesScreen = () => {
  const navigation = useNavigation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNewActivities = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();
      
      // Calculate date for one week ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Use API-level filtering for new activities
      const searchParams: any = { 
        limit: 50,
        // Filter by updated date at API level for better performance
        updatedAfter: oneWeekAgo.toISOString()
      };
      
      // Apply user preference for hiding closed activities
      if (preferences.hideClosedActivities) {
        searchParams.hideClosedActivities = true;
      }
      
      // Apply user preference for hiding full activities
      if (preferences.hideFullActivities) {
        searchParams.hideFullActivities = true;
      }
      
      const newActivities = await activityService.searchActivities(searchParams);
      
      // Activities are already filtered by date at API level
      // Just sort by date, newest first
      newActivities.sort((a, b) => {
        const dateA = new Date(a.scrapedAt || a.createdAt || 0);
        const dateB = new Date(b.scrapedAt || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setActivities(newActivities);
    } catch (err: any) {
      console.error('Error loading new activities:', err);
      setError(err.message || 'Failed to load new activities. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'New Activities',
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadNewActivities();
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNewActivities();
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <View style={styles.activityWrapper}>
      <ActivityCard 
        activity={item}
        onPress={() => {
          // Convert Date objects to ISO strings to avoid non-serializable warning
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
      {/* New badge */}
      <View style={styles.newBadge}>
        <Text style={styles.newBadgeText}>NEW</Text>
      </View>
    </View>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#4CAF50', '#45a049']}
      style={styles.header}
    >
      <Icon name="new-box" size={50} color="#fff" />
      <Text style={styles.headerTitle}>New This Week</Text>
      <Text style={styles.headerSubtitle}>
        {activities.length} new {activities.length === 1 ? 'activity' : 'activities'} added
      </Text>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading new activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadNewActivities}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="calendar-blank" size={60} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No new activities this week</Text>
        <Text style={styles.emptySubtext}>Check back soon for updates!</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
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
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  listContent: {
    paddingBottom: 20,
  },
  activityWrapper: {
    position: 'relative',
  },
  newBadge: {
    position: 'absolute',
    top: 20,
    right: 30,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 20,
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
  emptyText: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NewActivitiesScreen;