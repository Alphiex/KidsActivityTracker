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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { ModernColors } from '../../theme/modernTheme';
import { CHILD_COLORS } from '../../utils/calendarUtils';

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
}

export interface CustomEvent {
  title: string;
  description: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  location: string;
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
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
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
      setLocation('');
      setSelectedChildId(children[0]?.id || '');
      setRecurring('none');

      if (initialDate) {
        const parsedDate = parseISO(initialDate);
        setDate(parsedDate);
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
  }, [visible, initialDate, children]);

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
        location: location.trim(),
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

  const recurringOptions = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
  ];

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

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) setDate(selectedDate);
                  }}
                />
              )}
            </View>

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
                {showStartTimePicker && (
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setShowStartTimePicker(Platform.OS === 'ios');
                      if (selectedTime) setStartTime(selectedTime);
                    }}
                  />
                )}
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
                {showEndTimePicker && (
                  <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                      setShowEndTimePicker(Platform.OS === 'ios');
                      if (selectedTime) setEndTime(selectedTime);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location (optional)</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Add location"
                placeholderTextColor={ModernColors.textMuted}
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
                {showRecurrenceEndPicker && (
                  <DateTimePicker
                    value={recurrenceEndDate}
                    mode="date"
                    display="default"
                    minimumDate={date}
                    onChange={(event, selectedDate) => {
                      setShowRecurrenceEndPicker(Platform.OS === 'ios');
                      if (selectedDate) setRecurrenceEndDate(selectedDate);
                    }}
                  />
                )}
              </View>
            )}

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
});

export default AddEventModal;
