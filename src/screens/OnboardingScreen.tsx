import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import PreferencesService from '../services/preferencesService';
import { appEventEmitter, APP_EVENTS } from '../utils/eventEmitter';

const { width, height } = Dimensions.get('window');

const OnboardingScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Onboarding state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [ageRanges, setAgeRanges] = useState([{ min: 0, max: 18 }]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 500 });
  const [anyPrice, setAnyPrice] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ]);
  const [allDays, setAllDays] = useState(true);
  const [timePreferences, setTimePreferences] = useState({
    morning: true,
    afternoon: true,
    evening: true,
  });
  const [allTimes, setAllTimes] = useState(true);

  const categories = [
    { name: 'Team Sports', icon: 'basketball', color: '#FF6B6B' },
    { name: 'Martial Arts', icon: 'karate', color: '#4ECDC4' },
    { name: 'Racquet Sports', icon: 'tennis', color: '#A8E6CF' },
    { name: 'Aquatic Leadership', icon: 'pool', color: '#FFD93D' },
    { name: 'Swimming', icon: 'swim', color: '#00C9FF' },
    { name: 'Camps', icon: 'tent', color: '#C06EFF' },
    { name: 'Dance', icon: 'dance-ballroom', color: '#4B9BFF' },
    { name: 'Other', icon: 'star', color: '#95E1D3' },
  ];

  const locationOptions = [
    'North Vancouver',
    'West Vancouver',
    'Vancouver',
    'Burnaby',
    'Richmond',
    'Surrey',
    'Coquitlam',
    'Port Moody',
  ];

  const steps = [
    {
      title: 'Welcome!',
      subtitle: "Let's personalize your experience",
      component: renderWelcome,
    },
    {
      title: 'What interests your child?',
      subtitle: 'Select all that apply',
      component: renderCategories,
    },
    {
      title: 'Age Groups',
      subtitle: 'What age ranges are you looking for?',
      component: renderAgeRanges,
    },
    {
      title: 'Budget',
      subtitle: 'Set your price range',
      component: renderPriceRange,
    },
    {
      title: 'Locations',
      subtitle: 'Where would you like activities?',
      component: renderLocations,
    },
    {
      title: 'Schedule',
      subtitle: 'When are you available?',
      component: renderSchedule,
    },
  ];

  function renderWelcome() {
    return (
      <View style={styles.welcomeContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.welcomeGradient}
        >
          <Icon name="hand-wave" size={80} color="#fff" />
          <Text style={styles.welcomeTitle}>Welcome to Kids Activity Tracker!</Text>
          <Text style={styles.welcomeText}>
            We'll help you find the perfect activities for your children. 
            Let's start by learning about your preferences.
          </Text>
        </LinearGradient>
      </View>
    );
  }

  function renderCategories() {
    return (
      <View style={styles.categoriesContainer}>
        <View style={styles.categoriesGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.name}
              style={[
                styles.categoryCard,
                selectedCategories.includes(category.name) && styles.categoryCardSelected,
              ]}
              onPress={() => toggleCategory(category.name)}
            >
              <View
                style={[
                  styles.categoryIconContainer,
                  { backgroundColor: category.color },
                  selectedCategories.includes(category.name) && styles.categoryIconSelected,
                ]}
              >
                <Icon name={category.icon} size={32} color="#fff" />
              </View>
              <Text style={styles.categoryText}>{category.name}</Text>
              {selectedCategories.includes(category.name) && (
                <Icon name="check-circle" size={20} color="#667eea" style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  function renderAgeRanges() {
    return (
      <View style={styles.ageContainer}>
        {ageRanges.map((range, index) => (
          <View key={index} style={styles.ageRangeCard}>
            <View style={styles.ageRangeHeader}>
              <Text style={styles.ageRangeTitle}>Age Range {index + 1}</Text>
              {ageRanges.length > 1 && (
                <TouchableOpacity onPress={() => removeAgeRange(index)}>
                  <Icon name="close-circle" size={24} color="#ff4444" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.ageRangeText}>
              Ages {range.min} to {range.max}
            </Text>
            <View style={styles.rangeSliderContainer}>
              <Text style={styles.sliderLabel}>Minimum Age</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.ageValue}>{range.min}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={18}
                  step={1}
                  value={range.min}
                  onValueChange={(value) => updateAgeRange(index, 'min', value)}
                  minimumTrackTintColor="#667eea"
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.ageMaxLabel}>18</Text>
              </View>
              
              <Text style={styles.sliderLabel}>Maximum Age</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.ageValue}>{range.max}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={18}
                  step={1}
                  value={range.max}
                  onValueChange={(value) => updateAgeRange(index, 'max', value)}
                  minimumTrackTintColor="#667eea"
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.ageMaxLabel}>18</Text>
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addAgeRange}>
          <Icon name="plus-circle" size={24} color="#667eea" />
          <Text style={styles.addButtonText}>Add Another Age Range</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderPriceRange() {
    return (
      <View style={styles.priceContainer}>
        <LinearGradient
          colors={['#4facfe', '#00f2fe']}
          style={styles.priceCard}
        >
          <Icon name="cash-multiple" size={60} color="#fff" />
          <Text style={styles.priceTitle}>Budget Range</Text>
          <View style={styles.priceRangeContainer}>
            {anyPrice ? (
              <Text style={styles.priceText}>Any Price</Text>
            ) : (
              <>
                <Text style={styles.priceText}>${priceRange.min}</Text>
                <Text style={styles.priceText}>-</Text>
                <Text style={styles.priceText}>${priceRange.max}</Text>
              </>
            )}
          </View>
        </LinearGradient>
        
        <TouchableOpacity 
          style={[styles.anyPriceButton, anyPrice && styles.anyPriceButtonActive]}
          onPress={() => setAnyPrice(!anyPrice)}
        >
          <Icon 
            name={anyPrice ? "checkbox-marked" : "checkbox-blank-outline"} 
            size={24} 
            color={anyPrice ? "#4facfe" : "#666"} 
          />
          <Text style={[styles.anyPriceText, anyPrice && styles.anyPriceTextActive]}>
            Any Price
          </Text>
        </TouchableOpacity>
        
        {!anyPrice && (
          <View style={styles.sliderSection}>
            <Text style={styles.sliderLabel}>Minimum Price: ${priceRange.min}</Text>
            <View style={styles.priceSliderRow}>
              <Text style={styles.priceLegend}>$0</Text>
              <Slider
                style={styles.priceSlider}
                minimumValue={0}
                maximumValue={1000}
                step={25}
                value={priceRange.min}
                onValueChange={(value) => setPriceRange({ ...priceRange, min: value })}
                minimumTrackTintColor="#4facfe"
                maximumTrackTintColor="#ddd"
                disabled={anyPrice}
              />
              <Text style={styles.priceLegend}>$1000</Text>
            </View>
            
            <Text style={styles.sliderLabel}>Maximum Price: ${priceRange.max}</Text>
            <View style={styles.priceSliderRow}>
              <Text style={styles.priceLegend}>$0</Text>
              <Slider
                style={styles.priceSlider}
                minimumValue={0}
                maximumValue={1000}
                step={25}
                value={priceRange.max}
                onValueChange={(value) => setPriceRange({ ...priceRange, max: value })}
                minimumTrackTintColor="#4facfe"
                maximumTrackTintColor="#ddd"
                disabled={anyPrice}
              />
              <Text style={styles.priceLegend}>$1000</Text>
            </View>
            
            <View style={styles.priceMarkers}>
              <Text style={styles.priceMarker}>$0</Text>
              <Text style={styles.priceMarker}>$250</Text>
              <Text style={styles.priceMarker}>$500</Text>
              <Text style={styles.priceMarker}>$750</Text>
              <Text style={styles.priceMarker}>$1000</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  function renderLocations() {
    return (
      <ScrollView style={styles.locationsContainer}>
        <TouchableOpacity 
          style={[styles.anyPriceButton, allLocations && styles.anyPriceButtonActive]}
          onPress={() => {
            setAllLocations(!allLocations);
            if (!allLocations) {
              setLocations([]);
            }
          }}
        >
          <Icon 
            name={allLocations ? "checkbox-marked" : "checkbox-blank-outline"} 
            size={24} 
            color={allLocations ? "#667eea" : "#666"} 
          />
          <Text style={[styles.anyPriceText, allLocations && styles.anyPriceTextActive]}>
            All Locations
          </Text>
        </TouchableOpacity>
        
        {!allLocations && (
          <View style={styles.locationsGrid}>
            {locationOptions.map((location) => (
              <TouchableOpacity
                key={location}
                style={[
                  styles.locationChip,
                  locations.includes(location) && styles.locationChipSelected,
                ]}
                onPress={() => toggleLocation(location)}
              >
                <Icon 
                  name="map-marker" 
                  size={20} 
                  color={locations.includes(location) ? '#fff' : '#667eea'} 
                />
                <Text style={[
                  styles.locationText,
                  locations.includes(location) && styles.locationTextSelected,
                ]}>
                  {location}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderSchedule() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return (
      <View style={styles.scheduleContainer}>
        <TouchableOpacity 
          style={[styles.anyPriceButton, allDays && styles.anyPriceButtonActive]}
          onPress={() => {
            setAllDays(!allDays);
            if (!allDays) {
              setSelectedDays(daysFull);
            } else {
              setSelectedDays([]);
            }
          }}
        >
          <Icon 
            name={allDays ? "checkbox-marked" : "checkbox-blank-outline"} 
            size={24} 
            color={allDays ? "#667eea" : "#666"} 
          />
          <Text style={[styles.anyPriceText, allDays && styles.anyPriceTextActive]}>
            All Days & Times
          </Text>
        </TouchableOpacity>

        {!allDays && (
          <>
            <Text style={styles.scheduleLabel}>Available Days</Text>
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
                    styles.dayText,
                    selectedDays.includes(daysFull[index]) && styles.dayTextSelected,
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.scheduleLabel}>Preferred Times</Text>
            <View style={styles.timeOptions}>
              <TouchableOpacity
                style={[styles.timeCard, timePreferences.morning && styles.timeCardSelected]}
                onPress={() => toggleTime('morning')}
              >
                <Icon 
                  name="weather-sunset-up" 
                  size={32} 
                  color={timePreferences.morning ? '#fff' : '#667eea'} 
                />
                <Text style={[
                  styles.timeText,
                  timePreferences.morning && styles.timeTextSelected,
                ]}>
                  Morning
                </Text>
                <Text style={[
                  styles.timeSubtext,
                  timePreferences.morning && styles.timeTextSelected,
                ]}>
                  6am - 12pm
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timeCard, timePreferences.afternoon && styles.timeCardSelected]}
                onPress={() => toggleTime('afternoon')}
              >
                <Icon 
                  name="weather-sunny" 
                  size={32} 
                  color={timePreferences.afternoon ? '#fff' : '#667eea'} 
                />
                <Text style={[
                  styles.timeText,
                  timePreferences.afternoon && styles.timeTextSelected,
                ]}>
                  Afternoon
                </Text>
                <Text style={[
                  styles.timeSubtext,
                  timePreferences.afternoon && styles.timeTextSelected,
                ]}>
                  12pm - 5pm
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timeCard, timePreferences.evening && styles.timeCardSelected]}
                onPress={() => toggleTime('evening')}
              >
                <Icon 
                  name="weather-night" 
                  size={32} 
                  color={timePreferences.evening ? '#fff' : '#667eea'} 
                />
                <Text style={[
                  styles.timeText,
                  timePreferences.evening && styles.timeTextSelected,
                ]}>
                  Evening
                </Text>
                <Text style={[
                  styles.timeSubtext,
                  timePreferences.evening && styles.timeTextSelected,
                ]}>
                  5pm - 9pm
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const toggleLocation = (location: string) => {
    setLocations((prev) =>
      prev.includes(location)
        ? prev.filter((l) => l !== location)
        : [...prev, location]
    );
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };

  const toggleTime = (time: 'morning' | 'afternoon' | 'evening') => {
    setTimePreferences((prev) => ({
      ...prev,
      [time]: !prev[time],
    }));
  };

  const addAgeRange = () => {
    if (ageRanges.length < 4) {
      setAgeRanges([...ageRanges, { min: 0, max: 18 }]);
    }
  };

  const removeAgeRange = (index: number) => {
    setAgeRanges(ageRanges.filter((_, i) => i !== index));
  };

  const updateAgeRange = (index: number, field: 'min' | 'max', value: number) => {
    const updated = [...ageRanges];
    updated[index][field] = value;
    if (field === 'min' && value > updated[index].max) {
      updated[index].max = value;
    }
    if (field === 'max' && value < updated[index].min) {
      updated[index].min = value;
    }
    setAgeRanges(updated);
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

  const savePreferences = async () => {
    try {
      const preferences = preferencesService.getPreferences();
      await preferencesService.updatePreferences({
        ...preferences,
        preferredCategories: selectedCategories,
        ageRanges,
        priceRange: anyPrice ? { min: 0, max: 999999 } : priceRange,
        locations: allLocations ? [] : locations,
        daysOfWeek: allDays ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] : selectedDays,
        timePreferences: allDays ? { morning: true, afternoon: true, evening: true } : timePreferences,
        hasCompletedOnboarding: true,
      });
      
      // Emit event to notify RootNavigator that onboarding is complete
      console.log('Onboarding completed, preferences saved');
      appEventEmitter.emit(APP_EVENTS.ONBOARDING_COMPLETED);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
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
        <Text style={styles.title}>{currentStepData.title}</Text>
        <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
      </LinearGradient>

      <View style={styles.content}>
        {currentStepData.component()}
      </View>

      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Icon name="chevron-left" size={24} color="#667eea" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.nextButton, currentStep === 0 && styles.fullWidthButton]}
          onPress={handleNext}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.nextButtonGradient}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === steps.length - 1 ? "Let's Go!" : 'Next'}
            </Text>
            <Icon name="chevron-right" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 5,
  },
  progressDotActive: {
    backgroundColor: '#fff',
    width: 30,
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#667eea',
    marginLeft: 5,
  },
  nextButton: {
    flex: 1,
    marginLeft: 10,
  },
  fullWidthButton: {
    marginLeft: 0,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 5,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeGradient: {
    padding: 40,
    borderRadius: 30,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 15,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  categoriesContainer: {
    flex: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: (width - 60) / 2,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryCardSelected: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryIconSelected: {
    transform: [{ scale: 1.1 }],
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  checkIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  ageContainer: {
    flex: 1,
  },
  ageRangeCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  ageRangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  ageRangeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  ageRangeText: {
    fontSize: 18,
    color: '#667eea',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },
  rangeSliderContainer: {
    marginTop: 10,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    marginTop: 15,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    minWidth: 25,
    textAlign: 'center',
  },
  ageMaxLabel: {
    fontSize: 14,
    color: '#999',
    minWidth: 25,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    color: '#667eea',
    marginLeft: 10,
    fontWeight: '500',
  },
  priceContainer: {
    flex: 1,
  },
  priceCard: {
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  priceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 20,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 10,
  },
  sliderSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  priceSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  anyPriceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginVertical: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  anyPriceButtonActive: {
    borderColor: '#4facfe',
    backgroundColor: '#4facfe10',
  },
  anyPriceText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
    fontWeight: '500',
  },
  anyPriceTextActive: {
    color: '#4facfe',
    fontWeight: '600',
  },
  priceSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceLegend: {
    fontSize: 12,
    color: '#999',
    minWidth: 40,
    textAlign: 'center',
  },
  priceMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 15,
  },
  priceMarker: {
    fontSize: 11,
    color: '#999',
  },
  locationsContainer: {
    flex: 1,
  },
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  locationChipSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  locationTextSelected: {
    color: '#fff',
  },
  scheduleContainer: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 30,
  },
  dayChip: {
    width: (width - 70) / 7,
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  dayChipSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  dayTextSelected: {
    color: '#fff',
  },
  timeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  timeCardSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  timeSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  timeTextSelected: {
    color: '#fff',
  },
});

export default OnboardingScreen;