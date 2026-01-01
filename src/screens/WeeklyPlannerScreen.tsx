import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import aiService from '../services/aiService';
import { WeeklySchedule, ScheduleEntry } from '../types/ai';
import { useTheme } from '../contexts/ThemeContext';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Colors for children
const CHILD_COLORS = [
  '#E8638B', // teal
  '#10B981', // green
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#8B5CF6', // purple
];

/**
 * Get color for a child based on their ID
 */
const getChildColor = (childId: string, childIds: string[]): string => {
  const index = childIds.indexOf(childId);
  return CHILD_COLORS[index % CHILD_COLORS.length];
};

/**
 * Weekly Planner Screen
 * AI-generated optimal weekly activity schedule for families
 */
const WeeklyPlannerScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>(getNextMonday());

  // Constraints state
  const [maxActivitiesPerChild, setMaxActivitiesPerChild] = useState(3);
  const [avoidBackToBack, setAvoidBackToBack] = useState(true);

  // Get all unique child IDs from schedule
  const childIds = schedule
    ? [...new Set(Object.values(schedule.entries).flat().map(e => e.child_id))]
    : [];

  /**
   * Get the next Monday date
   */
  function getNextMonday(): string {
    const today = new Date();
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }

  /**
   * Format date for display
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  /**
   * Generate AI schedule
   */
  const generateSchedule = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await aiService.planWeek(selectedWeek, {
        max_activities_per_child: maxActivitiesPerChild,
        avoid_back_to_back: avoidBackToBack,
      });

      if (result.success && result.schedule) {
        setSchedule(result.schedule);
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
   * Refresh schedule
   */
  const onRefresh = async () => {
    setIsRefreshing(true);
    await generateSchedule();
    setIsRefreshing(false);
  };

  /**
   * Navigate to activity details
   */
  const handleActivityPress = (entry: ScheduleEntry) => {
    navigation.navigate('ActivityDetail' as never, { id: entry.activity_id } as never);
  };

  /**
   * Render a schedule entry card
   */
  const renderScheduleEntry = (entry: ScheduleEntry) => {
    const childColor = getChildColor(entry.child_id, childIds);

    return (
      <TouchableOpacity
        key={`${entry.child_id}-${entry.activity_id}-${entry.time}`}
        style={[styles.entryCard, { borderLeftColor: childColor }]}
        onPress={() => handleActivityPress(entry)}
      >
        <View style={styles.entryTime}>
          <Text style={styles.entryTimeText}>{entry.time}</Text>
          {entry.duration_minutes && (
            <Text style={styles.entryDuration}>{entry.duration_minutes} min</Text>
          )}
        </View>
        <View style={styles.entryContent}>
          <Text style={styles.entryActivityName}>{entry.activity_name}</Text>
          <View style={styles.entryMeta}>
            <View style={[styles.childBadge, { backgroundColor: childColor + '20' }]}>
              <Text style={[styles.childBadgeText, { color: childColor }]}>
                {entry.child_name || 'Child'}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={12} color="#6B7280" />
              <Text style={styles.entryLocation}>{entry.location}</Text>
            </View>
          </View>
        </View>
        <Icon name="chevron-right" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  /**
   * Render a day column
   */
  const renderDayColumn = (day: string) => {
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
            entries.map(entry => renderScheduleEntry(entry))
          ) : (
            <View style={styles.emptyDay}>
              <Icon name="calendar-blank" size={24} color="#D1D5DB" />
              <Text style={styles.emptyDayText}>No activities</Text>
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
          <Icon name="alert-circle" size={20} color="#F59E0B" />
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
              color="#F59E0B"
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
          <Icon name="lightbulb-outline" size={20} color="#6B46C1" />
          <Text style={styles.suggestionsTitle}>AI Suggestions</Text>
        </View>
        {schedule.suggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionCard}>
            <Icon name="sparkles" size={16} color="#6B46C1" />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="calendar-star" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>Plan Your Week</Text>
      <Text style={styles.emptyStateDescription}>
        Let AI create an optimal activity schedule for your family, balancing
        activities across children and avoiding conflicts.
      </Text>

      {/* Constraints */}
      <View style={styles.constraintsSection}>
        <Text style={styles.constraintsTitle}>Settings</Text>

        <View style={styles.constraintRow}>
          <Text style={styles.constraintLabel}>Max activities per child</Text>
          <View style={styles.constraintStepper}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setMaxActivitiesPerChild(Math.max(1, maxActivitiesPerChild - 1))}
            >
              <Icon name="minus" size={18} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{maxActivitiesPerChild}</Text>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={() => setMaxActivitiesPerChild(Math.min(10, maxActivitiesPerChild + 1))}
            >
              <Icon name="plus" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.constraintRow}
          onPress={() => setAvoidBackToBack(!avoidBackToBack)}
        >
          <Text style={styles.constraintLabel}>Avoid back-to-back activities</Text>
          <Icon
            name={avoidBackToBack ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={avoidBackToBack ? '#6B46C1' : '#9CA3AF'}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.generateButton} onPress={generateSchedule}>
        <Icon name="robot" size={20} color="#FFFFFF" />
        <Text style={styles.generateButtonText}>Generate Schedule</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render schedule summary
   */
  const renderSummary = () => {
    if (!schedule) return null;

    return (
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Icon name="calendar-check" size={24} color="#10B981" />
          <View>
            <Text style={styles.summaryValue}>{schedule.total_activities}</Text>
            <Text style={styles.summaryLabel}>Activities</Text>
          </View>
        </View>
        {schedule.total_cost !== undefined && (
          <View style={styles.summaryCard}>
            <Icon name="currency-usd" size={24} color="#F59E0B" />
            <View>
              <Text style={styles.summaryValue}>${schedule.total_cost}</Text>
              <Text style={styles.summaryLabel}>Total Cost</Text>
            </View>
          </View>
        )}
        <View style={styles.summaryCard}>
          <Icon name="account-group" size={24} color="#E8638B" />
          <View>
            <Text style={styles.summaryValue}>{childIds.length}</Text>
            <Text style={styles.summaryLabel}>Children</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Weekly Planner</Text>
          <Text style={styles.headerSubtitle}>
            Week of {formatDate(selectedWeek)}
          </Text>
        </View>
        {schedule && (
          <TouchableOpacity onPress={generateSchedule} disabled={isLoading}>
            <Icon name="refresh" size={24} color={isLoading ? '#D1D5DB' : '#6B46C1'} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
          <Text style={styles.loadingText}>Generating optimal schedule...</Text>
          <Text style={styles.loadingSubtext}>
            AI is analyzing activities for your family
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={generateSchedule}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : !schedule ? (
        renderEmptyState()
      ) : (
        <ScrollView
          style={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          {renderSummary()}
          {renderConflicts()}
          {renderSuggestions()}

          {/* Calendar view */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.calendarContainer}>
              {DAYS_OF_WEEK.map(day => renderDayColumn(day))}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legendSection}>
            <Text style={styles.legendTitle}>Children</Text>
            <View style={styles.legendItems}>
              {childIds.map(childId => {
                const entry = Object.values(schedule.entries)
                  .flat()
                  .find(e => e.child_id === childId);
                return (
                  <View key={childId} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendColor,
                        { backgroundColor: getChildColor(childId, childIds) },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {entry?.child_name || 'Child'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#6B46C1',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyStateDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  constraintsSection: {
    width: '100%',
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  constraintsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  constraintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  constraintLabel: {
    fontSize: 14,
    color: '#374151',
  },
  constraintStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#6B46C1',
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  conflictsSection: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
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
  suggestionsSection: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
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
    color: '#6B21A8',
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
    color: '#6B21A8',
    lineHeight: 18,
  },
  calendarContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
  },
  dayColumn: {
    width: 160,
    marginRight: 12,
  },
  dayHeader: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayHeaderToday: {
    backgroundColor: '#6B46C1',
    borderColor: '#6B46C1',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    gap: 10,
  },
  entryTime: {
    alignItems: 'center',
  },
  entryTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  entryDuration: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  entryContent: {
    flex: 1,
  },
  entryActivityName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 6,
  },
  entryMeta: {
    gap: 4,
  },
  childBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  childBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  entryLocation: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyDayText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  legendSection: {
    padding: 16,
    paddingTop: 0,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    color: '#6B7280',
  },
});

export default WeeklyPlannerScreen;
