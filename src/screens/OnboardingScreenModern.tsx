import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import PreferencesService from '../services/preferencesService';
import { appEventEmitter, APP_EVENTS } from '../utils/eventEmitter';
import ActivityService from '../services/activityService';
import { API_CONFIG } from '../config/api';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../theme/modernTheme';

const { width, height } = Dimensions.get('window');

interface ActivityType {
  id: string;
  name: string;
  code: string;
  icon?: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
}

const OnboardingScreenModern = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Data from API
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Onboarding state
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState({ min: 0, max: 18 });
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 500 });
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]);
  const [timePreferences, setTimePreferences] = useState({
    morning: true,
    afternoon: true,
    evening: true,
  });

  const steps = [
    {
      title: 'Welcome to Kids Activity Tracker',
      subtitle: "Let's personalize your experience",
      component: renderWelcome,
    },
    {
      title: 'What activities interest your child?',
      subtitle: 'Select all that apply',
      component: renderActivityTypes,
    },
    {
      title: 'How old is your child?',
      subtitle: 'This helps us find age-appropriate activities',
      component: renderAgeRange,
    },
    {
      title: 'Where are you looking?',
      subtitle: 'Select your preferred locations',
      component: renderLocations,
    },
    {
      title: "What's your budget?",
      subtitle: 'Set your price range per session',
      component: renderPriceRange,
    },
    {
      title: 'When are you available?',
      subtitle: 'Select your preferred days and times',
      component: renderSchedule,
    },
  ];

  useEffect(() => {
    loadActivityTypes();
    loadLocations();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/activity-types`);
      const result = await response.json();

      if (result.success && result.data && Array.isArray(result.data)) {
        // Add icons to activity types
        const typesWithIcons = result.data.map((type: any) => ({
          ...type,
          icon: getIconForActivityType(type.name),
        }));
        setActivityTypes(typesWithIcons);
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
      // Use fallback activity types
      setActivityTypes([
        { id: '1', name: 'Sports', code: 'sports', icon: 'basketball' },
        { id: '2', name: 'Arts', code: 'arts', icon: 'palette' },
        { id: '3', name: 'Music', code: 'music', icon: 'music' },
        { id: '4', name: 'Dance', code: 'dance', icon: 'dance-ballroom' },
        { id: '5', name: 'Swimming', code: 'swimming', icon: 'swim' },
        { id: '6', name: 'Camps', code: 'camps', icon: 'tent' },
      ]);
    }
  };

  const loadLocations = async () => {
    try {
      const locationData = await activityService.getLocations();
      setLocations(locationData || []);
    } catch (error) {
      console.error('Error loading locations:', error);
      // Use fallback locations
      setLocations([
        { id: '1', name: 'North Vancouver', city: 'North Vancouver' },
        { id: '2', name: 'West Vancouver', city: 'West Vancouver' },
        { id: '3', name: 'Vancouver', city: 'Vancouver' },
        { id: '4', name: 'Burnaby', city: 'Burnaby' },
        { id: '5', name: 'Richmond', city: 'Richmond' },
      ]);
    }
  };

  const getIconForActivityType = (name: string): string => {
    const iconMap: { [key: string]: string } = {
      'Sports': 'basketball',
      'Martial Arts': 'karate',
      'Arts': 'palette',
      'Music': 'music',
      'Dance': 'dance-ballroom',
      'Swimming': 'swim',
      'Aquatic': 'pool',
      'Camps': 'tent',
      'Fitness': 'dumbbell',
      'Education': 'school',
      'Drama': 'drama-masks',
      'Outdoor': 'hiking',
    };

    for (const [key, icon] of Object.entries(iconMap)) {
      if (name.includes(key)) {
        return icon;
      }
    }
    return 'star';
  };

  function renderWelcome() {
    return (
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeIconContainer}>
            <Icon name="hand-wave" size={60} color={ModernColors.primary} />
          </View>
          <Text style={styles.welcomeTitle}>Welcome!</Text>
          <Text style={styles.welcomeDescription}>
            We'll help you discover amazing activities for your children. This will only take a few moments.
          </Text>
          <View style={styles.welcomeFeatures}>
            <View style={styles.featureRow}>
              <Icon name="map-marker" size={24} color={ModernColors.primary} />
              <Text style={styles.featureText}>Find activities near you</Text>
            </View>
            <View style={styles.featureRow}>
              <Icon name="calendar-check" size={24} color={ModernColors.primary} />
              <Text style={styles.featureText}>Match your schedule</Text>
            </View>
            <View style={styles.featureRow}>
              <Icon name="tag" size={24} color={ModernColors.primary} />
              <Text style={styles.featureText}>Within your budget</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  function renderActivityTypes() {
    return (
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.gridContainer}>
          {activityTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.activityTypeCard,
                selectedActivityTypes.includes(type.code) && styles.activityTypeCardSelected,
              ]}
              onPress={() => toggleActivityType(type.code)}
            >
              <Icon
                name={type.icon || 'star'}
                size={32}
                color={selectedActivityTypes.includes(type.code) ? ModernColors.primary : ModernColors.textSecondary}
              />
              <Text style={[
                styles.activityTypeName,
                selectedActivityTypes.includes(type.code) && styles.activityTypeNameSelected,
              ]}>
                {type.name}
              </Text>
              {selectedActivityTypes.includes(type.code) && (
                <View style={styles.selectedCheckmark}>
                  <Icon name="check" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  function renderAgeRange() {
    return (
      <View style={styles.contentContainer}>
        <View style={styles.ageCard}>
          <View style={styles.ageDisplay}>
            <View style={styles.ageValueContainer}>
              <Text style={styles.ageLabel}>Min Age</Text>
              <Text style={styles.ageValue}>{ageRange.min}</Text>
            </View>
            <Icon name="arrow-right" size={24} color={ModernColors.textSecondary} />
            <View style={styles.ageValueContainer}>
              <Text style={styles.ageLabel}>Max Age</Text>
              <Text style={styles.ageValue}>{ageRange.max}</Text>
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Minimum Age</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderMinMax}>0</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={18}
                step={1}
                value={ageRange.min}
                onValueChange={(value) => {
                  const newMin = Math.min(value, ageRange.max);
                  setAgeRange({ ...ageRange, min: newMin });
                }}
                minimumTrackTintColor={ModernColors.primary}
                maximumTrackTintColor={ModernColors.border}
                thumbTintColor={ModernColors.primary}
              />
              <Text style={styles.sliderMinMax}>18</Text>
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Maximum Age</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderMinMax}>0</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={18}
                step={1}
                value={ageRange.max}
                onValueChange={(value) => {
                  const newMax = Math.max(value, ageRange.min);
                  setAgeRange({ ...ageRange, max: newMax });
                }}
                minimumTrackTintColor={ModernColors.primary}
                maximumTrackTintColor={ModernColors.border}
                thumbTintColor={ModernColors.primary}
              />
              <Text style={styles.sliderMinMax}>18</Text>
            </View>
          </View>

          <View style={styles.agePresets}>
            <Text style={styles.presetsLabel}>Quick Select:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setAgeRange({ min: 0, max: 3 })}
              >
                <Text style={styles.presetChipText}>Baby (0-3)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setAgeRange({ min: 4, max: 6 })}
              >
                <Text style={styles.presetChipText}>Preschool (4-6)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setAgeRange({ min: 7, max: 12 })}
              >
                <Text style={styles.presetChipText}>School Age (7-12)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setAgeRange({ min: 13, max: 18 })}
              >
                <Text style={styles.presetChipText}>Teen (13-18)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  function renderLocations() {
    // Group locations by city
    const cityGroups = locations.reduce((acc, location) => {
      const city = location.city || 'Other';
      if (!acc[city]) {
        acc[city] = [];
      }
      acc[city].push(location);
      return acc;
    }, {} as { [key: string]: Location[] });

    return (
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.selectAllButton, selectedLocations.length === 0 && styles.selectAllButtonActive]}
          onPress={() => setSelectedLocations([])}
        >
          <Icon
            name={selectedLocations.length === 0 ? "checkbox-marked" : "checkbox-blank-outline"}
            size={24}
            color={selectedLocations.length === 0 ? ModernColors.primary : ModernColors.textSecondary}
          />
          <Text style={[
            styles.selectAllText,
            selectedLocations.length === 0 && styles.selectAllTextActive
          ]}>
            All Locations
          </Text>
        </TouchableOpacity>

        {Object.entries(cityGroups).map(([city, cityLocations]) => (
          <View key={city} style={styles.cityGroup}>
            <Text style={styles.cityGroupTitle}>{city}</Text>
            <View style={styles.locationChips}>
              {cityLocations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationChip,
                    selectedLocations.includes(location.name) && styles.locationChipSelected,
                  ]}
                  onPress={() => toggleLocation(location.name)}
                >
                  <Text style={[
                    styles.locationChipText,
                    selectedLocations.includes(location.name) && styles.locationChipTextSelected,
                  ]}>
                    {location.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  function renderPriceRange() {
    return (
      <View style={styles.contentContainer}>
        <View style={styles.priceCard}>
          <View style={styles.priceDisplay}>
            <Text style={styles.priceLabel}>Per Session</Text>
            <Text style={styles.priceValue}>
              ${priceRange.min} - ${priceRange.max === 500 ? '500+' : priceRange.max}
            </Text>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Minimum Price</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderMinMax}>$0</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={500}
                step={25}
                value={priceRange.min}
                onValueChange={(value) => {
                  const newMin = Math.min(value, priceRange.max);
                  setPriceRange({ ...priceRange, min: newMin });
                }}
                minimumTrackTintColor={ModernColors.primary}
                maximumTrackTintColor={ModernColors.border}
                thumbTintColor={ModernColors.primary}
              />
              <Text style={styles.sliderMinMax}>$500</Text>
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Maximum Price</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderMinMax}>$0</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={500}
                step={25}
                value={priceRange.max}
                onValueChange={(value) => {
                  const newMax = Math.max(value, priceRange.min);
                  setPriceRange({ ...priceRange, max: newMax });
                }}
                minimumTrackTintColor={ModernColors.primary}
                maximumTrackTintColor={ModernColors.border}
                thumbTintColor={ModernColors.primary}
              />
              <Text style={styles.sliderMinMax}>$500+</Text>
            </View>
          </View>

          <View style={styles.pricePresets}>
            <Text style={styles.presetsLabel}>Quick Select:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setPriceRange({ min: 0, max: 50 })}
              >
                <Text style={styles.presetChipText}>Budget ($0-50)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setPriceRange({ min: 50, max: 150 })}
              >
                <Text style={styles.presetChipText}>Moderate ($50-150)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setPriceRange({ min: 150, max: 300 })}
              >
                <Text style={styles.presetChipText}>Premium ($150-300)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setPriceRange({ min: 0, max: 500 })}
              >
                <Text style={styles.presetChipText}>Any Price</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </View>
    );
  }

  function renderSchedule() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Days of the Week</Text>
          <View style={styles.daysGrid}>
            {days.map((day, index) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  selectedDays.includes(daysFull[index]) && styles.dayChipSelected,
                ]}
                onPress={() => toggleDay(daysFull[index])}
              >
                <Text style={[
                  styles.dayChipText,
                  selectedDays.includes(daysFull[index]) && styles.dayChipTextSelected,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Time of Day</Text>
          <TouchableOpacity
            style={[styles.timeOption, timePreferences.morning && styles.timeOptionSelected]}
            onPress={() => toggleTime('morning')}
          >
            <Icon
              name="weather-sunset-up"
              size={24}
              color={timePreferences.morning ? ModernColors.primary : ModernColors.textSecondary}
            />
            <View style={styles.timeOptionContent}>
              <Text style={[
                styles.timeOptionText,
                timePreferences.morning && styles.timeOptionTextSelected,
              ]}>
                Morning
              </Text>
              <Text style={styles.timeOptionSubtext}>6:00 AM - 12:00 PM</Text>
            </View>
            <Icon
              name={timePreferences.morning ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
              size={24}
              color={timePreferences.morning ? ModernColors.primary : ModernColors.border}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timeOption, timePreferences.afternoon && styles.timeOptionSelected]}
            onPress={() => toggleTime('afternoon')}
          >
            <Icon
              name="weather-sunny"
              size={24}
              color={timePreferences.afternoon ? ModernColors.primary : ModernColors.textSecondary}
            />
            <View style={styles.timeOptionContent}>
              <Text style={[
                styles.timeOptionText,
                timePreferences.afternoon && styles.timeOptionTextSelected,
              ]}>
                Afternoon
              </Text>
              <Text style={styles.timeOptionSubtext}>12:00 PM - 5:00 PM</Text>
            </View>
            <Icon
              name={timePreferences.afternoon ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
              size={24}
              color={timePreferences.afternoon ? ModernColors.primary : ModernColors.border}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.timeOption, timePreferences.evening && styles.timeOptionSelected]}
            onPress={() => toggleTime('evening')}
          >
            <Icon
              name="weather-night"
              size={24}
              color={timePreferences.evening ? ModernColors.primary : ModernColors.textSecondary}
            />
            <View style={styles.timeOptionContent}>
              <Text style={[
                styles.timeOptionText,
                timePreferences.evening && styles.timeOptionTextSelected,
              ]}>
                Evening
              </Text>
              <Text style={styles.timeOptionSubtext}>5:00 PM - 9:00 PM</Text>
            </View>
            <Icon
              name={timePreferences.evening ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
              size={24}
              color={timePreferences.evening ? ModernColors.primary : ModernColors.border}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const toggleActivityType = (code: string) => {
    setSelectedActivityTypes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const toggleLocation = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location)
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const toggleTime = (time: 'morning' | 'afternoon' | 'evening') => {
    setTimePreferences(prev => ({
      ...prev,
      [time]: !prev[time],
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      savePreferences();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Welcome
        return true;
      case 1: // Activity Types
        return selectedActivityTypes.length > 0;
      case 2: // Age Range
        return true;
      case 3: // Locations
        return true; // All locations is valid
      case 4: // Price Range
        return true;
      case 5: // Schedule
        return selectedDays.length > 0 &&
               (timePreferences.morning || timePreferences.afternoon || timePreferences.evening);
      default:
        return true;
    }
  };

  const savePreferences = async () => {
    try {
      setLoading(true);
      const preferences = preferencesService.getPreferences();

      await preferencesService.updatePreferences({
        ...preferences,
        preferredActivityTypes: selectedActivityTypes,
        ageRanges: [ageRange],
        locations: selectedLocations.length === 0 ? [] : selectedLocations,
        priceRange: priceRange.max === 500 ? { min: priceRange.min, max: 999999 } : priceRange,
        daysOfWeek: selectedDays,
        timePreferences,
        hideClosedActivities: true, // Default to hiding closed activities
        hideFullActivities: true, // Default to hiding full activities
        hideClosedOrFull: true, // Default to hiding both
        hasCompletedOnboarding: true,
      });

      console.log('Onboarding completed, preferences saved');
      appEventEmitter.emit(APP_EVENTS.ONBOARDING_COMPLETED);
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.progressContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>
        {currentStep > 0 && <View style={styles.backButton} />}
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>{currentStepData.title}</Text>
        <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
      </View>

      <View style={styles.content}>
        {currentStepData.component()}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !canProceed() && styles.continueButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>
                {currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}
              </Text>
              <Icon name="arrow-right" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ModernColors.border,
    marginHorizontal: 4,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: ModernColors.primary,
  },
  progressDotCompleted: {
    backgroundColor: ModernColors.primary,
    opacity: 0.5,
  },
  titleContainer: {
    paddingHorizontal: ModernSpacing.lg,
    marginBottom: ModernSpacing.lg,
  },
  title: {
    fontSize: ModernTypography.sizes.xxl,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: ModernSpacing.xs,
  },
  subtitle: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.textSecondary,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.md,
    backgroundColor: ModernColors.background,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  continueButton: {
    backgroundColor: ModernColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ModernSpacing.md,
    borderRadius: ModernBorderRadius.full,
    ...ModernShadows.sm,
  },
  continueButtonDisabled: {
    backgroundColor: ModernColors.border,
  },
  continueButtonText: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
    color: '#fff',
    marginRight: ModernSpacing.xs,
  },

  // Welcome Screen
  welcomeContainer: {
    flex: 1,
    paddingHorizontal: ModernSpacing.lg,
    justifyContent: 'center',
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${ModernColors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ModernSpacing.xl,
  },
  welcomeTitle: {
    fontSize: ModernTypography.sizes.h1,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: ModernSpacing.md,
  },
  welcomeDescription: {
    fontSize: ModernTypography.sizes.lg,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    marginBottom: ModernSpacing.xl,
    lineHeight: 24,
  },
  welcomeFeatures: {
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    marginBottom: ModernSpacing.sm,
  },
  featureText: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    marginLeft: ModernSpacing.md,
    flex: 1,
  },

  // Activity Types
  contentContainer: {
    flex: 1,
    paddingHorizontal: ModernSpacing.lg,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -ModernSpacing.xs,
  },
  activityTypeCard: {
    width: (width - ModernSpacing.lg * 2 - ModernSpacing.xs * 4) / 3,
    aspectRatio: 1,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    padding: ModernSpacing.md,
    margin: ModernSpacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: ModernColors.border,
  },
  activityTypeCardSelected: {
    borderColor: ModernColors.primary,
    backgroundColor: `${ModernColors.primary}10`,
  },
  activityTypeName: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.text,
    marginTop: ModernSpacing.xs,
    textAlign: 'center',
  },
  activityTypeNameSelected: {
    color: ModernColors.primary,
    fontWeight: '600',
  },
  selectedCheckmark: {
    position: 'absolute',
    top: ModernSpacing.xs,
    right: ModernSpacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ModernColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Age Range
  ageCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.xl,
    padding: ModernSpacing.lg,
    ...ModernShadows.sm,
  },
  ageDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ModernSpacing.xl,
  },
  ageValueContainer: {
    alignItems: 'center',
    marginHorizontal: ModernSpacing.xl,
  },
  ageLabel: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginBottom: ModernSpacing.xs,
  },
  ageValue: {
    fontSize: ModernTypography.sizes.h2,
    fontWeight: '700',
    color: ModernColors.primary,
  },
  sliderContainer: {
    marginBottom: ModernSpacing.lg,
  },
  sliderLabel: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    marginBottom: ModernSpacing.sm,
    fontWeight: '500',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: ModernSpacing.sm,
  },
  sliderMinMax: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    minWidth: 30,
    textAlign: 'center',
  },
  agePresets: {
    marginTop: ModernSpacing.lg,
  },
  presetsLabel: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    marginBottom: ModernSpacing.sm,
    fontWeight: '500',
  },
  presetChip: {
    paddingHorizontal: ModernSpacing.md,
    paddingVertical: ModernSpacing.sm,
    backgroundColor: ModernColors.background,
    borderRadius: ModernBorderRadius.full,
    marginRight: ModernSpacing.sm,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  presetChipText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.text,
  },

  // Locations
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    marginBottom: ModernSpacing.lg,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  selectAllButtonActive: {
    borderColor: ModernColors.primary,
    backgroundColor: `${ModernColors.primary}10`,
  },
  selectAllText: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    marginLeft: ModernSpacing.sm,
    fontWeight: '500',
  },
  selectAllTextActive: {
    color: ModernColors.primary,
  },
  cityGroup: {
    marginBottom: ModernSpacing.lg,
  },
  cityGroupTitle: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: ModernSpacing.sm,
  },
  locationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  locationChip: {
    paddingHorizontal: ModernSpacing.md,
    paddingVertical: ModernSpacing.sm,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.full,
    marginRight: ModernSpacing.sm,
    marginBottom: ModernSpacing.sm,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  locationChipSelected: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  locationChipText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.text,
  },
  locationChipTextSelected: {
    color: '#fff',
  },

  // Price Range
  priceCard: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.xl,
    padding: ModernSpacing.lg,
    ...ModernShadows.sm,
  },
  priceDisplay: {
    alignItems: 'center',
    marginBottom: ModernSpacing.xl,
  },
  priceLabel: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginBottom: ModernSpacing.xs,
  },
  priceValue: {
    fontSize: ModernTypography.sizes.h2,
    fontWeight: '700',
    color: ModernColors.primary,
  },
  pricePresets: {
    marginTop: ModernSpacing.lg,
  },

  // Schedule
  scheduleSection: {
    marginBottom: ModernSpacing.xl,
  },
  sectionTitle: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: ModernSpacing.md,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -ModernSpacing.xs,
  },
  dayChip: {
    width: (width - ModernSpacing.lg * 2 - ModernSpacing.xs * 8) / 7,
    aspectRatio: 1,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    margin: ModernSpacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ModernColors.border,
  },
  dayChipSelected: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  dayChipText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.text,
    fontWeight: '500',
  },
  dayChipTextSelected: {
    color: '#fff',
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    marginBottom: ModernSpacing.sm,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  timeOptionSelected: {
    borderColor: ModernColors.primary,
    backgroundColor: `${ModernColors.primary}10`,
  },
  timeOptionContent: {
    flex: 1,
    marginLeft: ModernSpacing.md,
  },
  timeOptionText: {
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: ModernColors.primary,
  },
  timeOptionSubtext: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
});

export default OnboardingScreenModern;