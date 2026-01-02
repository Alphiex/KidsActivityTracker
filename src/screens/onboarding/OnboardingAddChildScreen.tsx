import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppDispatch, useAppSelector } from '../../store';
import { addChild, selectChildrenLoading } from '../../store/slices/childrenSlice';
import { ChildAvatar } from '../../components/children';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingAddChild'>;

const INTERESTS = [
  'Sports', 'Music', 'Art', 'Dance', 'Swimming',
  'Reading', 'Science', 'Nature', 'Cooking', 'Drama',
];

const OnboardingAddChildScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectChildrenLoading);

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(() => {
    // Default to 5 years ago
    return new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate());
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) {
      return 'Select date';
    }
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your child\'s name');
      return;
    }

    const year = birthDate.getFullYear();
    const month = String(birthDate.getMonth() + 1).padStart(2, '0');
    const day = String(birthDate.getDate()).padStart(2, '0');
    const dateOfBirth = `${year}-${month}-${day}T00:00:00.000Z`;

    const childData = {
      name: name.trim(),
      dateOfBirth,
      interests: selectedInterests,
    };

    try {
      await dispatch(addChild(childData)).unwrap();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to add child. Please try again.');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Add a child</Text>
            <Text style={styles.subtitle}>
              Tell us about your child to personalize recommendations
            </Text>
          </View>

          {/* Avatar Preview */}
          <View style={styles.avatarSection}>
            <ChildAvatar name={name || 'Child'} size={100} />
          </View>

          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter child's name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
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
              <Text style={styles.datePickerText}>{formatDate(birthDate)}</Text>
              <Icon name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(new Date().getFullYear() - 18, 0, 1)}
              />
            )}
          </View>

          {/* Interests */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Interests (optional)</Text>
            <Text style={styles.helperText}>
              Select activities your child enjoys
            </Text>
            <View style={styles.interestsGrid}>
              {INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.interestChip,
                      isSelected && styles.interestChipSelected,
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <Text
                      style={[
                        styles.interestText,
                        isSelected && styles.interestTextSelected,
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.saveButtonContainer}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#9CA3AF', '#6B7280'] : ['#E8638B', '#D53F8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButton}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Add Child</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
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
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  interestChipSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E8638B',
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  interestTextSelected: {
    color: '#E8638B',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
  },
  saveButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingAddChildScreen;
