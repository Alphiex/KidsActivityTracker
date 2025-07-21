import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useStore } from '../store';
import ScraperService from '../services/scraperService';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';

// const { width } = Dimensions.get('window'); // Not currently used

const HomeScreen = () => {
  const navigation = useNavigation();
  const { activities, setActivities, isLoading, setLoading } = useStore();
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const scraperService = ScraperService.getInstance();
      const fetchedActivities = await scraperService.scrapeNVRC();
      setActivities(fetchedActivities);
    } catch (err: any) {
      console.error('Error loading activities:', err);
      setError(err.message || 'Failed to load activities. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const renderActivity = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        // Convert Date objects to ISO strings to avoid non-serializable warning
        const serializedActivity = {
          ...item,
          dateRange: {
            start: item.dateRange.start.toISOString(),
            end: item.dateRange.end.toISOString(),
          },
          scrapedAt: item.scrapedAt.toISOString(),
        };
        navigation.navigate('ActivityDetail', { activity: serializedActivity });
      }}
    >
      <ActivityCard activity={item} />
    </TouchableOpacity>
  );

  if (isLoading && activities.length === 0) {
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
        <Icon name="alert-circle" size={64} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadActivities}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={selectedCategory 
          ? activities.filter(activity => 
              activity.activityType.includes(selectedCategory)
            )
          : activities
        }
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <LinearGradient
              colors={Colors.gradients.primary}
              style={styles.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.headerContent}>
                <Text style={styles.greeting}>Hello, Parent! 👋</Text>
                <Text style={styles.headerTitle}>Discover Amazing Activities</Text>
                <Text style={styles.headerSubtitle}>
                  Find the perfect activities for your kids
                </Text>
              </View>
            </LinearGradient>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesContainer}
            >
              {[
                { icon: 'tent', label: 'Camps', value: 'camps', color: Colors.activities.camps },
                { icon: 'basketball', label: 'Sports', value: 'sports', color: Colors.activities.sports },
                { icon: 'palette', label: 'Arts', value: 'arts', color: Colors.activities.arts },
                { icon: 'swim', label: 'Swimming', value: 'swimming', color: Colors.activities.swimming },
                { icon: 'school', label: 'Education', value: 'education', color: Colors.activities.education },
              ].map((category) => (
                <TouchableOpacity 
                  key={category.label} 
                  style={[
                    styles.categoryCard,
                    selectedCategory === category.value && styles.categoryCardActive
                  ]}
                  onPress={() => setSelectedCategory(selectedCategory === category.value ? null : category.value)}
                >
                  <View style={[
                    styles.categoryIcon, 
                    { backgroundColor: category.color + (selectedCategory === category.value ? '40' : '20') }
                  ]}>
                    <Icon name={category.icon} size={24} color={category.color} />
                  </View>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Activities</Text>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <Text style={styles.clearFilter}>Show All</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="tent-off" size={64} color={Colors.gray[400]} />
            <Text style={styles.emptyText}>No activities available</Text>
            <Text style={styles.emptySubText}>Pull down to refresh</Text>
          </View>
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
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    ...Theme.typography.body,
    color: Colors.text.secondary,
  },
  listContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
  },
  header: {
    marginBottom: Theme.spacing.md,
  },
  headerGradient: {
    borderRadius: Theme.borderRadius.xl,
    marginHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.md,
    // Shadows removed from LinearGradient to avoid performance warning
  },
  headerContent: {
    padding: Theme.spacing.lg,
  },
  greeting: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
    marginBottom: Theme.spacing.xs,
  },
  headerTitle: {
    ...Theme.typography.h2,
    color: Colors.white,
    marginBottom: Theme.spacing.xs,
  },
  headerSubtitle: {
    ...Theme.typography.body,
    color: Colors.white,
    opacity: 0.8,
  },
  categoriesContainer: {
    marginTop: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.md,
  },
  categoryCard: {
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  categoryCardActive: {
    transform: [{ scale: 1.1 }],
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: Theme.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  categoryLabel: {
    ...Theme.typography.caption,
    color: Colors.text.secondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  sectionTitle: {
    ...Theme.typography.h4,
    color: Colors.text.primary,
  },
  clearFilter: {
    ...Theme.typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xxl,
  },
  emptyText: {
    ...Theme.typography.h5,
    color: Colors.text.secondary,
    marginTop: Theme.spacing.md,
  },
  emptySubText: {
    ...Theme.typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: Theme.spacing.xs,
  },
  errorText: {
    ...Theme.typography.body,
    color: Colors.error,
    marginTop: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Theme.spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
  },
  retryText: {
    ...Theme.typography.button,
    color: Colors.white,
  },
});

export default HomeScreen;