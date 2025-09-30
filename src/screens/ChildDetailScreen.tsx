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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import childrenService, { ChildActivity } from '../services/childrenService';
import { Child } from '../store/slices/childrenSlice';
import activityService from '../services/activityService';
import { Activity } from '../types';
import ActivityCard from '../components/modern/ActivityCard';

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

  useEffect(() => {
    loadChildAndActivities();
  }, [childId]);

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

      // The API now returns activities with full details, so we can use them directly
      const activitiesWithDetails = response.map((ca) => {
        // If we have activity data from the ChildActivity relation, use it
        if (ca.activity) {
          return {
            ...ca.activity,
            childActivity: ca,
          } as ActivityWithChild;
        }

        // Fallback: create minimal activity object from childActivity data
        return {
          id: ca.activityId,
          name: `Activity ${ca.activityId}`,
          category: 'General',
          childActivity: ca,
        } as ActivityWithChild;
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

    return (
      <View style={styles.activityWrapper}>
        {/* Activity Card with Image */}
        <ActivityCard
          activity={item}
          onPress={() => handleActivityPress(item)}
          variant="default"
          isAssignedToCalendar={true}
        />

        {/* Status Badge Overlay */}
        <View style={[styles.statusBadgeOverlay, { backgroundColor: statusColors[status] }]}>
          <Text style={styles.statusText}>
            {status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>

        {/* Action Buttons */}
        {!isShared && (
          <View style={styles.activityActions}>
            {status === 'planned' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleUpdateStatus(item, 'in_progress')}
              >
                <Icon name="play" size={20} color={ModernColors.secondary} />
                <Text style={styles.actionButtonText}>Start</Text>
              </TouchableOpacity>
            )}
            {status === 'in_progress' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleUpdateStatus(item, 'completed')}
              >
                <Icon name="check" size={20} color={ModernColors.success} />
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleRemoveActivity(item.id)}
            >
              <Icon name="delete-outline" size={20} color={ModernColors.error} />
              <Text style={styles.actionButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes Section */}
        {item.childActivity?.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{item.childActivity.notes}</Text>
          </View>
        )}
      </View>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['all', 'planned', 'in_progress', 'completed'] as ActivityStatus[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterTab, filter === status && styles.filterTabActive]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterTabText, filter === status && styles.filterTabTextActive]}>
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: ModernColors.backgroundLight,
  },
  filterTabActive: {
    backgroundColor: ModernColors.text,
  },
  filterTabText: {
    fontSize: 14,
    color: ModernColors.text,
    textTransform: 'capitalize',
  },
  filterTabTextActive: {
    color: ModernColors.background,
    fontWeight: '600',
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
  activityWrapper: {
    position: 'relative',
    marginVertical: 4,
  },
  statusBadgeOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusText: {
    fontSize: 11,
    color: ModernColors.background,
    fontWeight: '600',
  },
  activityActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: ModernColors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: ModernColors.borderLight,
    marginTop: -12,
    marginHorizontal: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionButtonText: {
    fontSize: 14,
    color: ModernColors.text,
    marginLeft: 6,
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