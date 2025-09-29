import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format, parseISO, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, isSameDay, addMonths } from 'date-fns';
import { useAppSelector, useAppDispatch } from '../store';
import { fetchChildren } from '../store/slices/childrenSlice';
import childrenService from '../services/childrenService';
import TopTabNavigation from '../components/TopTabNavigation';

const ModernColors = {
  primary: '#FF385C',
  secondary: '#00A699',
  text: '#222222',
  textLight: '#717171',
  textExtraLight: '#B0B0B0',
  border: '#DDDDDD',
  borderLight: '#EBEBEB',
  background: '#FFFFFF',
  backgroundGray: '#F7F7F7',
  surface: '#FFFFFF',
  error: '#C13515',
  success: '#00A699',
  warning: '#FFB400',
  info: '#428BFF',
};

// Color palette for children (up to 10 distinct colors)
const CHILD_COLORS = [
  '#FF385C', // Red (Airbnb primary)
  '#00A699', // Teal
  '#FFB400', // Yellow
  '#428BFF', // Blue
  '#7B61FF', // Purple
  '#FF6B6B', // Coral
  '#51CF66', // Green
  '#FF922B', // Orange
  '#F06595', // Pink
  '#845EF7', // Violet
];

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

interface ChildWithActivities {
  id: string;
  name: string;
  dateOfBirth?: string;
  location?: string;
  color: string;
  isVisible: boolean;
  isShared?: boolean;
  activities: ChildActivity[];
}

interface ChildActivity {
  id: string;
  childId: string;
  activityId: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  status: string;
  activity: {
    id: string;
    name: string;
    description?: string;
    location?: string;
    category?: string;
  };
}

const CalendarScreenModern = () => {
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
  const [agendaItems, setAgendaItems] = useState<any>({});

  // Load children and their activities
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch user's children
      await dispatch(fetchChildren());

      // Fetch shared children
      const shared = await childrenService.getSharedChildren();

      // Get date range for fetching scheduled activities
      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(addMonths(new Date(), 2));

      // Fetch scheduled activities for all children
      const childIds = myChildren.map(c => c.id);
      const scheduledActivities = await childrenService.getScheduledActivities(
        startDate,
        endDate,
        childIds
      );

      // Mock additional activity data for now - will be replaced with actual activity details
      const enhancedActivities = scheduledActivities.map(sa => ({
        ...sa,
        activity: {
          id: sa.activityId,
          name: `Activity ${sa.activityId}`,
          description: 'Activity description',
          location: 'Activity location',
          category: 'General',
        },
      }));

      // Add some demo activities if no real data
      if (enhancedActivities.length === 0 && myChildren.length > 0) {
        enhancedActivities.push(
          {
            id: '1',
            childId: myChildren[0]?.id || '1',
            activityId: '1',
            scheduledDate: format(new Date(), 'yyyy-MM-dd'),
            startTime: '09:00',
            endTime: '10:30',
            status: 'scheduled',
            activity: {
              id: '1',
              name: 'Swimming Lessons',
              description: 'Beginner swimming class',
              location: 'Community Pool',
              category: 'Sports',
            },
          },
          {
            id: '2',
            childId: myChildren[0]?.id || '1',
            activityId: '2',
            scheduledDate: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
            startTime: '14:00',
            endTime: '15:00',
            status: 'scheduled',
            activity: {
              id: '2',
              name: 'Piano Practice',
              description: 'Weekly piano lesson',
              location: 'Music School',
              category: 'Music',
            },
          }
        );
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

      // Generate agenda items
      generateAgendaItems([...processedChildren, ...processedShared]);

    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMarkedDates = (allChildren: ChildWithActivities[]) => {
    const dates: any = {};

    allChildren.forEach((child) => {
      if (!child.isVisible) return;

      child.activities.forEach((activity) => {
        if (activity.scheduledDate) {
          const dateKey = activity.scheduledDate;
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
  };

  const generateAgendaItems = (allChildren: ChildWithActivities[]) => {
    const items: any = {};

    // Generate items for next 30 days
    for (let i = 0; i < 30; i++) {
      const date = format(addDays(new Date(), i), 'yyyy-MM-dd');
      items[date] = [];

      allChildren.forEach((child) => {
        if (!child.isVisible) return;

        child.activities
          .filter((activity) => activity.scheduledDate === date)
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

    setAgendaItems(items);
  };

  const toggleChildVisibility = (childId: string, isShared: boolean = false) => {
    if (isShared) {
      setSharedChildren((prev) =>
        prev.map((child) =>
          child.id === childId ? { ...child, isVisible: !child.isVisible } : child
        )
      );
    } else {
      setChildrenWithActivities((prev) =>
        prev.map((child) =>
          child.id === childId ? { ...child, isVisible: !child.isVisible } : child
        )
      );
    }

    // Regenerate marked dates and agenda items
    const allChildren = isShared
      ? [...childrenWithActivities, ...sharedChildren]
      : [...childrenWithActivities, ...sharedChildren];
    generateMarkedDates(allChildren);
    generateAgendaItems(allChildren);
  };

  const toggleSharedChildrenVisibility = () => {
    const newVisibility = !showSharedChildren;
    setShowSharedChildren(newVisibility);
    setSharedChildren((prev) =>
      prev.map((child) => ({ ...child, isVisible: newVisibility }))
    );

    // Regenerate marked dates and agenda items
    generateMarkedDates([...childrenWithActivities, ...sharedChildren]);
    generateAgendaItems([...childrenWithActivities, ...sharedChildren]);
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const handleActivityPress = (activity: ChildActivity) => {
    setSelectedActivity(activity);
    setShowActivityModal(true);
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
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const exportToIOSCalendar = async () => {
    try {
      // Generate ICS file content for iOS Calendar
      const icsEvents = [];
      const allChildren = [...childrenWithActivities, ...sharedChildren];

      allChildren.forEach((child) => {
        if (!child.isVisible) return;

        child.activities.forEach((activity) => {
          const startDate = activity.scheduledDate
            ? new Date(`${activity.scheduledDate}T${activity.startTime || '09:00'}`)
            : new Date();
          const endDate = activity.scheduledDate
            ? new Date(`${activity.scheduledDate}T${activity.endTime || '10:00'}`)
            : new Date();

          const event = [
            'BEGIN:VEVENT',
            `UID:${activity.id}@kidsactivitytracker`,
            `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}`,
            `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}`,
            `DTEND:${format(endDate, "yyyyMMdd'T'HHmmss")}`,
            `SUMMARY:${activity.activity.name} - ${child.name}`,
            `DESCRIPTION:${activity.activity.description || ''}`,
            activity.activity.location ? `LOCATION:${activity.activity.location}` : '',
            'END:VEVENT',
          ].filter(Boolean).join('\n');

          icsEvents.push(event);
        });
      });

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kids Activity Tracker//Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        ...icsEvents,
        'END:VCALENDAR',
      ].join('\n');

      // Create a data URI for the ICS file
      const dataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;

      // Open the ICS file in the default calendar app
      const supported = await Linking.canOpenURL(dataUri);
      if (supported) {
        await Linking.openURL(dataUri);
      } else {
        // Alternative: save to device and share
        Alert.alert(
          'Export Calendar',
          'Calendar exported! You can now import it into your calendar app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error exporting to iOS Calendar:', error);
      Alert.alert('Export Error', 'Failed to export calendar. Please try again.');
    }
  };

  const exportToGoogleCalendar = () => {
    try {
      // Generate Google Calendar links for all activities
      const allChildren = [...childrenWithActivities, ...sharedChildren];
      const googleEvents = [];

      allChildren.forEach((child) => {
        if (!child.isVisible) return;

        child.activities.forEach((activity) => {
          const startDate = activity.scheduledDate
            ? `${activity.scheduledDate.replace(/-/g, '')}T${(activity.startTime || '09:00').replace(/:/g, '')}00`
            : format(new Date(), 'yyyyMMddTHHmmss');
          const endDate = activity.scheduledDate
            ? `${activity.scheduledDate.replace(/-/g, '')}T${(activity.endTime || '10:00').replace(/:/g, '')}00`
            : format(addDays(new Date(), 0), 'yyyyMMddTHHmmss');

          const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: `${activity.activity.name} - ${child.name}`,
            dates: `${startDate}/${endDate}`,
            details: activity.activity.description || '',
            location: activity.activity.location || '',
          });

          const googleCalendarUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
          googleEvents.push({ url: googleCalendarUrl, name: activity.activity.name });
        });
      });

      if (googleEvents.length === 0) {
        Alert.alert('No Events', 'No visible events to export.');
        return;
      }

      // For multiple events, show a list to choose from
      if (googleEvents.length > 1) {
        Alert.alert(
          'Export to Google Calendar',
          'Multiple events found. Events will be opened one by one in Google Calendar.',
          [
            {
              text: 'Export All',
              onPress: async () => {
                for (const event of googleEvents) {
                  await Linking.openURL(event.url);
                  // Small delay between opening each URL
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        // Single event - open directly
        Linking.openURL(googleEvents[0].url);
      }
    } catch (error) {
      console.error('Error exporting to Google Calendar:', error);
      Alert.alert('Export Error', 'Failed to export calendar. Please try again.');
    }
  };

  const renderCalendarHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Activity Calendar</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Icon name="filter-variant" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={exportToCalendar}
          >
            <Icon name="export" size={24} color={ModernColors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View Mode Tabs */}
      <View style={styles.viewModeTabs}>
        {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.viewModeTab,
              viewMode === mode && styles.viewModeTabActive,
            ]}
            onPress={() => setViewMode(mode)}
          >
            <Text
              style={[
                styles.viewModeTabText,
                viewMode === mode && styles.viewModeTabTextActive,
              ]}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderChildFilter = () => (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.childFilterContainer}
        contentContainerStyle={styles.childFilterContent}
      >
        {/* Toggle for shared children */}
        {sharedChildren.length > 0 && (
          <TouchableOpacity
            style={[
              styles.childChip,
              styles.sharedChildrenToggle,
              !showSharedChildren && styles.childChipInactive,
            ]}
            onPress={toggleSharedChildrenVisibility}
          >
            <Icon
              name="account-group"
              size={16}
              color={showSharedChildren ? ModernColors.secondary : ModernColors.textLight}
            />
            <Text
              style={[
                styles.childChipText,
                !showSharedChildren && styles.childChipTextInactive,
              ]}
            >
              Friends & Family
            </Text>
          </TouchableOpacity>
        )}

        {/* My children */}
        {childrenWithActivities.map((child) => (
          <TouchableOpacity
            key={child.id}
            style={[
              styles.childChip,
              !child.isVisible && styles.childChipInactive,
            ]}
            onPress={() => toggleChildVisibility(child.id, false)}
          >
            <View
              style={[
                styles.childChipDot,
                { backgroundColor: child.color },
                !child.isVisible && styles.childChipDotInactive,
              ]}
            />
            <Text
              style={[
                styles.childChipText,
                !child.isVisible && styles.childChipTextInactive,
              ]}
            >
              {child.name}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Shared children */}
        {showSharedChildren && sharedChildren.map((child) => (
          <TouchableOpacity
            key={`shared-${child.id}`}
            style={[
              styles.childChip,
              styles.sharedChildChip,
              !child.isVisible && styles.childChipInactive,
            ]}
            onPress={() => toggleChildVisibility(child.id, true)}
          >
            <View
              style={[
                styles.childChipDot,
                { backgroundColor: child.color },
                !child.isVisible && styles.childChipDotInactive,
              ]}
            />
            <Text
              style={[
                styles.childChipText,
                !child.isVisible && styles.childChipTextInactive,
              ]}
            >
              {child.name}
            </Text>
            <Icon
              name="account-switch"
              size={12}
              color={child.isVisible ? ModernColors.secondary : ModernColors.textLight}
              style={styles.sharedIcon}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderMonthView = () => (
    <Calendar
      current={selectedDate}
      onDayPress={handleDayPress}
      markingType={'multi-dot'}
      markedDates={markedDates}
      theme={{
        backgroundColor: ModernColors.background,
        calendarBackground: ModernColors.background,
        textSectionTitleColor: ModernColors.textLight,
        selectedDayBackgroundColor: ModernColors.primary,
        selectedDayTextColor: ModernColors.background,
        todayTextColor: ModernColors.primary,
        dayTextColor: ModernColors.text,
        textDisabledColor: ModernColors.textExtraLight,
        dotColor: ModernColors.primary,
        selectedDotColor: ModernColors.background,
        arrowColor: ModernColors.primary,
        monthTextColor: ModernColors.text,
        textDayFontFamily: 'System',
        textMonthFontFamily: 'System',
        textDayHeaderFontFamily: 'System',
        textDayFontWeight: '400',
        textMonthFontWeight: '600',
        textDayHeaderFontWeight: '600',
        textDayFontSize: 16,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14,
      }}
    />
  );

  const renderWeekView = () => {
    const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const allChildren = [...childrenWithActivities, ...sharedChildren];
    const weekActivities: { [key: string]: ChildActivity[] } = {};

    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      weekActivities[dateKey] = [];

      allChildren.forEach((child) => {
        if (!child.isVisible) return;
        const dayActivities = child.activities.filter(
          (activity) => activity.scheduledDate === dateKey
        );
        weekActivities[dateKey].push(
          ...dayActivities.map((a) => ({
            ...a,
            childName: child.name,
            childColor: child.color,
          }))
        );
      });
    });

    return (
      <View style={styles.weekViewContainer}>
        {/* Week header */}
        <View style={styles.weekHeader}>
          <View style={styles.timeColumn} />
          {weekDays.map((day) => (
            <TouchableOpacity
              key={format(day, 'yyyy-MM-dd')}
              style={[
                styles.weekDayHeader,
                isSameDay(day, parseISO(selectedDate)) && styles.selectedDayHeader,
              ]}
              onPress={() => setSelectedDate(format(day, 'yyyy-MM-dd'))}
            >
              <Text
                style={[
                  styles.weekDayName,
                  isSameDay(day, parseISO(selectedDate)) && styles.selectedDayText,
                ]}
              >
                {format(day, 'EEE')}
              </Text>
              <Text
                style={[
                  styles.weekDayNumber,
                  isSameDay(day, parseISO(selectedDate)) && styles.selectedDayText,
                  isToday(day) && styles.todayText,
                ]}
              >
                {format(day, 'd')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Time grid */}
        <ScrollView style={styles.weekGridScroll}>
          <View style={styles.weekGrid}>
            {hours.map((hour) => (
              <View key={hour} style={styles.hourRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                </View>
                {weekDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const hourActivities = weekActivities[dateKey].filter((activity) => {
                    const activityHour = parseInt(activity.startTime?.split(':')[0] || '0');
                    return activityHour === hour;
                  });

                  return (
                    <View key={dateKey} style={styles.weekCell}>
                      {hourActivities.map((activity) => (
                        <TouchableOpacity
                          key={activity.id}
                          style={[
                            styles.weekActivity,
                            { backgroundColor: activity.childColor + '20', borderLeftColor: activity.childColor },
                          ]}
                          onPress={() => handleActivityPress(activity)}
                        >
                          <Text style={styles.weekActivityName} numberOfLines={1}>
                            {activity.activity.name}
                          </Text>
                          <Text style={styles.weekActivityTime} numberOfLines={1}>
                            {activity.startTime} - {activity.endTime}
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
      </View>
    );
  };

  const renderDayView = () => {
    const currentDay = parseISO(selectedDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const allChildren = [...childrenWithActivities, ...sharedChildren];

    const dayActivities: ChildActivity[] = [];
    allChildren.forEach((child) => {
      if (!child.isVisible) return;
      const activities = child.activities.filter(
        (activity) => activity.scheduledDate === selectedDate
      );
      dayActivities.push(
        ...activities.map((a) => ({
          ...a,
          childName: child.name,
          childColor: child.color,
        }))
      );
    });

    return (
      <View style={styles.dayViewContainer}>
        {/* Day header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderDate}>
            {format(currentDay, 'EEEE, MMMM d, yyyy')}
          </Text>
          {isToday(currentDay) && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>

        {/* Time slots */}
        <ScrollView style={styles.dayScrollView}>
          <View style={styles.dayTimeSlots}>
            {hours.map((hour) => {
              const hourActivities = dayActivities.filter((activity) => {
                const activityHour = parseInt(activity.startTime?.split(':')[0] || '0');
                return activityHour === hour;
              });

              return (
                <View key={hour} style={styles.dayHourSlot}>
                  <View style={styles.dayTimeLabel}>
                    <Text style={styles.dayTimeText}>
                      {hour.toString().padStart(2, '0')}:00
                    </Text>
                  </View>
                  <View style={styles.dayActivitiesColumn}>
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
                              <Icon name="clock-outline" size={12} color={ModernColors.textLight} />
                              <Text style={styles.dayActivityTime}>
                                {activity.startTime} - {activity.endTime}
                              </Text>
                              {activity.activity.location && (
                                <>
                                  <Icon name="map-marker" size={12} color={ModernColors.textLight} />
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
    // Ensure agendaItems is properly structured for the Agenda component
    const safeAgendaItems = agendaItems || {};

    return (
      <Agenda
        items={safeAgendaItems}
        selected={selectedDate}
        renderItem={(item: any, firstItemInDay: boolean) => {
          // Handle empty items
          if (!item || item.empty) {
            return (
              <View style={styles.emptyDate}>
                <Text style={styles.emptyDateText}>No activities scheduled</Text>
              </View>
            );
          }

          // Ensure we have the required data
          const activityName = item.activity?.name || 'Activity';
          const childName = item.childName || 'Child';
          const startTime = item.startTime || '00:00';
          const endTime = item.endTime || '00:00';
          const childColor = item.childColor || ModernColors.primary;
          const location = item.activity?.location;

          return (
            <TouchableOpacity
              style={[styles.agendaItem, firstItemInDay && styles.firstAgendaItem]}
              onPress={() => handleActivityPress(item)}
            >
              <View style={[styles.agendaItemIndicator, { backgroundColor: childColor }]} />
              <View style={styles.agendaItemContent}>
                <Text style={styles.agendaItemTitle}>{activityName}</Text>
                <Text style={styles.agendaItemChild}>{childName}</Text>
                <View style={styles.agendaItemDetails}>
                  <Icon name="clock-outline" size={14} color={ModernColors.textLight} />
                  <Text style={styles.agendaItemTime}>
                    {startTime} - {endTime}
                  </Text>
                  {location && (
                    <>
                      <Icon name="map-marker" size={14} color={ModernColors.textLight} />
                      <Text style={styles.agendaItemLocation}>{location}</Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        renderEmptyDate={() => (
          <View style={styles.emptyDate}>
            <Text style={styles.emptyDateText}>No activities</Text>
          </View>
        )}
        renderEmptyData={() => (
          <View style={styles.emptyAgenda}>
            <Icon name="calendar-blank" size={48} color={ModernColors.textLight} />
            <Text style={styles.emptyAgendaTitle}>No Activities Scheduled</Text>
            <Text style={styles.emptyAgendaText}>
              Activities will appear here when scheduled
            </Text>
          </View>
        )}
        rowHasChanged={(r1: any, r2: any) => {
          return r1.id !== r2.id;
        }}
        showClosingKnob={true}
        markingType={'dot'}
        theme={{
          backgroundColor: ModernColors.backgroundGray,
          calendarBackground: ModernColors.background,
          agendaKnobColor: ModernColors.primary,
          agendaDayTextColor: ModernColors.text,
          agendaDayNumColor: ModernColors.text,
          agendaTodayColor: ModernColors.primary,
          agendaMonthTextColor: ModernColors.text,
          selectedDayBackgroundColor: ModernColors.primary,
          selectedDayTextColor: ModernColors.background,
          dotColor: ModernColors.primary,
          selectedDotColor: ModernColors.background,
        }}
      />
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
                <Icon name="calendar" size={20} color={ModernColors.textLight} />
                <Text style={styles.activityDetailText}>
                  {selectedActivity.scheduledDate &&
                    format(parseISO(selectedActivity.scheduledDate), 'MMMM d, yyyy')}
                </Text>
              </View>

              <View style={styles.activityDetailRow}>
                <Icon name="clock-outline" size={20} color={ModernColors.textLight} />
                <Text style={styles.activityDetailText}>
                  {selectedActivity.startTime} - {selectedActivity.endTime}
                </Text>
              </View>

              {selectedActivity.activity.location && (
                <View style={styles.activityDetailRow}>
                  <Icon name="map-marker" size={20} color={ModernColors.textLight} />
                  <Text style={styles.activityDetailText}>
                    {selectedActivity.activity.location}
                  </Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]}>
                  <Text style={styles.modalButtonTextSecondary}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]}>
                  <Text style={styles.modalButtonTextPrimary}>Mark Complete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <TopTabNavigation />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopTabNavigation />
      {renderCalendarHeader()}
      {renderChildFilter()}

      <View style={styles.calendarContainer}>
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'agenda' && renderAgendaView()}
      </View>

      {renderActivityModal()}
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: ModernColors.textLight,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: ModernColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: ModernColors.backgroundGray,
  },
  viewModeTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: ModernColors.backgroundGray,
  },
  viewModeTabActive: {
    backgroundColor: ModernColors.primary,
  },
  viewModeTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.text,
  },
  viewModeTabTextActive: {
    color: ModernColors.background,
  },
  childFilterContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  childFilterContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: ModernColors.backgroundGray,
    marginRight: 8,
  },
  childChipInactive: {
    opacity: 0.5,
  },
  childChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  childChipDotInactive: {
    opacity: 0.5,
  },
  childChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.text,
  },
  childChipTextInactive: {
    color: ModernColors.textLight,
  },
  sharedChildrenToggle: {
    borderWidth: 1,
    borderColor: ModernColors.secondary,
  },
  sharedChildChip: {
    position: 'relative',
  },
  sharedIcon: {
    marginLeft: 4,
  },
  calendarContainer: {
    flex: 1,
  },
  agendaItem: {
    flexDirection: 'row',
    backgroundColor: ModernColors.background,
    borderRadius: 12,
    marginRight: 20,
    marginTop: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  agendaItemIndicator: {
    width: 4,
    backgroundColor: ModernColors.primary,
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
    marginBottom: 4,
  },
  agendaItemChild: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 8,
  },
  agendaItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agendaItemTime: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginRight: 12,
  },
  agendaItemLocation: {
    fontSize: 14,
    color: ModernColors.textLight,
  },
  emptyDate: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    marginTop: 10,
  },
  emptyDateText: {
    fontSize: 14,
    color: ModernColors.textLight,
  },
  // Week view styles
  weekViewContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  weekHeader: {
    flexDirection: 'row',
    backgroundColor: ModernColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
    paddingVertical: 8,
  },
  weekDayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedDayHeader: {
    backgroundColor: ModernColors.primary + '10',
    borderRadius: 8,
  },
  weekDayName: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  selectedDayText: {
    color: ModernColors.primary,
  },
  todayText: {
    color: ModernColors.secondary,
    fontWeight: '700',
  },
  weekGridScroll: {
    flex: 1,
  },
  weekGrid: {
    flexDirection: 'column',
  },
  hourRow: {
    flexDirection: 'row',
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  timeColumn: {
    width: 60,
    paddingRight: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 11,
    color: ModernColors.textLight,
  },
  weekCell: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: ModernColors.borderLight,
    padding: 2,
  },
  weekActivity: {
    backgroundColor: ModernColors.primary + '15',
    borderLeftWidth: 3,
    borderRadius: 4,
    padding: 4,
    marginBottom: 2,
  },
  weekActivityName: {
    fontSize: 10,
    fontWeight: '600',
    color: ModernColors.text,
  },
  weekActivityTime: {
    fontSize: 9,
    color: ModernColors.textLight,
  },
  // Day view styles
  dayViewContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  dayHeaderDate: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
    flex: 1,
  },
  todayBadge: {
    backgroundColor: ModernColors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    color: ModernColors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  dayScrollView: {
    flex: 1,
  },
  dayTimeSlots: {
    paddingBottom: 20,
  },
  dayHourSlot: {
    flexDirection: 'row',
    minHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  dayTimeLabel: {
    width: 70,
    paddingTop: 8,
    paddingRight: 12,
    alignItems: 'flex-end',
  },
  dayTimeText: {
    fontSize: 12,
    color: ModernColors.textLight,
  },
  dayActivitiesColumn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dayActivity: {
    flexDirection: 'row',
    backgroundColor: ModernColors.backgroundGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dayActivityIndicator: {
    width: 4,
    backgroundColor: ModernColors.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  dayActivityContent: {
    flex: 1,
  },
  dayActivityName: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 4,
  },
  dayActivityChild: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 8,
  },
  dayActivityDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dayActivityTime: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginLeft: 4,
    marginRight: 12,
  },
  dayActivityLocation: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginLeft: 4,
  },
  dayEmptySlot: {
    height: 1,
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
    color: ModernColors.textLight,
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
    backgroundColor: ModernColors.backgroundGray,
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.background,
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  firstAgendaItem: {
    marginTop: 8,
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
    color: ModernColors.textLight,
    textAlign: 'center',
  },
});

export default CalendarScreenModern;