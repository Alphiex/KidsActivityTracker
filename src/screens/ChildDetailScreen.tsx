import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import childrenService, { ChildActivity as ChildActivityType } from '../services/childrenService';
import { Child } from '../store/slices/childrenSlice';
import { Activity } from '../types';
import { Colors, Theme } from '../theme';
import ScreenBackground from '../components/ScreenBackground';
import ActivityCard from '../components/ActivityCard';
import { ChildAvatar } from '../components/children';
import AddEventModal, { CustomEvent } from '../components/calendar/AddEventModal';
import { CHILD_COLORS } from '../utils/calendarUtils';

type TabType = 'upcoming' | 'current' | 'past';

interface ActivityWithChild extends Activity {
  childActivity?: ChildActivityType;
}

const ChildDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as {
    childId?: string;
    childName?: string;
    isShared?: boolean;
  } | undefined;
  const childId = params?.childId ?? '';
  const childName = params?.childName ?? 'Child';
  const isShared = params?.isShared ?? false;

  const [child, setChild] = useState<Child | null>(null);
  const [activities, setActivities] = useState<ActivityWithChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Validate required params
  useEffect(() => {
    if (!childId) {
      console.warn('ChildDetailScreen: Missing required childId param');
      navigation.goBack();
    }
  }, [childId, navigation]);

  const loadActivities = useCallback(async () => {
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

        // If we have activity data from the ChildActivity relation, use it
        if (ca.activity) {
          activitiesWithDetails.push({
            ...ca.activity,
            childActivity: ca,
          } as ActivityWithChild);
        } else {
          // Fallback: create minimal activity object from childActivity data
          activitiesWithDetails.push({
            id: ca.activityId,
            name: `Activity ${ca.activityId}`,
            category: 'General',
            childActivity: ca,
          } as ActivityWithChild);
        }
      }

      setActivities(activitiesWithDetails);
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    }
  }, [childId]);

  const loadChildAndActivities = useCallback(async () => {
    setLoading(true);
    try {
      // Load child details
      const childData = await childrenService.getChild(childId);
      setChild(childData);
      // Load child activities
      await loadActivities();
    } catch (error) {
      console.error('Error loading child details:', error);
      // Use route params as fallback for child name display
      setChild({
        id: childId,
        name: childName,
        dateOfBirth: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await loadActivities();
    } finally {
      setLoading(false);
    }
  }, [childId, childName, loadActivities]);

  useEffect(() => {
    loadChildAndActivities();
  }, [loadChildAndActivities]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }, [loadActivities]);

  // Categorize activities based on their dates relative to today
  const categorizedActivities = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming: ActivityWithChild[] = [];
    const current: ActivityWithChild[] = [];
    const past: ActivityWithChild[] = [];

    activities.forEach(item => {
      // Get start and end dates from various possible sources
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      // Try dateRange first
      if (item.dateRange) {
        if (item.dateRange.start) {
          startDate = new Date(item.dateRange.start);
        }
        if (item.dateRange.end) {
          endDate = new Date(item.dateRange.end);
        }
      }

      // Fallback to startDate/endDate fields
      if (!startDate && item.startDate) {
        startDate = new Date(item.startDate);
      }
      if (!endDate && item.endDate) {
        endDate = new Date(item.endDate);
      }

      // Fallback to dateStart/dateEnd (legacy)
      if (!startDate && (item as any).dateStart) {
        startDate = new Date((item as any).dateStart);
      }
      if (!endDate && (item as any).dateEnd) {
        endDate = new Date((item as any).dateEnd);
      }

      // Reset time for comparison
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(0, 0, 0, 0);

      // Categorize based on dates
      if (startDate && endDate) {
        if (endDate < today) {
          past.push(item);
        } else if (startDate <= today && endDate >= today) {
          current.push(item);
        } else if (startDate > today) {
          upcoming.push(item);
        }
      } else if (startDate) {
        if (startDate > today) {
          upcoming.push(item);
        } else {
          current.push(item);
        }
      } else if (endDate) {
        if (endDate < today) {
          past.push(item);
        } else {
          current.push(item);
        }
      } else {
        // No dates - put in upcoming by default
        upcoming.push(item);
      }
    });

    // Sort activities by date
    const sortByStartDate = (a: ActivityWithChild, b: ActivityWithChild) => {
      const aDate = a.dateRange?.start || a.startDate || (a as any).dateStart;
      const bDate = b.dateRange?.start || b.startDate || (b as any).dateStart;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    };

    upcoming.sort(sortByStartDate);
    current.sort(sortByStartDate);
    past.sort((a, b) => -sortByStartDate(a, b)); // Reverse for past (most recent first)

    return { upcoming, current, past };
  }, [activities]);

  const getTabActivities = () => {
    switch (activeTab) {
      case 'upcoming':
        return categorizedActivities.upcoming;
      case 'current':
        return categorizedActivities.current;
      case 'past':
        return categorizedActivities.past;
      default:
        return [];
    }
  };

  const tabs: { key: TabType; label: string; icon: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming', icon: 'calendar-clock', count: categorizedActivities.upcoming.length },
    { key: 'current', label: 'In Progress', icon: 'play-circle', count: categorizedActivities.current.length },
    { key: 'past', label: 'Completed', icon: 'check-circle', count: categorizedActivities.past.length },
  ];

  const handleActivityPress = (activity: Activity) => {
    navigation.navigate('ActivityDetail' as never, {
      activity: activity,
      childId,
      childName,
    } as never);
  };

  const handleRemoveActivity = (item: ActivityWithChild) => {
    Alert.alert(
      'Remove Activity',
      `Remove "${item.name}" from ${childName}'s calendar?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.childActivity) {
                await childrenService.removeActivityFromChild(childId, item.childActivity.id);
                await loadActivities();
              }
            } catch (error) {
              console.error('Error removing activity:', error);
              Alert.alert('Error', 'Failed to remove activity');
            }
          },
        },
      ]
    );
  };

  const handleSaveCustomEvent = async (event: CustomEvent) => {
    try {
      const scheduledDate = new Date(format(event.date, 'yyyy-MM-dd'));
      const startTimeStr = format(event.startTime, 'h:mm a').toLowerCase();
      const endTimeStr = format(event.endTime, 'h:mm a').toLowerCase();

      const result = await childrenService.createCustomEvent(
        event.childId,
        {
          title: event.title,
          description: event.description,
          scheduledDate,
          startTime: startTimeStr,
          endTime: endTimeStr,
          location: event.location,
          locationData: event.locationAddress ? {
            latitude: event.locationAddress.latitude,
            longitude: event.locationAddress.longitude,
            formattedAddress: event.locationAddress.formattedAddress,
          } : undefined,
          recurring: event.recurring === 'none' ? undefined : event.recurring,
          recurrenceEndDate: event.recurring && event.recurring !== 'none' ? event.recurrenceEndDate : undefined,
        }
      );

      if (result.eventsCreated > 1) {
        Alert.alert('Success', `Created ${result.eventsCreated} recurring events`);
      } else {
        Alert.alert('Success', 'Event added to calendar');
      }
      await loadActivities();
    } catch (error) {
      console.error('Error saving custom event:', error);
      throw error;
    }
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      upcoming: {
        icon: 'calendar-plus',
        title: 'No upcoming activities',
        subtitle: `Activities you add to ${childName}'s calendar will appear here`,
      },
      current: {
        icon: 'play-circle-outline',
        title: 'No activities in progress',
        subtitle: 'Activities happening now will appear here',
      },
      past: {
        icon: 'history',
        title: 'No past activities',
        subtitle: 'Completed activities will appear here',
      },
    };

    const message = emptyMessages[activeTab];

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Icon name={message.icon} size={64} color={Colors.primary} />
        </View>
        <Text style={styles.emptyText}>{message.title}</Text>
        <Text style={styles.emptySubtext}>{message.subtitle}</Text>
      </View>
    );
  };

  const age = child?.dateOfBirth
    ? childrenService.calculateAge(child.dateOfBirth)
    : null;

  const tabActivities = getTabActivities();

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        {/* Header with child info */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={Colors.text.primary} />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            {child && (
              <ChildAvatar
                name={child.name}
                avatarUrl={child.avatar}
                size={40}
                style={styles.headerAvatar}
              />
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{childName}'s Activities</Text>
              <Text style={styles.headerSubtitle}>
                {age !== null ? `${age} years old • ` : ''}
                {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              </Text>
            </View>
          </View>

          {!isShared && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditChild' as never, { childId } as never)}
            >
              <Icon name="pencil" size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? Colors.white : Colors.text.secondary}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={[
                  styles.tabBadge,
                  activeTab === tab.key && styles.tabBadgeActive,
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    activeTab === tab.key && styles.tabBadgeTextActive,
                  ]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : tabActivities.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {tabActivities.map((item) => {
                // Cast to Activity type for ActivityCard compatibility
                const activity = item as unknown as Activity;
                return (
                  <View key={item.childActivity?.id || item.id} style={styles.activityCardWrapper}>
                    <ActivityCard
                      activity={activity}
                      onPress={() => handleActivityPress(activity)}
                      containerStyle={styles.activityCard}
                      imageHeight={160}
                    />
                    {/* Delete button */}
                    {!isShared && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleRemoveActivity(item)}
                      >
                        <Icon name="trash-can-outline" size={18} color={Colors.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <View style={styles.bottomSpacer} />
            </>
          )}
        </ScrollView>

        {/* Floating Action Button for adding events */}
        {!isShared && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowAddEventModal(true)}
            activeOpacity={0.8}
          >
            <Icon name="plus" size={28} color={Colors.white} />
          </TouchableOpacity>
        )}

        {/* Add Event Modal */}
        <AddEventModal
          visible={showAddEventModal}
          onClose={() => setShowAddEventModal(false)}
          onSave={handleSaveCustomEvent}
          children={child ? [{
            id: childId,
            name: childName,
            color: (child as any).color || CHILD_COLORS[0],
          }] : []}
          initialChildId={childId}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    padding: Theme.spacing.xs,
    marginRight: Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    marginRight: Theme.spacing.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  editButton: {
    padding: Theme.spacing.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    gap: Theme.spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    gap: 4,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  tabBadgeTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  activityCardWrapper: {
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  activityCard: {
    marginBottom: 0,
  },
  deleteButton: {
    position: 'absolute',
    top: Theme.spacing.sm,
    left: Theme.spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bottomSpacer: {
    height: Theme.spacing.xl + 80, // Extra space for FAB
  },
  fab: {
    position: 'absolute',
    bottom: Theme.spacing.xl,
    right: Theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});

export default ChildDetailScreen;
