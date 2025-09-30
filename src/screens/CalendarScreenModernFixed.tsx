import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
  SafeAreaView,
} from 'react-native';
import { Calendar, Agenda } from 'react-native-calendars';
import { getWeek, subMonths, subWeeks } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  parseISO,
  getHours,
  isSameDay,
} from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchChildren } from '../store/slices/childrenSlice';
import childrenService from '../services/childrenService';
import activityService from '../services/activityService';
import { ModernColors } from '../theme/modernTheme';
import { ChildActivity } from '../services/childrenService';
import TopTabNavigation from '../components/TopTabNavigation';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const CHILD_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FECA57',
  '#DDA0DD',
  '#98D8C8',
  '#FFD93D',
  '#6BCB77',
  '#FF8CC8',
];

interface ChildWithActivities {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  isShared?: boolean;
  sharedBy?: string;
  activities: ChildActivity[];
}

interface ExtendedChildActivity extends ChildActivity {
  childName?: string;
  childColor?: string;
  activity: {
    id: string;
    name: string;
    description?: string;
    location?: string;
    category?: string;
  };
}

const CalendarScreenModernFixed = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { children: myChildren } = useAppSelector((state) => state.children);
  const { user } = useAppSelector((state) => state.auth);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [childrenWithActivities, setChildrenWithActivities] = useState<ChildWithActivities[]>([]);
  const [sharedChildren, setSharedChildren] = useState<ChildWithActivities[]>([]);
  const [showSharedChildren, setShowSharedChildren] = useState(true);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ChildActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [isAgendaReady, setIsAgendaReady] = useState(false);

  // Load children and their activities
  useEffect(() => {
    loadData();
  }, []);

  // Reload data when returning from other screens
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Update marked dates when selected date or children visibility changes
  useEffect(() => {
    if (childrenWithActivities.length > 0 || sharedChildren.length > 0) {
      generateMarkedDates([...childrenWithActivities, ...sharedChildren]);
    }
  }, [selectedDate, childrenWithActivities, sharedChildren, generateMarkedDates]);

  // Prevent re-renders when switching to agenda view
  useEffect(() => {
    if (viewMode === 'agenda' && !isAgendaReady && !loading) {
      // Set agenda ready flag when switching to agenda view after data is loaded
      setIsAgendaReady(true);
    }
  }, [viewMode, loading, isAgendaReady]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch user's children (handle if no children)
      try {
        await dispatch(fetchChildren());
      } catch (error) {
        console.warn('Error fetching children:', error);
      }

      // Fetch shared children (with error handling for 404)
      let shared = [];
      try {
        shared = await childrenService.getSharedChildren();
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.warn('Error fetching shared children:', error);
        }
        // Continue with empty shared array if 404 or other error
      }

      // Get date range for fetching scheduled activities
      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(addMonths(new Date(), 2));

      // Fetch scheduled activities for all children with full activity details
      let scheduledActivities = [];
      if (myChildren && myChildren.length > 0) {
        const childIds = myChildren.map(c => c.id);
        try {
          scheduledActivities = await childrenService.getScheduledActivities(
            startDate,
            endDate,
            childIds
          );
        } catch (error) {
          console.warn('Error fetching scheduled activities:', error);
        }
      }

      // Activities now come with full details from the API, no need to fetch separately
      const enhancedActivities = scheduledActivities.map(sa => ({
        ...sa,
        activity: sa.activity || {
          id: sa.activityId,
          name: `Activity ${sa.activityId}`,
          description: 'Activity details unavailable',
          location: 'TBD',
          category: 'General',
        },
      }));

      // If no activities, show helpful placeholder for first child
      if (enhancedActivities.length === 0 && myChildren.length > 0) {
        // Don't add demo activities - let the user see their real data
        console.log('No scheduled activities found for children');
      }

      // Process children with activities
      const processedChildren = myChildren.map((child, index) => ({
        ...child,
        color: CHILD_COLORS[index % CHILD_COLORS.length],
        isVisible: true,
        activities: enhancedActivities.filter(a => a.childId === child.id),
      }));

      setChildrenWithActivities(processedChildren);

      // Process shared children
      const processedShared = shared.map((sharedChild: any, index: number) => ({
        id: sharedChild.childId,
        name: sharedChild.childName || `${sharedChild.ownerName}'s child`,
        color: CHILD_COLORS[(myChildren.length + index) % CHILD_COLORS.length],
        isVisible: showSharedChildren,
        isShared: true,
        sharedBy: sharedChild.ownerName,
        activities: [],
      }));

      setSharedChildren(processedShared);

      // Generate marked dates for calendar
      generateMarkedDates([...processedChildren, ...processedShared]);

    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMarkedDates = useCallback((allChildren: ChildWithActivities[]) => {
    const dates: any = {};

    allChildren.forEach((child) => {
      if (!child.isVisible) return;

      child.activities.forEach((activity) => {
        if (activity.scheduledDate) {
          // Format the scheduledDate as 'yyyy-MM-dd' for calendar marking
          const dateKey = format(new Date(activity.scheduledDate), 'yyyy-MM-dd');
          if (!dates[dateKey]) {
            dates[dateKey] = { dots: [] };
          }
          dates[dateKey].dots.push({ color: child.color, key: activity.id });
        }
      });
    });

    // Mark selected date
    dates[selectedDate] = {
      ...dates[selectedDate],
      selected: true,
      selectedColor: ModernColors.primary,
    };

    setMarkedDates(dates);
  }, [selectedDate]);

  // Create a stable key for agenda items to prevent infinite loop
  const agendaKey = useMemo(() => {
    const allChildren = [...childrenWithActivities, ...sharedChildren];
    const visibleChildren = allChildren.filter(c => c.isVisible);
    const activityCount = visibleChildren.reduce((sum, c) => sum + c.activities.length, 0);
    return `${visibleChildren.length}-${activityCount}-${selectedDate}`;
  }, [childrenWithActivities, sharedChildren, selectedDate]);

  // Memoize agenda items to prevent infinite loop in Agenda component
  const memoizedAgendaItems = useMemo(() => {
    const items: any = {};
    const allChildren = [...childrenWithActivities, ...sharedChildren];

    // Generate items for next 30 days
    for (let i = 0; i < 30; i++) {
      const date = format(addDays(new Date(), i), 'yyyy-MM-dd');
      items[date] = [];

      allChildren.forEach((child) => {
        if (!child.isVisible) return;

        child.activities
          .filter((activity) => {
            if (!activity.scheduledDate) return false;
            // Format the scheduledDate as 'yyyy-MM-dd' for comparison
            const activityDate = format(new Date(activity.scheduledDate), 'yyyy-MM-dd');
            return activityDate === date;
          })
          .forEach((activity) => {
            items[date].push({
              ...activity,
              childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
              childColor: child.color,
            });
          });
      });

      if (items[date].length === 0) {
        items[date] = [{ empty: true, date }];
      }
    }

    return items;
  }, [agendaKey]);

  const toggleChildVisibility = useCallback((childId: string, isShared: boolean = false) => {
    const updateChildren = isShared ? setSharedChildren : setChildrenWithActivities;

    updateChildren((prev) => {
      const updated = prev.map((child) =>
        child.id === childId ? { ...child, isVisible: !child.isVisible } : child
      );

      // Regenerate with all children after update
      setTimeout(() => {
        const allChildren = isShared
          ? [...childrenWithActivities, ...updated]
          : [...updated, ...sharedChildren];
        generateMarkedDates(allChildren);
      }, 0);

      return updated;
    });
  }, [childrenWithActivities, sharedChildren, generateMarkedDates]);

  const toggleSharedChildrenVisibility = useCallback(() => {
    const newVisibility = !showSharedChildren;
    setShowSharedChildren(newVisibility);

    setSharedChildren((prev) => {
      const updated = prev.map((child) => ({ ...child, isVisible: newVisibility }));

      // Regenerate with updated children
      setTimeout(() => {
        generateMarkedDates([...childrenWithActivities, ...updated]);
      }, 0);

      return updated;
    });
  }, [showSharedChildren, childrenWithActivities, generateMarkedDates]);

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const handleActivityPress = (activity: ChildActivity) => {
    setSelectedActivity(activity);
    setShowActivityModal(true);
  };

  const handleActivityEdit = async (activity: ChildActivity) => {
    setShowActivityModal(false);
    // Navigate to activity detail screen with the activity and scheduling info
    navigation.navigate('ActivityDetail' as any, {
      activityId: activity.activityId,
      childId: activity.childId,
      scheduleId: activity.id,
      fromCalendar: true,
    });
  };

  const handleActivityDelete = async (activity: ChildActivity) => {
    Alert.alert(
      'Remove Activity',
      'Are you sure you want to remove this activity from the calendar?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await childrenService.removeActivityFromChild(activity.childId, activity.id);
              setShowActivityModal(false);
              // Reload calendar data
              loadData();
              Alert.alert('Success', 'Activity removed from calendar');
            } catch (error) {
              console.error('Error removing activity:', error);
              Alert.alert('Error', 'Failed to remove activity');
            }
          },
        },
      ]
    );
  };

  const handleQuickAdd = async (date: string) => {
    // Navigate to search screen with pre-selected date for quick activity addition
    navigation.navigate('SearchResults' as any, {
      preselectedDate: date,
      quickAdd: true,
    });
  };

  const exportToCalendar = async () => {
    Alert.alert(
      'Export Calendar',
      'Choose your calendar app',
      [
        {
          text: 'iOS Calendar',
          onPress: () => exportToIOSCalendar(),
        },
        {
          text: 'Google Calendar',
          onPress: () => exportToGoogleCalendar(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const exportToIOSCalendar = async () => {
    // Create ICS file content
    const activities = [...childrenWithActivities, ...sharedChildren]
      .filter(c => c.isVisible)
      .flatMap(c => c.activities);

    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kids Activity Tracker//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    activities.forEach((activity) => {
      const startDate = activity.scheduledDate ? parseISO(activity.scheduledDate) : new Date();
      const startTime = activity.startTime || '09:00';
      const endTime = activity.endTime || '10:00';

      icsContent += `BEGIN:VEVENT
SUMMARY:${activity.activity.name}
DTSTART:${format(startDate, 'yyyyMMdd')}T${startTime.replace(':', '')}00
DTEND:${format(startDate, 'yyyyMMdd')}T${endTime.replace(':', '')}00
DESCRIPTION:${activity.activity.description || ''}
LOCATION:${activity.activity.location || ''}
END:VEVENT
`;
    });

    icsContent += 'END:VCALENDAR';

    // For iOS, we could save this to a file and open it
    // This would require file system permissions and linking
    Alert.alert('Export Complete', 'Calendar events prepared for export');
  };

  const exportToGoogleCalendar = () => {
    const activities = [...childrenWithActivities, ...sharedChildren]
      .filter(c => c.isVisible)
      .flatMap(c => c.activities);

    if (activities.length > 0) {
      const firstActivity = activities[0];
      const startDate = firstActivity.scheduledDate || format(new Date(), 'yyyy-MM-dd');
      const text = encodeURIComponent(firstActivity.activity.name);
      const details = encodeURIComponent(firstActivity.activity.description || '');
      const location = encodeURIComponent(firstActivity.activity.location || '');

      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${startDate.replace(/-/g, '')}/${startDate.replace(/-/g, '')}`;

      Linking.openURL(url);
    }
  };

  const renderHeaderActions = () => (
    <View style={styles.headerActions}>
      <TouchableOpacity
        onPress={() => setShowFilterModal(true)}
        style={styles.headerActionButton}
      >
        <Icon name="filter-variant" size={24} color={ModernColors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={exportToCalendar}
        style={styles.headerActionButton}
      >
        <Icon name="export" size={24} color={ModernColors.text} />
      </TouchableOpacity>
    </View>
  );

  const renderViewModeSelector = () => (
    <View style={styles.viewModeContainer}>
      {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          onPress={() => setViewMode(mode)}
          style={[
            styles.viewModeButton,
            viewMode === mode && styles.viewModeButtonActive,
          ]}
        >
          <Text
            style={[
              styles.viewModeText,
              viewMode === mode && styles.viewModeTextActive,
            ]}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = parseISO(selectedDate);
    const newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const currentDate = parseISO(selectedDate);
    const newDate = direction === 'next' ? addDays(currentDate, 7) : addDays(currentDate, -7);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const currentDate = parseISO(selectedDate);
    const newDate = direction === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1);
    setSelectedDate(format(newDate, 'yyyy-MM-dd'));
  };

  const renderDateNavigation = (label: string, onPrev: () => void, onNext: () => void) => (
    <View style={styles.dateNavigationContainer}>
      <TouchableOpacity onPress={onPrev} style={styles.dateNavButton}>
        <Icon name="chevron-left" size={24} color={ModernColors.text} />
      </TouchableOpacity>
      <Text style={styles.dateNavigationText}>{label}</Text>
      <TouchableOpacity onPress={onNext} style={styles.dateNavButton}>
        <Icon name="chevron-right" size={24} color={ModernColors.text} />
      </TouchableOpacity>
    </View>
  );

  const getActivitiesForDate = (date: string): ExtendedChildActivity[] => {
    const allChildren = [...childrenWithActivities, ...sharedChildren];
    const activities: ExtendedChildActivity[] = [];

    allChildren.forEach((child) => {
      if (!child.isVisible) return;

      child.activities
        .filter((activity) => activity.scheduledDate === date)
        .forEach((activity) => {
          activities.push({
            ...activity,
            childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
            childColor: child.color,
          });
        });
    });

    return activities.sort((a, b) => {
      const timeA = a.startTime || '00:00';
      const timeB = b.startTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const renderChildrenLegend = () => {
    const visibleChildren = [...childrenWithActivities, ...sharedChildren].filter(c => c.isVisible);

    if (visibleChildren.length === 0) {
      return null;
    }

    return (
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>Children</Text>
        <View style={styles.legendItems}>
          {visibleChildren.map((child) => (
            <View key={child.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: child.color }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {child.isShared ? `${child.name} (${child.sharedBy})` : child.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderActivitiesList = () => {
    const activities = getActivitiesForDate(selectedDate);

    if (activities.length === 0) {
      return (
        <View style={styles.emptyActivitiesContainer}>
          <Icon name="calendar-blank" size={48} color={ModernColors.textMuted} />
          <Text style={styles.emptyActivitiesText}>No activities scheduled for this day</Text>
        </View>
      );
    }

    return (
      <View style={styles.activitiesListContainer}>
        <Text style={styles.activitiesListTitle}>
          Activities for {format(parseISO(selectedDate), 'MMMM d, yyyy')}
        </Text>
        {activities.map((activity) => (
          <TouchableOpacity
            key={activity.id}
            style={[
              styles.activityListItem,
              { borderLeftColor: activity.childColor, borderLeftWidth: 4 }
            ]}
            onPress={() => handleActivityPress(activity)}
          >
            <View style={styles.activityListHeader}>
              <Text style={styles.activityListName}>{activity.activity.name}</Text>
              <View style={[styles.activityListChildBadge, { backgroundColor: activity.childColor + '20' }]}>
                <Text style={[styles.activityListChildName, { color: activity.childColor }]}>
                  {activity.childName}
                </Text>
              </View>
            </View>
            <View style={styles.activityListDetails}>
              <View style={styles.activityListDetailRow}>
                <Icon name="clock-outline" size={16} color={ModernColors.textSecondary} />
                <Text style={styles.activityListDetailText}>
                  {activity.startTime} - {activity.endTime}
                </Text>
              </View>
              {activity.activity.location && (
                <View style={styles.activityListDetailRow}>
                  <Icon name="map-marker" size={16} color={ModernColors.textSecondary} />
                  <Text style={styles.activityListDetailText}>
                    {activity.activity.location}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMonthView = () => {
    const currentMonth = parseISO(selectedDate);

    return (
      <View>
        {renderDateNavigation(
          format(currentMonth, 'MMMM yyyy'),
          () => navigateMonth('prev'),
          () => navigateMonth('next')
        )}

        <Calendar
          current={selectedDate}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          markingType={'multi-dot'}
          hideArrows={true}
          hideExtraDays={false}
          disableMonthChange={true}
          theme={{
            backgroundColor: ModernColors.background,
            calendarBackground: ModernColors.background,
            textSectionTitleColor: ModernColors.textSecondary,
            selectedDayBackgroundColor: ModernColors.primary,
            selectedDayTextColor: ModernColors.background,
            todayTextColor: ModernColors.primary,
            dayTextColor: ModernColors.text,
            textDisabledColor: ModernColors.textMuted,
            dotColor: ModernColors.primary,
            selectedDotColor: ModernColors.background,
            arrowColor: ModernColors.primary,
            monthTextColor: 'transparent',
            textDayFontWeight: '400',
            textMonthFontWeight: '600',
            textDayHeaderFontWeight: '500',
            textDayFontSize: 16,
            textMonthFontSize: 0,
            textDayHeaderFontSize: 14,
          }}
          renderHeader={() => null}
        />
      </View>
    );
  };

  const renderWeekView = () => {
    const currentWeek = parseISO(selectedDate);
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Get all activities for the week, organized by day and hour
    const weekActivities: { [dateKey: string]: { [hour: number]: ExtendedChildActivity[] } } = {};

    weekDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      weekActivities[dateKey] = {};

      [...childrenWithActivities, ...sharedChildren]
        .filter(c => c.isVisible)
        .forEach(child => {
          child.activities
            .filter(a => a.scheduledDate === dateKey)
            .forEach(activity => {
              const startHour = parseInt(activity.startTime?.split(':')[0] || '0');
              if (!weekActivities[dateKey][startHour]) {
                weekActivities[dateKey][startHour] = [];
              }
              weekActivities[dateKey][startHour].push({
                ...activity,
                childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
                childColor: child.color,
              });
            });
        });
    });

    return (
      <View style={styles.weekContainer}>
        {renderDateNavigation(
          `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
          () => navigateWeek('prev'),
          () => navigateWeek('next')
        )}

        <ScrollView style={styles.weekVerticalScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekHorizontalScroll}>
            <View style={styles.weekGridContainer}>
              {/* Header row with day names and dates */}
              <View style={styles.weekHeaderRow}>
                <View style={styles.weekTimeColumn} />
                {weekDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const isToday = isSameDay(day, new Date());
                  const isSelected = dateKey === selectedDate;

                  return (
                    <TouchableOpacity
                      key={dateKey}
                      style={[
                        styles.weekDayHeader,
                        isToday && styles.weekDayHeaderToday,
                        isSelected && styles.weekDayHeaderSelected,
                      ]}
                      onPress={() => setSelectedDate(dateKey)}
                    >
                      <Text style={[
                        styles.weekDayHeaderName,
                        isToday && styles.weekDayHeaderTextToday,
                      ]}>
                        {format(day, 'EEE')}
                      </Text>
                      <Text style={[
                        styles.weekDayHeaderDate,
                        isToday && styles.weekDayHeaderTextToday,
                      ]}>
                        {format(day, 'd')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time slots grid */}
              {hours.map((hour) => (
                <View key={hour} style={styles.weekTimeRow}>
                  <View style={styles.weekTimeLabel}>
                    <Text style={styles.weekTimeLabelText}>
                      {hour.toString().padStart(2, '0')}:00
                    </Text>
                  </View>

                  {weekDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const hourActivities = weekActivities[dateKey][hour] || [];

                    return (
                      <View key={dateKey} style={styles.weekTimeSlot}>
                        {hourActivities.map((activity) => (
                          <TouchableOpacity
                            key={activity.id}
                            style={[
                              styles.weekActivityBlock,
                              { backgroundColor: activity.childColor + '20', borderLeftColor: activity.childColor }
                            ]}
                            onPress={() => handleActivityPress(activity)}
                          >
                            <Text style={styles.weekActivityBlockName} numberOfLines={1}>
                              {activity.activity.name}
                            </Text>
                            <Text style={styles.weekActivityBlockTime} numberOfLines={1}>
                              {activity.startTime}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    );
  };

  const renderDayView = () => {
    const currentDay = parseISO(selectedDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayActivities = [...childrenWithActivities, ...sharedChildren]
      .filter(c => c.isVisible)
      .flatMap(c => {
        return c.activities
          .filter(a => a.scheduledDate === selectedDate)
          .map(a => ({
            ...a,
            childName: c.isShared ? `${c.name} (${c.sharedBy})` : c.name,
            childColor: c.color,
          }));
      });

    return (
      <View style={styles.dayContainer}>
        {renderDateNavigation(
          format(currentDay, 'EEEE, MMMM d, yyyy'),
          () => navigateDay('prev'),
          () => navigateDay('next')
        )}
        <ScrollView style={styles.dayScroll}>
          <View style={styles.dayTimeline}>
            {hours.map((hour) => {
              const hourActivities = dayActivities.filter(a => {
                const startHour = parseInt(a.startTime?.split(':')[0] || '0');
                return startHour === hour;
              });

              return (
                <View key={hour} style={styles.dayHour}>
                  <Text style={styles.dayHourText}>
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                  <View style={styles.dayHourContent}>
                    {hourActivities.length > 0 ? (
                      hourActivities.map((activity) => (
                        <TouchableOpacity
                          key={activity.id}
                          style={[
                            styles.dayActivity,
                            { backgroundColor: activity.childColor + '15' },
                          ]}
                          onPress={() => handleActivityPress(activity)}
                        >
                          <View style={[styles.dayActivityIndicator, { backgroundColor: activity.childColor }]} />
                          <View style={styles.dayActivityContent}>
                            <Text style={styles.dayActivityName}>
                              {activity.activity.name}
                            </Text>
                            <Text style={styles.dayActivityChild}>
                              {activity.childName}
                            </Text>
                            <View style={styles.dayActivityDetails}>
                              <Icon name="clock-outline" size={12} color={ModernColors.textSecondary} />
                              <Text style={styles.dayActivityTime}>
                                {activity.startTime} - {activity.endTime}
                              </Text>
                              {activity.activity.location && (
                                <>
                                  <Icon name="map-marker" size={12} color={ModernColors.textSecondary} />
                                  <Text style={styles.dayActivityLocation}>
                                    {activity.activity.location}
                                  </Text>
                                </>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.dayEmptySlot} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderAgendaView = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      );
    }

    // Get activities for the next 30 days
    const allChildren = [...childrenWithActivities, ...sharedChildren];
    const upcomingActivities: Array<{ date: string; activities: any[] }> = [];

    for (let i = 0; i < 30; i++) {
      const date = format(addDays(new Date(), i), 'yyyy-MM-dd');
      const dayActivities: any[] = [];

      allChildren.forEach((child) => {
        if (!child.isVisible) return;

        child.activities
          .filter((activity) => activity.scheduledDate === date)
          .forEach((activity) => {
            dayActivities.push({
              ...activity,
              childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
              childColor: child.color,
            });
          });
      });

      if (dayActivities.length > 0) {
        upcomingActivities.push({ date, activities: dayActivities });
      }
    }

    if (upcomingActivities.length === 0) {
      return (
        <View style={styles.emptyAgenda}>
          <Icon name="calendar-blank" size={48} color={ModernColors.textSecondary} />
          <Text style={styles.emptyAgendaTitle}>No Activities Scheduled</Text>
          <Text style={styles.emptyAgendaText}>
            Activities will appear here when scheduled
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.agendaContainer}>
        {upcomingActivities.map(({ date, activities }) => (
          <View key={date} style={styles.agendaDateSection}>
            <Text style={styles.agendaDateHeader}>
              {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
            </Text>
            {activities.map((activity) => {
              const activityName = activity.activity?.name || 'Activity';
              const childName = activity.childName || 'Child';
              const startTime = activity.startTime || '00:00';
              const endTime = activity.endTime || '00:00';
              const childColor = activity.childColor || ModernColors.primary;
              const location = activity.activity?.location;

              return (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.agendaItem}
                  onPress={() => handleActivityPress(activity)}
                >
                  <View style={[styles.agendaItemIndicator, { backgroundColor: childColor }]} />
                  <View style={styles.agendaItemContent}>
                    <Text style={styles.agendaItemTitle}>{activityName}</Text>
                    <Text style={styles.agendaItemChild}>{childName}</Text>
                    <View style={styles.agendaItemDetails}>
                      <Icon name="clock-outline" size={14} color={ModernColors.textSecondary} />
                      <Text style={styles.agendaItemTime}>
                        {startTime} - {endTime}
                      </Text>
                      {location && (
                        <>
                          <Icon name="map-marker" size={14} color={ModernColors.textSecondary} />
                          <Text style={styles.agendaItemLocation}>{location}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderActivityModal = () => (
    <Modal
      visible={showActivityModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowActivityModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Activity Details</Text>
            <TouchableOpacity
              onPress={() => setShowActivityModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          {selectedActivity && (
            <View style={styles.modalBody}>
              <Text style={styles.activityName}>{selectedActivity.activity.name}</Text>
              {selectedActivity.activity.description && (
                <Text style={styles.activityDescription}>
                  {selectedActivity.activity.description}
                </Text>
              )}

              <View style={styles.activityDetailRow}>
                <Icon name="calendar" size={20} color={ModernColors.textSecondary} />
                <Text style={styles.activityDetailText}>
                  {selectedActivity.scheduledDate &&
                    format(parseISO(selectedActivity.scheduledDate), 'MMMM d, yyyy')}
                </Text>
              </View>

              <View style={styles.activityDetailRow}>
                <Icon name="clock-outline" size={20} color={ModernColors.textSecondary} />
                <Text style={styles.activityDetailText}>
                  {selectedActivity.startTime} - {selectedActivity.endTime}
                </Text>
              </View>

              {selectedActivity.activity.location && (
                <View style={styles.activityDetailRow}>
                  <Icon name="map-marker" size={20} color={ModernColors.textSecondary} />
                  <Text style={styles.activityDetailText}>
                    {selectedActivity.activity.location}
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => handleActivityEdit(selectedActivity)}
                >
                  <Text style={styles.modalButtonTextPrimary}>Edit Activity</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDanger]}
                  onPress={() => handleActivityDelete(selectedActivity)}
                >
                  <Text style={styles.modalButtonTextDanger}>Remove</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowActivityModal(false)}
                >
                  <Text style={styles.modalButtonTextSecondary}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Calendar</Text>
            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterContent}>
            {/* My Children */}
            <Text style={styles.filterSectionTitle}>My Children</Text>
            {childrenWithActivities.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={styles.filterItem}
                onPress={() => toggleChildVisibility(child.id, false)}
              >
                <View style={[styles.filterColorDot, { backgroundColor: child.color }]} />
                <Text style={styles.filterItemText}>{child.name}</Text>
                <Icon
                  name={child.isVisible ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color={child.isVisible ? ModernColors.primary : ModernColors.textSecondary}
                />
              </TouchableOpacity>
            ))}

            {/* Shared Children */}
            {sharedChildren.length > 0 && (
              <>
                <View style={styles.filterDivider} />
                <TouchableOpacity
                  style={styles.filterSectionHeader}
                  onPress={toggleSharedChildrenVisibility}
                >
                  <Text style={styles.filterSectionTitle}>Shared Children</Text>
                  <Icon
                    name={showSharedChildren ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={ModernColors.text}
                  />
                </TouchableOpacity>
                {showSharedChildren &&
                  sharedChildren.map((child) => (
                    <TouchableOpacity
                      key={child.id}
                      style={styles.filterItem}
                      onPress={() => toggleChildVisibility(child.id, true)}
                    >
                      <View style={[styles.filterColorDot, { backgroundColor: child.color }]} />
                      <View style={styles.filterItemContent}>
                        <Text style={styles.filterItemText}>{child.name}</Text>
                        <Text style={styles.filterItemSubtext}>
                          Shared by {child.sharedBy}
                        </Text>
                      </View>
                      <Icon
                        name={child.isVisible ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={24}
                        color={child.isVisible ? ModernColors.primary : ModernColors.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ModernColors.primary} />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopTabNavigation />

      <View style={styles.contentContainer}>
        <View style={styles.calendarActions}>
          {renderHeaderActions()}
        </View>

        {renderViewModeSelector()}
        {renderChildrenLegend()}

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'agenda' && renderAgendaView()}

          {/* Show activities list only for month, week, and day views */}
          {viewMode !== 'agenda' && renderActivitiesList()}
        </ScrollView>
      </View>

      {renderActivityModal()}
      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ModernColors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: ModernColors.textSecondary,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  calendarActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: ModernColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionButton: {
    padding: 8,
  },
  dateNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: ModernColors.background,
  },
  dateNavButton: {
    padding: 8,
  },
  dateNavigationText: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  legendContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: ModernColors.borderLight,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: ModernColors.text,
    maxWidth: 120,
  },
  activitiesListContainer: {
    padding: 20,
  },
  activitiesListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 16,
  },
  activityListItem: {
    backgroundColor: ModernColors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityListName: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    flex: 1,
    marginRight: 12,
  },
  activityListChildBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityListChildName: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityListDetails: {
    gap: 8,
  },
  activityListDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityListDetailText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
  },
  emptyActivitiesContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivitiesText: {
    fontSize: 14,
    color: ModernColors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: ModernColors.borderLight,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: ModernColors.background,
  },
  viewModeButtonActive: {
    backgroundColor: ModernColors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.text,
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  weekContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  weekVerticalScroll: {
    flex: 1,
  },
  weekHorizontalScroll: {
    flex: 1,
  },
  weekGridContainer: {
    flexDirection: 'column',
    minWidth: 760, // 60px time column + 100px * 7 days
  },
  weekHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: ModernColors.border,
    backgroundColor: ModernColors.background,
  },
  weekTimeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: ModernColors.borderLight,
  },
  weekDayHeader: {
    flex: 1,
    minWidth: 100,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: ModernColors.borderLight,
  },
  weekDayHeaderToday: {
    backgroundColor: ModernColors.primary + '10',
  },
  weekDayHeaderSelected: {
    backgroundColor: ModernColors.primary + '20',
  },
  weekDayHeaderName: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.textSecondary,
    textTransform: 'uppercase',
  },
  weekDayHeaderDate: {
    fontSize: 18,
    fontWeight: '700',
    color: ModernColors.text,
    marginTop: 4,
  },
  weekDayHeaderTextToday: {
    color: ModernColors.primary,
  },
  weekTimeRow: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  weekTimeLabel: {
    width: 60,
    paddingTop: 4,
    paddingRight: 8,
    alignItems: 'flex-end',
    borderRightWidth: 1,
    borderRightColor: ModernColors.borderLight,
  },
  weekTimeLabelText: {
    fontSize: 11,
    color: ModernColors.textSecondary,
    fontWeight: '500',
  },
  weekTimeSlot: {
    flex: 1,
    minWidth: 100,
    borderRightWidth: 1,
    borderRightColor: ModernColors.borderLight,
    padding: 2,
  },
  weekActivityBlock: {
    padding: 4,
    marginBottom: 2,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  weekActivityBlockName: {
    fontSize: 11,
    fontWeight: '600',
    color: ModernColors.text,
  },
  weekActivityBlockTime: {
    fontSize: 10,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  dayContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  dayHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  dayHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  dayScroll: {
    flex: 1,
  },
  dayTimeline: {
    paddingHorizontal: 20,
  },
  dayHour: {
    flexDirection: 'row',
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
    paddingVertical: 8,
  },
  dayHourText: {
    width: 50,
    fontSize: 12,
    color: ModernColors.textSecondary,
    paddingTop: 4,
  },
  dayHourContent: {
    flex: 1,
    paddingLeft: 12,
  },
  dayActivity: {
    flexDirection: 'row',
    padding: 8,
    marginBottom: 4,
    borderRadius: 8,
  },
  dayActivityIndicator: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 8,
  },
  dayActivityContent: {
    flex: 1,
  },
  dayActivityName: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.text,
  },
  dayActivityChild: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  dayActivityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  dayActivityTime: {
    fontSize: 11,
    color: ModernColors.textSecondary,
    marginRight: 8,
  },
  dayActivityLocation: {
    fontSize: 11,
    color: ModernColors.textSecondary,
  },
  dayEmptySlot: {
    height: 20,
  },
  agendaItem: {
    backgroundColor: ModernColors.background,
    flex: 1,
    borderRadius: 8,
    padding: 12,
    marginRight: 10,
    marginTop: 17,
    flexDirection: 'row',
  },
  firstAgendaItem: {
    marginTop: 8,
  },
  agendaItemIndicator: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  agendaItemContent: {
    flex: 1,
  },
  agendaItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  agendaItemChild: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    marginTop: 4,
  },
  agendaItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  agendaItemTime: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginRight: 12,
  },
  agendaItemLocation: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  emptyDate: {
    height: 60,
    flex: 1,
    paddingTop: 30,
    alignItems: 'center',
  },
  emptyDateText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
  },
  emptyAgenda: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyAgendaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyAgendaText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    textAlign: 'center',
  },
  agendaContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  agendaDateSection: {
    marginBottom: 20,
  },
  agendaDateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: ModernColors.borderLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ModernColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  activityName: {
    fontSize: 24,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 8,
  },
  activityDescription: {
    fontSize: 16,
    color: ModernColors.textSecondary,
    marginBottom: 20,
  },
  activityDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  activityDetailText: {
    fontSize: 16,
    color: ModernColors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: ModernColors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: ModernColors.borderLight,
  },
  modalButtonDanger: {
    backgroundColor: '#FF6B6B',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.background,
  },
  modalButtonTextDanger: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.background,
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  filterContent: {
    maxHeight: 400,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterDivider: {
    height: 1,
    backgroundColor: ModernColors.border,
    marginVertical: 8,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  filterItemContent: {
    flex: 1,
  },
  filterItemText: {
    fontSize: 14,
    color: ModernColors.text,
    flex: 1,
  },
  filterItemSubtext: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
});

export default CalendarScreenModernFixed;