import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChildAvatar, AvatarPicker, ColorPicker } from '../children';

export type Gender = 'male' | 'female' | null;

export interface ChildProfileData {
  name: string;
  birthDate: Date;
  gender: Gender;
  avatarId: number;
  colorId: number;
}

interface ChildProfileStepProps {
  data: ChildProfileData;
  onChange: (data: ChildProfileData) => void;
  showAvatar?: boolean;
}

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male', label: 'Boy', icon: 'face-man' },
  { value: 'female', label: 'Girl', icon: 'face-woman' },
  { value: null, label: 'Prefer not to say', icon: 'account' },
];

const ChildProfileStep: React.FC<ChildProfileStepProps> = ({
  data,
  onChange,
  showAvatar = true,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleNameChange = (name: string) => {
    onChange({ ...data, name });
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      onChange({ ...data, birthDate: selectedDate });
    }
  };

  const handleGenderSelect = (gender: Gender) => {
    onChange({ ...data, gender });
  };

  const handleAvatarSelect = (avatarId: number) => {
    onChange({ ...data, avatarId });
  };

  const handleColorSelect = (colorId: number) => {
    onChange({ ...data, colorId });
  };

  const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) {
      return 'Select date';
    }
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      {/* Avatar Preview */}
      {showAvatar && (
        <View style={styles.avatarSection}>
          <ChildAvatar
            name={data.name || 'Child'}
            avatarId={data.avatarId}
            colorId={data.colorId}
            size={100}
          />
        </View>
      )}

      {/* Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={data.name}
          onChangeText={handleNameChange}
          placeholder="Enter child's name"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      {/* Date of Birth */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="calendar" size={20} color="#E8638B" />
          <Text style={styles.datePickerText}>{formatDate(data.birthDate)}</Text>
          <Icon name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={data.birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(new Date().getFullYear() - 18, 0, 1)}
          />
        )}
      </View>

      {/* Gender Selection */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Gender</Text>
        <Text style={styles.helperText}>
          Used to show relevant activities (e.g., girls softball, boys basketball)
        </Text>
        <View style={styles.genderOptions}>
          {GENDER_OPTIONS.map((option) => {
            const isSelected = data.gender === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.genderOption,
                  isSelected && styles.genderOptionSelected,
                ]}
                onPress={() => handleGenderSelect(option.value)}
                activeOpacity={0.7}
              >
                <Icon
                  name={option.icon}
                  size={24}
                  color={isSelected ? '#E8638B' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.genderOptionText,
                    isSelected && styles.genderOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Icon name="check" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Avatar Selection */}
      <AvatarPicker
        selectedId={data.avatarId}
        colorId={data.colorId}
        onSelect={handleAvatarSelect}
      />

      {/* Color Selection */}
      <ColorPicker
        selectedId={data.colorId}
        onSelect={handleColorSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },
  genderOptions: {
    flexDirection: 'column',
    gap: 12,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  genderOptionSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E8638B',
  },
  genderOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  genderOptionTextSelected: {
    color: '#E8638B',
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8638B',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChildProfileStep;
