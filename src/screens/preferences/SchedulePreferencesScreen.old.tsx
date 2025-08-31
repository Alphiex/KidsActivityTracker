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

const daysOfWeek = [
  { id: 'monday', name: 'Monday', short: 'Mon' },
  { id: 'tuesday', name: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', name: 'Wednesday', short: 'Wed' },
  { id: 'thursday', name: 'Thursday', short: 'Thu' },
  { id: 'friday', name: 'Friday', short: 'Fri' },
  { id: 'saturday', name: 'Saturday', short: 'Sat' },
  { id: 'sunday', name: 'Sunday', short: 'Sun' },
];

const timeSlots = [
  { id: 'morning', name: 'Morning', icon: 'weather-sunset-up', time: '6AM - 12PM' },
  { id: 'afternoon', name: 'Afternoon', icon: 'weather-sunny', time: '12PM - 5PM' },
  { id: 'evening', name: 'Evening', icon: 'weather-night', time: '5PM - 9PM' },
];

const SchedulePreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  const [selectedDays, setSelectedDays] = useState<string[]>(currentPreferences.daysOfWeek);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>(
    currentPreferences.timeSlots || ['morning', 'afternoon', 'evening']
  );

  const toggleDay = (dayId: string) => {
    setSelectedDays(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(id => id !== dayId);
      } else {
        return [...prev, dayId];
      }
    });
  };

  const toggleTimeSlot = (slotId: string) => {
    setSelectedTimeSlots(prev => {
      if (prev.includes(slotId)) {
        return prev.filter(id => id !== slotId);
      } else {
        return [...prev, slotId];
      }
    });
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      daysOfWeek: selectedDays,
      timeSlots: selectedTimeSlots,
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
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Select your preferred days and times for activities. We'll show you activities 
          that match your schedule.
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Preferred Days
          </Text>
          <View style={styles.daysGrid}>
            {daysOfWeek.map(day => {
              const isSelected = selectedDays.includes(day.id);
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayButton,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      { color: isSelected ? '#FFFFFF' : colors.text }
                    ]}
                  >
                    {day.short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Preferred Times
          </Text>
          {timeSlots.map(slot => {
            const isSelected = selectedTimeSlots.includes(slot.id);
            return (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.timeSlotItem,
                  {
                    backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => toggleTimeSlot(slot.id)}
              >
                <View style={styles.timeSlotContent}>
                  <Icon
                    name={slot.icon}
                    size={24}
                    color={isSelected ? colors.primary : colors.text}
                  />
                  <View style={styles.timeSlotText}>
                    <Text
                      style={[
                        styles.timeSlotName,
                        { color: isSelected ? colors.primary : colors.text }
                      ]}
                    >
                      {slot.name}
                    </Text>
                    <Text
                      style={[
                        styles.timeSlotTime,
                        { color: colors.textSecondary }
                      ]}
                    >
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

        <View style={[styles.quickActions, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
            }}
          >
            <Text style={[styles.quickActionText, { color: colors.primary }]}>
              Select Weekdays
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              setSelectedDays(['saturday', 'sunday']);
            }}
          >
            <Text style={[styles.quickActionText, { color: colors.primary }]}>
              Select Weekends
            </Text>
          </TouchableOpacity>
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
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  timeSlotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSlotText: {
    marginLeft: 12,
  },
  timeSlotName: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeSlotTime: {
    fontSize: 14,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  quickActionButton: {
    padding: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SchedulePreferencesScreen;