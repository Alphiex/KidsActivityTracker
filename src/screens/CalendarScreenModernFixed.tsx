import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
import ScreenBackground from '../components/ScreenBackground';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import DateTimePicker from '@react-native-community/datetimepicker';
import { detectRescheduleConflicts, suggestAlternativeTimes, TimeSlot } from '../utils/conflictDetection';
import { parseTimeString, sortByTime } from '../utils/calendarUtils';
import ConflictWarning from '../components/ConflictWarning';
import ChildColorLegend from '../components/calendar/ChildColorLegend';
import calendarExportService from '../services/calendarExportService';
import AddEventModal, { CustomEvent } from '../components/calendar/AddEventModal';
import useSubscription from '../hooks/useSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';
import { aiRobotImage } from '../assets/images';

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

interface ExtendedChildActivity {
  id: string;
  childId: string;
  activityId: string;
  status: 'planned' | 'in_progress' | 'completed';
  addedAt?: Date;
  scheduledDate?: Date;
  startTime?: string;
  endTime?: string;
  notes?: string;
  recurring?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEnd?: Date;
  childName?: string;
  childColor?: string;
  activity?: {
    id: string;
    name: string;
    description?: string;
    location?: string | { name: string; address?: string; [key: string]: any };
    category?: string;
    [key: string]: any;
  };
}

const CalendarScreenModernFixed = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { children: myChildren } = useAppSelector((state) => state.children);
  const { user } = useAppSelector((state) => state.auth);

  // Subscription state for calendar export
  const {
    checkAndShowUpgrade,
    showUpgradeModal,
    upgradeFeature,
    hideUpgradeModal,
    hasCalendarExport,
  } = useSubscription();

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
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

  // Bulk operations state (Feature 7)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());

  // Reschedule state (Feature 3: Drag & Drop alternative)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleActivity, setRescheduleActivity] = useState<ChildActivity | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [rescheduleStartTime, setRescheduleStartTime] = useState(new Date());
  const [rescheduleEndTime, setRescheduleEndTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [rescheduleConflicts, setRescheduleConflicts] = useState<any[]>([]);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [alternativeTimes, setAlternativeTimes] = useState<TimeSlot[]>([]);

  // Add Event modal state
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [addEventDate, setAddEventDate] = useState<string | undefined>(undefined);

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

  // Note: useEffect for updating marked dates is defined after generateMarkedDates function

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
      let shared: any[] = [];
      try {
        shared = await childrenService.getSharedChildren();
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.warn('Error fetching shared children:', error);
        }
        // Continue with empty shared array if 404 or other error
      }

      // Get date range for fetching scheduled activities (12 months ahead)
      const startDate = startOfMonth(new Date());
      const endDate = endOfMonth(addMonths(new Date(), 12));

      // Fetch scheduled activities for all children with full activity details
      let scheduledActivities: any[] = [];
      if (myChildren && myChildren.length > 0) {
        const childIds = myChildren.map(c => c.id);
        try {
          scheduledActivities = await childrenService.getScheduledActivities(
            startDate,
            endDate,
            childIds
          );
          console.log('[CalendarScreen] Fetched scheduled activities:', scheduledActivities.length);
          console.log('[CalendarScreen] First activity:', JSON.stringify(scheduledActivities[0], null, 2));
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
      console.log('[CalendarScreen] myChildren:', myChildren.map(c => ({ id: c.id, name: c.name })));
      console.log('[CalendarScreen] enhancedActivities childIds:', enhancedActivities.map(a => a.childId));

      const processedChildren = myChildren.map((child, index) => {
        const childActivities = enhancedActivities.filter(a => a.childId === child.id);
        console.log(`[CalendarScreen] Child ${child.name} (${child.id}) has ${childActivities.length} activities`);
        return {
          ...child,
          color: CHILD_COLORS[index % CHILD_COLORS.length],
          isVisible: true,
          activities: childActivities,
        };
      });

      setChildrenWithActivities(processedChildren);

      // Fetch shared children's activities from the dedicated API endpoint
      let sharedChildrenActivities: { childId: string; childName: string; activities: any[] }[] = [];
      try {
        sharedChildrenActivities = await childrenService.getSharedChildrenActivities(
          startDate,
          endDate
        );
        console.log('[CalendarScreen] Fetched shared children activities:', sharedChildrenActivities.length, 'children');
      } catch (error) {
        console.warn('[CalendarScreen] Error fetching shared children activities:', error);
      }

      // Create a map of shared children activities by childId for quick lookup
      const sharedActivitiesMap = new Map<string, any[]>();
      for (const item of sharedChildrenActivities) {
        sharedActivitiesMap.set(item.childId, item.activities);
      }

      // Process shared children with their activities
      const processedShared = shared.map((sharedChild: any, index: number) => {
        const childId = sharedChild.childId || sharedChild.id;
        const activities = sharedActivitiesMap.get(childId) || [];

        return {
          id: childId,
          name: sharedChild.childName || sharedChild.name || `${sharedChild.ownerName}'s child`,
          color: CHILD_COLORS[(myChildren.length + index) % CHILD_COLORS.length],
          isVisible: showSharedChildren,
          isShared: true,
          sharedBy: sharedChild.ownerName || sharedChild.sharedBy,
          activities: activities,
        };
      });

      // Also add any shared children from activities that weren't in the shared list
      for (const item of sharedChildrenActivities) {
        const existsInProcessed = processedShared.some(p => p.id === item.childId);
        if (!existsInProcessed && item.activities.length > 0) {
          processedShared.push({
            id: item.childId,
            name: item.childName,
            color: CHILD_COLORS[(myChildren.length + processedShared.length) % CHILD_COLORS.length],
            isVisible: showSharedChildren,
            isShared: true,
            sharedBy: undefined,
            activities: item.activities,
          });
        }
      }

      console.log('[CalendarScreen] Processed shared children:', processedShared.map(c => ({
        id: c.id,
        name: c.name,
        activityCount: c.activities.length,
      })));

      setSharedChildren(processedShared);

      // Generate marked dates for calendar
      generateMarkedDates([...processedChildren, ...processedShared]);

    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to expand recurring activities into individual dates
  const expandActivityDates = (activity: ChildActivity): string[] => {
    const dates: string[] = [];

    // Check if activity has sessions in rawData (most specific and reliable)
    const rawDataSessions = (activity.activity as any)?.rawData?.sessions;
    if (rawDataSessions && Array.isArray(rawDataSessions) && rawDataSessions.length > 0) {
      rawDataSessions.forEach((session: any) => {
        if (session.date) {
          try {
            // Parse MM/DD/YY format (e.g., "10/19/25")
            const parts = session.date.split('/');
            if (parts.length === 3) {
              const month = parseInt(parts[0], 10);
              const day = parseInt(parts[1], 10);
              let year = parseInt(parts[2], 10);
              // Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx otherwise)
              if (year < 100) {
                year = year < 50 ? 2000 + year : 1900 + year;
              }
              const parsedDate = new Date(year, month - 1, day);
              if (!isNaN(parsedDate.getTime())) {
                const formattedDate = format(parsedDate, 'yyyy-MM-dd');
                dates.push(formattedDate);
                console.log('[expandActivityDates] Session date:', session.date, '→', formattedDate);
              }
            }
          } catch (e) {
            // Silently skip invalid dates
          }
        }
      });

      // If we found session dates, return them and skip other logic
      if (dates.length > 0) {
        console.log('[expandActivityDates] Activity', activity.id, 'has', dates.length, 'session dates from rawData');
        return [...new Set(dates)];
      }
    }

    // Otherwise, if activity has a specific scheduledDate, use that (fix timezone issue)
    if (activity.scheduledDate) {
      const dateStr = typeof activity.scheduledDate === 'string' ? activity.scheduledDate : activity.scheduledDate.toISOString();
      // Parse as UTC date to avoid timezone conversion
      const utcDate = new Date(dateStr);
      const formattedDate = format(new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()), 'yyyy-MM-dd');
      dates.push(formattedDate);
      console.log('[expandActivityDates] Activity', activity.id, 'has scheduledDate:', formattedDate);
    }

    // If activity has sessions, use those dates (most specific)
    if (activity.activity?.sessions && activity.activity.sessions.length > 0) {
      activity.activity.sessions.forEach((session) => {
        if (session.date) {
          try {
            // Try parsing as ISO format first
            let parsedDate;
            try {
              parsedDate = parseISO(session.date);
            } catch {
              // If that fails, try parsing MM/DD/YY format (e.g., "10/19/25")
              const parts = session.date.split('/');
              if (parts.length === 3) {
                const month = parseInt(parts[0], 10);
                const day = parseInt(parts[1], 10);
                let year = parseInt(parts[2], 10);
                // Convert 2-digit year to 4-digit (assume 20xx for years < 50, 19xx otherwise)
                if (year < 100) {
                  year = year < 50 ? 2000 + year : 1900 + year;
                }
                parsedDate = new Date(year, month - 1, day);
              }
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
              dates.push(format(parsedDate, 'yyyy-MM-dd'));
            }
          } catch (e) {
            // Silently skip invalid dates
          }
        }
      });
    }
    // Otherwise, if activity has dateRange, expand based on schedule
    else if (activity.activity?.dateRange || (activity.activity as any)?.dateStart) {
      let startDate: Date | undefined, endDate: Date | undefined;
      const activityData = activity.activity;

      // Handle both dateRange and dateStart/dateEnd formats
      if (activityData?.dateRange) {
        startDate = parseISO(activityData.dateRange.start as any);
        endDate = parseISO(activityData.dateRange.end as any);
      } else if ((activityData as any)?.dateStart && (activityData as any)?.dateEnd) {
        startDate = parseISO((activityData as any).dateStart);
        endDate = parseISO((activityData as any).dateEnd);
      }

      if (startDate && endDate) {
        // If activity has sessions with dayOfWeek, use those
        if (activityData?.sessions && activityData.sessions.length > 0) {
          const dayMap: { [key: string]: number } = {
            'sunday': 0, 'sun': 0,
            'monday': 1, 'mon': 1,
            'tuesday': 2, 'tue': 2, 'tues': 2,
            'wednesday': 3, 'wed': 3,
            'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
            'friday': 5, 'fri': 5,
            'saturday': 6, 'sat': 6,
          };

          const targetDays = (activityData?.sessions || [])
            .map((s: any) => s.dayOfWeek ? dayMap[s.dayOfWeek.toLowerCase()] : undefined)
            .filter((d: number | undefined): d is number => d !== undefined);

          if (targetDays.length > 0) {
            let currentDate = startDate;
            while (currentDate <= endDate) {
              if (targetDays.includes(currentDate.getDay())) {
                dates.push(format(currentDate, 'yyyy-MM-dd'));
              }
              currentDate = addDays(currentDate, 1);
            }
          }
        }
        // Otherwise, check if activity has a schedule object with days of week
        else if (activity.activity?.schedule && typeof activity.activity.schedule === 'object') {
          const schedule = activity.activity.schedule;
          if (schedule.days && Array.isArray(schedule.days)) {
            const dayMap: { [key: string]: number } = {
              'sunday': 0, 'sun': 0,
              'monday': 1, 'mon': 1,
              'tuesday': 2, 'tue': 2, 'tues': 2,
              'wednesday': 3, 'wed': 3,
              'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
              'friday': 5, 'fri': 5,
              'saturday': 6, 'sat': 6,
            };

            const targetDays = schedule.days.map(day => dayMap[day.toLowerCase()]).filter((d): d is number => d !== undefined);

            if (targetDays.length > 0) {
              let currentDate = startDate;
              while (currentDate <= endDate) {
                if (targetDays.includes(currentDate.getDay())) {
                  dates.push(format(currentDate, 'yyyy-MM-dd'));
                }
                currentDate = addDays(currentDate, 1);
              }
            }
          }
        }
        // Check if activity has top-level dayOfWeek array (from Activity model)
        else if ((activity.activity as any)?.dayOfWeek && Array.isArray((activity.activity as any).dayOfWeek)) {
          const dayMap: { [key: string]: number } = {
            'sunday': 0, 'sun': 0,
            'monday': 1, 'mon': 1,
            'tuesday': 2, 'tue': 2, 'tues': 2,
            'wednesday': 3, 'wed': 3,
            'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
            'friday': 5, 'fri': 5,
            'saturday': 6, 'sat': 6,
          };

          const dayOfWeekArray = (activity.activity as any).dayOfWeek;
          const targetDays = dayOfWeekArray
            .map((day: string) => dayMap[day.toLowerCase()])
            .filter((d: number | undefined): d is number => d !== undefined);

          if (targetDays.length > 0) {
            let currentDate = startDate;
            while (currentDate <= endDate) {
              if (targetDays.includes(currentDate.getDay())) {
                dates.push(format(currentDate, 'yyyy-MM-dd'));
              }
              currentDate = addDays(currentDate, 1);
            }
          } else {
            // If no valid days found, add all dates in range (activity occurs every day)
            let currentDate = startDate;
            while (currentDate <= endDate) {
              dates.push(format(currentDate, 'yyyy-MM-dd'));
              currentDate = addDays(currentDate, 1);
            }
          }
        }
        // If no dayOfWeek info at all, add all dates in range
        else if (dates.length === 0) {
          let currentDate = startDate;
          while (currentDate <= endDate) {
            dates.push(format(currentDate, 'yyyy-MM-dd'));
            currentDate = addDays(currentDate, 1);
          }
        }
      }
    }

    return [...new Set(dates)]; // Remove duplicates
  };

  const generateMarkedDates = useCallback((allChildren: ChildWithActivities[]) => {
    const dates: any = {};

    console.log('[generateMarkedDates] Processing', allChildren.length, 'children');

    allChildren.forEach((child) => {
      if (!child.isVisible) {
        console.log('[generateMarkedDates] Child', child.name, 'is not visible, skipping');
        return;
      }

      console.log('[generateMarkedDates] Child', child.name, 'has', child.activities.length, 'activities');

      child.activities.forEach((activity) => {
        // Expand activity to all its occurrence dates
        const occurrenceDates = expandActivityDates(activity);
        console.log('[generateMarkedDates] Activity', activity.id, 'expanded to', occurrenceDates.length, 'dates:', occurrenceDates);

        occurrenceDates.forEach((dateKey) => {
          if (!dates[dateKey]) {
            dates[dateKey] = { dots: [] };
          }
          dates[dateKey].dots.push({ color: child.color, key: `${activity.id}-${dateKey}` });
        });
      });
    });

    console.log('[generateMarkedDates] Final marked dates:', Object.keys(dates).length, 'dates with dots');
    console.log('[generateMarkedDates] Sample dates:', Object.keys(dates).slice(0, 5));
    console.log('[generateMarkedDates] Full markedDates object:', JSON.stringify(dates, null, 2));

    // Mark selected date
    dates[selectedDate] = {
      ...dates[selectedDate],
      selected: true,
      selectedColor: ModernColors.primary,
    };

    console.log('[generateMarkedDates] Setting markedDates with', Object.keys(dates).length, 'total dates');
    setMarkedDates(dates);
  }, [selectedDate]);

  // Update marked dates when selected date or children visibility changes
  useEffect(() => {
    if (childrenWithActivities.length > 0 || sharedChildren.length > 0) {
      generateMarkedDates([...childrenWithActivities, ...sharedChildren]);
    }
  }, [selectedDate, childrenWithActivities, sharedChildren, generateMarkedDates]);

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

        child.activities.forEach((activity) => {
          // Expand activity to all its occurrence dates
          const occurrenceDates = expandActivityDates(activity);

          // Check if this activity occurs on this date
          if (occurrenceDates.includes(date)) {
            items[date].push({
              ...activity,
              childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
              childColor: child.color,
            });
          }
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

  // Quick Add handlers for Feature 2
  const handleDayLongPress = (day: any) => {
    setQuickAddDate(day.dateString);
    setShowQuickAddModal(true);
  };

  const handleQuickAddActivity = () => {
    setShowQuickAddModal(false);
    // Navigate to search with pre-selected date
    navigation.navigate('SearchResults', {
      preselectedDate: quickAddDate,
      mode: 'schedule',
    });
  };

  const handleFabPress = () => {
    Alert.alert(
      'Add to Calendar',
      'What would you like to add?',
      [
        {
          text: 'Search Activities',
          onPress: () => {
            setQuickAddDate(selectedDate);
            setShowQuickAddModal(true);
          },
        },
        {
          text: 'Create Custom Event',
          onPress: () => {
            setAddEventDate(selectedDate);
            setShowAddEventModal(true);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleSaveCustomEvent = async (event: CustomEvent) => {
    try {
      // Create a custom activity via the API
      const scheduledDate = new Date(format(event.date, 'yyyy-MM-dd'));
      const startTimeStr = format(event.startTime, 'h:mm a').toLowerCase();
      const endTimeStr = format(event.endTime, 'h:mm a').toLowerCase();

      const response = await childrenService.addActivityToChild(
        event.childId,
        'custom-' + Date.now(), // Temporary activity ID for custom events
        'planned',
        scheduledDate,
        startTimeStr,
        endTimeStr
      );

      Alert.alert('Success', 'Event added to calendar');
      loadData(); // Refresh calendar
    } catch (error) {
      console.error('[Calendar] Failed to save custom event:', error);
      throw error;
    }
  };

  // Bulk operations handlers (Feature 7)
  const toggleActivitySelection = (activityId: string) => {
    const newSelection = new Set(selectedActivities);
    if (newSelection.has(activityId)) {
      newSelection.delete(activityId);
    } else {
      newSelection.add(activityId);
    }
    setSelectedActivities(newSelection);

    // Exit selection mode if no activities selected
    if (newSelection.size === 0) {
      setSelectionMode(false);
    }
  };

  const handleActivityLongPressForSelection = (activity: ChildActivity) => {
    if (!selectionMode) {
      setSelectionMode(true);
    }
    toggleActivitySelection(activity.id);
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Activities',
      `Remove ${selectedActivities.size} activities from calendar?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const allChildren = [...childrenWithActivities, ...sharedChildren];
              for (const activityId of selectedActivities) {
                // Find the child and activity details
                for (const child of allChildren) {
                  const activity = child.activities.find(a => a.id === activityId);
                  if (activity) {
                    await childrenService.removeActivityFromChild(child.id, activity.id);
                    break;
                  }
                }
              }
              setSelectionMode(false);
              setSelectedActivities(new Set());
              loadData();
            } catch (error) {
              console.error('Bulk delete failed:', error);
              Alert.alert('Error', 'Failed to delete some activities');
            }
          },
        },
      ]
    );
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedActivities(new Set());
  };

  // Reschedule handlers (Feature 3)
  const handleActivityLongPressForReschedule = (activity: ChildActivity) => {
    // Parse existing times
    const activityDate = activity.scheduledDate
      ? typeof activity.scheduledDate === 'string'
        ? parseISO(activity.scheduledDate)
        : activity.scheduledDate
      : new Date();

    // Parse start time
    let startDate = new Date(activityDate);
    if (activity.startTime) {
      const timeParts = activity.startTime.match(/(\d+):(\d+)\s*(am|pm)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        if (timeParts[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (timeParts[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
        startDate.setHours(hours, minutes);
      }
    }

    // Parse end time
    let endDate = new Date(activityDate);
    if (activity.endTime) {
      const timeParts = activity.endTime.match(/(\d+):(\d+)\s*(am|pm)?/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        if (timeParts[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (timeParts[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;
        endDate.setHours(hours, minutes);
      }
    } else {
      endDate.setHours(startDate.getHours() + 1);
    }

    setRescheduleActivity(activity);
    setRescheduleDate(activityDate);
    setRescheduleStartTime(startDate);
    setRescheduleEndTime(endDate);
    setShowRescheduleModal(true);
  };

  const checkRescheduleConflicts = () => {
    if (!rescheduleActivity) return;

    const allActivities = [
      ...childrenWithActivities.flatMap(c => c.activities),
      ...sharedChildren.flatMap(c => c.activities),
    ];

    const newSlot: TimeSlot = {
      date: format(rescheduleDate, 'yyyy-MM-dd'),
      startTime: format(rescheduleStartTime, 'HH:mm'),
      endTime: format(rescheduleEndTime, 'HH:mm'),
    };

    const conflicts = detectRescheduleConflicts(
      rescheduleActivity.id,
      newSlot,
      rescheduleActivity.childId,
      allActivities
    );

    if (conflicts.length > 0) {
      setRescheduleConflicts(conflicts);
      const alternatives = suggestAlternativeTimes(
        newSlot,
        rescheduleActivity.childId,
        allActivities,
        Math.round((rescheduleEndTime.getTime() - rescheduleStartTime.getTime()) / 60000)
      );
      setAlternativeTimes(alternatives);
      setShowConflictWarning(true);
    } else {
      confirmReschedule();
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleActivity) return;

    try {
      const newDate = format(rescheduleDate, 'yyyy-MM-dd');
      const newStartTime = format(rescheduleStartTime, 'h:mm a').toLowerCase();
      const newEndTime = format(rescheduleEndTime, 'h:mm a').toLowerCase();

      await childrenService.updateChildActivity(rescheduleActivity.id, {
        scheduledDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
      });

      setShowRescheduleModal(false);
      setShowConflictWarning(false);
      setRescheduleActivity(null);
      loadData();
      Alert.alert('Success', 'Activity rescheduled successfully');
    } catch (error) {
      console.error('Reschedule failed:', error);
      Alert.alert('Error', 'Failed to reschedule activity');
    }
  };

  const handleSelectAlternativeTime = (slot: TimeSlot) => {
    const [startHours, startMinutes] = slot.startTime.split(':').map(Number);
    const [endHours, endMinutes] = slot.endTime.split(':').map(Number);

    const newStart = new Date(rescheduleDate);
    newStart.setHours(startHours, startMinutes);

    const newEnd = new Date(rescheduleDate);
    newEnd.setHours(endHours, endMinutes);

    setRescheduleStartTime(newStart);
    setRescheduleEndTime(newEnd);
    setShowConflictWarning(false);

    // Re-check for conflicts with new time
    setTimeout(() => checkRescheduleConflicts(), 100);
  };

  // Share calendar functionality (Feature 8)
  const calendarRef = useRef<ViewShot>(null);

  const handleShareCalendar = async () => {
    try {
      if (calendarRef.current?.capture) {
        const uri = await calendarRef.current.capture();
        await Share.open({
          url: uri,
          type: 'image/png',
          title: `Calendar - ${format(parseISO(selectedDate), 'MMMM yyyy')}`,
          message: 'Shared from Kids Activity Tracker',
        });
      }
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Share failed:', error);
      }
    }
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
    // Check subscription for calendar export feature
    if (!hasCalendarExport) {
      checkAndShowUpgrade('calendar');
      return;
    }

    const allChildren = [...childrenWithActivities, ...sharedChildren];
    const activitiesToExport = allChildren
      .filter(c => c.isVisible)
      .flatMap(child =>
        child.activities
          .filter(a => a.activity)
          .map(a => ({
          id: a.activityId,
          childActivityId: a.id,
          name: a.activity!.name,
          description: a.activity!.description,
          location: a.activity!.location,
          scheduledDate: a.scheduledDate,
          dateStart: (a.activity as any)?.dateStart,
          dateEnd: (a.activity as any)?.dateEnd,
          startTime: a.startTime || (a.activity as any)?.startTime,
          endTime: a.endTime || (a.activity as any)?.endTime,
          dayOfWeek: (a.activity as any)?.dayOfWeek,
          childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
        }))
      );

    if (activitiesToExport.length === 0) {
      Alert.alert('No Activities', 'There are no visible activities to export.');
      return;
    }

    Alert.alert(
      'Export Calendar',
      `Export ${activitiesToExport.length} activities to:`,
      [
        {
          text: 'Native Calendar',
          onPress: () => exportToNativeCalendar(activitiesToExport),
        },
        {
          text: 'Share as ICS',
          onPress: () => shareAsICS(activitiesToExport),
        },
        {
          text: 'Google Calendar',
          onPress: () => exportToGoogleCalendar(activitiesToExport),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const exportToNativeCalendar = async (activities: any[]) => {
    try {
      const hasPermission = await calendarExportService.requestCalendarPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please grant calendar access in Settings to export activities.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await calendarExportService.exportActivitiesToCalendar(activities);

      Alert.alert(
        'Export Complete',
        `Successfully exported ${result.success} activities.${result.failed > 0 ? ` (${result.failed} failed)` : ''}`
      );
    } catch (error) {
      console.error('[Calendar] Export failed:', error);
      Alert.alert('Export Failed', 'Unable to export activities to calendar.');
    }
  };

  const shareAsICS = async (activities: any[]) => {
    try {
      const success = await calendarExportService.shareICSContent(
        activities,
        `kids-activities-${format(new Date(), 'yyyy-MM-dd')}.ics`
      );

      if (!success) {
        Alert.alert('Share Failed', 'Unable to share calendar file.');
      }
    } catch (error) {
      console.error('[Calendar] Share failed:', error);
      Alert.alert('Share Failed', 'Unable to share calendar file.');
    }
  };

  const exportToGoogleCalendar = (activities: any[]) => {
    if (activities.length === 0) return;

    const firstActivity = activities[0];
    const dateStr = firstActivity.scheduledDate || firstActivity.dateStart || format(new Date(), 'yyyy-MM-dd');
    const startDate = typeof dateStr === 'string' ? dateStr.substring(0, 10).replace(/-/g, '') : format(dateStr, 'yyyyMMdd');

    const text = encodeURIComponent(firstActivity.name);
    const details = encodeURIComponent(firstActivity.description || '');
    const locationStr = typeof firstActivity.location === 'string'
      ? firstActivity.location
      : (firstActivity.location?.name || firstActivity.location?.fullAddress || '');
    const location = encodeURIComponent(locationStr);

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${startDate}/${startDate}`;

    Linking.openURL(url);
  };

  // Removed - Filter and Export buttons moved to Children legend row

  const renderViewModeSelector = () => (
    <View style={styles.viewModeSelectorRow}>
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
              numberOfLines={1}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.aiPlanButtonWrapper}>
        <TouchableOpacity
          style={styles.aiPlanButtonContainer}
          onPress={() => navigation.navigate('WeeklyPlanner' as never)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#FFB5C5', '#E8638B', '#D53F8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiPlanButton}
          >
            <Text style={styles.aiPlanButtonText}>AI Plan</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Image source={aiRobotImage} style={styles.aiPlanRobotImage} />
      </View>
    </View>
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = parseISO(selectedDate);
    const newDate = direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    // Keep the same day of month when navigating, or use last day if month is shorter
    const newDateFormatted = format(newDate, 'yyyy-MM-dd');
    console.log('[navigateMonth] Moving from', selectedDate, 'to', newDateFormatted);
    setSelectedDate(newDateFormatted);
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
        .filter((activity) => {
          // Use expandActivityDates to check if activity occurs on this date
          // This handles Date objects, sessions, date ranges, etc.
          const occurrenceDates = expandActivityDates(activity);
          return occurrenceDates.includes(date);
        })
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
    const allChildren = [...childrenWithActivities, ...sharedChildren];

    if (allChildren.length === 0) {
      return null;
    }

    // Prepare legend items with activity counts
    const legendItems = allChildren.map(child => ({
      id: child.id,
      name: child.name,
      color: child.color,
      isVisible: child.isVisible,
      isShared: child.isShared,
      sharedBy: child.sharedBy,
      activityCount: child.activities.length,
    }));

    const handleToggle = (childId: string, isShared: boolean) => {
      toggleChildVisibility(childId, isShared);
    };

    return (
      <View style={styles.legendContainer}>
        <View style={styles.legendLeftSection}>
          <Text style={styles.legendTitle}>Children</Text>
          <ChildColorLegend
            children={legendItems}
            onToggleChild={handleToggle}
            showActivityCount={true}
            horizontal={true}
          />
        </View>
        <View style={styles.legendRightActions}>
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
            onPress={() => handleActivityPress(activity as any)}
          >
            <View style={styles.activityListHeader}>
              <Text style={styles.activityListName}>{activity.activity?.name || 'Unknown Activity'}</Text>
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
              {(activity.activity?.locationName || (typeof activity.activity?.location === 'object' ? activity.activity?.location?.name : activity.activity?.location)) && (
                <View style={styles.activityListDetailRow}>
                  <Icon name="map-marker" size={16} color={ModernColors.textSecondary} />
                  <Text style={styles.activityListDetailText}>
                    {activity.activity?.locationName || (typeof activity.activity?.location === 'object' ? activity.activity?.location?.name : activity.activity?.location)}
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
          onDayLongPress={handleDayLongPress}
          onMonthChange={(month: any) => {
            console.log('[Calendar] onMonthChange to:', month.dateString);
            // Sync selectedDate when month changes to keep calendar and state in sync
            setSelectedDate(month.dateString);
          }}
          markedDates={markedDates}
          markingType={'multi-dot'}
          hideArrows={true}
          hideExtraDays={false}
          disableMonthChange={false}
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
          child.activities.forEach(activity => {
            // Check if activity occurs on this date using expandActivityDates
            const occurrenceDates = expandActivityDates(activity);

            if (occurrenceDates.includes(dateKey)) {
              // Extract start hour from activity's startTime or sessions
              let startTimeStr = activity.startTime;

              // If no startTime on childActivity, try to get from sessions
              if (!startTimeStr && activity.activity?.sessions) {
                const matchingSession = activity.activity.sessions.find(s =>
                  s.dayOfWeek && s.dayOfWeek.toLowerCase() === format(day, 'EEEE').toLowerCase()
                );
                startTimeStr = matchingSession?.startTime;
              }

              // Parse hour from time string using proper AM/PM handling
              const parsedTime = parseTimeString(startTimeStr);
              const startHour = parsedTime ? parsedTime.hours : 0;

              if (!weekActivities[dateKey][startHour]) {
                weekActivities[dateKey][startHour] = [];
              }

              weekActivities[dateKey][startHour].push({
                ...activity,
                childName: child.isShared ? `${child.name} (${child.sharedBy})` : child.name,
                childColor: child.color,
              });
            }
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
                        {hourActivities.map((activity) => {
                          // Get time range for display
                          let timeDisplay = '';
                          let startTimeStr = activity.startTime;
                          let endTimeStr = activity.endTime;

                          // If not on childActivity, try to get from sessions
                          if (!startTimeStr && activity.activity?.sessions) {
                            const matchingSession = activity.activity.sessions.find((s: any) =>
                              s.dayOfWeek && s.dayOfWeek.toLowerCase() === format(day, 'EEEE').toLowerCase()
                            );
                            startTimeStr = matchingSession?.startTime;
                            endTimeStr = matchingSession?.endTime;
                          }

                          if (startTimeStr && endTimeStr) {
                            timeDisplay = `${startTimeStr} - ${endTimeStr}`;
                          } else if (startTimeStr) {
                            timeDisplay = startTimeStr;
                          }

                          return (
                            <TouchableOpacity
                              key={activity.id}
                              style={[
                                styles.weekActivityBlock,
                                { backgroundColor: activity.childColor + '20', borderLeftColor: activity.childColor }
                              ]}
                              onPress={() => handleActivityPress(activity as any)}
                              onLongPress={() => handleActivityLongPressForReschedule(activity as any)}
                              delayLongPress={400}
                            >
                              <View style={styles.weekActivityBlockHeader}>
                                <Text style={styles.weekActivityBlockName} numberOfLines={1}>
                                  {activity.activity?.name || 'Unknown'}
                                </Text>
                                <Icon name="drag" size={12} color={ModernColors.textMuted} />
                              </View>
                              {timeDisplay && (
                                <Text style={styles.weekActivityBlockTime} numberOfLines={1}>
                                  {timeDisplay}
                                </Text>
                              )}
                              <Text style={styles.weekActivityBlockChild} numberOfLines={1}>
                                {activity.childName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
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
          .filter(a => {
            // Check if activity occurs on this date using expandActivityDates
            const occurrenceDates = expandActivityDates(a);
            return occurrenceDates.includes(selectedDate);
          })
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
                // Get start time from activity or sessions
                let startTimeStr = a.startTime;

                if (!startTimeStr && a.activity?.sessions) {
                  const matchingSession = a.activity.sessions.find(s =>
                    s.dayOfWeek && s.dayOfWeek.toLowerCase() === format(currentDay, 'EEEE').toLowerCase()
                  );
                  startTimeStr = matchingSession?.startTime;
                }

                // Parse hour from time string using proper AM/PM handling
                const parsedTime = parseTimeString(startTimeStr);
                const startHour = parsedTime ? parsedTime.hours : 0;

                return startHour === hour;
              });

              return (
                <View key={hour} style={styles.dayHour}>
                  <Text style={styles.dayHourText}>
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                  <View style={styles.dayHourContent}>
                    {hourActivities.length > 0 ? (
                      hourActivities.map((activity) => {
                        // Get time range for display
                        let startTimeStr = activity.startTime;
                        let endTimeStr = activity.endTime;

                        if (!startTimeStr && activity.activity?.sessions) {
                          const matchingSession = activity.activity.sessions.find(s =>
                            s.dayOfWeek && s.dayOfWeek.toLowerCase() === format(currentDay, 'EEEE').toLowerCase()
                          );
                          startTimeStr = matchingSession?.startTime;
                          endTimeStr = matchingSession?.endTime;
                        }

                        const timeDisplay = startTimeStr && endTimeStr
                          ? `${startTimeStr} - ${endTimeStr}`
                          : startTimeStr || 'All day';

                        // Get location name
                        const locationName = typeof activity.activity?.location === 'string'
                          ? activity.activity?.location
                          : (activity.activity?.location as any)?.name || '';

                        return (
                          <TouchableOpacity
                            key={activity.id}
                            style={[
                              styles.dayActivity,
                              { backgroundColor: activity.childColor + '15' },
                            ]}
                            onPress={() => handleActivityPress(activity as any)}
                          >
                            <View style={[styles.dayActivityIndicator, { backgroundColor: activity.childColor }]} />
                            <View style={styles.dayActivityContent}>
                              <Text style={styles.dayActivityName}>
                                {activity.activity?.name || 'Unknown'}
                              </Text>
                              <Text style={styles.dayActivityChild}>
                                {activity.childName}
                              </Text>
                              <View style={styles.dayActivityDetails}>
                                <Icon name="clock-outline" size={12} color={ModernColors.textSecondary} />
                                <Text style={styles.dayActivityTime}>
                                  {timeDisplay}
                                </Text>
                                {locationName && (
                                  <>
                                    <Icon name="map-marker" size={12} color={ModernColors.textSecondary} style={{ marginLeft: 8 }} />
                                    <Text style={styles.dayActivityLocation}>
                                      {locationName}
                                    </Text>
                                  </>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })
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
          .filter((activity) => activity.scheduledDate && format(activity.scheduledDate, 'yyyy-MM-dd') === date)
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
              const locationName = activity.activity?.locationName || activity.activity?.location?.name || '';

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
                      {locationName && (
                        <>
                          <Icon name="map-marker" size={14} color={ModernColors.textSecondary} />
                          <Text style={styles.agendaItemLocation}>{locationName}</Text>
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
              <Text style={styles.activityName}>{selectedActivity.activity?.name || 'Unknown Activity'}</Text>
              {selectedActivity.activity?.description && (
                <Text style={styles.activityDescription}>
                  {selectedActivity.activity?.description}
                </Text>
              )}

              <View style={styles.activityDetailRow}>
                <Icon name="calendar" size={20} color={ModernColors.textSecondary} />
                <Text style={styles.activityDetailText}>
                  {selectedActivity.scheduledDate &&
                    format(selectedActivity.scheduledDate, 'MMMM d, yyyy')}
                </Text>
              </View>

              {(selectedActivity.startTime || selectedActivity.endTime) && (
                <View style={styles.activityDetailRow}>
                  <Icon name="clock-outline" size={20} color={ModernColors.textSecondary} />
                  <Text style={styles.activityDetailText}>
                    {selectedActivity.startTime || 'N/A'} - {selectedActivity.endTime || 'N/A'}
                  </Text>
                </View>
              )}

              {(selectedActivity.activity?.locationName || (typeof selectedActivity.activity?.location === 'object' ? selectedActivity.activity?.location?.name : selectedActivity.activity?.location)) && (
                <View style={styles.activityDetailRow}>
                  <Icon name="map-marker" size={20} color={ModernColors.textSecondary} />
                  <Text style={styles.activityDetailText}>
                    {selectedActivity.activity?.locationName || (typeof selectedActivity.activity?.location === 'object' ? (selectedActivity.activity?.location as any)?.name : selectedActivity.activity?.location)}
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

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TopTabNavigation />
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ModernColors.primary} />
            <Text style={styles.loadingText}>Loading calendar...</Text>
          </View>
        ) : (
          <>

        {/* Bulk Selection Toolbar */}
      {selectionMode && (
        <View style={styles.bulkToolbar}>
          <Text style={styles.bulkToolbarText}>
            {selectedActivities.size} selected
          </Text>
          <View style={styles.bulkToolbarActions}>
            <TouchableOpacity
              style={styles.bulkToolbarButton}
              onPress={handleBulkDelete}
            >
              <Icon name="trash-can-outline" size={22} color="#FF6B6B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkToolbarButton}
              onPress={handleShareCalendar}
            >
              <Icon name="share-variant" size={22} color={ModernColors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bulkToolbarButton}
              onPress={exitSelectionMode}
            >
              <Icon name="close" size={22} color={ModernColors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ViewShot ref={calendarRef} options={{ format: 'png', quality: 0.9 }} style={{ flex: 1 }}>
        <View style={styles.contentContainer}>
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
      </ViewShot>

      {renderActivityModal()}
      {renderFilterModal()}

      {/* Quick Add Modal */}
      <Modal
        visible={showQuickAddModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowQuickAddModal(false)}
      >
        <TouchableOpacity
          style={styles.quickAddOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickAddModal(false)}
        >
          <View style={styles.quickAddContent}>
            <View style={styles.quickAddHeader}>
              <Icon name="calendar-plus" size={32} color={ModernColors.primary} />
              <Text style={styles.quickAddTitle}>Add Activity</Text>
              <Text style={styles.quickAddDate}>
                {quickAddDate && format(parseISO(quickAddDate), 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>

            <View style={styles.quickAddActions}>
              <TouchableOpacity
                style={styles.quickAddButton}
                onPress={handleQuickAddActivity}
              >
                <Icon name="magnify" size={24} color={ModernColors.primary} />
                <Text style={styles.quickAddButtonText}>Browse Activities</Text>
                <Text style={styles.quickAddButtonSubtext}>Search and add an activity for this date</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAddButton}
                onPress={() => {
                  setShowQuickAddModal(false);
                  setViewMode('day');
                  if (quickAddDate) setSelectedDate(quickAddDate);
                }}
              >
                <Icon name="calendar-today" size={24} color={ModernColors.primary} />
                <Text style={styles.quickAddButtonText}>View Day</Text>
                <Text style={styles.quickAddButtonSubtext}>See all activities for this day</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.quickAddCancelButton}
              onPress={() => setShowQuickAddModal(false)}
            >
              <Text style={styles.quickAddCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reschedule Modal (Feature 3) */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rescheduleModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Activity</Text>
              <TouchableOpacity
                onPress={() => setShowRescheduleModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color={ModernColors.text} />
              </TouchableOpacity>
            </View>

            {rescheduleActivity && (
              <View style={styles.rescheduleBody}>
                <View style={styles.rescheduleActivityInfo}>
                  <Icon name="calendar-check" size={24} color={ModernColors.primary} />
                  <Text style={styles.rescheduleActivityName}>
                    {rescheduleActivity.activity?.name || 'Activity'}
                  </Text>
                </View>

                {/* Date Picker */}
                <TouchableOpacity
                  style={styles.reschedulePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="calendar" size={20} color={ModernColors.textSecondary} />
                  <Text style={styles.reschedulePickerLabel}>Date</Text>
                  <Text style={styles.reschedulePickerValue}>
                    {format(rescheduleDate, 'EEEE, MMMM d, yyyy')}
                  </Text>
                  <Icon name="chevron-right" size={20} color={ModernColors.textMuted} />
                </TouchableOpacity>

                {/* Start Time Picker */}
                <TouchableOpacity
                  style={styles.reschedulePickerButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Icon name="clock-start" size={20} color={ModernColors.textSecondary} />
                  <Text style={styles.reschedulePickerLabel}>Start Time</Text>
                  <Text style={styles.reschedulePickerValue}>
                    {format(rescheduleStartTime, 'h:mm a')}
                  </Text>
                  <Icon name="chevron-right" size={20} color={ModernColors.textMuted} />
                </TouchableOpacity>

                {/* End Time Picker */}
                <TouchableOpacity
                  style={styles.reschedulePickerButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Icon name="clock-end" size={20} color={ModernColors.textSecondary} />
                  <Text style={styles.reschedulePickerLabel}>End Time</Text>
                  <Text style={styles.reschedulePickerValue}>
                    {format(rescheduleEndTime, 'h:mm a')}
                  </Text>
                  <Icon name="chevron-right" size={20} color={ModernColors.textMuted} />
                </TouchableOpacity>

                <View style={styles.rescheduleActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => setShowRescheduleModal(false)}
                  >
                    <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={checkRescheduleConflicts}
                  >
                    <Text style={styles.modalButtonTextPrimary}>Reschedule</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* iOS Date Pickers */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setRescheduleDate(date);
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showStartTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={rescheduleStartTime}
                mode="time"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setRescheduleStartTime(date);
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showEndTimePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={rescheduleEndTime}
                mode="time"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setRescheduleEndTime(date);
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Conflict Warning */}
      <ConflictWarning
        visible={showConflictWarning}
        conflicts={rescheduleConflicts}
        newActivityName={rescheduleActivity?.activity?.name || 'Activity'}
        alternativeTimes={alternativeTimes}
        onProceed={() => {
          setShowConflictWarning(false);
          confirmReschedule();
        }}
        onCancel={() => setShowConflictWarning(false)}
        onSelectAlternative={handleSelectAlternativeTime}
      />

      {/* Add Event Modal */}
      <AddEventModal
        visible={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        onSave={handleSaveCustomEvent}
        children={childrenWithActivities.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: c.color || CHILD_COLORS[i % CHILD_COLORS.length],
        }))}
        initialDate={addEventDate}
      />

      {/* Upgrade Modal for Calendar Export */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        feature={upgradeFeature || 'calendar'}
        onClose={hideUpgradeModal}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleFabPress}
        activeOpacity={0.8}
      >
        <Icon name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>
          </>
        )}
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  dateNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeftSection: {
    flex: 1,
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
  legendRightActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: ModernColors.surface,
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
  viewModeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: ModernColors.borderLight,
    marginTop: 4,
    zIndex: 10,
  },
  viewModeContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ModernColors.background,
  },
  viewModeButtonActive: {
    backgroundColor: ModernColors.primary,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '500',
    color: ModernColors.text,
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  aiPlanButtonWrapper: {
    position: 'relative',
    marginLeft: 6,
    paddingRight: 15,
  },
  aiPlanButtonContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  aiPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    paddingRight: 20,
    borderRadius: 10,
    gap: 4,
  },
  aiPlanButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  aiPlanRobotImage: {
    position: 'absolute',
    right: -5,
    top: -12,
    width: 40,
    height: 40,
    resizeMode: 'contain',
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
  weekActivityBlockChild: {
    fontSize: 9,
    color: ModernColors.textMuted,
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
  // FAB (Floating Action Button) styles
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ModernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Quick Add Modal styles
  quickAddOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickAddContent: {
    backgroundColor: ModernColors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  quickAddHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  quickAddTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: ModernColors.text,
    marginTop: 12,
  },
  quickAddDate: {
    fontSize: 15,
    color: ModernColors.textSecondary,
    marginTop: 4,
  },
  quickAddActions: {
    gap: 12,
  },
  quickAddButton: {
    backgroundColor: ModernColors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: ModernColors.borderLight,
  },
  quickAddButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 8,
  },
  quickAddButtonSubtext: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    marginTop: 4,
  },
  quickAddCancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickAddCancelText: {
    fontSize: 16,
    color: ModernColors.textSecondary,
    fontWeight: '500',
  },
  // Bulk Selection Toolbar styles
  bulkToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: ModernColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  bulkToolbarText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  bulkToolbarActions: {
    flexDirection: 'row',
    gap: 16,
  },
  bulkToolbarButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: ModernColors.background,
  },
  // Week view activity block header
  weekActivityBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Reschedule Modal styles
  rescheduleModalContent: {
    backgroundColor: ModernColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  rescheduleBody: {
    paddingHorizontal: 20,
  },
  rescheduleActivityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
    marginBottom: 16,
  },
  rescheduleActivityName: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    flex: 1,
  },
  reschedulePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
    gap: 12,
  },
  reschedulePickerLabel: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    width: 80,
  },
  reschedulePickerValue: {
    fontSize: 16,
    color: ModernColors.text,
    flex: 1,
    textAlign: 'right',
  },
  rescheduleActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  // Picker Modal styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: ModernColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: '600',
    color: ModernColors.primary,
  },
});

export default CalendarScreenModernFixed;