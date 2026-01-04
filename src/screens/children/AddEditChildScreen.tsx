import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import DateTimePicker from '@react-native-community/datetimepicker';
// react-native-image-picker is installed and loaded dynamically in handlePickImage
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  addChild,
  updateChild,
  selectAllChildren,
  selectChildrenLoading,
} from '../../store/slices/childrenSlice';
import { ChildAvatar, AvatarPicker, ColorPicker } from '../../components/children';
import {
  getNextAvailableAvatarId,
  getNextAvailableColorId,
} from '../../theme/childColors';
import childrenService from '../../services/childrenService';
import useSmartPaywallTrigger from '../../hooks/useSmartPaywallTrigger';
import { useTheme } from '../../contexts/ThemeContext';

type ChildrenStackParamList = {
  ChildrenList: undefined;
  AddEditChild: { childId?: string };
  ChildProfile: { childId: string };
};

type NavigationProp = StackNavigationProp<ChildrenStackParamList, 'AddEditChild'>;
type RouteProps = RouteProp<ChildrenStackParamList, 'AddEditChild'>;

const INTERESTS = [
  'Sports', 'Music', 'Art', 'Dance', 'Swimming',
  'Reading', 'Science', 'Nature', 'Cooking', 'Drama',
  'Coding', 'Math', 'Games', 'Crafts', 'Animals',
];

const AddEditChildScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const children = useAppSelector(selectAllChildren);
  const loading = useAppSelector(selectChildrenLoading);
  const { onChildAdded } = useSmartPaywallTrigger();

  const isEdit = !!route.params?.childId;
  const existingChild = isEdit
    ? children.find(c => c.id === route.params.childId)
    : null;

  const [name, setName] = useState(existingChild?.name || '');

  // Date picker state
  const [birthDate, setBirthDate] = useState(() => {
    if (existingChild?.dateOfBirth) {
      console.log('Loading existing child dateOfBirth:', existingChild.dateOfBirth);
      console.log('Type of dateOfBirth:', typeof existingChild.dateOfBirth);

      try {
        // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.SSSZ" formats
        const dateString = String(existingChild.dateOfBirth);

        // Extract just the date part (YYYY-MM-DD) if it's ISO 8601
        const datePart = dateString.split('T')[0];
        const parts = datePart.split('-');
        console.log('Date parts:', parts);

        if (parts.length === 3) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[2]);

          console.log('Parsed values:', { year, month, day });

          const parsedDate = new Date(year, month, day);
          console.log('Parsed date:', parsedDate.toString());
          console.log('isValid:', !isNaN(parsedDate.getTime()));

          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }

    // Default to 5 years ago
    const defaultDate = new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate());
    console.log('Using default date:', defaultDate.toString());
    return defaultDate;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    existingChild?.interests || []
  );
  const [allergies, setAllergies] = useState(existingChild?.allergies?.join(', ') || '');
  const [medicalInfo, setMedicalInfo] = useState(existingChild?.medicalInfo || '');
  const [avatarUri, setAvatarUri] = useState(existingChild?.avatar || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Get used avatars and colors from siblings for new children
  const usedAvatarIds = children
    .filter(c => c.id !== existingChild?.id)
    .map(c => c.avatarId)
    .filter((id): id is number => !!id);
  const usedColorIds = children
    .filter(c => c.id !== existingChild?.id)
    .map(c => c.colorId)
    .filter((id): id is number => !!id);

  const [avatarId, setAvatarId] = useState(
    existingChild?.avatarId ?? getNextAvailableAvatarId(usedAvatarIds)
  );
  const [colorId, setColorId] = useState(
    existingChild?.colorId ?? getNextAvailableColorId(usedColorIds)
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      console.log('DatePicker selected date:', selectedDate);
      console.log('Selected date details:', {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth(),
        date: selectedDate.getDate(),
        isValid: !isNaN(selectedDate.getTime())
      });
      setBirthDate(selectedDate);
    }
  };

  const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) {
      console.error('Invalid date passed to formatDate:', date);
      return 'Invalid Date';
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

  const handlePickImage = async () => {
    // Try to dynamically import image picker - this allows the app to work without the dependency
    try {
      const ImagePicker = require('react-native-image-picker');

      Alert.alert(
        'Choose Photo',
        'Select a source for the profile picture',
        [
          {
            text: 'Camera',
            onPress: async () => {
              const result = await ImagePicker.launchCamera({
                mediaType: 'photo',
                quality: 0.8,
                maxWidth: 500,
                maxHeight: 500,
              });
              if (result.assets?.[0]?.uri) {
                setAvatarUri(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibrary({
                mediaType: 'photo',
                quality: 0.8,
                maxWidth: 500,
                maxHeight: 500,
              });
              if (result.assets?.[0]?.uri) {
                setAvatarUri(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      // Image picker not installed - show helpful message
      Alert.alert(
        'Feature Not Available',
        'Photo upload requires additional setup. To enable this feature:\n\n' +
        '1. Run: npm install react-native-image-picker\n' +
        '2. Run: cd ios && pod install\n' +
        '3. Rebuild the app\n\n' +
        'For now, children will use a default avatar based on their name.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the child');
      return;
    }

    // Format date as YYYY-MM-DD in local timezone (not UTC)
    console.log('birthDate object:', birthDate);
    console.log('birthDate.getFullYear():', birthDate.getFullYear());
    console.log('birthDate.getMonth():', birthDate.getMonth());
    console.log('birthDate.getDate():', birthDate.getDate());

    const year = birthDate.getFullYear();
    const month = String(birthDate.getMonth() + 1).padStart(2, '0');
    const day = String(birthDate.getDate()).padStart(2, '0');
    // Format as ISO 8601 for API validation
    const dateOfBirth = `${year}-${month}-${day}T00:00:00.000Z`;

    console.log('Formatted dateOfBirth:', dateOfBirth);

    const childData = {
      name: name.trim(),
      dateOfBirth,
      interests: selectedInterests,
      allergies: allergies ? allergies.split(',').map(a => a.trim()) : undefined,
      medicalInfo: medicalInfo.trim() || undefined,
      avatar: avatarUri || undefined,
      avatarId,
      colorId,
    };

    console.log('Child data to save:', childData);

    try {
      if (isEdit && existingChild) {
        await dispatch(updateChild({
          id: existingChild.id,
          data: childData,
        })).unwrap();
        
        // Upload avatar if changed
        if (avatarUri && avatarUri !== existingChild.avatar && avatarUri.startsWith('file://')) {
          setUploadingAvatar(true);
          try {
            const result = await childrenService.uploadAvatar(existingChild.id, avatarUri);
            await dispatch(updateChild({
              id: existingChild.id,
              data: { avatar: result.avatarUrl },
            }));
          } catch (error) {
            console.error('Failed to upload avatar:', error);
          }
          setUploadingAvatar(false);
        }
      } else {
        const result = await dispatch(addChild(childData)).unwrap();

        // Trigger smart paywall after first child is added
        const newChildCount = children.length + 1;
        onChildAdded(newChildCount);

        // Upload avatar for new child
        if (result && avatarUri && avatarUri.startsWith('file://')) {
          setUploadingAvatar(true);
          try {
            const avatarResult = await childrenService.uploadAvatar(result.id, avatarUri);
            await dispatch(updateChild({
              id: result.id,
              data: { avatar: avatarResult.avatarUrl },
            }));
          } catch (error) {
            console.error('Failed to upload avatar:', error);
          }
          setUploadingAvatar(false);
        }
      }
      
      navigation.goBack();
    } catch (error: any) {
      // Extract user-friendly error message from API response
      const errorMessage = error?.response?.data?.error
        || error?.response?.data?.message
        || error?.message
        || `Failed to ${isEdit ? 'update' : 'add'} child`;
      Alert.alert('Unable to Save', errorMessage);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEdit ? 'Edit Child' : 'Add Child'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            {/* Recommendation tip */}
            <View style={styles.recommendationTip}>
              <MaterialCommunityIcon name="lightbulb-outline" size={20} color="#F59E0B" />
              <Text style={styles.recommendationTipText}>
                Adding date of birth helps us find age-appropriate activities for your child.
              </Text>
            </View>

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <ChildAvatar
                name={name || 'Child'}
                avatarId={avatarId}
                colorId={colorId}
                avatarUrl={avatarUri || undefined}
                size={100}
              />
            </View>

            {/* Avatar Selection */}
            <AvatarPicker
              selectedId={avatarId}
              colorId={colorId}
              onSelect={setAvatarId}
            />

            {/* Color Selection */}
            <ColorPicker
              selectedId={colorId}
              onSelect={setColorId}
            />

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={name}
                onChangeText={setName}
                placeholder="Enter child's name"
                placeholderTextColor={colors.textSecondary}
                keyboardAppearance="light"
                selectionColor={colors.primary}
              />
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar-today" size={20} color="#666" />
                <Text style={styles.datePickerText}>{formatDate(birthDate)}</Text>
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
              <Text style={styles.label}>Interests</Text>
              <View style={styles.interestsGrid}>
                {INTERESTS.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.interestChip,
                      selectedInterests.includes(interest) && styles.interestChipSelected,
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <Text
                      style={[
                        styles.interestText,
                        selectedInterests.includes(interest) && styles.interestTextSelected,
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Allergies */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Allergies (optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Enter allergies separated by commas"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
                keyboardAppearance="light"
                selectionColor={colors.primary}
              />
            </View>

            {/* Medical Info */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medical Information (optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={medicalInfo}
                onChangeText={setMedicalInfo}
                placeholder="Any important medical information"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                keyboardAppearance="light"
                selectionColor={colors.primary}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (loading || uploadingAvatar) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading || uploadingAvatar}
          >
            {(loading || uploadingAvatar) ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEdit ? 'Update Child' : 'Add Child'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  recommendationTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  recommendationTipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2196F3',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 14,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  interestChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  interestText: {
    fontSize: 14,
    color: '#666',
  },
  interestTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AddEditChildScreen;