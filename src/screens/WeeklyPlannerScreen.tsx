import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Animated,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Calendar } from 'react-native-calendars';
import aiService from '../services/aiService';
import ActivityService from '../services/activityService';
import childrenService, { ChildActivity } from '../services/childrenService';
import { WeeklySchedule, ScheduleEntry } from '../types/ai';
import { Activity } from '../types';

/** View mode for results display */
type ViewMode = 'weekly' | 'monthly';

/** Existing calendar activity with source marker */
interface ExistingActivity {
  childActivity: ChildActivity;
  activity: Activity | null;
  isExisting: true;
}
import { ModernColors, ModernShadows, ModernBorderRadius } from '../theme/modernTheme';
import { useAppSelector } from '../store';
import { selectAllChildren, ChildWithPreferences } from '../store/slices/childrenSlice';
import ScreenBackground from '../components/ScreenBackground';
import { aiRobotImage, getActivityImageByKey } from '../assets/images';
import { OptimizedActivityImage } from '../components/OptimizedActivityImage';
import { getActivityImageKey } from '../utils/activityHelpers';
import { formatActivityPrice } from '../utils/formatters';
import { ChildAvatar } from '../components/children';
import { getChildColor as getThemeChildColor } from '../theme/childColors';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const;
const TIME_SLOT_LABELS: Record<typeof TIME_SLOTS[number], string> = {
  morning: 'Morning\n6am-12pm',
  afternoon: 'Afternoon\n12pm-5pm',
  evening: 'Evening\n5pm-9pm',
};

/**
 * Get color for a child - uses child's colorId if available, falls back to index-based
 */
const getChildColor = (child: ChildWithPreferences | null, index: number): string => {
  if (child?.colorId) {
    return getThemeChildColor(child.colorId).hex;
  }
  // Fallback for backwards compatibility
  const fallbackColors = [
    ModernColors.primary,
    ModernColors.success,
    ModernColors.warning,
    '#06B6D4',
    '#8B5CF6',
  ];
  return fallbackColors[index % fallbackColors.length];
};

/**
 * Per-child availability slots
 */
interface ChildAvailability {
  childId: string;
  slots: {
    [day: string]: {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
    };
  };
}

/**
 * Entry approval state
 */
type ApprovalState = 'pending' | 'approved' | 'declined';

/**
 * Chat message for activity refinement
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  activityContext?: {
    childId: string;
    day: string;
    activityId: string;
    activityName: string;
  };
  suggestedActivity?: ScheduleEntry;
}

/**
 * Feedback history for AI context
 */
interface FeedbackHistory {
  activityId: string;
  feedback: string;
  timestamp: Date;
}

/**
 * Chat context for current refinement session
 */
interface ChatContext {
  childId: string;
  childName: string;
  day: string;
  entryIndex: number;
  currentActivityId: string;
  currentActivityName: string;
}

/**
 * Quick response option
 */
interface QuickResponse {
  label: string;
  value: string | null;
}

const QUICK_RESPONSES: QuickResponse[] = [
  { label: 'Too expensive', value: 'too expensive, looking for cheaper options' },
  { label: 'Too far', value: 'too far from our location, need something closer' },
  { label: 'Wrong time', value: 'the time doesn\'t work, need different hours' },
  { label: 'Not interested', value: 'this type of activity doesn\'t interest my child' },
  { label: 'Already tried', value: 'we\'ve already done this activity before' },
  { label: 'Other...', value: null },
];

/**
 * Generate a simple unique ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get the next Monday date
 */
function getNextMonday(): Date {
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday;
}

/**
 * Get end of current week (Sunday)
 */
function getEndOfWeek(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return endDate;
}

/**
 * Get summer date range (July 1 - August 31 of current/next year)
 */
function getSummerDateRange(): { start: Date; end: Date } {
  const today = new Date();
  let year = today.getFullYear();
  // If it's already past August, use next year's summer
  if (today.getMonth() > 7) {
    year += 1;
  }
  return {
    start: new Date(year, 6, 1), // July 1
    end: new Date(year, 7, 31),  // August 31
  };
}

/**
 * Calculate number of weeks between two dates
 */
function getWeeksBetween(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
}

/**
 * Get the start of week N within a date range
 */
function getWeekStartInRange(rangeStart: Date, weekIndex: number): Date {
  const weekStart = new Date(rangeStart);
  weekStart.setDate(rangeStart.getDate() + (weekIndex * 7));
  return weekStart;
}

/**
 * Date range preset type
 */
type DateRangePreset = 'this-week' | 'summer' | 'custom';

/**
 * Format date for display
 */
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
const toISODateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Initialize availability for all children - all slots enabled by default
 */
const initializeAvailability = (children: ChildWithPreferences[]): ChildAvailability[] => {
  return children.map(child => ({
    childId: child.id,
    slots: DAYS_OF_WEEK.reduce((acc, day) => ({
      ...acc,
      [day]: { morning: true, afternoon: true, evening: true },
    }), {}),
  }));
};

/**
 * Weekly Planner Screen
 * AI-generated optimal weekly activity schedule for families
 */
const WeeklyPlannerScreen = () => {
  const navigation = useNavigation();
  const children = useAppSelector(selectAllChildren);

  // Schedule state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuration state - Date range
  const [startDate, setStartDate] = useState<Date>(getNextMonday());
  const [endDate, setEndDate] = useState<Date>(getEndOfWeek(getNextMonday()));
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-week');
  const [allowGaps, setAllowGaps] = useState(true);

  // Configuration state - Other settings
  const [maxActivitiesPerChild, setMaxActivitiesPerChild] = useState(5);
  const [avoidBackToBack, setAvoidBackToBack] = useState(true);
  const [scheduleSiblingsTogether, setScheduleSiblingsTogether] = useState(false);
  const [childAvailability, setChildAvailability] = useState<ChildAvailability[]>([]);
  const [selectedChildTab, setSelectedChildTab] = useState(0);

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [currentViewWeek, setCurrentViewWeek] = useState(0); // Week index for viewing results
  const [_viewMode, _setViewMode] = useState<ViewMode>('weekly'); // Weekly or monthly view (future use)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [entryApprovals, setEntryApprovals] = useState<Record<string, ApprovalState>>({});

  // Existing calendar activities (user's pre-scheduled activities)
  const [existingActivities, setExistingActivities] = useState<ExistingActivity[]>([]);
  const [_loadingExisting, setLoadingExisting] = useState(false); // TODO: Show loading state for existing activities

  // Activity details cache (loaded from API when schedule is generated)
  const [activityDetails, setActivityDetails] = useState<Record<string, Activity>>({});
  const activityService = ActivityService.getInstance();

  // Chat state for activity refinement
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeChatContext, setActiveChatContext] = useState<ChatContext | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistory[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const chatScrollRef = React.useRef<FlatList>(null);

  // First-time explanation modal
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const EXPLANATION_SHOWN_KEY = 'weeklyPlannerExplanationShown';

  // Success animation modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Animation
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Initialize availability when children load
  useEffect(() => {
    if (children.length > 0 && childAvailability.length === 0) {
      setChildAvailability(initializeAvailability(children));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch existing calendar activities when date range changes
  useEffect(() => {
    const fetchExistingActivities = async () => {
      if (children.length === 0) return;

      setLoadingExisting(true);
      try {
        const childIds = children.map(c => c.id);
        const scheduledActivities = await childrenService.getScheduledActivities(
          startDate,
          endDate,
          childIds
        );

        // Convert to ExistingActivity format and fetch activity details
        const existing: ExistingActivity[] = [];
        for (const ca of scheduledActivities) {
          let activity: Activity | null = null;
          if (ca.activityId && !activityDetails[ca.activityId]) {
            try {
              activity = await activityService.getActivityDetails(ca.activityId);
              if (activity) {
                setActivityDetails(prev => ({ ...prev, [ca.activityId]: activity! }));
              }
            } catch {
              // Activity details not available
            }
          } else if (ca.activityId) {
            activity = activityDetails[ca.activityId] || null;
          }

          existing.push({
            childActivity: ca,
            activity: activity || ca.activity || null,
            isExisting: true,
          });
        }

        setExistingActivities(existing);
      } catch (error) {
        console.error('Error fetching existing activities:', error);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExistingActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, children]);

  // Get unique child IDs from schedule
  const childIdsInSchedule = useMemo(() => {
    if (!schedule) return [];
    return [...new Set(Object.values(schedule.entries).flat().map(e => e.child_id))];
  }, [schedule]);

  // Get child info by ID
  const getChildInfo = useCallback((childId: string) => {
    const index = children.findIndex(c => c.id === childId);
    const child = children[index] || null;
    return {
      name: child?.name || 'Child',
      color: getChildColor(child, index >= 0 ? index : 0),
      index,
      child,
    };
  }, [children]);

  // Calculate total weeks in selected range
  const totalWeeks = useMemo(() => {
    return getWeeksBetween(startDate, endDate);
  }, [startDate, endDate]);

  // Get the start date for the currently viewed week
  const currentWeekStartDate = useMemo(() => {
    return getWeekStartInRange(startDate, currentViewWeek);
  }, [startDate, currentViewWeek]);

  /**
   * Apply a date range preset
   */
  const applyDatePreset = useCallback((preset: DateRangePreset) => {
    setDateRangePreset(preset);
    setCurrentViewWeek(0);

    if (preset === 'this-week') {
      const monday = getNextMonday();
      setStartDate(monday);
      setEndDate(getEndOfWeek(monday));
    } else if (preset === 'summer') {
      const summer = getSummerDateRange();
      setStartDate(summer.start);
      setEndDate(summer.end);
    }
    // 'custom' keeps current dates
  }, []);

  /**
   * Open date picker for start or end date
   */
  const openDatePicker = useCallback((mode: 'start' | 'end') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  }, []);

  /**
   * Generate AI schedule
   */
  const generateSchedule = async () => {
    if (children.length === 0) {
      setError('Please add children to your profile first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build availability constraint for API
      const availabilityForApi = childAvailability.map(ca => ({
        child_id: ca.childId,
        available_slots: ca.slots,
      }));

      const result = await aiService.planWeek(toISODateString(startDate), {
        end_date: toISODateString(endDate),
        max_activities_per_child: maxActivitiesPerChild,
        avoid_back_to_back: avoidBackToBack,
        schedule_siblings_together: scheduleSiblingsTogether,
        allow_gaps: allowGaps,
        child_availability: availabilityForApi,
      });

      if (result.success && result.schedule) {
        setSchedule(result.schedule);
        // Initialize all entries as pending
        const approvals: Record<string, ApprovalState> = {};
        Object.values(result.schedule.entries).flat().forEach((entry, idx) => {
          const key = `${entry.child_id}-${entry.activity_id}-${entry.day}-${idx}`;
          approvals[key] = 'pending';
        });
        setEntryApprovals(approvals);

        // Load activity details for all activities in the schedule
        const activityIds = [...new Set(Object.values(result.schedule.entries).flat().map(e => e.activity_id))];
        const details: Record<string, Activity> = {};
        await Promise.all(activityIds.map(async (id) => {
          try {
            const activity = await activityService.getActivityDetails(id);
            if (activity) {
              details[id] = activity;
            }
          } catch (err) {
            console.warn('Failed to load activity details for', id);
          }
        }));
        setActivityDetails(details);

        // Show explanation modal on first schedule generation
        try {
          const hasSeenExplanation = await AsyncStorage.getItem(EXPLANATION_SHOWN_KEY);
          if (!hasSeenExplanation) {
            setShowExplanationModal(true);
          }
        } catch (storageErr) {
          console.warn('Failed to check explanation status:', storageErr);
        }
      } else {
        setError(result.error || 'Failed to generate schedule');
      }
    } catch (err: any) {
      console.error('Schedule generation error:', err);
      setError('Failed to generate schedule. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle availability slot
   */
  const toggleAvailability = (childId: string, day: string, slot: typeof TIME_SLOTS[number]) => {
    setChildAvailability(prev => prev.map(ca => {
      if (ca.childId !== childId) return ca;
      return {
        ...ca,
        slots: {
          ...ca.slots,
          [day]: {
            ...ca.slots[day],
            [slot]: !ca.slots[day][slot],
          },
        },
      };
    }));
  };

  /**
   * Toggle all slots for a day
   */
  const toggleDayAll = (childId: string, day: string) => {
    setChildAvailability(prev => prev.map(ca => {
      if (ca.childId !== childId) return ca;
      const allEnabled = TIME_SLOTS.every(slot => ca.slots[day][slot]);
      return {
        ...ca,
        slots: {
          ...ca.slots,
          [day]: {
            morning: !allEnabled,
            afternoon: !allEnabled,
            evening: !allEnabled,
          },
        },
      };
    }));
  };

  /**
   * Navigate to activity details
   */
  const handleActivityPress = (entry: ScheduleEntry) => {
    navigation.navigate('ActivityDetail' as never, { id: entry.activity_id } as never);
  };

  /**
   * Get declined activity IDs for exclusion
   */
  const getDeclinedActivityIds = useCallback((): string[] => {
    return Object.entries(entryApprovals)
      .filter(([_, state]) => state === 'declined')
      .map(([key]) => {
        const parts = key.split('-');
        return parts.length >= 2 ? parts[1] : null;
      })
      .filter(Boolean) as string[];
  }, [entryApprovals]);

  /**
   * Open chat panel for refining an activity
   */
  const openChatForActivity = useCallback((entry: ScheduleEntry, uniqueKey: string, entryIndex: number) => {
    const { name: childName } = getChildInfo(entry.child_id);

    // Set chat context
    setActiveChatContext({
      childId: entry.child_id,
      childName,
      day: entry.day,
      entryIndex,
      currentActivityId: entry.activity_id,
      currentActivityName: entry.activity_name,
    });

    // Clear previous messages and add initial AI message
    setChatMessages([{
      id: generateId(),
      role: 'assistant',
      content: `I noticed "${entry.activity_name}" isn't quite right for ${childName}. What didn't work about it?`,
      timestamp: new Date(),
      activityContext: {
        childId: entry.child_id,
        day: entry.day,
        activityId: entry.activity_id,
        activityName: entry.activity_name,
      },
    }]);

    // Reset state
    setChatInputText('');
    setShowOtherInput(false);

    // Show chat panel
    setShowChat(true);
  }, [getChildInfo]);

  /**
   * Handle chat message submission
   */
  const handleChatSubmit = useCallback(async (feedback: string) => {
    if (!activeChatContext || !feedback.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: feedback,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInputText('');
    setShowOtherInput(false);

    // Store feedback for future context
    setFeedbackHistory(prev => [...prev, {
      activityId: activeChatContext.currentActivityId,
      feedback,
      timestamp: new Date(),
    }]);

    setIsChatLoading(true);

    try {
      // Get declined activity IDs
      const excludedIds = getDeclinedActivityIds();
      excludedIds.push(activeChatContext.currentActivityId);

      // Request AI to find alternative with feedback context
      const result = await aiService.findAlternativeActivity({
        child_id: activeChatContext.childId,
        day: activeChatContext.day,
        time_slot: schedule?.entries[activeChatContext.day]?.[activeChatContext.entryIndex]?.time || 'morning',
        excluded_activity_ids: excludedIds,
        week_start: toISODateString(currentWeekStartDate),
      });

      if (result.success && result.alternative) {
        // Load activity details for the suggestion
        let activityDetail: Activity | null = null;
        try {
          activityDetail = await activityService.getActivityDetails(result.alternative.activity_id);
          if (activityDetail) {
            setActivityDetails(prev => ({ ...prev, [result.alternative!.activity_id]: activityDetail! }));
          }
        } catch (err) {
          console.warn('Failed to load alternative activity details');
        }

        // Add AI response with suggested activity
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `Based on your feedback, here's an alternative that might work better:`,
          timestamp: new Date(),
          suggestedActivity: result.alternative,
        };
        setChatMessages(prev => [...prev, aiMessage]);

        // Scroll to bottom
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        // No alternatives found
        const aiMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: "I couldn't find a better match with those criteria. Would you like to skip this time slot, or try different feedback?",
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: "Sorry, I had trouble finding alternatives. Please try again.",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [activeChatContext, schedule, currentWeekStartDate, getDeclinedActivityIds, activityService]);

  /**
   * Handle quick response selection
   */
  const handleQuickResponse = useCallback((response: QuickResponse) => {
    if (response.value === null) {
      // "Other..." was selected - show text input
      setShowOtherInput(true);
    } else {
      // Send the quick response as feedback
      handleChatSubmit(response.value);
    }
  }, [handleChatSubmit]);

  /**
   * Accept a suggested activity from chat
   */
  const handleAcceptFromChat = useCallback((suggestedActivity: ScheduleEntry) => {
    if (!activeChatContext) return;

    // Update schedule with new activity
    setSchedule(prev => {
      if (!prev) return prev;
      const newEntries = { ...prev.entries };
      const dayEntries = [...(newEntries[activeChatContext.day] || [])];
      if (activeChatContext.entryIndex < dayEntries.length) {
        dayEntries[activeChatContext.entryIndex] = suggestedActivity;
        newEntries[activeChatContext.day] = dayEntries;
      }
      return { ...prev, entries: newEntries };
    });

    // Update approval state
    const oldKey = `${activeChatContext.childId}-${activeChatContext.currentActivityId}-${activeChatContext.day}-${activeChatContext.entryIndex}`;
    const newKey = `${suggestedActivity.child_id}-${suggestedActivity.activity_id}-${suggestedActivity.day}-${activeChatContext.entryIndex}`;
    setEntryApprovals(prev => {
      const updated = { ...prev };
      delete updated[oldKey];
      updated[newKey] = 'approved';
      return updated;
    });

    // Close chat
    setShowChat(false);
    setActiveChatContext(null);
  }, [activeChatContext]);

  /**
   * Decline a suggested activity in chat and request another
   */
  const handleDeclineFromChat = useCallback((suggestedActivity: ScheduleEntry) => {
    // Add to feedback history
    setFeedbackHistory(prev => [...prev, {
      activityId: suggestedActivity.activity_id,
      feedback: 'declined without specific feedback',
      timestamp: new Date(),
    }]);

    // Add another AI message asking for feedback
    const aiMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: `Got it, "${suggestedActivity.activity_name}" isn't right either. What would you prefer instead?`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, aiMessage]);
  }, []);

  /**
   * Close chat panel
   */
  const closeChat = useCallback(() => {
    setShowChat(false);
    setActiveChatContext(null);
    setChatMessages([]);
    setShowOtherInput(false);
  }, []);

  /**
   * Dismiss explanation modal and mark as seen
   */
  const dismissExplanationModal = useCallback(async () => {
    setShowExplanationModal(false);
    try {
      await AsyncStorage.setItem(EXPLANATION_SHOWN_KEY, 'true');
    } catch (err) {
      console.warn('Failed to save explanation status:', err);
    }
  }, [EXPLANATION_SHOWN_KEY]);

  /**
   * Legacy function for backwards compatibility - now opens chat
   */
  const handleFindDifferent = useCallback((entry: ScheduleEntry, uniqueKey: string, entryIndex: number) => {
    openChatForActivity(entry, uniqueKey, entryIndex);
  }, [openChatForActivity]);

  /**
   * Add approved activities to calendar
   */
  const addApprovedToCalendar = async () => {
    if (!schedule) return;

    const approvedEntries = Object.entries(entryApprovals)
      .filter(([_, state]) => state === 'approved')
      .map(([key]) => {
        // Parse key: childId-activityId-day-entryIndex
        const parts = key.split('-');
        const childId = parts[0];
        const activityId = parts[1];
        const day = parts.slice(2, -1).join('-'); // Day might have dashes
        return { childId, activityId, day };
      });

    if (approvedEntries.length === 0) return;

    try {
      // Add each approved activity to the child's calendar
      for (const entry of approvedEntries) {
        const scheduleEntry = Object.values(schedule.entries)
          .flat()
          .find(e => e.child_id === entry.childId && e.activity_id === entry.activityId);

        if (scheduleEntry) {
          // Calculate the scheduled date based on the day of week and current week start
          const dayIndex = DAYS_OF_WEEK.indexOf(scheduleEntry.day);
          const scheduledDate = new Date(currentWeekStartDate);
          scheduledDate.setDate(scheduledDate.getDate() + dayIndex);

          await childrenService.addActivityToChild(
            entry.childId,
            entry.activityId,
            'planned',
            scheduledDate,
            scheduleEntry.time
          );
        }
      }

      // Show success animation
      setSuccessMessage(`Added ${approvedEntries.length} ${approvedEntries.length === 1 ? 'activity' : 'activities'} to calendar!`);
      setShowSuccessModal(true);

      // Auto-hide after 2 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
        clearSchedule();
      }, 2000);

    } catch (err: any) {
      console.error('Error adding to calendar:', err);
      setError('Failed to add activities to calendar. Please try again.');
    }
  };

  /**
   * Regenerate alternatives for all declined entries
   */
  const regenerateDeclined = async () => {
    if (!schedule) return;

    const declinedKeys = Object.entries(entryApprovals)
      .filter(([_, state]) => state === 'declined')
      .map(([key]) => key);

    if (declinedKeys.length === 0) return;

    setIsRegenerating(true);
    setError(null);

    try {
      // Get all declined activity IDs to exclude
      const excludedIds = getDeclinedActivityIds();

      // For each declined entry, try to find an alternative
      for (const key of declinedKeys) {
        const parts = key.split('-');
        const childId = parts[0];
        const day = parts.slice(2, -1).join('-');
        const entryIndex = parseInt(parts[parts.length - 1], 10);

        const dayEntries = schedule.entries[day] || [];
        const entry = dayEntries[entryIndex];

        if (!entry) continue;

        try {
          const result = await aiService.findAlternativeActivity({
            child_id: childId,
            day: day,
            time_slot: entry.time || 'morning',
            excluded_activity_ids: excludedIds,
            week_start: toISODateString(currentWeekStartDate),
          });

          if (result.success && result.alternative) {
            // Update schedule with new activity
            setSchedule(prev => {
              if (!prev) return prev;
              const newEntries = { ...prev.entries };
              const updatedDayEntries = [...(newEntries[day] || [])];
              if (entryIndex < updatedDayEntries.length) {
                updatedDayEntries[entryIndex] = result.alternative!;
                newEntries[day] = updatedDayEntries;
              }
              return { ...prev, entries: newEntries };
            });

            // Update approval state to pending for new entry
            const newKey = `${result.alternative.child_id}-${result.alternative.activity_id}-${result.alternative.day}-${entryIndex}`;
            setEntryApprovals(prev => {
              const updated = { ...prev };
              delete updated[key];
              updated[newKey] = 'pending';
              return updated;
            });

            // Load activity details for the new suggestion
            if (result.alternative.activity_id) {
              try {
                const activity = await activityService.getActivityDetails(result.alternative.activity_id);
                if (activity) {
                  setActivityDetails(prev => ({ ...prev, [result.alternative!.activity_id]: activity }));
                }
              } catch {
                // Ignore activity detail fetch errors
              }
            }

            // Add to excluded list for next iteration
            excludedIds.push(result.alternative.activity_id);
          }
        } catch (err) {
          console.warn('Failed to find alternative for entry:', key);
        }
      }

      setSuccessMessage(`Found alternatives for ${declinedKeys.length} ${declinedKeys.length === 1 ? 'activity' : 'activities'}`);
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);

    } catch (err: any) {
      console.error('Error regenerating declined:', err);
      setError('Failed to find alternatives. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Render child availability picker
   */
  const renderAvailabilityPicker = () => {
    if (children.length === 0) return null;

    const currentChild = children[selectedChildTab];
    const currentAvailability = childAvailability.find(ca => ca.childId === currentChild?.id);
    if (!currentChild || !currentAvailability) return null;

    return (
      <Modal
        visible={showAvailabilityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAvailabilityModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Availability</Text>
            <TouchableOpacity onPress={() => setShowAvailabilityModal(false)}>
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          {/* Child tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childTabs}>
            {children.map((child, idx) => {
              const childColorHex = getChildColor(child, idx);
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childTab,
                    selectedChildTab === idx && { backgroundColor: childColorHex + '20', borderColor: childColorHex },
                  ]}
                  onPress={() => setSelectedChildTab(idx)}
                >
                  <ChildAvatar child={child} size={32} showBorder={selectedChildTab === idx} borderWidth={2} />
                  <Text style={[
                    styles.childTabText,
                    selectedChildTab === idx && { color: ModernColors.primary, fontWeight: '600' },
                  ]}>
                    {child.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.availabilityHint}>
            Tap slots to toggle when {currentChild.name} is available
          </Text>

          {/* Availability grid */}
          <ScrollView style={styles.availabilityGrid}>
            {/* Header row */}
            <View style={styles.gridRow}>
              <View style={styles.gridHeaderCell} />
              {TIME_SLOTS.map(slot => (
                <View key={slot} style={styles.gridHeaderCell}>
                  <Text style={styles.gridHeaderText}>{TIME_SLOT_LABELS[slot]}</Text>
                </View>
              ))}
            </View>

            {/* Day rows */}
            {DAYS_OF_WEEK.map(day => (
              <View key={day} style={styles.gridRow}>
                <TouchableOpacity
                  style={styles.gridDayCell}
                  onPress={() => toggleDayAll(currentChild.id, day)}
                >
                  <Text style={styles.gridDayText}>{day.substring(0, 3)}</Text>
                </TouchableOpacity>
                {TIME_SLOTS.map(slot => {
                  const isEnabled = currentAvailability.slots[day]?.[slot] ?? true;
                  const currentChildColor = getChildColor(currentChild, selectedChildTab);
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.gridSlotCell,
                        isEnabled && { backgroundColor: currentChildColor + '30' },
                      ]}
                      onPress={() => toggleAvailability(currentChild.id, day, slot)}
                    >
                      {isEnabled && (
                        <Icon name="check" size={20} color={currentChildColor} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.modalDoneButton}
            onPress={() => setShowAvailabilityModal(false)}
          >
            <LinearGradient
              colors={ModernColors.primaryGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalDoneButtonGradient}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  };

  /**
   * Render date picker modal
   */
  const renderDatePicker = () => {
    const isStartMode = datePickerMode === 'start';
    const currentDate = isStartMode ? startDate : endDate;
    const minDate = isStartMode ? undefined : toISODateString(startDate);

    return (
      <Modal
        visible={showDatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Select {isStartMode ? 'Start' : 'End'} Date
            </Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.datePickerHint}>
            {isStartMode
              ? 'Choose when your planning period begins'
              : 'Choose when your planning period ends'}
          </Text>

          <Calendar
            current={toISODateString(currentDate)}
            minDate={minDate}
            onDayPress={(day: any) => {
              const selected = new Date(day.dateString);
              if (isStartMode) {
                setStartDate(selected);
                // If new start is after current end, adjust end date
                if (selected > endDate) {
                  setEndDate(getEndOfWeek(selected));
                }
              } else {
                setEndDate(selected);
              }
              setDateRangePreset('custom');
              setShowDatePicker(false);
            }}
            markedDates={{
              [toISODateString(startDate)]: {
                selected: isStartMode,
                startingDay: true,
                color: ModernColors.primary,
                textColor: '#FFFFFF',
              },
              [toISODateString(endDate)]: {
                selected: !isStartMode,
                endingDay: true,
                color: ModernColors.primary,
                textColor: '#FFFFFF',
              },
            }}
            markingType="period"
            theme={{
              selectedDayBackgroundColor: ModernColors.primary,
              todayTextColor: ModernColors.primary,
              arrowColor: ModernColors.primary,
            }}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  /**
   * Render chat message with optional activity card
   */
  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.chatMessageContainer, isUser ? styles.chatMessageUser : styles.chatMessageAssistant]}>
        {!isUser && (
          <View style={styles.chatAvatarContainer}>
            <Image source={aiRobotImage} style={styles.chatAvatar} />
          </View>
        )}
        <View style={[styles.chatBubble, isUser ? styles.chatBubbleUser : styles.chatBubbleAssistant]}>
          <Text style={[styles.chatMessageText, isUser && styles.chatMessageTextUser]}>
            {item.content}
          </Text>

          {/* Suggested activity card */}
          {item.suggestedActivity && (
            <View style={styles.chatActivityCard}>
              {/* Activity info */}
              <View style={styles.chatActivityInfo}>
                <Text style={styles.chatActivityName} numberOfLines={2}>
                  {item.suggestedActivity.activity_name}
                </Text>
                <View style={styles.chatActivityRow}>
                  <Icon name="map-marker" size={12} color={ModernColors.textSecondary} />
                  <Text style={styles.chatActivityDetail} numberOfLines={1}>
                    {item.suggestedActivity.location}
                  </Text>
                </View>
                <View style={styles.chatActivityRow}>
                  <Icon name="clock-outline" size={12} color={ModernColors.textSecondary} />
                  <Text style={styles.chatActivityDetail}>{item.suggestedActivity.time}</Text>
                  {item.suggestedActivity.duration_minutes && (
                    <Text style={styles.chatActivityDetail}> • {item.suggestedActivity.duration_minutes} min</Text>
                  )}
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.chatActivityActions}>
                <TouchableOpacity
                  style={[styles.chatActivityButton, styles.chatActivityButtonAccept]}
                  onPress={() => handleAcceptFromChat(item.suggestedActivity!)}
                >
                  <Icon name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.chatActivityButtonTextLight}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chatActivityButton, styles.chatActivityButtonDecline]}
                  onPress={() => handleDeclineFromChat(item.suggestedActivity!)}
                >
                  <Icon name="close" size={16} color={ModernColors.error} />
                  <Text style={[styles.chatActivityButtonText, { color: ModernColors.error }]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  /**
   * Render chat panel modal
   */
  const renderChatPanel = () => (
    <Modal
      visible={showChat}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeChat}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
      >
        <SafeAreaView style={styles.chatContainer}>
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderContent}>
              <Text style={styles.chatHeaderTitle}>
                Refining activity for {activeChatContext?.childName || 'your child'}
              </Text>
              <Text style={styles.chatHeaderSubtitle}>
                {activeChatContext?.day} • Tell me what you'd prefer
              </Text>
            </View>
            <TouchableOpacity onPress={closeChat} style={styles.chatCloseButton}>
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          {/* Chat Messages */}
          <FlatList
            ref={chatScrollRef}
            data={chatMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderChatMessage}
            contentContainerStyle={styles.chatMessagesList}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Loading indicator */}
          {isChatLoading && (
            <View style={styles.chatLoadingContainer}>
              <ActivityIndicator size="small" color={ModernColors.primary} />
              <Text style={styles.chatLoadingText}>Finding alternatives...</Text>
            </View>
          )}

          {/* Quick responses (shown when no custom input is active) */}
          {!showOtherInput && !isChatLoading && (
            <View style={styles.quickResponsesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {QUICK_RESPONSES.map((response, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickResponseChip}
                    onPress={() => handleQuickResponse(response)}
                  >
                    <Text style={styles.quickResponseText}>{response.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Text input (shown when "Other..." is selected or after quick response) */}
          {showOtherInput && (
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                value={chatInputText}
                onChangeText={setChatInputText}
                placeholder="Tell me what you're looking for..."
                placeholderTextColor={ModernColors.textSecondary}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.chatSendButton, !chatInputText.trim() && styles.chatSendButtonDisabled]}
                onPress={() => handleChatSubmit(chatInputText)}
                disabled={!chatInputText.trim() || isChatLoading}
              >
                <Icon name="send" size={20} color={chatInputText.trim() ? '#FFFFFF' : ModernColors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Skip button */}
          <TouchableOpacity style={styles.chatSkipButton} onPress={closeChat}>
            <Text style={styles.chatSkipText}>Skip this time slot</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );

  /**
   * Render first-time explanation modal
   */
  const renderExplanationModal = () => (
    <Modal
      visible={showExplanationModal}
      transparent
      animationType="fade"
      onRequestClose={dismissExplanationModal}
    >
      <View style={styles.explanationOverlay}>
        <View style={styles.explanationModal}>
          {/* Header with icon */}
          <View style={styles.explanationHeader}>
            <View style={styles.explanationIconContainer}>
              <Icon name="lightbulb-on" size={32} color={ModernColors.warning} />
            </View>
            <Text style={styles.explanationTitle}>How to Refine Your Plan</Text>
          </View>

          {/* Instructions */}
          <View style={styles.explanationContent}>
            <View style={styles.explanationItem}>
              <View style={[styles.explanationBadge, { backgroundColor: `${ModernColors.success}20` }]}>
                <Icon name="check" size={18} color={ModernColors.success} />
              </View>
              <View style={styles.explanationItemText}>
                <Text style={styles.explanationItemTitle}>Accept</Text>
                <Text style={styles.explanationItemDesc}>Add this activity to your plan</Text>
              </View>
            </View>

            <View style={styles.explanationItem}>
              <View style={[styles.explanationBadge, { backgroundColor: `${ModernColors.error}20` }]}>
                <Icon name="close" size={18} color={ModernColors.error} />
              </View>
              <View style={styles.explanationItemText}>
                <Text style={styles.explanationItemTitle}>No</Text>
                <Text style={styles.explanationItemDesc}>Remove this suggestion from the plan</Text>
              </View>
            </View>

            <View style={styles.explanationItem}>
              <View style={[styles.explanationBadge, { backgroundColor: `${ModernColors.primary}20` }]}>
                <Icon name="refresh" size={18} color={ModernColors.primary} />
              </View>
              <View style={styles.explanationItemText}>
                <Text style={styles.explanationItemTitle}>Different</Text>
                <Text style={styles.explanationItemDesc}>Chat with AI to find a better match</Text>
              </View>
            </View>

            <Text style={styles.explanationTip}>
              Tap "Different" to tell me what you'd prefer and I'll find better options!
            </Text>
          </View>

          {/* Got it button */}
          <TouchableOpacity
            style={styles.explanationButton}
            onPress={dismissExplanationModal}
          >
            <Text style={styles.explanationButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /**
   * Render success modal with animation
   */
  const renderSuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.successOverlay}>
        <View style={styles.successModal}>
          <View style={styles.successIconContainer}>
            <Icon name="check-circle" size={64} color={ModernColors.success} />
          </View>
          <Text style={styles.successTitle}>Success!</Text>
          <Text style={styles.successMessage}>{successMessage}</Text>
        </View>
      </View>
    </Modal>
  );

  /**
   * Render a schedule entry card (ActivityCard-style with child color border)
   */
  const renderScheduleEntry = (entry: ScheduleEntry, dayIndex: number, entryIndex: number) => {
    const { name: childName, color: childColor } = getChildInfo(entry.child_id);
    const uniqueKey = `${entry.child_id}-${entry.activity_id}-${entry.day}-${entryIndex}`;
    const approvalState = entryApprovals[uniqueKey] || 'pending';
    const activity = activityDetails[entry.activity_id];

    // Find all children assigned to the same activity on the same day
    const dayEntries = schedule?.entries[entry.day] || [];
    const sameActivityEntries = dayEntries.filter(
      e => e.activity_id === entry.activity_id && e.time === entry.time
    );
    const childrenForActivity = sameActivityEntries.map(e => ({
      ...getChildInfo(e.child_id),
      childName: e.child_name || getChildInfo(e.child_id).name,
    }));

    // Deduplicate (in case same child appears twice)
    const uniqueChildren = childrenForActivity.filter(
      (child, idx, arr) => arr.findIndex(c => c.name === child.name) === idx
    );

    // Get activity image
    const imageKey = activity ? getActivityImageKey(activity.category || '', activity.subcategory, activity.name) : 'default';
    const fallbackImage = getActivityImageByKey(imageKey);

    // Format time display (from entry.time which is like "morning", "afternoon", etc. or actual time)
    const formatEntryTime = (time: string): string => {
      if (time.includes(':')) return time;
      const timeLabels: Record<string, string> = {
        morning: '9:00',
        afternoon: '13:00',
        evening: '18:00',
      };
      return timeLabels[time] || time;
    };

    return (
      <TouchableOpacity
        key={uniqueKey}
        style={[
          styles.scheduleCard,
          approvalState === 'approved' && styles.scheduleCardApproved,
          approvalState === 'declined' && styles.scheduleCardDeclined,
        ]}
        onPress={() => handleActivityPress(entry)}
        activeOpacity={0.8}
      >
        {/* Child color indicator bar(s) at top - stacked if multiple children */}
        <View style={styles.childColorBarsContainer}>
          {uniqueChildren.length > 1 ? (
            // Multiple children - show stacked colors
            uniqueChildren.map((child, idx) => (
              <View
                key={idx}
                style={[
                  styles.childColorBarStacked,
                  { backgroundColor: child.color },
                  idx === 0 && styles.childColorBarStackedFirst,
                  idx === uniqueChildren.length - 1 && styles.childColorBarStackedLast,
                ]}
              >
                <Text style={styles.childColorBarText}>{child.childName}</Text>
              </View>
            ))
          ) : (
            // Single child - show full bar
            <View style={[styles.childColorBar, { backgroundColor: childColor }]}>
              <Text style={styles.childColorBarText}>
                {entry.child_name || childName}
              </Text>
            </View>
          )}
        </View>

        {/* Activity Image - Full width, taller */}
        <View style={styles.scheduleCardImageContainer}>
          {activity?.imageUrl ? (
            <OptimizedActivityImage
              source={{ uri: activity.imageUrl }}
              style={styles.scheduleCardImage}
            />
          ) : (
            <Image source={fallbackImage} style={styles.scheduleCardImage} />
          )}

          {/* Price overlay - bottom left */}
          {activity?.cost !== undefined && activity.cost !== null && (
            <View style={styles.priceOverlay}>
              <Text style={styles.priceOverlayText}>
                {formatActivityPrice(activity.cost)}
              </Text>
            </View>
          )}

          {/* Time badge - bottom right */}
          <View style={styles.timeBadge}>
            <Icon name="clock-outline" size={12} color="#FFFFFF" />
            <Text style={styles.timeBadgeText}>{formatEntryTime(entry.time)}</Text>
          </View>
        </View>

        {/* Activity Details */}
        <View style={styles.scheduleCardDetails}>
          <Text style={styles.scheduleCardTitle} numberOfLines={2}>
            {entry.activity_name}
          </Text>

          {/* Location */}
          <View style={styles.scheduleCardRow}>
            <Icon name="map-marker" size={14} color={ModernColors.primary} />
            <Text style={styles.scheduleCardRowText} numberOfLines={1}>
              {entry.location}
            </Text>
          </View>

          {/* Date range if available */}
          {(activity?.dateStart || activity?.startDate) && (
            <View style={styles.scheduleCardRow}>
              <Icon name="calendar-range" size={14} color={ModernColors.primary} />
              <Text style={styles.scheduleCardRowText} numberOfLines={1}>
                {(() => {
                  const startDate = activity?.dateStart || activity?.startDate;
                  const endDate = activity?.dateEnd || activity?.endDate;
                  if (!startDate) return '';
                  const start = new Date(startDate as string);
                  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  if (!endDate) return startStr;
                  const end = new Date(endDate as string);
                  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return `${startStr} - ${endStr}`;
                })()}
              </Text>
            </View>
          )}

          {/* Time badge in pink */}
          {(activity?.startTime || entry.time) && (
            <View style={styles.scheduleCardTimeRow}>
              <View style={styles.timePinkBadge}>
                <Text style={styles.timePinkBadgeText}>
                  {activity?.startTime && activity?.endTime
                    ? `${activity.startTime} - ${activity.endTime}`
                    : formatEntryTime(entry.time)}
                </Text>
              </View>
            </View>
          )}

          {/* Age range */}
          {activity?.ageRange && (
            <View style={styles.scheduleCardRow}>
              <Icon name="account-child" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.scheduleCardRowText}>
                {activity.ageRange.min === activity.ageRange.max
                  ? `Age ${activity.ageRange.min}`
                  : activity.ageRange.max >= 90
                    ? `Ages ${activity.ageRange.min}+`
                    : `Ages ${activity.ageRange.min}-${activity.ageRange.max}`}
              </Text>
            </View>
          )}

          {/* Spots available */}
          {activity?.spotsAvailable !== undefined && activity.spotsAvailable !== null && activity.spotsAvailable <= 10 && (
            <View style={styles.scheduleCardRow}>
              <Icon
                name="alert-circle"
                size={14}
                color={activity.spotsAvailable <= 3 ? ModernColors.error : ModernColors.warning}
              />
              <Text style={[
                styles.scheduleCardRowText,
                { color: activity.spotsAvailable <= 3 ? ModernColors.error : ModernColors.warning, fontWeight: '500' }
              ]}>
                {activity.spotsAvailable === 0
                  ? 'No spots left'
                  : `${activity.spotsAvailable} spot${activity.spotsAvailable === 1 ? '' : 's'} left`}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons - Delete and Suggest Alternative only */}
        <View style={styles.actionButtonsRow}>
          {/* Delete Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDelete]}
            onPress={(e) => {
              e.stopPropagation();
              // Remove from schedule
              setSchedule(prev => {
                if (!prev) return prev;
                const newEntries = { ...prev.entries };
                const dayEntries = [...(newEntries[entry.day] || [])];
                dayEntries.splice(entryIndex, 1);
                newEntries[entry.day] = dayEntries;
                return {
                  ...prev,
                  entries: newEntries,
                  total_activities: (prev.total_activities || 0) - 1,
                };
              });
              // Remove approval state
              setEntryApprovals(prev => {
                const updated = { ...prev };
                delete updated[uniqueKey];
                return updated;
              });
            }}
          >
            <Icon name="delete-outline" size={18} color={ModernColors.error} />
            <Text style={[styles.actionButtonText, { color: ModernColors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>

          {/* Suggest Alternative Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonAlternative]}
            onPress={(e) => {
              e.stopPropagation();
              handleFindDifferent(entry, uniqueKey, entryIndex);
            }}
          >
            <Icon name="swap-horizontal" size={18} color={ModernColors.primary} />
            <Text style={[styles.actionButtonText, { color: ModernColors.primary }]}>
              Suggest Alternative
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render an existing calendar activity card (pre-scheduled by user)
   */
  const renderExistingActivityCard = (existing: ExistingActivity, dayIndex: number, entryIndex: number) => {
    const { childActivity, activity } = existing;
    const childId = childActivity.childId;
    const { name: childName, color: childColor } = getChildInfo(childId);

    // Get activity image
    const imageKey = activity ? getActivityImageKey(activity.category || '', activity.subcategory, activity.name) : 'default';
    const fallbackImage = getActivityImageByKey(imageKey);

    return (
      <TouchableOpacity
        key={`existing-${childActivity.id}-${entryIndex}`}
        style={[styles.scheduleCard, styles.scheduleCardExisting]}
        onPress={() => {
          if (childActivity.activityId) {
            navigation.navigate('ActivityDetail' as never, { id: childActivity.activityId } as never);
          }
        }}
        activeOpacity={0.8}
      >
        {/* EXISTING badge */}
        <View style={styles.existingBadge}>
          <Icon name="pin" size={12} color="#FFFFFF" />
          <Text style={styles.existingBadgeText}>EXISTING</Text>
        </View>

        {/* Child color indicator bar */}
        <View style={[styles.childColorBar, { backgroundColor: childColor }]}>
          <Text style={styles.childColorBarText}>{childName}</Text>
        </View>

        {/* Activity Image */}
        <View style={styles.scheduleCardImageContainer}>
          {activity?.imageUrl ? (
            <OptimizedActivityImage
              source={{ uri: activity.imageUrl }}
              style={styles.scheduleCardImage}
            />
          ) : (
            <Image source={fallbackImage} style={styles.scheduleCardImage} />
          )}

          {/* Time badge */}
          {childActivity.startTime && (
            <View style={styles.timeBadge}>
              <Icon name="clock-outline" size={12} color="#FFFFFF" />
              <Text style={styles.timeBadgeText}>{childActivity.startTime}</Text>
            </View>
          )}
        </View>

        {/* Activity Details */}
        <View style={styles.scheduleCardDetails}>
          <Text style={styles.scheduleCardTitle} numberOfLines={2}>
            {activity?.name || 'Scheduled Activity'}
          </Text>

          {activity?.location && (
            <View style={styles.scheduleCardRow}>
              <Icon name="map-marker" size={14} color={ModernColors.primary} />
              <Text style={styles.scheduleCardRowText} numberOfLines={1}>
                {activity.location.name || activity.location}
              </Text>
            </View>
          )}

          {childActivity.scheduledDate && (
            <View style={styles.scheduleCardRow}>
              <Icon name="calendar" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.scheduleCardRowText}>
                {new Date(childActivity.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}
        </View>

        {/* Action Button - Only Suggest Alternative for existing */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonAlternative, { flex: 1 }]}
            onPress={(e) => {
              e.stopPropagation();
              // TODO: Handle suggesting alternative for existing activity
              setError('Suggesting alternatives for existing activities coming soon');
            }}
          >
            <Icon name="swap-horizontal" size={18} color={ModernColors.primary} />
            <Text style={[styles.actionButtonText, { color: ModernColors.primary }]}>
              Suggest Alternative
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  /**
   * Render a day column
   */
  const renderDayColumn = (day: string, dayIndex: number) => {
    const entries = schedule?.entries[day] || [];
    const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

    // Filter existing activities for this day of week
    // Match by day name (e.g., "Monday") or by specific date within current view week
    const existingForDay = existingActivities.filter(ea => {
      const scheduledDate = ea.childActivity.scheduledDate;
      if (!scheduledDate) return false;

      // Check if activity falls within current viewing week
      const activityDate = new Date(scheduledDate);
      const weekStart = currentWeekStartDate;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (activityDate >= weekStart && activityDate <= weekEnd) {
        // Check if it matches this day of week
        const activityDay = activityDate.toLocaleDateString('en-US', { weekday: 'long' });
        return activityDay === day;
      }
      return false;
    });

    const hasEntries = entries.length > 0 || existingForDay.length > 0;

    return (
      <View key={day} style={styles.dayColumn}>
        <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
            {day.substring(0, 3)}
          </Text>
        </View>
        <View style={styles.dayContent}>
          {hasEntries ? (
            <>
              {/* Existing calendar activities first */}
              {existingForDay.map((existing, idx) => renderExistingActivityCard(existing, dayIndex, idx))}
              {/* AI-generated schedule entries */}
              {entries.map((entry, idx) => renderScheduleEntry(entry, dayIndex, idx))}
            </>
          ) : (
            <View style={styles.emptyDay}>
              <Icon name="calendar-blank" size={24} color={ModernColors.border} />
              <Text style={styles.emptyDayText}>Free day</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  /**
   * Render conflicts section
   */
  const renderConflicts = () => {
    if (!schedule?.conflicts || schedule.conflicts.length === 0) return null;

    return (
      <View style={styles.conflictsSection}>
        <View style={styles.conflictsHeader}>
          <Icon name="alert-circle" size={20} color={ModernColors.warning} />
          <Text style={styles.conflictsTitle}>Scheduling Conflicts</Text>
        </View>
        {schedule.conflicts.map((conflict, index) => (
          <View key={index} style={styles.conflictCard}>
            <Icon
              name={
                conflict.type === 'time_overlap'
                  ? 'clock-alert'
                  : conflict.type === 'travel_distance'
                  ? 'map-marker-distance'
                  : 'run-fast'
              }
              size={18}
              color={ModernColors.warning}
            />
            <Text style={styles.conflictText}>{conflict.description}</Text>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render schedule summary
   */
  const renderSummary = () => {
    if (!schedule) return null;

    const approvedCount = Object.values(entryApprovals).filter(s => s === 'approved').length;

    return (
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Icon name="calendar-check" size={24} color={ModernColors.success} />
          <View>
            <Text style={styles.summaryValue}>{schedule.total_activities}</Text>
            <Text style={styles.summaryLabel}>Activities</Text>
          </View>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="check-circle" size={24} color={ModernColors.success} />
          <View>
            <Text style={styles.summaryValue}>{approvedCount}</Text>
            <Text style={styles.summaryLabel}>Approved</Text>
          </View>
        </View>
        {schedule.total_cost !== undefined && (
          <View style={styles.summaryCard}>
            <Icon name="currency-usd" size={24} color={ModernColors.warning} />
            <View>
              <Text style={styles.summaryValue}>${schedule.total_cost}</Text>
              <Text style={styles.summaryLabel}>Est. Cost</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  /**
   * Render empty state with configuration
   */
  const renderEmptyState = () => (
    <ScrollView style={styles.emptyStateScroll} contentContainerStyle={styles.emptyStateContent}>
      {/* Header */}
      <View style={styles.emptyStateHeader}>
        <LinearGradient
          colors={[ModernColors.primaryLight + '40', ModernColors.primary + '20']}
          style={styles.emptyStateIconContainer}
        >
          <Icon name="calendar-star" size={48} color={ModernColors.primary} />
        </LinearGradient>
        <Text style={styles.emptyStateTitle}>AI Weekly Planner</Text>
        <Text style={styles.emptyStateDescription}>
          Let AI create an optimal activity schedule for your family, balancing
          each child's availability and preferences.
        </Text>
      </View>

      {/* Date range selection */}
      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>Planning Period</Text>

        {/* Quick presets */}
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={[
              styles.presetButton,
              dateRangePreset === 'this-week' && styles.presetButtonActive,
            ]}
            onPress={() => applyDatePreset('this-week')}
          >
            <Text
              style={[
                styles.presetButtonText,
                dateRangePreset === 'this-week' && styles.presetButtonTextActive,
              ]}
            >
              This Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.presetButton,
              dateRangePreset === 'summer' && styles.presetButtonActive,
            ]}
            onPress={() => applyDatePreset('summer')}
          >
            <Text
              style={[
                styles.presetButtonText,
                dateRangePreset === 'summer' && styles.presetButtonTextActive,
              ]}
            >
              Summer (Jul-Aug)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.presetButton,
              dateRangePreset === 'custom' && styles.presetButtonActive,
            ]}
            onPress={() => {
              setDateRangePreset('custom');
              openDatePicker('start');
            }}
          >
            <Text
              style={[
                styles.presetButtonText,
                dateRangePreset === 'custom' && styles.presetButtonTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date range display */}
        <View style={styles.dateRangeContainer}>
          <TouchableOpacity
            style={styles.dateRangeButton}
            onPress={() => openDatePicker('start')}
          >
            <Icon name="calendar-start" size={18} color={ModernColors.primary} />
            <View style={styles.dateRangeButtonText}>
              <Text style={styles.dateRangeLabel}>Start</Text>
              <Text style={styles.dateRangeValue}>{formatDate(startDate)}</Text>
            </View>
          </TouchableOpacity>

          <Icon name="arrow-right" size={20} color={ModernColors.textMuted} />

          <TouchableOpacity
            style={styles.dateRangeButton}
            onPress={() => openDatePicker('end')}
          >
            <Icon name="calendar-end" size={18} color={ModernColors.primary} />
            <View style={styles.dateRangeButtonText}>
              <Text style={styles.dateRangeLabel}>End</Text>
              <Text style={styles.dateRangeValue}>{formatDate(endDate)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Duration indicator */}
        <Text style={styles.durationText}>
          {totalWeeks} week{totalWeeks !== 1 ? 's' : ''} total
        </Text>
      </View>

      {/* Children availability */}
      {children.length > 0 && (
        <View style={styles.configSection}>
          <Text style={styles.configSectionTitle}>Children's Availability</Text>
          <TouchableOpacity
            style={styles.availabilityButton}
            onPress={() => setShowAvailabilityModal(true)}
          >
            <View style={styles.availabilityButtonContent}>
              <View style={styles.childrenAvatars}>
                {children.slice(0, 3).map((child, idx) => (
                  <View
                    key={child.id}
                    style={{ marginLeft: idx > 0 ? -8 : 0 }}
                  >
                    <ChildAvatar child={child} size={36} showBorder={true} borderWidth={3} />
                  </View>
                ))}
              </View>
              <View style={styles.availabilityButtonText}>
                <Text style={styles.availabilityButtonTitle}>Set when each child is free</Text>
                <Text style={styles.availabilityButtonSubtitle}>
                  {children.map(c => c.name).join(', ')}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={20} color={ModernColors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Settings */}
      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>Settings</Text>

        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Max activities per child</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setMaxActivitiesPerChild(Math.max(1, maxActivitiesPerChild - 1))}
              >
                <Icon name="minus" size={18} color={ModernColors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{maxActivitiesPerChild}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setMaxActivitiesPerChild(Math.min(10, maxActivitiesPerChild + 1))}
              >
                <Icon name="plus" size={18} color={ModernColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setAvoidBackToBack(!avoidBackToBack)}
          >
            <Text style={styles.settingLabel}>Avoid back-to-back activities</Text>
            <Icon
              name={avoidBackToBack ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={avoidBackToBack ? ModernColors.primary : ModernColors.textMuted}
            />
          </TouchableOpacity>

          {children.length >= 2 && (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setScheduleSiblingsTogether(!scheduleSiblingsTogether)}
            >
              <View>
                <Text style={styles.settingLabel}>Schedule siblings together</Text>
                <Text style={styles.settingHint}>Try to book same activities when possible</Text>
              </View>
              <Icon
                name={scheduleSiblingsTogether ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={scheduleSiblingsTogether ? ModernColors.primary : ModernColors.textMuted}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowLast]}
            onPress={() => setAllowGaps(!allowGaps)}
          >
            <View style={styles.settingLabelContainer}>
              <Text style={styles.settingLabel}>Allow gaps between activities</Text>
              <Text style={styles.settingHint}>
                💡 Better results - AI finds best matches without forcing full coverage
              </Text>
            </View>
            <Icon
              name={allowGaps ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={allowGaps ? ModernColors.primary : ModernColors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Generate button with AI robot */}
      <View style={styles.generateButtonWrapper}>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={generateSchedule}
          disabled={children.length === 0}
        >
          <LinearGradient
            colors={children.length === 0 ? ['#ccc', '#aaa'] : ModernColors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateButtonGradient}
          >
            <Icon name="creation" size={20} color="#FFFFFF" />
            <Text style={styles.generateButtonText}>Generate Schedule</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Image source={aiRobotImage} style={styles.generateButtonRobot} />
      </View>

      {children.length === 0 && (
        <Text style={styles.noChildrenHint}>
          Add children to your profile to use the AI planner
        </Text>
      )}
    </ScrollView>
  );

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingContent}>
        <LinearGradient
          colors={[ModernColors.primaryLight + '40', ModernColors.primary + '20']}
          style={styles.loadingIconContainer}
        >
          <ActivityIndicator size="large" color={ModernColors.primary} />
        </LinearGradient>
        <Text style={styles.loadingText}>Creating your schedule...</Text>
        <Text style={styles.loadingSubtext}>
          AI is finding the best activities for your family
        </Text>
      </View>
    </View>
  );

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Icon name="alert-circle" size={48} color={ModernColors.error} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={generateSchedule}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setError(null)}
      >
        <Text style={styles.backButtonText}>Change Settings</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Clear the current schedule/plan
   */
  const clearSchedule = useCallback(() => {
    setSchedule(null);
    setEntryApprovals({});
    setActivityDetails({});
    setChatMessages([]);
    setActiveChatContext(null);
    setShowChat(false);
    setFeedbackHistory([]);
  }, []);

  /**
   * Render floating action bar
   */
  const renderActionBar = () => {
    if (!schedule) return null;

    const approvedCount = Object.values(entryApprovals).filter(s => s === 'approved').length;
    const declinedCount = Object.values(entryApprovals).filter(s => s === 'declined').length;
    const pendingCount = Object.values(entryApprovals).filter(s => s === 'pending').length;

    return (
      <View style={styles.actionBar}>
        {/* Cancel button */}
        <TouchableOpacity
          style={styles.actionBarCancelButton}
          onPress={clearSchedule}
        >
          <Icon name="close" size={18} color={ModernColors.textSecondary} />
          <Text style={styles.actionBarCancelText}>Cancel</Text>
        </TouchableOpacity>

        {/* Regenerate Declined button - only show if there are declined entries */}
        {declinedCount > 0 && (
          <TouchableOpacity
            style={styles.actionBarRegenerateButton}
            onPress={regenerateDeclined}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <ActivityIndicator size="small" color={ModernColors.warning} />
            ) : (
              <>
                <Icon name="refresh" size={16} color={ModernColors.warning} />
                <Text style={styles.actionBarRegenerateText}>{declinedCount}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Add to calendar button */}
        <TouchableOpacity
          style={[styles.actionBarButton, approvedCount === 0 && styles.actionBarButtonDisabled]}
          onPress={addApprovedToCalendar}
          disabled={approvedCount === 0}
        >
          <LinearGradient
            colors={approvedCount > 0 ? ModernColors.primaryGradient as any : ['#D1D5DB', '#D1D5DB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBarButtonGradient}
          >
            <Icon name="calendar-plus" size={20} color={approvedCount > 0 ? '#FFFFFF' : '#9CA3AF'} />
            <Text style={[styles.actionBarButtonText, approvedCount === 0 && styles.actionBarButtonTextDisabled]}>
              {approvedCount > 0
                ? `Add ${approvedCount} to Calendar`
                : 'Select activities'}
            </Text>
            {pendingCount > 0 && approvedCount > 0 && (
              <View style={styles.partialBadge}>
                <Text style={styles.partialBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render week navigator for multi-week plans
   */
  const renderWeekNavigator = () => {
    if (!schedule || totalWeeks <= 1) return null;

    const weekStart = getWeekStartInRange(startDate, currentViewWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return (
      <View style={styles.weekNavigator}>
        <TouchableOpacity
          style={[
            styles.weekNavigatorButton,
            currentViewWeek === 0 && styles.weekNavigatorButtonDisabled,
          ]}
          onPress={() => setCurrentViewWeek(Math.max(0, currentViewWeek - 1))}
          disabled={currentViewWeek === 0}
        >
          <Icon
            name="chevron-left"
            size={20}
            color={currentViewWeek === 0 ? ModernColors.textMuted : ModernColors.text}
          />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.weekNavigatorText}>
            Week {currentViewWeek + 1} of {totalWeeks}
          </Text>
          <Text style={styles.weekNavigatorDates}>
            {formatDate(weekStart)} - {formatDate(weekEnd)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.weekNavigatorButton,
            currentViewWeek >= totalWeeks - 1 && styles.weekNavigatorButtonDisabled,
          ]}
          onPress={() => setCurrentViewWeek(Math.min(totalWeeks - 1, currentViewWeek + 1))}
          disabled={currentViewWeek >= totalWeeks - 1}
        >
          <Icon
            name="chevron-right"
            size={20}
            color={currentViewWeek >= totalWeeks - 1 ? ModernColors.textMuted : ModernColors.text}
          />
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render legend
   */
  const renderLegend = () => {
    if (!schedule || childIdsInSchedule.length === 0) return null;

    return (
      <View style={styles.legendSection}>
        <Text style={styles.legendTitle}>Children</Text>
        <View style={styles.legendItems}>
          {childIdsInSchedule.map(childId => {
            const { name, color } = getChildInfo(childId);
            return (
              <View key={childId} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{name}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Weekly Planner</Text>
          {schedule && (
            <Text style={styles.headerSubtitle}>
              Week of {formatDate(currentWeekStartDate)}
            </Text>
          )}
        </View>
        {schedule && (
          <TouchableOpacity
            onPress={generateSchedule}
            disabled={isLoading}
            style={styles.headerButton}
          >
            <Icon
              name="refresh"
              size={24}
              color={isLoading ? ModernColors.border : ModernColors.primary}
            />
          </TouchableOpacity>
        )}
        {!schedule && <View style={styles.headerButton} />}
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {isLoading ? (
          renderLoadingState()
        ) : error ? (
          renderErrorState()
        ) : !schedule ? (
          renderEmptyState()
        ) : (
          <ScrollView
            style={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={generateSchedule}
                tintColor={ModernColors.primary}
              />
            }
          >
            {/* Week navigator for multi-week plans */}
            {renderWeekNavigator()}

            {renderSummary()}
            {renderConflicts()}

            {/* Calendar view */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.calendarScroll}
            >
              <View style={styles.calendarContainer}>
                {DAYS_OF_WEEK.map((day, idx) => renderDayColumn(day, idx))}
              </View>
            </ScrollView>

            {renderLegend()}

            {/* Spacing for action bar */}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </Animated.View>

      {/* Action bar */}
      {renderActionBar()}

      {/* Modals */}
      {renderDatePicker()}
      {renderAvailabilityPicker()}
      {renderChatPanel()}
      {renderExplanationModal()}
      {renderSuccessModal()}
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    textAlign: 'center',
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: ModernColors.error,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: ModernColors.primary,
    borderRadius: ModernBorderRadius.lg,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  backButtonText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
  },

  // Empty state
  emptyStateScroll: {
    flex: 1,
  },
  emptyStateContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyStateHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emptyStateIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 15,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  // Config sections
  configSection: {
    marginBottom: 24,
  },
  configSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Week selector (legacy)
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: ModernColors.border,
    gap: 12,
  },
  weekSelectorText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: ModernColors.text,
  },

  // Date range presets
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.md,
    borderWidth: 1,
    borderColor: ModernColors.border,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: ModernColors.primary + '15',
    borderColor: ModernColors.primary,
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: ModernColors.textSecondary,
  },
  presetButtonTextActive: {
    color: ModernColors.primary,
  },

  // Date range display
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateRangeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: ModernColors.border,
    gap: 10,
  },
  dateRangeButtonText: {
    flex: 1,
  },
  dateRangeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: ModernColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateRangeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 2,
  },
  durationText: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },

  // Setting label container
  settingLabelContainer: {
    flex: 1,
    marginRight: 12,
  },

  // Availability button
  availabilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  availabilityButtonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childrenAvatars: {
    flexDirection: 'row',
  },
  childAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: ModernColors.surface,
  },
  childAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  availabilityButtonText: {
    flex: 1,
  },
  availabilityButtonTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: ModernColors.text,
  },
  availabilityButtonSubtitle: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },

  // Settings card
  settingsCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: ModernColors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingLabel: {
    fontSize: 15,
    color: ModernColors.text,
  },
  settingHint: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ModernColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    minWidth: 28,
    textAlign: 'center',
  },

  // Generate button
  generateButtonWrapper: {
    marginTop: 16,
    position: 'relative',
  },
  generateButton: {
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
    ...ModernShadows.md,
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateButtonRobot: {
    position: 'absolute',
    right: -8,
    top: -20,
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  noChildrenHint: {
    fontSize: 13,
    color: ModernColors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },

  // Schedule view
  scrollContent: {
    flex: 1,
  },
  summarySection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: ModernColors.border,
    gap: 10,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: ModernColors.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: ModernColors.textSecondary,
  },

  // Conflicts
  conflictsSection: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  conflictsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  conflictsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
  },
  conflictCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  conflictText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },

  // Calendar
  calendarScroll: {
    paddingHorizontal: 16,
  },
  calendarContainer: {
    flexDirection: 'row',
    paddingBottom: 16,
  },
  dayColumn: {
    width: 200,
    marginRight: 16,
  },
  dayHeader: {
    padding: 12,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.md,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  dayHeaderToday: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
  },
  dayNameToday: {
    color: '#FFFFFF',
  },
  dayContent: {
    gap: 8,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.md,
    borderWidth: 1,
    borderColor: ModernColors.border,
    borderLeftWidth: 4,
  },
  entryCardApproved: {
    backgroundColor: ModernColors.success + '10',
    borderColor: ModernColors.success + '30',
  },
  entryCardDeclined: {
    backgroundColor: ModernColors.error + '08',
    borderColor: ModernColors.error + '20',
    opacity: 0.6,
  },
  entryContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  entryTime: {
    alignItems: 'center',
    minWidth: 50,
  },
  entryTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.text,
  },
  entryDuration: {
    fontSize: 10,
    color: ModernColors.textMuted,
    marginTop: 2,
  },
  entryDetails: {
    flex: 1,
  },
  entryActivityName: {
    fontSize: 13,
    fontWeight: '500',
    color: ModernColors.text,
    marginBottom: 6,
  },
  entryMeta: {
    marginBottom: 4,
  },
  childBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  childBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryLocation: {
    flex: 1,
    fontSize: 11,
    color: ModernColors.textSecondary,
  },
  approvalButtons: {
    flexDirection: 'column',
    gap: 4,
    marginLeft: 8,
  },
  approvalButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ModernColors.background,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  approvalButtonActive: {
    backgroundColor: ModernColors.success,
    borderColor: ModernColors.success,
  },
  approvalButtonDeclined: {
    backgroundColor: ModernColors.error,
    borderColor: ModernColors.error,
  },

  // New Schedule Card styles (ActivityCard-like)
  scheduleCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
    marginBottom: 12,
    ...ModernShadows.md,
  },
  scheduleCardApproved: {
    borderWidth: 2,
    borderColor: ModernColors.success,
  },
  scheduleCardDeclined: {
    opacity: 0.5,
    borderWidth: 2,
    borderColor: ModernColors.error,
  },
  childColorBarsContainer: {
    flexDirection: 'row',
  },
  childColorBar: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  childColorBarStacked: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  childColorBarStackedFirst: {
    // First bar in stack
  },
  childColorBarStackedLast: {
    // Last bar in stack
  },
  childColorBarText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scheduleCardImageContainer: {
    width: '100%',
    height: 100,
    position: 'relative',
    backgroundColor: ModernColors.background,
  },
  scheduleCardImage: {
    width: '100%',
    height: 100,
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceOverlayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scheduleCardDetails: {
    padding: 12,
  },
  scheduleCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 6,
    lineHeight: 18,
  },
  scheduleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  scheduleCardRowText: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    flex: 1,
  },
  scheduleCardTimeRow: {
    marginBottom: 4,
  },
  timePinkBadge: {
    backgroundColor: ModernColors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  timePinkBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ModernColors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationBadgeText: {
    fontSize: 11,
    color: ModernColors.textSecondary,
  },
  daysBadge: {
    backgroundColor: ModernColors.primaryLight + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    gap: 3,
    minWidth: 0,
  },
  actionButtonAccept: {
    backgroundColor: ModernColors.success + '15',
  },
  actionButtonAcceptActive: {
    backgroundColor: ModernColors.success,
  },
  actionButtonDecline: {
    backgroundColor: ModernColors.error + '15',
  },
  actionButtonDeclineActive: {
    backgroundColor: ModernColors.error,
  },
  actionButtonAlternative: {
    backgroundColor: ModernColors.primary + '15',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },

  emptyDay: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.md,
    borderWidth: 1,
    borderColor: ModernColors.border,
    borderStyle: 'dashed',
  },
  emptyDayText: {
    fontSize: 12,
    color: ModernColors.textMuted,
    marginTop: 8,
  },

  // Legend
  legendSection: {
    padding: 16,
    paddingTop: 0,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: ModernColors.textSecondary,
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: ModernColors.surface,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...ModernShadows.lg,
  },
  actionBarCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: ModernBorderRadius.lg,
    backgroundColor: ModernColors.background,
    borderWidth: 1,
    borderColor: ModernColors.border,
    gap: 6,
  },
  actionBarCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.textSecondary,
  },
  actionBarButton: {
    flex: 1,
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
  },
  actionBarButtonDisabled: {
    opacity: 0.7,
  },
  actionBarButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBarButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionBarButtonTextDisabled: {
    color: '#9CA3AF',
  },
  partialBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  partialBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
    backgroundColor: ModernColors.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  childTabs: {
    flexGrow: 0,
    padding: 16,
    paddingBottom: 8,
  },
  childTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: ModernBorderRadius.full,
    borderWidth: 1,
    borderColor: ModernColors.border,
    marginRight: 8,
    gap: 8,
  },
  childTabDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  childTabText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
  },
  availabilityHint: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  availabilityGrid: {
    flex: 1,
    padding: 16,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  gridHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  gridHeaderText: {
    fontSize: 11,
    color: ModernColors.textSecondary,
    textAlign: 'center',
  },
  gridDayCell: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  gridDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
  },
  gridSlotCell: {
    flex: 1,
    height: 48,
    marginHorizontal: 4,
    borderRadius: ModernBorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ModernColors.surface,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  modalDoneButton: {
    margin: 16,
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
  },
  modalDoneButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  datePickerHint: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    padding: 16,
  },

  // Chat Panel Styles
  chatContainer: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: ModernColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  chatHeaderContent: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  chatHeaderSubtitle: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  chatCloseButton: {
    padding: 8,
  },
  chatMessagesList: {
    padding: 16,
    flexGrow: 1,
  },
  chatMessageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  chatMessageUser: {
    justifyContent: 'flex-end',
  },
  chatMessageAssistant: {
    justifyContent: 'flex-start',
  },
  chatAvatarContainer: {
    marginRight: 8,
  },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ModernColors.primaryLight + '30',
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  chatBubbleUser: {
    backgroundColor: ModernColors.primary,
    borderBottomRightRadius: 4,
  },
  chatBubbleAssistant: {
    backgroundColor: ModernColors.surface,
    borderBottomLeftRadius: 4,
    ...ModernShadows.sm,
  },
  chatMessageText: {
    fontSize: 14,
    lineHeight: 20,
    color: ModernColors.text,
  },
  chatMessageTextUser: {
    color: '#FFFFFF',
  },
  chatActivityCard: {
    marginTop: 12,
    backgroundColor: ModernColors.background,
    borderRadius: ModernBorderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  chatActivityInfo: {
    marginBottom: 12,
  },
  chatActivityName: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 6,
  },
  chatActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  chatActivityDetail: {
    fontSize: 12,
    color: ModernColors.textSecondary,
  },
  chatActivityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatActivityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  chatActivityButtonAccept: {
    backgroundColor: ModernColors.success,
  },
  chatActivityButtonDecline: {
    backgroundColor: ModernColors.error + '10',
    borderWidth: 1,
    borderColor: ModernColors.error + '30',
  },
  chatActivityButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatActivityButtonTextLight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  chatLoadingText: {
    fontSize: 13,
    color: ModernColors.textSecondary,
  },
  quickResponsesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
    backgroundColor: ModernColors.surface,
  },
  quickResponseChip: {
    backgroundColor: ModernColors.primaryLight + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: ModernColors.primary + '30',
  },
  quickResponseText: {
    fontSize: 13,
    fontWeight: '500',
    color: ModernColors.primary,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ModernColors.surface,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
    gap: 12,
  },
  chatInput: {
    flex: 1,
    backgroundColor: ModernColors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: ModernColors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ModernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: ModernColors.border,
  },
  chatSkipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
    backgroundColor: ModernColors.surface,
  },
  chatSkipText: {
    fontSize: 14,
    color: ModernColors.textSecondary,
  },
  // Explanation modal styles
  explanationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  explanationModal: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.xl,
    width: '100%',
    maxWidth: 360,
    ...ModernShadows.lg,
  },
  explanationHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  explanationIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ModernColors.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  explanationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ModernColors.text,
    textAlign: 'center',
  },
  explanationContent: {
    padding: 24,
    gap: 16,
  },
  explanationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  explanationBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationItemText: {
    flex: 1,
  },
  explanationItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 2,
  },
  explanationItemDesc: {
    fontSize: 13,
    color: ModernColors.textSecondary,
  },
  explanationTip: {
    fontSize: 13,
    color: ModernColors.primary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  explanationButton: {
    backgroundColor: ModernColors.primary,
    marginHorizontal: 24,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: ModernBorderRadius.lg,
    alignItems: 'center',
  },
  explanationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Action button delete style
  actionButtonDelete: {
    backgroundColor: ModernColors.error + '15',
  },

  // Existing activity card styles
  scheduleCardExisting: {
    borderWidth: 2,
    borderColor: ModernColors.textMuted,
    borderStyle: 'dashed',
    opacity: 0.9,
  },
  existingBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: ModernColors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: ModernBorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  existingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Success modal styles
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.xl,
    padding: 32,
    alignItems: 'center',
    ...ModernShadows.lg,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: ModernColors.textSecondary,
    textAlign: 'center',
  },

  // Regenerate button style
  actionBarRegenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: ModernBorderRadius.lg,
    backgroundColor: ModernColors.warning + '20',
    borderWidth: 1,
    borderColor: ModernColors.warning,
    gap: 4,
    minWidth: 48,
  },
  actionBarRegenerateText: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.warning,
  },

  // Week navigator styles
  weekNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: ModernColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
    gap: 16,
  },
  weekNavigatorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ModernColors.background,
    borderWidth: 1,
    borderColor: ModernColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavigatorButtonDisabled: {
    opacity: 0.4,
  },
  weekNavigatorText: {
    fontSize: 15,
    fontWeight: '600',
    color: ModernColors.text,
  },
  weekNavigatorDates: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
});

export default WeeklyPlannerScreen;
