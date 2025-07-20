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
import { ScraperService } from '../services/scraperService';
import CampCard from '../components/CampCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors, Theme } from '../theme';

// const { width } = Dimensions.get('window'); // Not currently used

const HomeScreen = () => {
  const navigation = useNavigation();
  const { camps, setCamps, isLoading, setLoading } = useStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadCamps = async () => {
    try {
      setLoading(true);
      setError(null);
      const scraperService = ScraperService.getInstance();
      const fetchedCamps = await scraperService.scrapeNVRC();
      setCamps(fetchedCamps);
    } catch (err: any) {
      console.error('Error loading camps:', err);
      setError(err.message || 'Failed to load camps. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCamps();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setRefreshing(true);
    loadCamps();
  };

  const renderCamp = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        // Convert Date objects to ISO strings to avoid non-serializable warning
        const serializedCamp = {
          ...item,
          dateRange: {
            start: item.dateRange.start.toISOString(),
            end: item.dateRange.end.toISOString(),
          },
          scrapedAt: item.scrapedAt.toISOString(),
        };
        navigation.navigate('CampDetail', { camp: serializedCamp });
      }}
    >
      <CampCard camp={item} />
    </TouchableOpacity>
  );

  if (isLoading && camps.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading camps...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={64} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCamps}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={camps}
        renderItem={renderCamp}
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
                <Text style={styles.headerTitle}>Discover Amazing Camps</Text>
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
                { icon: 'tent', label: 'Camps', color: Colors.activities.camps },
                { icon: 'swim', label: 'Swimming', color: Colors.activities.swimming },
                { icon: 'karate', label: 'Martial Arts', color: Colors.activities.martial_arts },
                { icon: 'palette', label: 'Arts', color: Colors.activities.visual_arts },
                { icon: 'music', label: 'Music', color: Colors.activities.music },
              ].map((category) => (
                <TouchableOpacity key={category.label} style={styles.categoryCard}>
                  <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                    <Icon name={category.icon} size={24} color={category.color} />
                  </View>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Available Camps</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="tent-off" size={64} color={Colors.gray[400]} />
            <Text style={styles.emptyText}>No camps available</Text>
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
  sectionTitle: {
    ...Theme.typography.h4,
    color: Colors.text.primary,
    marginTop: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
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