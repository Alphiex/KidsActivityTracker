import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchChildActivityHistory,
  selectChildActivitiesLoading,
} from '../../store/slices/childActivitiesSlice';
import { ChildActivity } from '../../services/childActivityService';
import ScreenBackground from '../../components/ScreenBackground';
import ActivityCard from '../../components/ActivityCard';
import { ChildAvatar } from '../../components/children';
import { selectChildById } from '../../store/slices/childrenSlice';
import { Colors, Theme } from '../../theme';
import { Activity } from '../../types';

type TabType = 'upcoming' | 'current' | 'past';

const ChildActivityHistoryScreen = () => {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectChildActivitiesLoading);

  const { childId, childName } = route.params as { childId: string; childName: string };
  const child = useAppSelector(selectChildById(childId));

  const [activities, setActivities] = useState<ChildActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  const loadActivityHistory = useCallback(async () => {
    try {
      const result = await dispatch(fetchChildActivityHistory({ childId })).unwrap();
      setActivities(result);
    } catch (error) {
      console.error('Failed to load activity history:', error);
    }
  }, [childId, dispatch]);

  useEffect(() => {
    loadActivityHistory();
  }, [loadActivityHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivityHistory();
    setRefreshing(false);
  };

  // Categorize activities based on their dates relative to today
  const categorizedActivities = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming: ChildActivity[] = [];
    const current: ChildActivity[] = [];
    const past: ChildActivity[] = [];

    activities.forEach(item => {
      if (!item.activity) return;

      const activity = item.activity;

      // Get start and end dates from various possible sources
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      // Try dateRange first
      if (activity.dateRange) {
        if (activity.dateRange.start) {
          startDate = new Date(activity.dateRange.start);
        }
        if (activity.dateRange.end) {
          endDate = new Date(activity.dateRange.end);
        }
      }

      // Fallback to startDate/endDate fields
      if (!startDate && activity.startDate) {
        startDate = new Date(activity.startDate);
      }
      if (!endDate && activity.endDate) {
        endDate = new Date(activity.endDate);
      }

      // Reset time for comparison
      if (startDate) startDate.setHours(0, 0, 0, 0);
      if (endDate) endDate.setHours(0, 0, 0, 0);

      // Categorize based on dates
      if (startDate && endDate) {
        if (endDate < today) {
          // Activity has ended
          past.push(item);
        } else if (startDate <= today && endDate >= today) {
          // Activity is ongoing
          current.push(item);
        } else if (startDate > today) {
          // Activity hasn't started yet
          upcoming.push(item);
        }
      } else if (startDate) {
        // Only start date available
        if (startDate > today) {
          upcoming.push(item);
        } else {
          current.push(item);
        }
      } else if (endDate) {
        // Only end date available
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
    const sortByStartDate = (a: ChildActivity, b: ChildActivity) => {
      const aDate = a.activity?.dateRange?.start || a.activity?.startDate;
      const bDate = b.activity?.dateRange?.start || b.activity?.startDate;
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
    navigation.navigate('ActivityDetail', { activity });
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      upcoming: {
        icon: 'calendar-plus',
        title: 'No upcoming activities',
        subtitle: 'Activities you add to the calendar will appear here',
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
                child={child}
                size={40}
                style={styles.headerAvatar}
              />
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{childName}'s Activities</Text>
              <Text style={styles.headerSubtitle}>
                {activities.length} {activities.length === 1 ? 'activity' : 'activities'} on calendar
              </Text>
            </View>
          </View>
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
                color={activeTab === tab.key ? Colors.white : Colors.textSecondary}
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
          {loading && activities.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : tabActivities.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {tabActivities.map((item) => {
                if (!item.activity) return null;
                // Cast to Activity type for ActivityCard compatibility
                const activity = item.activity as unknown as Activity;
                return (
                  <ActivityCard
                    key={item.id}
                    activity={activity}
                    onPress={() => handleActivityPress(activity)}
                    containerStyle={styles.activityCard}
                    imageHeight={160}
                  />
                );
              })}
              <View style={styles.bottomSpacer} />
            </>
          )}
        </ScrollView>
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
    color: Colors.textSecondary,
    marginTop: 2,
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
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  activityCard: {
    marginBottom: Theme.spacing.md,
  },
  bottomSpacer: {
    height: Theme.spacing.xl,
  },
});

export default ChildActivityHistoryScreen;
