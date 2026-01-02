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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Calendar } from 'react-native-calendars';
import aiService from '../services/aiService';
import ActivityService from '../services/activityService';
import { WeeklySchedule, ScheduleEntry } from '../types/ai';
import { Activity } from '../types';
import { ModernColors, ModernShadows, ModernBorderRadius } from '../theme/modernTheme';
import { useAppSelector } from '../store';
import { selectAllChildren, ChildWithPreferences } from '../store/slices/childrenSlice';
import ScreenBackground from '../components/ScreenBackground';
import { aiRobotImage, getActivityImageByKey } from '../assets/images';
import { OptimizedActivityImage } from '../components/OptimizedActivityImage';
import { getActivityImageKey } from '../utils/activityHelpers';
import { formatActivityPrice } from '../utils/formatters';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const;
const TIME_SLOT_LABELS: Record<typeof TIME_SLOTS[number], string> = {
  morning: 'Morning\n6am-12pm',
  afternoon: 'Afternoon\n12pm-5pm',
  evening: 'Evening\n5pm-9pm',
};

// Child colors matching the app theme
const CHILD_COLORS = [
  ModernColors.primary,     // pink
  ModernColors.success,     // green
  ModernColors.warning,     // amber
  '#06B6D4',               // cyan
  '#8B5CF6',               // purple
];

/**
 * Get color for a child based on index
 */
const getChildColor = (index: number): string => {
  return CHILD_COLORS[index % CHILD_COLORS.length];
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

  // Configuration state
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(getNextMonday());
  const [maxActivitiesPerChild, setMaxActivitiesPerChild] = useState(3);
  const [avoidBackToBack, setAvoidBackToBack] = useState(true);
  const [scheduleSiblingsTogether, setScheduleSiblingsTogether] = useState(false);
  const [childAvailability, setChildAvailability] = useState<ChildAvailability[]>([]);
  const [selectedChildTab, setSelectedChildTab] = useState(0);

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [entryApprovals, setEntryApprovals] = useState<Record<string, ApprovalState>>({});

  // Activity details cache (loaded from API when schedule is generated)
  const [activityDetails, setActivityDetails] = useState<Record<string, Activity>>({});
  const [loadingAlternative, setLoadingAlternative] = useState<string | null>(null);
  const activityService = ActivityService.getInstance();

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

  // Get unique child IDs from schedule
  const childIdsInSchedule = useMemo(() => {
    if (!schedule) return [];
    return [...new Set(Object.values(schedule.entries).flat().map(e => e.child_id))];
  }, [schedule]);

  // Get child info by ID
  const getChildInfo = useCallback((childId: string) => {
    const index = children.findIndex(c => c.id === childId);
    const child = children[index];
    return {
      name: child?.name || 'Child',
      color: getChildColor(index >= 0 ? index : 0),
      index,
    };
  }, [children]);

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

      const result = await aiService.planWeek(toISODateString(selectedWeekStart), {
        max_activities_per_child: maxActivitiesPerChild,
        avoid_back_to_back: avoidBackToBack,
        schedule_siblings_together: scheduleSiblingsTogether,
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
   * Set approval state for an entry
   */
  const setEntryApproval = (key: string, state: ApprovalState) => {
    setEntryApprovals(prev => ({ ...prev, [key]: state }));
  };

  /**
   * Navigate to activity details
   */
  const handleActivityPress = (entry: ScheduleEntry) => {
    navigation.navigate('ActivityDetail' as never, { id: entry.activity_id } as never);
  };

  /**
   * Request AI to find a different activity for this slot
   */
  const handleFindDifferent = async (entry: ScheduleEntry, uniqueKey: string, entryIndex: number) => {
    setLoadingAlternative(uniqueKey);

    try {
      // Get declined activity IDs to exclude
      const declinedActivityIds = Object.entries(entryApprovals)
        .filter(([_, state]) => state === 'declined')
        .map(([key]) => {
          // Extract activity_id from key format: childId-activityId-day-index
          const parts = key.split('-');
          return parts.length >= 2 ? parts[1] : null;
        })
        .filter(Boolean) as string[];

      // Add current activity to exclusions
      declinedActivityIds.push(entry.activity_id);

      // Request AI to find alternative
      const result = await aiService.findAlternativeActivity({
        child_id: entry.child_id,
        day: entry.day,
        time_slot: entry.time,
        excluded_activity_ids: declinedActivityIds,
        week_start: toISODateString(selectedWeekStart),
      });

      if (result.success && result.alternative) {
        // Update schedule with new activity
        setSchedule(prev => {
          if (!prev) return prev;
          const newEntries = { ...prev.entries };
          const dayEntries = [...(newEntries[entry.day] || [])];
          if (entryIndex < dayEntries.length) {
            dayEntries[entryIndex] = result.alternative;
            newEntries[entry.day] = dayEntries;
          }
          return { ...prev, entries: newEntries };
        });

        // Load activity details for new activity
        try {
          const activity = await activityService.getActivityDetails(result.alternative.activity_id);
          if (activity) {
            setActivityDetails(prev => ({ ...prev, [result.alternative.activity_id]: activity }));
          }
        } catch (err) {
          console.warn('Failed to load alternative activity details');
        }

        // Reset approval for new entry
        const newKey = `${result.alternative.child_id}-${result.alternative.activity_id}-${result.alternative.day}-${entryIndex}`;
        setEntryApprovals(prev => {
          const updated = { ...prev };
          delete updated[uniqueKey];
          updated[newKey] = 'pending';
          return updated;
        });
      } else {
        setError(result.error || 'No alternative activity found for this slot');
      }
    } catch (err) {
      console.error('Failed to find alternative:', err);
      setError('Failed to find alternative activity');
    } finally {
      setLoadingAlternative(null);
    }
  };

  /**
   * Add approved activities to calendar
   */
  const addApprovedToCalendar = () => {
    const approved = Object.entries(entryApprovals)
      .filter(([_, state]) => state === 'approved')
      .map(([key]) => key);

    // TODO: Integrate with calendar service
    console.log('Adding to calendar:', approved);
    // For now, show success message
    setError(null);
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
            {children.map((child, idx) => (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childTab,
                  selectedChildTab === idx && { backgroundColor: getChildColor(idx) + '20', borderColor: getChildColor(idx) },
                ]}
                onPress={() => setSelectedChildTab(idx)}
              >
                <View style={[styles.childTabDot, { backgroundColor: getChildColor(idx) }]} />
                <Text style={[
                  styles.childTabText,
                  selectedChildTab === idx && { color: getChildColor(idx), fontWeight: '600' },
                ]}>
                  {child.name}
                </Text>
              </TouchableOpacity>
            ))}
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
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.gridSlotCell,
                        isEnabled && { backgroundColor: getChildColor(selectedChildTab) + '30' },
                      ]}
                      onPress={() => toggleAvailability(currentChild.id, day, slot)}
                    >
                      {isEnabled && (
                        <Icon name="check" size={20} color={getChildColor(selectedChildTab)} />
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
  const renderDatePicker = () => (
    <Modal
      visible={showDatePicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowDatePicker(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Week</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
            <Icon name="close" size={24} color={ModernColors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.datePickerHint}>Select the Monday of the week you want to plan</Text>

        <Calendar
          current={toISODateString(selectedWeekStart)}
          onDayPress={(day: any) => {
            const selected = new Date(day.dateString);
            // Find the Monday of that week
            const dayOfWeek = selected.getDay();
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(selected);
            monday.setDate(selected.getDate() + diff);
            setSelectedWeekStart(monday);
            setShowDatePicker(false);
          }}
          markedDates={{
            [toISODateString(selectedWeekStart)]: {
              selected: true,
              selectedColor: ModernColors.primary,
            },
          }}
          theme={{
            selectedDayBackgroundColor: ModernColors.primary,
            todayTextColor: ModernColors.primary,
            arrowColor: ModernColors.primary,
          }}
        />
      </SafeAreaView>
    </Modal>
  );

  /**
   * Render a schedule entry card (ActivityCard-style)
   */
  const renderScheduleEntry = (entry: ScheduleEntry, dayIndex: number, entryIndex: number) => {
    const { name: childName, color: childColor } = getChildInfo(entry.child_id);
    const uniqueKey = `${entry.child_id}-${entry.activity_id}-${entry.day}-${entryIndex}`;
    const approvalState = entryApprovals[uniqueKey] || 'pending';
    const activity = activityDetails[entry.activity_id];
    const isLoadingAlternative = loadingAlternative === uniqueKey;

    // Get activity image
    const imageKey = activity ? getActivityImageKey(activity) : 'default';
    const fallbackImage = getActivityImageByKey(imageKey);

    return (
      <View
        key={uniqueKey}
        style={[
          styles.scheduleCard,
          approvalState === 'approved' && styles.scheduleCardApproved,
          approvalState === 'declined' && styles.scheduleCardDeclined,
        ]}
      >
        {/* Child color indicator bar at top */}
        <View style={[styles.childColorBar, { backgroundColor: childColor }]}>
          <Text style={styles.childColorBarText}>
            {entry.child_name || childName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.scheduleCardContent}
          onPress={() => handleActivityPress(entry)}
          activeOpacity={0.7}
        >
          {/* Activity Image */}
          <View style={styles.scheduleCardImageContainer}>
            {activity?.imageUrl ? (
              <OptimizedActivityImage
                activity={activity}
                style={styles.scheduleCardImage}
                fallbackImage={fallbackImage}
              />
            ) : (
              <Image source={fallbackImage} style={styles.scheduleCardImage} />
            )}
            {/* Time badge overlay */}
            <View style={styles.timeBadge}>
              <Icon name="clock-outline" size={12} color="#FFFFFF" />
              <Text style={styles.timeBadgeText}>{entry.time}</Text>
            </View>
          </View>

          {/* Activity Details */}
          <View style={styles.scheduleCardDetails}>
            <Text style={styles.scheduleCardTitle} numberOfLines={2}>
              {entry.activity_name}
            </Text>

            {/* Location */}
            <View style={styles.scheduleCardRow}>
              <Icon name="map-marker" size={14} color={ModernColors.textSecondary} />
              <Text style={styles.scheduleCardRowText} numberOfLines={1}>
                {entry.location}
              </Text>
            </View>

            {/* Duration & Cost */}
            <View style={styles.scheduleCardRow}>
              {entry.duration_minutes && (
                <>
                  <Icon name="timer-outline" size={14} color={ModernColors.textSecondary} />
                  <Text style={styles.scheduleCardRowText}>{entry.duration_minutes} min</Text>
                </>
              )}
              {activity?.cost !== undefined && activity.cost !== null && (
                <Text style={styles.scheduleCardCost}>
                  {formatActivityPrice(activity.cost)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          {/* Accept Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonAccept,
              approvalState === 'approved' && styles.actionButtonAcceptActive,
            ]}
            onPress={() => setEntryApproval(uniqueKey, approvalState === 'approved' ? 'pending' : 'approved')}
          >
            <Icon
              name={approvalState === 'approved' ? 'check-circle' : 'check'}
              size={18}
              color={approvalState === 'approved' ? '#FFFFFF' : ModernColors.success}
            />
            <Text style={[
              styles.actionButtonText,
              { color: approvalState === 'approved' ? '#FFFFFF' : ModernColors.success },
            ]}>
              {approvalState === 'approved' ? 'Accepted' : 'Accept'}
            </Text>
          </TouchableOpacity>

          {/* Decline Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonDecline,
              approvalState === 'declined' && styles.actionButtonDeclineActive,
            ]}
            onPress={() => setEntryApproval(uniqueKey, approvalState === 'declined' ? 'pending' : 'declined')}
          >
            <Icon
              name={approvalState === 'declined' ? 'close-circle' : 'close'}
              size={18}
              color={approvalState === 'declined' ? '#FFFFFF' : ModernColors.error}
            />
            <Text style={[
              styles.actionButtonText,
              { color: approvalState === 'declined' ? '#FFFFFF' : ModernColors.error },
            ]}>
              No
            </Text>
          </TouchableOpacity>

          {/* Find Different Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonAlternative]}
            onPress={() => handleFindDifferent(entry, uniqueKey, entryIndex)}
            disabled={isLoadingAlternative}
          >
            {isLoadingAlternative ? (
              <ActivityIndicator size="small" color={ModernColors.primary} />
            ) : (
              <>
                <Icon name="refresh" size={18} color={ModernColors.primary} />
                <Text style={[styles.actionButtonText, { color: ModernColors.primary }]}>
                  Different
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /**
   * Render a day column
   */
  const renderDayColumn = (day: string, dayIndex: number) => {
    const entries = schedule?.entries[day] || [];
    const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

    return (
      <View key={day} style={styles.dayColumn}>
        <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
            {day.substring(0, 3)}
          </Text>
        </View>
        <View style={styles.dayContent}>
          {entries.length > 0 ? (
            entries.map((entry, idx) => renderScheduleEntry(entry, dayIndex, idx))
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
   * Render suggestions section
   */
  const renderSuggestions = () => {
    if (!schedule?.suggestions || schedule.suggestions.length === 0) return null;

    return (
      <View style={styles.suggestionsSection}>
        <View style={styles.suggestionsHeader}>
          <Icon name="lightbulb-outline" size={20} color={ModernColors.primary} />
          <Text style={styles.suggestionsTitle}>AI Suggestions</Text>
        </View>
        {schedule.suggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionCard}>
            <Icon name="lightbulb-on" size={16} color={ModernColors.primary} />
            <Text style={styles.suggestionText}>{suggestion}</Text>
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

      {/* Week selection */}
      <View style={styles.configSection}>
        <Text style={styles.configSectionTitle}>Planning Week</Text>
        <TouchableOpacity
          style={styles.weekSelector}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="calendar" size={20} color={ModernColors.primary} />
          <Text style={styles.weekSelectorText}>
            Week of {formatDate(selectedWeekStart)}
          </Text>
          <Icon name="chevron-right" size={20} color={ModernColors.textSecondary} />
        </TouchableOpacity>
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
                    style={[
                      styles.childAvatar,
                      { backgroundColor: getChildColor(idx), marginLeft: idx > 0 ? -8 : 0 },
                    ]}
                  >
                    <Text style={styles.childAvatarText}>{child.name[0]}</Text>
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
              style={[styles.settingRow, styles.settingRowLast]}
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
   * Render floating action bar
   */
  const renderActionBar = () => {
    const approvedCount = Object.values(entryApprovals).filter(s => s === 'approved').length;

    if (!schedule || approvedCount === 0) return null;

    return (
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBarButton}
          onPress={addApprovedToCalendar}
        >
          <LinearGradient
            colors={ModernColors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionBarButtonGradient}
          >
            <Icon name="calendar-plus" size={20} color="#FFFFFF" />
            <Text style={styles.actionBarButtonText}>
              Add {approvedCount} to Calendar
            </Text>
          </LinearGradient>
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
              Week of {formatDate(selectedWeekStart)}
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
            {renderSummary()}
            {renderConflicts()}
            {renderSuggestions()}

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

  // Week selector
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

  // Suggestions
  suggestionsSection: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: ModernColors.primaryLight + '15',
    borderRadius: ModernBorderRadius.lg,
    borderWidth: 1,
    borderColor: ModernColors.primaryLight + '30',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: ModernColors.primaryDark,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: ModernColors.primaryDark,
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
    width: 160,
    marginRight: 12,
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
    ...ModernShadows.sm,
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
  childColorBar: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  childColorBarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scheduleCardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  scheduleCardImageContainer: {
    width: 80,
    height: 80,
    borderRadius: ModernBorderRadius.md,
    overflow: 'hidden',
    backgroundColor: ModernColors.background,
  },
  scheduleCardImage: {
    width: 80,
    height: 80,
    borderRadius: ModernBorderRadius.md,
  },
  timeBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scheduleCardDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  scheduleCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 6,
  },
  scheduleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  scheduleCardRowText: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    flex: 1,
  },
  scheduleCardCost: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.primary,
    marginLeft: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonAccept: {
    borderRightWidth: 1,
    borderRightColor: ModernColors.border,
  },
  actionButtonAcceptActive: {
    backgroundColor: ModernColors.success,
  },
  actionButtonDecline: {
    borderRightWidth: 1,
    borderRightColor: ModernColors.border,
  },
  actionButtonDeclineActive: {
    backgroundColor: ModernColors.error,
  },
  actionButtonAlternative: {
    backgroundColor: ModernColors.primaryLight + '20',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
    ...ModernShadows.lg,
  },
  actionBarButton: {
    borderRadius: ModernBorderRadius.lg,
    overflow: 'hidden',
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
});

export default WeeklyPlannerScreen;
