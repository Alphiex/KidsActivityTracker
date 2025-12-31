import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import ActivityService from '../services/activityService';
import aiService from '../services/aiService';
import { ActivitySearchParams } from '../types/api';
import { ActivitySearchFilters } from '../types/ai';
import { useTheme } from '../contexts/ThemeContext';
import { API_CONFIG } from '../config/api';
import { AIRecommendButton } from '../components/ai';

const { width, height } = Dimensions.get('window');

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const POPULAR_CITIES = [
  'Vancouver', 'Burnaby', 'Richmond', 'Surrey', 'North Vancouver', 
  'West Vancouver', 'Coquitlam', 'New Westminster', 'Port Coquitlam'
];

const PREDEFINED_TIMES = [
  { label: 'Before School', value: 'before-school', timeRange: '6:00 AM - 8:00 AM' },
  { label: 'After School', value: 'after-school', timeRange: '3:00 PM - 6:00 PM' },
  { label: 'Morning', value: 'morning', timeRange: '8:00 AM - 12:00 PM' },
  { label: 'Day', value: 'day', timeRange: '9:00 AM - 5:00 PM' },
  { label: 'Evening', value: 'evening', timeRange: '6:00 PM - 9:00 PM' },
  { label: 'Night', value: 'night', timeRange: '7:00 PM - 10:00 PM' }
];

const SearchScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const activityService = ActivityService.getInstance();
  
  // Search state
  const [searchText, setSearchText] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [useCustomTimeRange, setUseCustomTimeRange] = useState(false);
  const [startTime, setStartTime] = useState(6); // 6 AM in 24-hour format
  const [endTime, setEndTime] = useState(22); // 10 PM in 24-hour format
  const [minCost, setMinCost] = useState(0);
  const [maxCost, setMaxCost] = useState(500);
  const [isUnlimitedCost, setIsUnlimitedCost] = useState(false);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [minAge, setMinAge] = useState(0);
  const [maxAge, setMaxAge] = useState(18);
  
  // Activity Types data
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [loadingActivityTypes, setLoadingActivityTypes] = useState(false);
  
  // NL parsing state
  const [isNLQuery, setIsNLQuery] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedFilters, setParsedFilters] = useState<Partial<ActivitySearchFilters> | null>(null);
  const [parseConfidence, setParseConfidence] = useState(0);
  
  // UI state
  const [expandedSection, setExpandedSection] = useState<string | null>('what');
  const [fadeAnim] = useState(new Animated.Value(0));
  
  useEffect(() => {
    // Animate in the search screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Load activity types
    loadActivityTypes();
  }, []);

  // Debounced NL detection and parsing
  useEffect(() => {
    const detectNL = aiService.isNaturalLanguageQuery(searchText);
    setIsNLQuery(detectNL);

    // Auto-parse if NL detected
    if (detectNL && searchText.length >= 20) {
      const parseTimeout = setTimeout(async () => {
        setIsParsing(true);
        try {
          const result = await aiService.parseSearch(searchText);
          if (result.success) {
            setParsedFilters(result.parsed_filters);
            setParseConfidence(result.confidence);
          }
        } catch (error) {
          console.error('Parse error:', error);
        } finally {
          setIsParsing(false);
        }
      }, 800); // Debounce 800ms

      return () => clearTimeout(parseTimeout);
    } else {
      setParsedFilters(null);
      setParseConfidence(0);
    }
  }, [searchText]);

  const loadActivityTypes = async () => {
    try {
      setLoadingActivityTypes(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/activity-types`);
      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        setActivityTypes(result.data);
        console.log('Loaded activity types:', result.data.length);
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
    } finally {
      setLoadingActivityTypes(false);
    }
  };

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const toggleActivityType = (activityTypeCode: string) => {
    setSelectedActivityTypes(prev => 
      prev.includes(activityTypeCode) 
        ? prev.filter(code => code !== activityTypeCode)
        : [...prev, activityTypeCode]
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities(prev => 
      prev.includes(city) 
        ? prev.filter(c => c !== city)
        : [...prev, city]
    );
  };

  const toggleTime = (timeValue: string) => {
    setSelectedTimes(prev => 
      prev.includes(timeValue) 
        ? prev.filter(t => t !== timeValue)
        : [...prev, timeValue]
    );
    // Reset custom time range when selecting predefined times
    if (!useCustomTimeRange) {
      setUseCustomTimeRange(false);
    }
  };

  const formatTime = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const clearAllFilters = () => {
    setSearchText('');
    setSelectedDays([]);
    setSelectedActivityTypes([]);
    setSelectedTimes([]);
    setUseCustomTimeRange(false);
    setStartTime(6);
    setEndTime(22);
    setMinCost(0);
    setMaxCost(500);
    setIsUnlimitedCost(false);
    setSelectedCities([]);
    setMinAge(0);
    setMaxAge(18);
    setParsedFilters(null);
    setParseConfidence(0);
  };

  /**
   * Apply parsed filters to the form fields
   */
  const applyParsedFilters = () => {
    if (!parsedFilters) return;

    // Apply search term
    if (parsedFilters.search) {
      setSearchText(parsedFilters.search);
    }

    // Apply age
    if (parsedFilters.ageMin !== undefined) {
      setMinAge(parsedFilters.ageMin);
    }
    if (parsedFilters.ageMax !== undefined) {
      setMaxAge(parsedFilters.ageMax);
    }

    // Apply days
    if (parsedFilters.dayOfWeek && parsedFilters.dayOfWeek.length > 0) {
      setSelectedDays(parsedFilters.dayOfWeek);
    }

    // Apply location
    if (parsedFilters.location) {
      const matchingCity = POPULAR_CITIES.find(
        city => city.toLowerCase() === parsedFilters.location?.toLowerCase()
      );
      if (matchingCity) {
        setSelectedCities([matchingCity]);
      }
    }

    // Apply cost
    if (parsedFilters.costMax !== undefined) {
      setMaxCost(parsedFilters.costMax);
      setIsUnlimitedCost(false);
    }

    // Clear parsed state after applying
    setParsedFilters(null);
    setParseConfidence(0);
  };

  /**
   * Render parsed filter chips
   */
  const renderParsedFilters = () => {
    if (!parsedFilters || Object.keys(parsedFilters).length === 0) return null;

    const chips: { label: string; key: string }[] = [];

    if (parsedFilters.search) {
      chips.push({ label: `"${parsedFilters.search}"`, key: 'search' });
    }
    if (parsedFilters.ageMin !== undefined || parsedFilters.ageMax !== undefined) {
      const min = parsedFilters.ageMin ?? 0;
      const max = parsedFilters.ageMax ?? 18;
      chips.push({ label: `Ages ${min}-${max}`, key: 'age' });
    }
    if (parsedFilters.dayOfWeek && parsedFilters.dayOfWeek.length > 0) {
      chips.push({ label: parsedFilters.dayOfWeek.join(', '), key: 'days' });
    }
    if (parsedFilters.location) {
      chips.push({ label: parsedFilters.location, key: 'location' });
    }
    if (parsedFilters.costMax !== undefined) {
      chips.push({ label: `Under $${parsedFilters.costMax}`, key: 'cost' });
    }

    if (chips.length === 0) return null;

    return (
      <View style={styles.parsedFiltersContainer}>
        <View style={styles.parsedFiltersHeader}>
          <View style={styles.parsedFiltersLabel}>
            <Icon name="robot" size={16} color="#6B46C1" />
            <Text style={styles.parsedFiltersText}>AI detected filters:</Text>
          </View>
          <Text style={styles.confidenceText}>
            {Math.round(parseConfidence * 100)}% confident
          </Text>
        </View>
        <View style={styles.parsedChipsContainer}>
          {chips.map(chip => (
            <View key={chip.key} style={styles.parsedChip}>
              <Text style={styles.parsedChipText}>{chip.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.applyParsedButton} onPress={applyParsedFilters}>
          <Icon name="check" size={16} color="#FFFFFF" />
          <Text style={styles.applyParsedButtonText}>Apply These Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleSearch = async () => {
    const searchParams: ActivitySearchParams = {
      search: searchText || undefined,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : undefined,
      activityTypes: selectedActivityTypes.length > 0 ? selectedActivityTypes : undefined,
      costMin: minCost > 0 ? minCost : undefined,
      costMax: !isUnlimitedCost ? maxCost : undefined,
      location: selectedCities.length === 1 ? selectedCities[0] : undefined,
      locations: selectedCities.length > 1 ? selectedCities : undefined,
      ageMin: minAge > 0 ? minAge : undefined,
      ageMax: maxAge < 18 ? maxAge : undefined,
      hideFullActivities: true,
    };

    console.log('🔍 [SearchScreen] handleSearch called with searchText:', searchText);
    console.log('🔍 [SearchScreen] Search params being passed:', JSON.stringify(searchParams, null, 2));

    navigation.navigate('SearchResults' as never, { 
      filters: searchParams,
      searchQuery: searchText 
    } as never);
  };

  /**
   * Handle AI-powered search
   */
  const handleAISearch = () => {
    const filters = {
      search: searchText || undefined,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : undefined,
      activityTypes: selectedActivityTypes.length > 0 ? selectedActivityTypes : undefined,
      costMin: minCost > 0 ? minCost : undefined,
      costMax: !isUnlimitedCost ? maxCost : undefined,
      location: selectedCities.length === 1 ? selectedCities[0] : undefined,
      locations: selectedCities.length > 1 ? selectedCities : undefined,
      ageMin: minAge > 0 ? minAge : undefined,
      ageMax: maxAge < 18 ? maxAge : undefined,
    };
    
    // Build a natural language search intent from the filters
    const searchIntent = aiService.buildSearchIntent({
      ...filters,
      dayOfWeek: selectedDays,
      category: selectedActivityTypes[0],
    });
    
    navigation.navigate('AIRecommendations' as never, { 
      search_intent: searchText || searchIntent,
      filters 
    } as never);
  };

  const getSectionSummary = (section: string) => {
    switch (section) {
      case 'what':
        return searchText || 'Any activity';
      case 'days':
        return selectedDays.length > 0 ? selectedDays.join(', ') : 'Any day';
      case 'activityType':
        if (selectedActivityTypes.length > 0) {
          const typeNames = selectedActivityTypes.map(code => 
            activityTypes.find(type => type.code === code)?.name
          ).filter(Boolean);
          return typeNames.length > 3 
            ? `${typeNames.slice(0, 2).join(', ')} +${typeNames.length - 2} more`
            : typeNames.join(', ');
        }
        return 'All types';
      case 'time':
        if (useCustomTimeRange) {
          return `${formatTime(startTime)} - ${formatTime(endTime)}`;
        }
        if (selectedTimes.length > 0) {
          const timeLabels = selectedTimes.map(timeValue => 
            PREDEFINED_TIMES.find(t => t.value === timeValue)?.label
          ).filter(Boolean);
          return timeLabels.join(', ');
        }
        return 'Any time';
      case 'cost':
        if (minCost === 0 && isUnlimitedCost) return 'Any price';
        if (minCost === 0 && !isUnlimitedCost) return `Under $${maxCost}`;
        if (isUnlimitedCost) return `$${minCost}+`;
        return `$${minCost} - $${maxCost}`;
      case 'where':
        return selectedCities.length > 0 ? selectedCities.join(', ') : 'Anywhere';
      case 'age':
        if (minAge === 0 && maxAge === 18) return 'All ages';
        return `${minAge} - ${maxAge} years`;
      default:
        return '';
    }
  };

  const renderExpandableSection = (
    key: string,
    title: string,
    icon: string,
    content: React.ReactNode
  ) => {
    const isExpanded = expandedSection === key;
    const summary = getSectionSummary(key);

    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          style={[styles.sectionHeader, isExpanded && styles.sectionHeaderExpanded]}
          onPress={() => toggleSection(key)}
        >
          <View style={styles.sectionHeaderContent}>
            <Icon name={icon} size={24} color="#222222" />
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.sectionSummary}>{summary}</Text>
            </View>
          </View>
          <Icon 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={24} 
            color="#717171" 
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.sectionContent}>
            {content}
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Fogged Background */}
      <View style={styles.foggedBackground} />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#222222" />
          </TouchableOpacity>
        </View>

        {/* Search Content */}
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.searchContainer}>
            
            {/* What Section */}
            {renderExpandableSection(
              'what',
              'What?',
              'magnify',
              <View style={styles.textInputContainer}>
                <View style={styles.searchInputWrapper}>
                  <TextInput
                    style={[
                      styles.searchInput,
                      isNLQuery && styles.searchInputNL
                    ]}
                    placeholder="Search activities or try: 'swimming for my 5 year old on Saturdays'"
                    placeholderTextColor="#999999"
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus={expandedSection === 'what'}
                    multiline={isNLQuery}
                  />
                  {isParsing && (
                    <View style={styles.parsingIndicator}>
                      <ActivityIndicator size="small" color="#6B46C1" />
                    </View>
                  )}
                </View>
                {isNLQuery && !isParsing && (
                  <View style={styles.nlIndicator}>
                    <Icon name="robot" size={14} color="#6B46C1" />
                    <Text style={styles.nlIndicatorText}>
                      Natural language detected - AI will parse your request
                    </Text>
                  </View>
                )}
                {renderParsedFilters()}
              </View>
            )}

            {/* Days Section */}
            {renderExpandableSection(
              'days',
              'Day of the Week?',
              'calendar-week',
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(day) && styles.dayButtonSelected
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDays.includes(day) && styles.dayButtonTextSelected
                    ]}>
                      {day.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Activity Type Section */}
            {renderExpandableSection(
              'activityType',
              'Activity Type?',
              'soccer',
              <View style={styles.activityTypeContainer}>
                {loadingActivityTypes ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading activity types...</Text>
                  </View>
                ) : (
                  <View style={styles.activityTypesGrid}>
                    {activityTypes.map(activityType => (
                      <TouchableOpacity
                        key={activityType.code}
                        style={[
                          styles.activityTypeButton,
                          selectedActivityTypes.includes(activityType.code) && styles.activityTypeButtonSelected
                        ]}
                        onPress={() => toggleActivityType(activityType.code)}
                      >
                        <Text style={[
                          styles.activityTypeButtonText,
                          selectedActivityTypes.includes(activityType.code) && styles.activityTypeButtonTextSelected
                        ]}>
                          {activityType.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Time Section */}
            {renderExpandableSection(
              'time',
              'Time?',
              'clock',
              <View style={styles.timeContainer}>
                {/* Predefined Time Options */}
                <View style={styles.predefinedTimesContainer}>
                  {PREDEFINED_TIMES.map(timeOption => (
                    <TouchableOpacity
                      key={timeOption.value}
                      style={[
                        styles.timeButton,
                        selectedTimes.includes(timeOption.value) && styles.timeButtonSelected,
                        useCustomTimeRange && styles.timeButtonDisabled
                      ]}
                      onPress={() => {
                        if (!useCustomTimeRange) {
                          toggleTime(timeOption.value);
                        }
                      }}
                      disabled={useCustomTimeRange}
                    >
                      <Text style={[
                        styles.timeButtonText,
                        selectedTimes.includes(timeOption.value) && styles.timeButtonTextSelected,
                        useCustomTimeRange && styles.timeButtonTextDisabled
                      ]}>
                        {timeOption.label}
                      </Text>
                      <Text style={[
                        styles.timeRangeText,
                        selectedTimes.includes(timeOption.value) && styles.timeRangeTextSelected,
                        useCustomTimeRange && styles.timeRangeTextDisabled
                      ]}>
                        {timeOption.timeRange}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Time Range Toggle */}
                <View style={styles.customTimeToggle}>
                  <TouchableOpacity
                    style={[styles.customToggleButton, useCustomTimeRange && styles.customToggleButtonSelected]}
                    onPress={() => {
                      setUseCustomTimeRange(!useCustomTimeRange);
                      if (!useCustomTimeRange) {
                        setSelectedTimes([]); // Clear predefined times when switching to custom
                      }
                    }}
                  >
                    <Text style={[
                      styles.customToggleText,
                      useCustomTimeRange && styles.customToggleTextSelected
                    ]}>
                      Custom Time Range
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Time Range Sliders */}
                {useCustomTimeRange && (
                  <View style={styles.customTimeContainer}>
                    <View style={styles.timeLabels}>
                      <Text style={styles.timeLabel}>Start: {formatTime(startTime)}</Text>
                      <Text style={styles.timeLabel}>End: {formatTime(endTime)}</Text>
                    </View>
                    
                    <Text style={styles.sliderLabel}>Start Time</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={23}
                      step={1}
                      value={startTime}
                      onValueChange={setStartTime}
                      minimumTrackTintColor="#FF385C"
                      maximumTrackTintColor="#DDDDDD"
                      
                    />
                    
                    <Text style={styles.sliderLabel}>End Time</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={startTime + 1}
                      maximumValue={23}
                      step={1}
                      value={endTime}
                      onValueChange={setEndTime}
                      minimumTrackTintColor="#FF385C"
                      maximumTrackTintColor="#DDDDDD"
                      
                    />
                  </View>
                )}
              </View>
            )}

            {/* Cost Section */}
            {renderExpandableSection(
              'cost',
              'Cost?',
              'currency-usd',
              <View style={styles.costContainer}>
                <View style={styles.costLabels}>
                  <Text style={styles.costLabel}>Min: ${minCost}</Text>
                  <Text style={styles.costLabel}>
                    Max: {isUnlimitedCost ? 'Unlimited' : `$${maxCost}`}
                  </Text>
                </View>
                
                <Text style={styles.sliderLabel}>Minimum Cost</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={500}
                  step={25}
                  value={minCost}
                  onValueChange={setMinCost}
                  minimumTrackTintColor="#FF385C"
                  maximumTrackTintColor="#DDDDDD"
                  
                />
                
                <Text style={styles.sliderLabel}>Maximum Cost</Text>
                <View style={styles.maxCostContainer}>
                  <Slider
                    style={[styles.slider, { opacity: isUnlimitedCost ? 0.5 : 1 }]}
                    minimumValue={minCost}
                    maximumValue={1500}
                    step={50}
                    value={maxCost}
                    onValueChange={setMaxCost}
                    disabled={isUnlimitedCost}
                    minimumTrackTintColor="#FF385C"
                    maximumTrackTintColor="#DDDDDD"
                    
                  />
                  <TouchableOpacity
                    style={[styles.unlimitedButton, isUnlimitedCost && styles.unlimitedButtonSelected]}
                    onPress={() => setIsUnlimitedCost(!isUnlimitedCost)}
                  >
                    <Text style={[
                      styles.unlimitedButtonText,
                      isUnlimitedCost && styles.unlimitedButtonTextSelected
                    ]}>
                      Unlimited
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Where Section */}
            {renderExpandableSection(
              'where',
              'Where?',
              'map-marker',
              <View style={styles.citiesContainer}>
                {POPULAR_CITIES.map(city => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.cityButton,
                      selectedCities.includes(city) && styles.cityButtonSelected
                    ]}
                    onPress={() => toggleCity(city)}
                  >
                    <Text style={[
                      styles.cityButtonText,
                      selectedCities.includes(city) && styles.cityButtonTextSelected
                    ]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Age Section */}
            {renderExpandableSection(
              'age',
              'Age?',
              'account-child',
              <View style={styles.ageContainer}>
                <View style={styles.ageLabels}>
                  <Text style={styles.ageLabel}>Min: {minAge} years</Text>
                  <Text style={styles.ageLabel}>Max: {maxAge} years</Text>
                </View>
                
                <Text style={styles.sliderLabel}>Minimum Age</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={17}
                  step={1}
                  value={minAge}
                  onValueChange={setMinAge}
                  minimumTrackTintColor="#FF385C"
                  maximumTrackTintColor="#DDDDDD"
                  
                />
                
                <Text style={styles.sliderLabel}>Maximum Age</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={minAge}
                  maximumValue={18}
                  step={1}
                  value={maxAge}
                  onValueChange={setMaxAge}
                  minimumTrackTintColor="#FF385C"
                  maximumTrackTintColor="#DDDDDD"
                  
                />
              </View>
            )}

          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
          
          <View style={styles.searchActions}>
            <AIRecommendButton 
              onPress={handleAISearch}
              variant="outline"
              label="AI Match"
            />
            
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Icon name="magnify" size={20} color="#FFFFFF" />
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  foggedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionContainer: {
    // Remove bottom border
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionHeaderExpanded: {
    // Remove bottom border
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionHeaderText: {
    marginLeft: 16,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  sectionSummary: {
    fontSize: 14,
    color: '#717171',
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  textInputContainer: {
    marginTop: 10,
  },
  searchInputWrapper: {
    position: 'relative',
  },
  searchInput: {
    fontSize: 16,
    color: '#222222',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputNL: {
    borderColor: '#6B46C1',
    borderWidth: 2,
    minHeight: 60,
  },
  parsingIndicator: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  nlIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  nlIndicatorText: {
    fontSize: 12,
    color: '#6B46C1',
    marginLeft: 4,
  },
  parsedFiltersContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  parsedFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parsedFiltersLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  parsedFiltersText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B46C1',
    marginLeft: 6,
  },
  confidenceText: {
    fontSize: 11,
    color: '#6B7280',
  },
  parsedChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  parsedChip: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  parsedChipText: {
    fontSize: 13,
    color: '#5B21B6',
    fontWeight: '500',
  },
  applyParsedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B46C1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 6,
  },
  applyParsedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  dayButtonSelected: {
    backgroundColor: '#FF385C',
    borderColor: '#FF385C',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  activityTypeContainer: {
    marginTop: 10,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#717171',
  },
  activityTypesGrid: {
    gap: 8,
  },
  activityTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  activityTypeButtonSelected: {
    backgroundColor: '#FF385C',
    borderColor: '#FF385C',
  },
  activityTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  activityTypeButtonTextSelected: {
    color: '#FFFFFF',
  },
  timeContainer: {
    marginTop: 10,
  },
  predefinedTimesContainer: {
    gap: 8,
    marginBottom: 20,
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  timeButtonSelected: {
    backgroundColor: '#FF385C',
    borderColor: '#FF385C',
  },
  timeButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  timeButtonTextSelected: {
    color: '#FFFFFF',
  },
  timeButtonTextDisabled: {
    color: '#999999',
  },
  timeRangeText: {
    fontSize: 12,
    color: '#717171',
  },
  timeRangeTextSelected: {
    color: '#FFFFFF',
  },
  timeRangeTextDisabled: {
    color: '#CCCCCC',
  },
  customTimeToggle: {
    marginBottom: 20,
  },
  customToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  customToggleButtonSelected: {
    backgroundColor: '#FF385C',
    borderColor: '#FF385C',
  },
  customToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
  },
  customToggleTextSelected: {
    color: '#FFFFFF',
  },
  customTimeContainer: {
    marginTop: 10,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  costContainer: {
    marginTop: 10,
  },
  costLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  sliderLabel: {
    fontSize: 14,
    color: '#717171',
    marginBottom: 8,
    marginTop: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  maxCostContainer: {
    marginTop: 10,
  },
  unlimitedButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  unlimitedButtonSelected: {
    backgroundColor: '#FF385C',
    borderColor: '#FF385C',
  },
  unlimitedButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
  },
  unlimitedButtonTextSelected: {
    color: '#FFFFFF',
  },
  citiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  cityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  cityButtonSelected: {
    backgroundColor: '#FF385C',
    borderColor: '#FF385C',
  },
  cityButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
  },
  cityButtonTextSelected: {
    color: '#FFFFFF',
  },
  ageContainer: {
    marginTop: 10,
  },
  ageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  ageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#222222',
    textDecorationLine: 'underline',
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: '#FF385C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 120,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SearchScreen;