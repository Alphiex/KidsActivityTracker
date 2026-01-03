import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  addChild,
  updateChild,
  updateChildPreferences,
  selectAllChildren,
  selectChildrenLoading,
} from '../../store/slices/childrenSlice';
import {
  getNextAvailableAvatarId,
  getNextAvailableColorId,
} from '../../theme/childColors';
import {
  ChildProfileStep,
  ChildLocationStep,
  ChildActivitiesStep,
  ChildProfileData,
  ChildLocationData,
  ChildActivitiesData,
  Gender,
  SiblingWithLocation,
} from '../../components/childSetup';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { EnhancedAddress } from '../../types/preferences';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'ChildSetupWizard'>;
type ScreenRouteProp = RouteProp<OnboardingStackParamList, 'ChildSetupWizard'>;

type WizardStep = 'profile' | 'location' | 'activities';

const STEPS: { key: WizardStep; title: string; icon: string }[] = [
  { key: 'profile', title: 'About Your Child', icon: 'account' },
  { key: 'location', title: 'Location', icon: 'map-marker' },
  { key: 'activities', title: 'Activities', icon: 'run' },
];

const ChildSetupWizardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const dispatch = useAppDispatch();
  const scrollViewRef = useRef<ScrollView>(null);

  const children = useAppSelector(selectAllChildren);
  const isLoading = useAppSelector(selectChildrenLoading);

  // Route params
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isOnboarding = route.params?.isOnboarding ?? true; // Reserved for future navigation logic
  const editingChildId = route.params?.childId;
  const editingChild = editingChildId
    ? children.find(c => c.id === editingChildId)
    : null;

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('profile');
  const [isSaving, setIsSaving] = useState(false);

  // Get used avatars and colors from siblings for new children
  const usedAvatarIds = children.map(c => c.avatarId).filter((id): id is number => !!id);
  const usedColorIds = children.map(c => c.colorId).filter((id): id is number => !!id);

  // Form data
  const [profileData, setProfileData] = useState<ChildProfileData>(() => {
    if (editingChild) {
      return {
        name: editingChild.name,
        birthDate: new Date(editingChild.dateOfBirth),
        gender: (editingChild.gender as Gender) ?? null,
        avatarId: editingChild.avatarId ?? 1,
        colorId: editingChild.colorId ?? 1,
      };
    }
    return {
      name: '',
      birthDate: new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()),
      gender: null,
      avatarId: getNextAvailableAvatarId(usedAvatarIds),
      colorId: getNextAvailableColorId(usedColorIds),
    };
  });

  const [locationData, setLocationData] = useState<ChildLocationData>(() => {
    if (editingChild?.preferences) {
      return {
        savedAddress: editingChild.preferences.savedAddress as EnhancedAddress | null,
        distanceRadiusKm: editingChild.preferences.distanceRadiusKm ?? 25,
      };
    }
    return {
      savedAddress: null,
      distanceRadiusKm: 25,
    };
  });

  const [activitiesData, setActivitiesData] = useState<ChildActivitiesData>(() => {
    if (editingChild?.preferences) {
      return {
        preferredActivityTypes: editingChild.preferences.preferredActivityTypes ?? [],
      };
    }
    return {
      preferredActivityTypes: [],
    };
  });

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  // Siblings for copy feature (activities)
  const siblings = children
    .filter(c => c.id !== editingChildId)
    .map(c => ({
      id: c.id,
      name: c.name,
      preferredActivityTypes: c.preferences?.preferredActivityTypes ?? [],
    }));

  // Siblings for location copy feature
  const siblingsWithLocation: SiblingWithLocation[] = children
    .filter(c => c.id !== editingChildId)
    .filter(c => c.location || c.preferences?.savedAddress)
    .map(c => ({
      id: c.id,
      name: c.name,
      location: c.location,
      savedAddress: c.preferences?.savedAddress as EnhancedAddress | null | undefined,
    }));

  const handleBack = () => {
    if (isFirstStep) {
      navigation.goBack();
    } else {
      const prevStep = STEPS[currentStepIndex - 1];
      setCurrentStep(prevStep.key);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const validateProfile = (): boolean => {
    if (!profileData.name.trim()) {
      Alert.alert('Name Required', 'Please enter your child\'s name');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 'profile' && !validateProfile()) {
      return;
    }

    if (!isLastStep) {
      const nextStep = STEPS[currentStepIndex + 1];
      setCurrentStep(nextStep.key);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleSave();
    }
  };

  const handleSkip = () => {
    if (isLastStep) {
      handleSave();
    } else {
      handleNext();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Format birth date
      const birthDate = profileData.birthDate;
      const year = birthDate.getFullYear();
      const month = String(birthDate.getMonth() + 1).padStart(2, '0');
      const day = String(birthDate.getDate()).padStart(2, '0');
      const dateOfBirth = `${year}-${month}-${day}T00:00:00.000Z`;

      let childId: string;

      if (editingChild) {
        // Update existing child
        await dispatch(updateChild({
          id: editingChild.id,
          data: {
            name: profileData.name.trim(),
            dateOfBirth,
            gender: profileData.gender,
            avatarId: profileData.avatarId,
            colorId: profileData.colorId,
          },
        })).unwrap();
        childId = editingChild.id;
      } else {
        // Create new child
        const childResult = await dispatch(addChild({
          name: profileData.name.trim(),
          dateOfBirth,
          gender: profileData.gender,
          avatarId: profileData.avatarId,
          colorId: profileData.colorId,
        })).unwrap();
        if (!childResult) {
          throw new Error('Failed to create child');
        }
        childId = childResult.id;
      }

      // Save preferences
      await dispatch(updateChildPreferences({
        childId,
        updates: {
          savedAddress: locationData.savedAddress ?? undefined,
          distanceRadiusKm: locationData.distanceRadiusKm,
          distanceFilterEnabled: !!locationData.savedAddress,
          preferredActivityTypes: activitiesData.preferredActivityTypes,
        },
      })).unwrap();

      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('[ChildSetupWizard] Save error:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScrollToAddress = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 200, animated: true });
    }, 100);
  };

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 'profile':
        return editingChild ? `Edit ${editingChild.name}` : 'Add a Child';
      case 'location':
        return `Where does ${profileData.name || 'your child'} do activities?`;
      case 'activities':
        return `What activities interest ${profileData.name || 'your child'}?`;
      default:
        return '';
    }
  };

  const getButtonText = (): string => {
    if (isSaving) return 'Saving...';
    if (isLastStep) {
      return activitiesData.preferredActivityTypes.length > 0
        ? `Done (${activitiesData.preferredActivityTypes.length} selected)`
        : 'Done';
    }
    return 'Continue';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>

        {!isFirstStep && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            {STEPS.map((step, index) => (
              <View
                key={step.key}
                style={[
                  styles.stepDot,
                  index < currentStepIndex && styles.stepDotCompleted,
                  index === currentStepIndex && styles.stepDotActive,
                ]}
              />
            ))}
          </View>

          {/* Title */}
          <View style={styles.header}>
            <Text style={styles.title}>{getStepTitle()}</Text>
          </View>

          {/* Step Content */}
          <View style={styles.stepContent}>
            {currentStep === 'profile' && (
              <ChildProfileStep
                data={profileData}
                onChange={setProfileData}
                showAvatar={true}
              />
            )}

            {currentStep === 'location' && (
              <ChildLocationStep
                childName={profileData.name || 'your child'}
                data={locationData}
                onChange={setLocationData}
                onScrollToAddress={handleScrollToAddress}
                siblings={siblingsWithLocation}
              />
            )}

            {currentStep === 'activities' && (
              <ChildActivitiesStep
                childName={profileData.name || 'your child'}
                data={activitiesData}
                onChange={setActivitiesData}
                siblings={siblings}
              />
            )}
          </View>
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.nextButtonContainer}
            onPress={handleNext}
            activeOpacity={0.8}
            disabled={isSaving || isLoading}
          >
            <LinearGradient
              colors={isSaving || isLoading ? ['#9CA3AF', '#6B7280'] : ['#E8638B', '#D53F8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButton}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.nextButtonText}>{getButtonText()}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Step progress text */}
          <Text style={styles.progressText}>
            Step {currentStepIndex + 1} of {STEPS.length}
          </Text>
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
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#E8638B',
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: '#E8638B',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    minHeight: 400,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  nextButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  progressText: {
    textAlign: 'center',
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 13,
  },
});

export default ChildSetupWizardScreen;
