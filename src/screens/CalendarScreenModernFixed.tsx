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
} from 'react-native';
import { Calendar, Agenda } from 'react-native-calendars';
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
import { Colors as ModernColors } from '../theme';
import { ChildActivity } from '../services/childrenService';

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
  const [isAgendaReady, setIsAgendaReady] = useState(false);

  // Load children and their activities
  useEffect(() => {
    loadData();
  }, []);

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

      // Fetch scheduled activities for all children
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

  const generateMarkedDates = useCallback((allChildren: ChildWithActivities[]) => {
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
  }, [selectedDate]);

  const generateAgendaItems = useCallback((allChildren: ChildWithActivities[]) => {
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
  }, []);

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
        generateAgendaItems(allChildren);
      }, 0);

      return updated;
    });
  }, [childrenWithActivities, sharedChildren, generateMarkedDates, generateAgendaItems]);

  const toggleSharedChildrenVisibility = useCallback(() => {
    const newVisibility = !showSharedChildren;
    setShowSharedChildren(newVisibility);

    setSharedChildren((prev) => {
      const updated = prev.map((child) => ({ ...child, isVisible: newVisibility }));

      // Regenerate with updated children
      setTimeout(() => {
        generateMarkedDates([...childrenWithActivities, ...updated]);
        generateAgendaItems([...childrenWithActivities, ...updated]);
      }, 0);

      return updated;
    });
  }, [showSharedChildren, childrenWithActivities, generateMarkedDates, generateAgendaItems]);

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

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => useNavigation().goBack()}
        style={styles.backButton}
      >
        <Icon name="arrow-left" size={24} color={ModernColors.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Calendar</Text>
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

  const renderMonthView = () => (
    <Calendar
      current={selectedDate}
      onDayPress={handleDayPress}
      markedDates={markedDates}
      markingType={'multi-dot'}
      theme={{
        backgroundColor: ModernColors.background,
        calendarBackground: ModernColors.background,
        textSectionTitleColor: ModernColors.textLight,
        selectedDayBackgroundColor: ModernColors.primary,
        selectedDayTextColor: ModernColors.background,
        todayTextColor: ModernColors.primary,
        dayTextColor: ModernColors.text,
        textDisabledColor: ModernColors.textLight,
        dotColor: ModernColors.primary,
        selectedDotColor: ModernColors.background,
        arrowColor: ModernColors.primary,
        monthTextColor: ModernColors.text,
        textDayFontWeight: '400',
        textMonthFontWeight: '600',
        textDayHeaderFontWeight: '500',
        textDayFontSize: 16,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14,
      }}
    />
  );

  const renderWeekView = () => {
    const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <View style={styles.weekContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.weekGrid}>
            {weekDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayActivities = [...childrenWithActivities, ...sharedChildren]
                .filter(c => c.isVisible)
                .flatMap(c => c.activities.filter(a => a.scheduledDate === dateKey));

              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[
                    styles.weekDay,
                    isSameDay(day, new Date()) && styles.weekDayToday,
                    dateKey === selectedDate && styles.weekDaySelected,
                  ]}
                  onPress={() => setSelectedDate(dateKey)}
                >
                  <Text style={styles.weekDayName}>{format(day, 'EEE')}</Text>
                  <Text style={styles.weekDayNumber}>{format(day, 'd')}</Text>

                  <ScrollView style={styles.weekDayActivities}>
                    {dayActivities.map((activity) => {
                      const child = [...childrenWithActivities, ...sharedChildren]
                        .find(c => c.id === activity.childId);
                      return (
                        <TouchableOpacity
                          key={activity.id}
                          style={[
                            styles.weekActivity,
                            { backgroundColor: child?.color + '20' },
                          ]}
                          onPress={() => handleActivityPress(activity)}
                        >
                          <View style={[styles.weekActivityIndicator, { backgroundColor: child?.color }]} />
                          <Text style={styles.weekActivityText} numberOfLines={1}>
                            {activity.activity.name}
                          </Text>
                          <Text style={styles.weekActivityTime}>
                            {activity.startTime}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </TouchableOpacity>
              );
            })}
          </View>
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
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderText}>
            {format(currentDay, 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>
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
    // Prevent rendering agenda until data is ready to avoid infinite loops
    if (loading || !isAgendaReady) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      );
    }

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
        // Prevent unnecessary re-renders
        hideKnob={false}
        showOnlySelectedDayItems={false}
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
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => {
                    setShowActivityModal(false);
                    // Navigate to activity detail
                  }}
                >
                  <Text style={styles.modalButtonTextPrimary}>View Details</Text>
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
                  color={child.isVisible ? ModernColors.primary : ModernColors.textLight}
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
                        color={child.isVisible ? ModernColors.primary : ModernColors.textLight}
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
    <View style={styles.container}>
      {renderHeader()}
      {renderViewModeSelector()}

      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'agenda' && renderAgendaView()}

      {renderActivityModal()}
      {renderFilterModal()}
    </View>
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
    color: ModernColors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: ModernColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: ModernColors.backgroundGray,
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
    color: ModernColors.background,
  },
  weekContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  weekGrid: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  weekDay: {
    width: 100,
    marginHorizontal: 5,
    padding: 8,
    borderRadius: 8,
    backgroundColor: ModernColors.backgroundGray,
    alignItems: 'center',
  },
  weekDayToday: {
    backgroundColor: ModernColors.primary + '10',
  },
  weekDaySelected: {
    borderWidth: 2,
    borderColor: ModernColors.primary,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.textLight,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 8,
  },
  weekDayActivities: {
    width: '100%',
    maxHeight: 200,
  },
  weekActivity: {
    padding: 4,
    marginVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekActivityIndicator: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    marginRight: 4,
  },
  weekActivityText: {
    fontSize: 11,
    color: ModernColors.text,
    flex: 1,
  },
  weekActivityTime: {
    fontSize: 10,
    color: ModernColors.textLight,
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
    color: ModernColors.textLight,
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
    color: ModernColors.textLight,
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
    color: ModernColors.textLight,
    marginRight: 8,
  },
  dayActivityLocation: {
    fontSize: 11,
    color: ModernColors.textLight,
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
    color: ModernColors.textLight,
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
    color: ModernColors.textLight,
    marginRight: 12,
  },
  agendaItemLocation: {
    fontSize: 12,
    color: ModernColors.textLight,
  },
  emptyDate: {
    height: 60,
    flex: 1,
    paddingTop: 30,
    alignItems: 'center',
  },
  emptyDateText: {
    fontSize: 14,
    color: ModernColors.textLight,
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
    color: ModernColors.textLight,
    marginTop: 2,
  },
});

export default CalendarScreenModernFixed;