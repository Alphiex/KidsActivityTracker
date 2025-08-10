import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';
import { Activity } from '../types';

const ActivityTypeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { category, filters } = route.params as { category: string; filters?: any };
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      
      let searchParams: any = {};
      
      // Add category filter if not "All"
      if (category !== 'All') {
        searchParams.activityTypes = [category];
      }
      
      // Apply additional filters if provided
      if (filters) {
        searchParams = { ...searchParams, ...filters };
      }
      
      const fetchedActivities = await activityService.searchActivities(searchParams);
      setActivities(fetchedActivities);
    } catch (err: any) {
      console.error('Error loading activities:', err);
      setError(err.message || 'Failed to load activities. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let title = category;
    
    // Update title based on filters
    if (filters?.maxCost) {
      title = `Budget Friendly (Under $${filters.maxCost})`;
    }
    
    navigation.setOptions({
      title: title,
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadActivities();
  }, [category, navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const renderActivity = ({ item }: { item: Activity }) => (
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
  );

  const renderHeader = () => (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryDark]}
      style={styles.header}
    >
      <Text style={styles.categoryTitle}>{category}</Text>
      <Text style={styles.categorySubtitle}>
        {activities.length} {activities.length === 1 ? 'activity' : 'activities'} found
      </Text>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading {category} activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadActivities}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="emoticon-sad" size={60} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>No {category} activities found</Text>
        <Text style={styles.emptySubtext}>Check back later for new activities!</Text>
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
  },
  categoryTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  categorySubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  listContent: {
    paddingBottom: 20,
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

export default ActivityTypeScreen;