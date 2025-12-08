import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SectionList,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import childrenService, { ChildActivity } from '../services/childrenService';
import { Child } from '../store/slices/childrenSlice';
import activityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import { Activity } from '../types';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';

// Airbnb-style colors
const ModernColors = {
  primary: '#FF385C',
  secondary: '#00A699',
  text: '#222222',
  textLight: '#717171',
  background: '#FFFFFF',
  backgroundLight: '#F7F7F7',
  border: '#DDDDDD',
  borderLight: '#EBEBEB',
  success: '#008A05',
  warning: '#FFA500',
  error: '#C13515',
  info: '#428BCA',
};

type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'all';

interface ActivityWithChild extends Activity {
  childActivity?: ChildActivity;
}

const ChildDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { childId, childName, isShared } = route.params as {
    childId: string;
    childName: string;
    isShared?: boolean;
  };

  const [child, setChild] = useState<Child | null>(null);
  const [activities, setActivities] = useState<ActivityWithChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActivityStatus>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const favoritesService = FavoritesService.getInstance();

  useEffect(() => {
    loadChildAndActivities();
  }, [childId]);

  // Load favorites when activities change
  useEffect(() => {
    const loadFavorites = () => {
      const favoriteIds = new Set<string>();
      activities.forEach(activity => {
        if (favoritesService.isFavorite(activity.id)) {
          favoriteIds.add(activity.id);
        }
      });
      setFavorites(favoriteIds);
    };
    loadFavorites();
  }, [activities]);

  const handleToggleFavorite = (activity: ActivityWithChild) => {
    favoritesService.toggleFavorite(activity as Activity);
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activity.id)) {
        newSet.delete(activity.id);
      } else {
        newSet.add(activity.id);
      }
      return newSet;
    });
  };

  const loadChildAndActivities = async () => {
    setLoading(true);
    try {
      // Load child details
      const childData = await childrenService.getChild(childId);
      setChild(childData);

      // Load child activities
      await loadActivities();
    } catch (error) {
      console.error('Error loading child details:', error);
      // Use mock data for now
      setChild({
        id: childId,
        name: childName,
        dateOfBirth: '2018-01-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await loadActivities();
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      // Get child activities with full activity details from API
      const response = await childrenService.getChildActivitiesList(childId);

      // Deduplicate activities by childActivity.id (not activity.id)
      const seenChildActivityIds = new Set<string>();
      const activitiesWithDetails: ActivityWithChild[] = [];

      for (const ca of response) {
        // Skip if we've already seen this childActivity
        if (seenChildActivityIds.has(ca.id)) {
          continue;
        }
        seenChildActivityIds.add(ca.id);

        // Log raw data for first activity
        if (activitiesWithDetails.length === 0) {
          console.log('=== FIRST CHILD ACTIVITY ===');
          console.log('Full object:', JSON.stringify(ca, null, 2));
        }

        // If we have activity data from the ChildActivity relation, use it
        if (ca.activity) {
          console.log('Activity data found:', {
            name: ca.activity.name,
            id: ca.activity.id,
            hasLocation: !!ca.activity.location,
            hasSessions: !!(ca.activity as any).sessions
          });

          activitiesWithDetails.push({
            ...ca.activity,
            childActivity: ca,
          } as ActivityWithChild);
        } else {
          console.log('NO ACTIVITY DATA - using fallback');
          // Fallback: create minimal activity object from childActivity data
          activitiesWithDetails.push({
            id: ca.activityId,
            name: `Activity ${ca.activityId}`,
            category: 'General',
            childActivity: ca,
          } as ActivityWithChild);
        }
      }

      // Sort by start date (newest to oldest)
      activitiesWithDetails.sort((a, b) => {
        const dateA = a.childActivity?.scheduledDate ? new Date(a.childActivity.scheduledDate).getTime() :
                     (a as any).dateStart ? new Date((a as any).dateStart).getTime() : 0;
        const dateB = b.childActivity?.scheduledDate ? new Date(b.childActivity.scheduledDate).getTime() :
                     (b as any).dateStart ? new Date((b as any).dateStart).getTime() : 0;
        return dateB - dateA; // Newest first
      });

      setActivities(activitiesWithDetails);
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }, [childId]);

  const getFilteredActivities = () => {
    if (filter === 'all') return activities;
    return activities.filter(a => a.childActivity?.status === filter);
  };

  const groupActivitiesByStatus = () => {
    const grouped = {
      current: [] as ActivityWithChild[],
      upcoming: [] as ActivityWithChild[],
      completed: [] as ActivityWithChild[],
    };

    activities.forEach(activity => {
      const status = activity.childActivity?.status;
      if (status === 'completed') {
        grouped.completed.push(activity);
      } else if (status === 'in_progress') {
        grouped.current.push(activity);
      } else {
        grouped.upcoming.push(activity);
      }
    });

    const sections = [];
    if (filter === 'all' || filter === 'in_progress') {
      if (grouped.current.length > 0) {
        sections.push({ title: 'Current Activities', data: grouped.current });
      }
    }
    if (filter === 'all' || filter === 'planned') {
      if (grouped.upcoming.length > 0) {
        sections.push({ title: 'Upcoming Activities', data: grouped.upcoming });
      }
    }
    if (filter === 'all' || filter === 'completed') {
      if (grouped.completed.length > 0) {
        sections.push({ title: 'Completed Activities', data: grouped.completed });
      }
    }

    return sections;
  };

  const handleRemoveActivity = (activityId: string) => {
    Alert.alert(
      'Remove Activity',
      'Are you sure you want to remove this activity from this child?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const childActivity = activities.find(a => a.id === activityId)?.childActivity;
            if (childActivity) {
              await childrenService.removeActivityFromChild(childActivity.id);
              await loadActivities();
            }
          },
        },
      ]
    );
  };

  const handleActivityPress = (activity: ActivityWithChild) => {
    navigation.navigate('ActivityDetail' as never, {
      activity: activity,
      childId,
      childName,
    } as never);
  };

  const handleUpdateStatus = async (activity: ActivityWithChild, newStatus: ChildActivity['status']) => {
    if (activity.childActivity) {
      await childrenService.updateActivityStatus(activity.childActivity.id, newStatus);
      await loadActivities();
    }
  };

  const renderActivity = ({ item }: { item: ActivityWithChild }) => {
    const status = item.childActivity?.status || 'planned';
    const statusColors = {
      planned: ModernColors.info,
      in_progress: ModernColors.warning,
      completed: ModernColors.success,
    };

    // Extract activity details
    const activityName = item.name || `Activity ${item.id}`;
    const startTime = item.childActivity?.startTime || (item as any).startTime;
    const endTime = item.childActivity?.endTime || (item as any).endTime;
    const location = (item as any).location?.name || (item as any).location || 'Location TBA';

    // Get date and day of week - prioritize activity dateStart/dateEnd
    let dateInfo = '';
    let dayOfWeek = '';

    // First check for activity's dateStart and dateEnd
    if ((item as any).dateStart && (item as any).dateEnd) {
      const startDate = new Date((item as any).dateStart);
      const endDate = new Date((item as any).dateEnd);
      dateInfo = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      // Get day of week from first session or activity schedule
      if ((item as any).schedule) {
        dayOfWeek = (item as any).schedule;
      } else if ((item as any).sessions && (item as any).sessions.length > 0) {
        dayOfWeek = (item as any).sessions[0].dayOfWeek || '';
      }
    } else if ((item as any).sessions && (item as any).sessions.length > 0) {
      // Fallback to sessions
      const session = (item as any).sessions[0];
      dayOfWeek = session.dayOfWeek || '';
      if (session.date) {
        const date = new Date(session.date);
        dateInfo = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } else if (item.childActivity?.scheduledDate) {
      // Last resort: use scheduled date from childActivity
      const date = new Date(item.childActivity.scheduledDate);
      dateInfo = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Get activity image - fallback to category if activityType not available
    const activityTypeName = (item as any).activityType?.name || item.category || (item as any).category || 'general';
    const subcategory = (item as any).activitySubtype?.name || (item as any).subcategory;

    // Log for debugging
    console.log('Activity image lookup:', {
      activityName,
      activityTypeName,
      subcategory,
      hasActivityType: !!(item as any).activityType,
      category: item.category
    });

    const imageKey = getActivityImageKey(activityTypeName, subcategory);
    const imageSource = getActivityImageByKey(imageKey);

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => handleActivityPress(item)}
        activeOpacity={0.9}
      >
        {/* Image Container */}
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.activityImage} resizeMode="cover" />

          {/* Status Badge Overlay */}
          <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
            <Text style={styles.statusBadgeText}>
              {status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          {/* Favorite Button - Top Right */}
          <TouchableOpacity
            style={[
              styles.favoriteButton,
              favorites.has(item.id) && styles.favoriteButtonActive
            ]}
            onPress={() => handleToggleFavorite(item)}
          >
            <Icon
              name={favorites.has(item.id) ? 'heart' : 'heart-outline'}
              size={24}
              color={favorites.has(item.id) ? ModernColors.primary : '#FFF'}
            />
          </TouchableOpacity>

          {/* Delete Button - Bottom Right */}
          {!isShared && (
            <TouchableOpacity
              style={styles.deleteButtonOverlay}
              onPress={() => handleRemoveActivity(item.id)}
            >
              <Icon name="trash-can-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Activity Info */}
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle} numberOfLines={2}>{activityName}</Text>

          {(dateInfo || dayOfWeek) && (
            <View style={styles.infoRow}>
              <Icon name="calendar" size={14} color={ModernColors.textLight} />
              <Text style={styles.infoText} numberOfLines={1}>
                {dayOfWeek}{dayOfWeek && dateInfo && ' • '}{dateInfo}
              </Text>
            </View>
          )}

          {(startTime || endTime) && (
            <View style={styles.infoRow}>
              <Icon name="clock-outline" size={14} color={ModernColors.textLight} />
              <Text style={styles.infoText} numberOfLines={1}>
                {startTime}{endTime && ` - ${endTime}`}
              </Text>
            </View>
          )}

          {location && (
            <View style={styles.infoRow}>
              <Icon name="map-marker" size={14} color={ModernColors.textLight} />
              <Text style={styles.infoText} numberOfLines={1}>{location}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="calendar-blank" size={64} color={ModernColors.borderLight} />
      <Text style={styles.emptyTitle}>No activities yet</Text>
      <Text style={styles.emptySubtitle}>
        Activities linked to {childName} will appear here
      </Text>
      {!isShared && (
        <TouchableOpacity
          style={styles.addActivityButton}
          onPress={() => navigation.navigate('Search' as never)}
        >
          <Text style={styles.addActivityButtonText}>Browse Activities</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const age = child?.dateOfBirth
    ? childrenService.calculateAge(child.dateOfBirth)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{childName}</Text>
          {age !== null && (
            <Text style={styles.headerSubtitle}>{age} years old</Text>
          )}
        </View>
        {!isShared && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditChild' as never, { childId } as never)}
          >
            <Icon name="pencil" size={20} color={ModernColors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'planned', 'in_progress', 'completed'] as ActivityStatus[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, filter === status && styles.filterTabActive]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterTabText, filter === status && styles.filterTabTextActive]}>
              {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activities List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
        </View>
      ) : (
        <SectionList
          sections={groupActivitiesByStatus()}
          keyExtractor={(item) => item.id}
          renderItem={renderActivity}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  backButton: {
    padding: 5,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginTop: 2,
  },
  editButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: ModernColors.borderLight,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: ModernColors.background,
  },
  filterTabActive: {
    backgroundColor: ModernColors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: ModernColors.text,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    backgroundColor: ModernColors.backgroundLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  activityCard: {
    backgroundColor: ModernColors.background,
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    color: ModernColors.background,
    fontWeight: '600',
  },
  activityInfo: {
    padding: 16,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: ModernColors.textLight,
    marginLeft: 6,
    flex: 1,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  deleteButtonOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesContainer: {
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: ModernColors.backgroundLight,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: ModernColors.borderLight,
  },
  notesLabel: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: ModernColors.text,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: ModernColors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  addActivityButton: {
    backgroundColor: ModernColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  addActivityButtonText: {
    color: ModernColors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChildDetailScreen;