import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors } from '../theme';
import { Activity } from '../types';

const CategoryDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { category } = route.params as { category: any };
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: category.name || 'Category',
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
    });
    loadActivities(true);
  }, [navigation, category]);

  const loadActivities = async (reset = false) => {
    try {
      if (reset) {
        setCurrentPage(1);
        setActivities([]);
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      
      const activityService = ActivityService.getInstance();
      
      // Use the category code to fetch activities
      const response = await fetch(
        `${activityService.api.defaults.baseURL}/api/v1/categories/${category.code}/activities?page=${reset ? 1 : currentPage}&limit=50`
      );
      
      const data = await response.json();
      
      if (data.success) {
        if (reset) {
          setActivities(data.data.activities);
        } else {
          setActivities(prev => [...prev, ...data.data.activities]);
        }
        setTotalPages(data.data.pagination.totalPages);
        setCurrentPage(prev => prev + 1);
      } else {
        throw new Error(data.error || 'Failed to load activities');
      }
    } catch (err: any) {
      console.error('Error loading category activities:', err);
      setError(err.message || 'Failed to load activities');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadActivities(true);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && currentPage <= totalPages) {
      loadActivities(false);
    }
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <ActivityCard 
      activity={item}
      onPress={() => {
        navigation.navigate('ActivityDetail' as never, { activity: item } as never);
      }}
    />
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#673AB7', '#512DA8']}
      style={styles.header}
    >
      <Icon name="account-group" size={50} color="#fff" />
      <Text style={styles.headerTitle}>{category.name}</Text>
      <Text style={styles.headerSubtitle}>
        {category.description || `Activities for ${category.name.toLowerCase()}`}
      </Text>
      <View style={styles.headerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{category.count || 0}</Text>
          <Text style={styles.statLabel}>Total Activities</Text>
        </View>
        {category.ageMin !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {category.ageMin}-{category.ageMax}
            </Text>
            <Text style={styles.statLabel}>Age Range</Text>
          </View>
        )}
        {category.requiresParent && (
          <View style={styles.statItem}>
            <Icon name="account-child" size={24} color="#fff" />
            <Text style={styles.statLabel}>Parent Required</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <LoadingIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    return null;
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadActivities(true)}>
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
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading && !refreshing ? (
            <View style={styles.emptyContainer}>
              <Icon name="magnify-remove-outline" size={60} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>No activities found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your filters or check back later
              </Text>
            </View>
          ) : null
        }
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
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default CategoryDetailScreen;