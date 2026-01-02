import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../../services/preferencesService';
import { useTheme } from '../../contexts/ThemeContext';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday', 
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const TIME_SLOTS = [
  { key: 'earlyMorning', label: 'Early Morning', time: '6:00 AM - 9:00 AM', icon: 'weather-sunset-up' },
  { key: 'morning', label: 'Morning', time: '9:00 AM - 12:00 PM', icon: 'weather-sunny' },
  { key: 'afternoon', label: 'Afternoon', time: '12:00 PM - 3:00 PM', icon: 'weather-partly-cloudy' },
  { key: 'lateAfternoon', label: 'Late Afternoon', time: '3:00 PM - 6:00 PM', icon: 'weather-sunset-down' },
  { key: 'evening', label: 'Evening', time: '6:00 PM - 9:00 PM', icon: 'weather-night' },
];

const SchedulePreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  
  const [selectedDays, setSelectedDays] = useState<string[]>(currentPreferences.daysOfWeek || []);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(() => {
    const times: string[] = [];
    const timePrefs = currentPreferences.timePreferences || {};
    
    // Check if we have the expanded format saved
    if (currentPreferences.expandedTimePreferences) {
      return currentPreferences.expandedTimePreferences;
    }
    
    // Convert old format to new format
    if (timePrefs.morning) {
      times.push('earlyMorning');
      times.push('morning');
    }
    if (timePrefs.afternoon) {
      times.push('afternoon');
      times.push('lateAfternoon');
    }
    if (timePrefs.evening) times.push('evening');
    
    // If no times selected, default to all
    if (times.length === 0) {
      return TIME_SLOTS.map(slot => slot.key);
    }
    
    return times;
  });
  
  const [daySelectionMode, setDaySelectionMode] = useState<'all' | 'specific'>(
    selectedDays.length === 7 ? 'all' : 'specific'
  );
  const [timeSelectionMode, setTimeSelectionMode] = useState<'all' | 'specific'>(
    selectedTimes.length === TIME_SLOTS.length ? 'all' : 'specific'
  );

  const toggleDay = (day: string) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const toggleTime = (timeKey: string) => {
    setSelectedTimes(prev => {
      if (prev.includes(timeKey)) {
        return prev.filter(t => t !== timeKey);
      } else {
        return [...prev, timeKey];
      }
    });
  };

  const selectWeekdays = () => {
    setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    setDaySelectionMode('specific');
  };

  const selectWeekends = () => {
    setSelectedDays(['Saturday', 'Sunday']);
    setDaySelectionMode('specific');
  };

  const selectAllDays = () => {
    setSelectedDays(DAYS_OF_WEEK);
    setDaySelectionMode('all');
  };

  const selectAllTimes = () => {
    setSelectedTimes(TIME_SLOTS.map(slot => slot.key));
    setTimeSelectionMode('all');
  };

  const handleSave = () => {
    // Convert new time format to old format for compatibility
    const timePreferences = {
      morning: selectedTimes.includes('earlyMorning') || selectedTimes.includes('morning'),
      afternoon: selectedTimes.includes('afternoon') || selectedTimes.includes('lateAfternoon'),
      evening: selectedTimes.includes('evening'),
    };

    preferencesService.updatePreferences({
      ...currentPreferences,
      daysOfWeek: selectedDays,
      timePreferences,
      expandedTimePreferences: selectedTimes, // Save the detailed time slots
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Schedule Preferences
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Days Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Preferred Days
          </Text>
          
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                daySelectionMode === 'all' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={selectAllDays}
            >
              <Text style={[
                styles.modeButtonText,
                { color: daySelectionMode === 'all' ? colors.primary : colors.text }
              ]}>
                Any Day
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                daySelectionMode === 'specific' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => setDaySelectionMode('specific')}
            >
              <Text style={[
                styles.modeButtonText,
                { color: daySelectionMode === 'specific' ? colors.primary : colors.text }
              ]}>
                Specific Days
              </Text>
            </TouchableOpacity>
          </View>

          {daySelectionMode === 'specific' && (
            <>
              <View style={styles.daysGrid}>
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.background,
                          borderColor: isSelected ? colors.primary : colors.border,
                        }
                      ]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[
                        styles.dayButtonText,
                        { color: isSelected ? '#FFF' : colors.text }
                      ]}>
                        {day.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* Times Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Preferred Times
          </Text>
          
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                timeSelectionMode === 'all' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={selectAllTimes}
            >
              <Text style={[
                styles.modeButtonText,
                { color: timeSelectionMode === 'all' ? colors.primary : colors.text }
              ]}>
                All Times
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                timeSelectionMode === 'specific' && { backgroundColor: colors.primary + '20' }
              ]}
              onPress={() => setTimeSelectionMode('specific')}
            >
              <Text style={[
                styles.modeButtonText,
                { color: timeSelectionMode === 'specific' ? colors.primary : colors.text }
              ]}>
                Specific Times
              </Text>
            </TouchableOpacity>
          </View>

          {timeSelectionMode === 'specific' && (
            <View style={styles.timeSlots}>
              {TIME_SLOTS.map(slot => {
                const isSelected = selectedTimes.includes(slot.key);
                return (
                  <TouchableOpacity
                    key={slot.key}
                    style={[
                      styles.timeSlot,
                      {
                        backgroundColor: isSelected ? colors.primary + '10' : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      }
                    ]}
                    onPress={() => toggleTime(slot.key)}
                  >
                    <View style={styles.timeSlotContent}>
                      <Icon
                        name={slot.icon}
                        size={24}
                        color={isSelected ? colors.primary : colors.text}
                      />
                      <View style={styles.timeSlotInfo}>
                        <Text style={[
                          styles.timeSlotLabel,
                          { color: isSelected ? colors.primary : colors.text }
                        ]}>
                          {slot.label}
                        </Text>
                        <Text style={[styles.timeSlotTime, { color: colors.textSecondary }]}>
                          {slot.time}
                        </Text>
                      </View>
                    </View>
                    <Icon
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Summary */}
        <View style={[styles.summary, { backgroundColor: colors.surface }]}>
          <Icon name="information" size={20} color={colors.primary} />
          <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
            Activities matching your schedule preferences will be prioritized in recommendations.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  quickButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: '13%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeSlots: {
    gap: 8,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  timeSlotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSlotInfo: {
    marginLeft: 12,
  },
  timeSlotLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeSlotTime: {
    fontSize: 12,
    marginTop: 2,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default SchedulePreferencesScreen;