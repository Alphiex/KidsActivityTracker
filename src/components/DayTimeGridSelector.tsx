import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ModernColors } from '../theme/modernTheme';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type TimeSlot = typeof TIME_SLOTS[number];

export const TIME_SLOT_LABELS: Record<TimeSlot, { label: string; time: string }> = {
  morning: { label: 'Morning', time: '6am-12pm' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm' },
  evening: { label: 'Evening', time: '5pm-9pm' },
};

export interface DayTimeSlots {
  [day: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
}

interface DayTimeGridSelectorProps {
  /** Current selections - map of day -> time slots */
  selectedSlots: DayTimeSlots;
  /** Called when selection changes */
  onChange: (slots: DayTimeSlots) => void;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Accent color for selected items */
  accentColor?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/**
 * Create default day time slots with all slots enabled
 */
export const createDefaultDayTimeSlots = (): DayTimeSlots => {
  const slots: DayTimeSlots = {};
  DAYS_OF_WEEK.forEach(day => {
    slots[day] = { morning: true, afternoon: true, evening: true };
  });
  return slots;
};

/**
 * Create empty day time slots with all slots disabled
 */
export const createEmptyDayTimeSlots = (): DayTimeSlots => {
  const slots: DayTimeSlots = {};
  DAYS_OF_WEEK.forEach(day => {
    slots[day] = { morning: false, afternoon: false, evening: false };
  });
  return slots;
};

/**
 * DayTimeGridSelector - A 7x3 grid for selecting day + time combinations
 *
 * Features:
 * - 7 day rows (Mon-Sun) × 3 time columns (Morning, Afternoon, Evening)
 * - Tap cell to toggle individual slot
 * - Tap day label to toggle entire row
 * - Tap time header to toggle entire column
 */
const DayTimeGridSelector: React.FC<DayTimeGridSelectorProps> = ({
  selectedSlots,
  onChange,
  compact = false,
  accentColor = ModernColors.primary,
  disabled = false,
}) => {
  // Toggle a single slot
  const toggleSlot = useCallback((day: string, slot: TimeSlot) => {
    if (disabled) return;

    const newSlots = { ...selectedSlots };
    if (!newSlots[day]) {
      newSlots[day] = { morning: false, afternoon: false, evening: false };
    }
    newSlots[day] = {
      ...newSlots[day],
      [slot]: !newSlots[day][slot],
    };
    onChange(newSlots);
  }, [selectedSlots, onChange, disabled]);

  // Toggle an entire day (row)
  const toggleDay = useCallback((day: string) => {
    if (disabled) return;

    const currentDaySlots = selectedSlots[day] || { morning: false, afternoon: false, evening: false };
    const allEnabled = currentDaySlots.morning && currentDaySlots.afternoon && currentDaySlots.evening;

    const newSlots = { ...selectedSlots };
    newSlots[day] = {
      morning: !allEnabled,
      afternoon: !allEnabled,
      evening: !allEnabled,
    };
    onChange(newSlots);
  }, [selectedSlots, onChange, disabled]);

  // Toggle an entire time slot (column)
  const toggleTimeColumn = useCallback((slot: TimeSlot) => {
    if (disabled) return;

    // Check if all days have this slot enabled
    const allEnabled = DAYS_OF_WEEK.every(day => selectedSlots[day]?.[slot] ?? false);

    const newSlots = { ...selectedSlots };
    DAYS_OF_WEEK.forEach(day => {
      if (!newSlots[day]) {
        newSlots[day] = { morning: false, afternoon: false, evening: false };
      }
      newSlots[day] = {
        ...newSlots[day],
        [slot]: !allEnabled,
      };
    });
    onChange(newSlots);
  }, [selectedSlots, onChange, disabled]);

  // Check if a slot is enabled
  const isSlotEnabled = useCallback((day: string, slot: TimeSlot): boolean => {
    return selectedSlots[day]?.[slot] ?? false;
  }, [selectedSlots]);

  // Check if entire day is enabled
  const isDayFullyEnabled = useCallback((day: string): boolean => {
    const daySlots = selectedSlots[day];
    if (!daySlots) return false;
    return daySlots.morning && daySlots.afternoon && daySlots.evening;
  }, [selectedSlots]);

  // Check if entire column is enabled
  const isColumnFullyEnabled = useCallback((slot: TimeSlot): boolean => {
    return DAYS_OF_WEEK.every(day => selectedSlots[day]?.[slot] ?? false);
  }, [selectedSlots]);

  const cellSize = compact ? 36 : 44;
  const dayLabelWidth = compact ? 40 : 50;
  const fontSize = compact ? 11 : 13;

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row */}
          <View style={styles.gridRow}>
            <View style={[styles.gridDayCell, { width: dayLabelWidth }]} />
            {TIME_SLOTS.map(slot => {
              const isFullColumn = isColumnFullyEnabled(slot);
              return (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.gridHeaderCell,
                    { width: cellSize + 16, height: compact ? 40 : 48 },
                    isFullColumn && { backgroundColor: accentColor + '15' },
                  ]}
                  onPress={() => toggleTimeColumn(slot)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.gridHeaderLabel,
                    { fontSize: fontSize },
                    isFullColumn && { color: accentColor, fontWeight: '600' },
                  ]}>
                    {TIME_SLOT_LABELS[slot].label}
                  </Text>
                  <Text style={[
                    styles.gridHeaderTime,
                    { fontSize: fontSize - 2 },
                    isFullColumn && { color: accentColor },
                  ]}>
                    {TIME_SLOT_LABELS[slot].time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Day rows */}
          {DAYS_OF_WEEK.map(day => {
            const isFullDay = isDayFullyEnabled(day);
            return (
              <View key={day} style={styles.gridRow}>
                <TouchableOpacity
                  style={[
                    styles.gridDayCell,
                    { width: dayLabelWidth, height: cellSize },
                    isFullDay && { backgroundColor: accentColor + '15' },
                  ]}
                  onPress={() => toggleDay(day)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.gridDayText,
                    { fontSize: fontSize },
                    isFullDay && { color: accentColor, fontWeight: '600' },
                  ]}>
                    {day.substring(0, 3)}
                  </Text>
                </TouchableOpacity>
                {TIME_SLOTS.map(slot => {
                  const isEnabled = isSlotEnabled(day, slot);
                  return (
                    <TouchableOpacity
                      key={slot}
                      style={[
                        styles.gridSlotCell,
                        { width: cellSize + 16, height: cellSize },
                        isEnabled && { backgroundColor: accentColor + '20' },
                      ]}
                      onPress={() => toggleSlot(day, slot)}
                      disabled={disabled}
                      activeOpacity={0.7}
                    >
                      {isEnabled && (
                        <Icon name="check" size={compact ? 16 : 20} color={accentColor} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Quick select buttons */}
      <View style={styles.quickSelectRow}>
        <TouchableOpacity
          style={styles.quickSelectButton}
          onPress={() => onChange(createDefaultDayTimeSlots())}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickSelectText, { color: accentColor }]}>Select All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickSelectButton}
          onPress={() => onChange(createEmptyDayTimeSlots())}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickSelectText, { color: ModernColors.textLight }]}>Clear All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridDayCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginRight: 4,
  },
  gridDayText: {
    fontWeight: '500',
    color: ModernColors.text,
  },
  gridHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  gridHeaderLabel: {
    fontWeight: '500',
    color: ModernColors.text,
    textAlign: 'center',
  },
  gridHeaderTime: {
    color: ModernColors.textLight,
    textAlign: 'center',
    marginTop: 2,
  },
  gridSlotCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
    marginVertical: 2,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickSelectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  quickSelectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickSelectText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DayTimeGridSelector;
