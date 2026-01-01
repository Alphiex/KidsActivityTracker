import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PreferencesService from '../../services/preferencesService';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

const { width: screenWidth } = Dimensions.get('window');

const ageGroups = [
  { id: 'toddler', label: 'Toddler', range: '1-3 years', icon: 'baby-carriage' },
  { id: 'preschool', label: 'Preschool', range: '3-5 years', icon: 'human-child' },
  { id: 'elementary', label: 'Elementary', range: '6-10 years', icon: 'human-male-child' },
  { id: 'preteen', label: 'Pre-teen', range: '11-13 years', icon: 'account' },
  { id: 'teen', label: 'Teen', range: '14-17 years', icon: 'account-group' },
];

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingAge'>;

const OnboardingAgeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const preferencesService = PreferencesService.getInstance();

  const [selectedAges, setSelectedAges] = useState<string[]>([]);

  const toggleAge = (ageId: string) => {
    setSelectedAges(prev =>
      prev.includes(ageId)
        ? prev.filter(a => a !== ageId)
        : [...prev, ageId]
    );
  };

  const handleNext = async () => {
    // Convert selected age groups to age range
    const ageRanges: { min?: number; max?: number } = {};

    if (selectedAges.includes('toddler')) {
      ageRanges.min = ageRanges.min ? Math.min(ageRanges.min, 1) : 1;
      ageRanges.max = ageRanges.max ? Math.max(ageRanges.max, 3) : 3;
    }
    if (selectedAges.includes('preschool')) {
      ageRanges.min = ageRanges.min ? Math.min(ageRanges.min, 3) : 3;
      ageRanges.max = ageRanges.max ? Math.max(ageRanges.max, 5) : 5;
    }
    if (selectedAges.includes('elementary')) {
      ageRanges.min = ageRanges.min ? Math.min(ageRanges.min, 6) : 6;
      ageRanges.max = ageRanges.max ? Math.max(ageRanges.max, 10) : 10;
    }
    if (selectedAges.includes('preteen')) {
      ageRanges.min = ageRanges.min ? Math.min(ageRanges.min, 11) : 11;
      ageRanges.max = ageRanges.max ? Math.max(ageRanges.max, 13) : 13;
    }
    if (selectedAges.includes('teen')) {
      ageRanges.min = ageRanges.min ? Math.min(ageRanges.min, 14) : 14;
      ageRanges.max = ageRanges.max ? Math.max(ageRanges.max, 17) : 17;
    }

    await preferencesService.updatePreferences({
      preferredAgeGroups: selectedAges,
      ageRange: ageRanges.min !== undefined ? ageRanges : undefined,
    });

    navigation.navigate('OnboardingLocation');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingLocation');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Icon name="arrow-left" size={24} color="#1F2937" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepDot} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
        </View>
        <Text style={styles.title}>What are your children's ages?</Text>
        <Text style={styles.subtitle}>Select all age groups that apply</Text>
      </View>

      <View style={styles.ageGroupsContainer}>
        {ageGroups.map((age) => {
          const isSelected = selectedAges.includes(age.id);
          return (
            <TouchableOpacity
              key={age.id}
              style={[styles.ageCard, isSelected && styles.ageCardSelected]}
              onPress={() => toggleAge(age.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                <Icon
                  name={age.icon}
                  size={28}
                  color={isSelected ? '#FFFFFF' : '#E8638B'}
                />
              </View>
              <View style={styles.ageTextContainer}>
                <Text style={[styles.ageLabel, isSelected && styles.ageLabelSelected]}>
                  {age.label}
                </Text>
                <Text style={[styles.ageRange, isSelected && styles.ageRangeSelected]}>
                  {age.range}
                </Text>
              </View>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Icon name="check" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.nextButtonContainer}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#E8638B', '#D53F8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
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
  },
  ageGroupsContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  ageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ageCardSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E8638B',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#E8638B',
  },
  ageTextContainer: {
    flex: 1,
  },
  ageLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  ageLabelSelected: {
    color: '#E8638B',
  },
  ageRange: {
    fontSize: 14,
    color: '#6B7280',
  },
  ageRangeSelected: {
    color: '#DC2626',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8638B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  nextButton: {
    backgroundColor: '#E8638B',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingAgeScreen;
