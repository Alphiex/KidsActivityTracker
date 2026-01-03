import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { safeParseDateISO } from '../../utils/safeAccessors';
import { ModernColors } from '../../theme/modernTheme';
import { CHILD_COLORS } from '../../utils/calendarUtils';
import AddressAutocomplete from '../AddressAutocomplete/AddressAutocomplete';
import { EnhancedAddress } from '../../types/preferences';

interface Child {
  id: string;
  name: string;
  color: string;
}

interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event: CustomEvent) => Promise<void>;
  children: Child[];
  initialDate?: string;
  initialChildId?: string;
}

export interface CustomEvent {
  title: string;
  description: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  location: string;
  locationAddress?: EnhancedAddress | null;
  childId: string;
  recurring?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEndDate?: Date;
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  visible,
  onClose,
  onSave,
  children,
  initialDate,
  initialChildId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationAddress, setLocationAddress] = useState<EnhancedAddress | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  // Picker visibility states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRecurrenceEndPicker, setShowRecurrenceEndPicker] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setLocationAddress(null);
      setSelectedChildId(initialChildId || children[0]?.id || '');
      setRecurring('none');

      if (initialDate) {
        const parsedDate = safeParseDateISO(initialDate);
        setDate(parsedDate || new Date());
      } else {
        setDate(new Date());
      }

      // Default times
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      setStartTime(now);

      const endDefault = new Date(now);
      endDefault.setHours(endDefault.getHours() + 1);
      setEndTime(endDefault);

      // Default recurrence end to 1 month from now
      const recEnd = new Date();
      recEnd.setMonth(recEnd.getMonth() + 1);
      setRecurrenceEndDate(recEnd);
    }
  }, [visible, initialDate, initialChildId, children]);

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an event title.');
      return;
    }

    if (!selectedChildId) {
      Alert.alert('Required', 'Please select a child for this event.');
      return;
    }

    if (endTime <= startTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        date,
        startTime,
        endTime,
        location: locationAddress?.formattedAddress || '',
        locationAddress,
        childId: selectedChildId,
        recurring: recurring !== 'none' ? recurring : undefined,
        recurrenceEndDate: recurring !== 'none' ? recurrenceEndDate : undefined,
      });
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportToCalendar = (calendarType: 'apple' | 'google') => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter an event title first.');
      return;
    }

    const startDateTime = new Date(date);
    startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);

    const endDateTime = new Date(date);
    endDateTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    const location = locationAddress?.formattedAddress || '';

    if (calendarType === 'google') {
      // Google Calendar URL format
      const startStr = format(startDateTime, "yyyyMMdd'T'HHmmss");
      const endStr = format(endDateTime, "yyyyMMdd'T'HHmmss");
      const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
      Linking.openURL(googleUrl);
    } else {
      // Apple Calendar - use calendar:// scheme
      // Format: calendar://addEvent?title=X&startDate=X&endDate=X&notes=X&location=X
      const startStr = startDateTime.toISOString();
      const endStr = endDateTime.toISOString();
      const appleUrl = `calshow:${startDateTime.getTime() / 1000}`;

      // Try to open Calendar app - Note: iOS doesn't have a direct "add event" URL scheme
      // We'll show instructions instead
      Alert.alert(
        'Add to Apple Calendar',
        'To add this event to Apple Calendar:\n\n1. Open the Calendar app\n2. Tap + to add a new event\n3. Enter the event details\n\nWould you like to open Calendar now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Calendar',
            onPress: () => Linking.openURL('calshow:')
          }
        ]
      );
    }
  };

  const recurringOptions = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
  ];

  // Calculate how many events will be created
  const getRecurrenceCount = () => {
    if (recurring === 'none') return 1;

    let count = 0;
    let currentDate = new Date(date);
    const endDate = new Date(recurrenceEndDate);

    while (currentDate <= endDate && count < 100) {
      count++;
      switch (recurring) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'biweekly':
          currentDate = addWeeks(currentDate, 2);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
      }
    }

    return count;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
    if (selectedTime) {
      setStartTime(selectedTime);
      // Auto-adjust end time if it's now before start time
      if (selectedTime >= endTime) {
        const newEndTime = new Date(selectedTime);
        newEndTime.setHours(newEndTime.getHours() + 1);
        setEndTime(newEndTime);
      }
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }
    if (selectedTime) {
      setEndTime(selectedTime);
    }
  };

  const handleRecurrenceEndChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowRecurrenceEndPicker(false);
    }
    if (selectedDate) {
      setRecurrenceEndDate(selectedDate);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Event</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.headerButton}
              disabled={saving}
            >
              <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor={ModernColors.textMuted}
              />
            </View>

            {/* Child Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Child</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.childSelector}
              >
                {children.map((child, index) => (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childOption,
                      selectedChildId === child.id && styles.childOptionSelected,
                      { borderColor: child.color || CHILD_COLORS[index % CHILD_COLORS.length] },
                    ]}
                    onPress={() => setSelectedChildId(child.id)}
                  >
                    <View
                      style={[
                        styles.childDot,
                        { backgroundColor: child.color || CHILD_COLORS[index % CHILD_COLORS.length] },
                      ]}
                    />
                    <Text
                      style={[
                        styles.childName,
                        selectedChildId === child.id && styles.childNameSelected,
                      ]}
                    >
                      {child.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar" size={20} color={ModernColors.primary} />
                <Text style={styles.pickerText}>
                  {format(date, 'EEEE, MMMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* iOS inline date picker */}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor={ModernColors.text}
                />
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Android date picker */}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}

            {/* Time */}
            <View style={styles.timeRow}>
              <View style={[styles.inputGroup, styles.timeInput]}>
                <Text style={styles.label}>Start</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Icon name="clock-outline" size={20} color={ModernColors.primary} />
                  <Text style={styles.pickerText}>
                    {format(startTime, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputGroup, styles.timeInput]}>
                <Text style={styles.label}>End</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Icon name="clock-outline" size={20} color={ModernColors.primary} />
                  <Text style={styles.pickerText}>
                    {format(endTime, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* iOS inline start time picker */}
            {showStartTimePicker && Platform.OS === 'ios' && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  display="spinner"
                  onChange={handleStartTimeChange}
                  textColor={ModernColors.text}
                />
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  onPress={() => setShowStartTimePicker(false)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Android start time picker */}
            {showStartTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={handleStartTimeChange}
              />
            )}

            {/* iOS inline end time picker */}
            {showEndTimePicker && Platform.OS === 'ios' && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  display="spinner"
                  onChange={handleEndTimeChange}
                  textColor={ModernColors.text}
                />
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  onPress={() => setShowEndTimePicker(false)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Android end time picker */}
            {showEndTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={handleEndTimeChange}
              />
            )}

            {/* Location with Google Places */}
            <View style={[styles.inputGroup, { zIndex: 1000 }]}>
              <AddressAutocomplete
                label="Location (optional)"
                value={locationAddress}
                onAddressSelect={setLocationAddress}
                placeholder="Search for a location..."
                showFallbackOption={true}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add notes"
                placeholderTextColor={ModernColors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Recurring */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Repeat</Text>
              <View style={styles.recurringOptions}>
                {recurringOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.recurringOption,
                      recurring === option.value && styles.recurringOptionSelected,
                    ]}
                    onPress={() => setRecurring(option.value as any)}
                  >
                    <Text
                      style={[
                        styles.recurringText,
                        recurring === option.value && styles.recurringTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Recurrence End Date */}
            {recurring !== 'none' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Repeat Until</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowRecurrenceEndPicker(true)}
                >
                  <Icon name="calendar-end" size={20} color={ModernColors.primary} />
                  <Text style={styles.pickerText}>
                    {format(recurrenceEndDate, 'MMMM d, yyyy')}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.recurrenceInfo}>
                  This will create {getRecurrenceCount()} event{getRecurrenceCount() !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* iOS inline recurrence end picker */}
            {showRecurrenceEndPicker && Platform.OS === 'ios' && (
              <View style={styles.inlinePicker}>
                <DateTimePicker
                  value={recurrenceEndDate}
                  mode="date"
                  display="spinner"
                  minimumDate={date}
                  onChange={handleRecurrenceEndChange}
                  textColor={ModernColors.text}
                />
                <TouchableOpacity
                  style={styles.pickerDoneButton}
                  onPress={() => setShowRecurrenceEndPicker(false)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Android recurrence end picker */}
            {showRecurrenceEndPicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={recurrenceEndDate}
                mode="date"
                display="default"
                minimumDate={date}
                onChange={handleRecurrenceEndChange}
              />
            )}

            {/* Export to Calendar */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Export to External Calendar</Text>
              <View style={styles.exportButtons}>
                <TouchableOpacity
                  style={styles.exportButton}
                  onPress={() => handleExportToCalendar('apple')}
                >
                  <Icon name="apple" size={20} color={ModernColors.text} />
                  <Text style={styles.exportButtonText}>Apple Calendar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exportButton}
                  onPress={() => handleExportToCalendar('google')}
                >
                  <Icon name="google" size={20} color="#4285F4" />
                  <Text style={styles.exportButtonText}>Google Calendar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Spacer for keyboard */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: ModernColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: ModernColors.text,
  },
  cancelText: {
    fontSize: 16,
    color: ModernColors.textSecondary,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.primary,
    textAlign: 'right',
  },
  saveTextDisabled: {
    opacity: 0.5,
  },
  content: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: ModernColors.text,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  childSelector: {
    flexDirection: 'row',
  },
  childOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 10,
    backgroundColor: ModernColors.cardBackground,
  },
  childOptionSelected: {
    backgroundColor: ModernColors.primaryLight,
  },
  childDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  childName: {
    fontSize: 14,
    color: ModernColors.text,
  },
  childNameSelected: {
    fontWeight: '600',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ModernColors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  pickerText: {
    fontSize: 16,
    color: ModernColors.text,
    marginLeft: 10,
  },
  inlinePicker: {
    backgroundColor: ModernColors.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pickerDoneButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeInput: {
    flex: 1,
  },
  recurringOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurringOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: ModernColors.cardBackground,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  recurringOptionSelected: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  recurringText: {
    fontSize: 13,
    color: ModernColors.text,
  },
  recurringTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  recurrenceInfo: {
    fontSize: 12,
    color: ModernColors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ModernColors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ModernColors.border,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 14,
    color: ModernColors.text,
    fontWeight: '500',
  },
});

export default AddEventModal;
