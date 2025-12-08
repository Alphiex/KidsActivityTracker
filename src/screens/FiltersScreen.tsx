import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import { useTheme } from '../contexts/ThemeContext';
import PreferencesService from '../services/preferencesService';
import ActivityService from '../services/activityService';
import { UserPreferences } from '../types/preferences';
import { API_CONFIG } from '../config/api';
import TopTabNavigation from '../components/TopTabNavigation';

interface ExpandableSection {
  id: string;
  title: string;
  expanded: boolean;
}

interface ActivityType {
  id: string;
  name: string;
  code: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  activities?: number;
}

interface City {
  name: string;
  locations: Location[];
  expanded: boolean;
}

const FiltersScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [sections, setSections] = useState<ExpandableSection[]>([
    { id: 'activityTypes', title: 'Activity Type?', expanded: false },
    { id: 'age', title: 'Age Range?', expanded: false },
    { id: 'locations', title: 'Where?', expanded: false },
    { id: 'budget', title: 'Cost?', expanded: false },
    { id: 'schedule', title: 'Day of the Week?', expanded: false },
    { id: 'dates', title: 'When?', expanded: false },
  ]);

  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();

  useEffect(() => {
    loadPreferences();
    loadActivityTypes();
    loadLocations();
  }, []);

  const loadPreferences = async () => {
    try {
      const userPrefs = preferencesService.getPreferences();
      console.log('📖 [FiltersScreen] Loaded preferences:', {
        hideClosedOrFull: userPrefs.hideClosedOrFull,
        hideClosedActivities: userPrefs.hideClosedActivities,
        hideFullActivities: userPrefs.hideFullActivities
      });
      setPreferences(userPrefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityTypes = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/activity-types`);
      const result = await response.json();
      
      if (result.success && result.data && Array.isArray(result.data)) {
        setActivityTypes(result.data);
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
    }
  };

  const loadLocations = async () => {
    try {
      const locations = await activityService.getLocations();
      
      // Group locations by city
      const cityMap = new Map<string, Location[]>();
      locations.forEach((location: any) => {
        const cityName = location.city || location.name.split(',')[0] || 'Other';
        if (!cityMap.has(cityName)) {
          cityMap.set(cityName, []);
        }
        cityMap.get(cityName)!.push({
          id: location.id,
          name: location.name,
          city: cityName,
          activities: location._count?.activities || 0,
        });
      });

      const cityList = Array.from(cityMap.entries()).map(([cityName, locations]) => ({
        name: cityName,
        locations,
        expanded: false,
      }));

      setCities(cityList);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    if (!preferences) return;

    console.log('📝 [FiltersScreen] Updating preferences with:', updates);
    const updatedPrefs = preferencesService.updatePreferences(updates);
    console.log('📝 [FiltersScreen] Updated preferences:', updatedPrefs);
    setPreferences(updatedPrefs);
  };

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  const toggleActivityType = (activityTypeCode: string) => {
    if (!preferences) return;

    const currentTypes = preferences.preferredActivityTypes || [];
    const updatedTypes = currentTypes.includes(activityTypeCode)
      ? currentTypes.filter(code => code !== activityTypeCode)
      : [...currentTypes, activityTypeCode];

    updatePreferences({ preferredActivityTypes: updatedTypes });
  };

  const toggleLocation = (locationName: string) => {
    if (!preferences) return;

    const currentLocations = preferences.locations || [];
    const updatedLocations = currentLocations.includes(locationName)
      ? currentLocations.filter(loc => loc !== locationName)
      : [...currentLocations, locationName];

    updatePreferences({ locations: updatedLocations });
  };

  const toggleCity = (cityName: string) => {
    setCities(prev => prev.map(city => 
      city.name === cityName 
        ? { ...city, expanded: !city.expanded }
        : city
    ));
  };

  const updateAgeRange = (min: number, max: number) => {
    updatePreferences({ 
      ageRanges: [{ min, max }] 
    });
  };

  const updateBudget = (min: number, max: number) => {
    updatePreferences({ 
      priceRange: { min, max } 
    });
  };

  const toggleDayOfWeek = (day: string) => {
    if (!preferences) return;

    const currentDays = preferences.daysOfWeek || [];
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];

    updatePreferences({ daysOfWeek: updatedDays });
  };

  const handleNavigateToDashboard = () => {
    navigation.navigate('Dashboard' as never);
  };

  const handleNavigateToCalendar = () => {
    navigation.navigate('Calendar' as never);
  };

  const getSectionSummary = (section: ExpandableSection) => {
    switch (section.id) {
      case 'activityTypes':
        const selectedTypes = preferences?.preferredActivityTypes || [];
        return selectedTypes.length > 0
          ? `${selectedTypes.length} selected`
          : 'All types';
      case 'age':
        const ageRange = preferences?.ageRanges?.[0] || { min: 0, max: 18 };
        return `${ageRange.min} - ${ageRange.max} years`;
      case 'locations':
        const locations = preferences?.locations || [];
        return locations.length > 0
          ? `${locations.length} selected`
          : 'Anywhere';
      case 'budget':
        const priceRange = preferences?.priceRange || { min: 0, max: 1000 };
        const budgetIsUnlimited = priceRange.max >= 10000;
        return budgetIsUnlimited ? 'No Limit' : `Up to $${priceRange.max}`;
      case 'schedule':
        const days = preferences?.daysOfWeek || [];
        return days.length === 7 || days.length === 0 ? 'Any day' : `${days.length} days`;
      case 'dates':
        return 'Flexible dates';
      default:
        return '';
    }
  };

  const getSectionIcon = (sectionId: string) => {
    switch (sectionId) {
      case 'activityTypes':
        return 'soccer';
      case 'age':
        return 'account-child';
      case 'locations':
        return 'map-marker';
      case 'budget':
        return 'currency-usd';
      case 'schedule':
        return 'calendar-week';
      case 'dates':
        return 'calendar-range';
      default:
        return 'help-circle';
    }
  };

  const renderExpandableSection = (section: ExpandableSection) => {
    const isExpanded = section.expanded;
    const summary = getSectionSummary(section);
    const icon = getSectionIcon(section.id);

    return (
      <View key={section.id} style={styles.sectionContainer}>
        <TouchableOpacity
          style={[styles.sectionHeader, isExpanded && styles.sectionHeaderExpanded]}
          onPress={() => toggleSection(section.id)}
        >
          <View style={styles.sectionHeaderContent}>
            <Icon name={icon} size={24} color="#222222" style={styles.sectionIcon} />
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSummary}>{summary}</Text>
            </View>
          </View>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#717171"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.sectionContent}>
            {renderSectionContent(section)}
          </View>
        )}
      </View>
    );
  };

  const renderSectionContent = (section: ExpandableSection) => {
    switch (section.id) {
      case 'activityTypes':
        return renderActivityTypesContent();
      case 'age':
        return renderAgeContent();
      case 'locations':
        return renderLocationsContent();
      case 'budget':
        return renderBudgetContent();
      case 'schedule':
        return renderScheduleContent();
      case 'dates':
        return renderDatesContent();
      default:
        return null;
    }
  };

  const renderActivityTypesContent = () => (
    <View style={styles.sectionContent}>
      <View style={styles.optionsGrid}>
        {activityTypes.map((type) => (
          <TouchableOpacity
            key={type.code}
            style={[
              styles.optionChip,
              preferences?.preferredActivityTypes?.includes(type.code) && styles.optionChipActive,
            ]}
            onPress={() => toggleActivityType(type.code)}
          >
            <Text style={[
              styles.optionChipText,
              preferences?.preferredActivityTypes?.includes(type.code) && styles.optionChipTextActive,
            ]}>
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAgeContent = () => {
    const ageRange = preferences?.ageRanges?.[0] || { min: 0, max: 18 };

    return (
      <View style={styles.sectionContent}>
        <View style={styles.ageRangeHeader}>
          <Text style={styles.rangeLabel}>Age Range</Text>
          <Text style={styles.ageRangeValue}>
            {ageRange.min} - {ageRange.max} years
          </Text>
        </View>

        {/* Age Range Visual */}
        <View style={styles.ageRangeVisual}>
          <View style={styles.ageRangeBar}>
            <View
              style={[
                styles.ageRangeFill,
                {
                  left: `${(ageRange.min / 18) * 100}%`,
                  right: `${((18 - ageRange.max) / 18) * 100}%`,
                }
              ]}
            />
          </View>
          <View style={styles.ageRangeLabels}>
            <Text style={styles.ageRangeLabelText}>0</Text>
            <Text style={styles.ageRangeLabelText}>18</Text>
          </View>
        </View>

        {/* Minimum Age Slider */}
        <View style={styles.sliderSection}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Minimum Age</Text>
            <View style={styles.sliderValueBadge}>
              <Text style={styles.sliderValueText}>{ageRange.min} yrs</Text>
            </View>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={17}
            step={1}
            value={ageRange.min}
            onValueChange={(value) => {
              const newMin = Math.round(value);
              if (newMin < ageRange.max) {
                updateAgeRange(newMin, ageRange.max);
              }
            }}
            minimumTrackTintColor="#FF385C"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#FF385C"
          />
        </View>

        {/* Maximum Age Slider */}
        <View style={styles.sliderSection}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Maximum Age</Text>
            <View style={styles.sliderValueBadge}>
              <Text style={styles.sliderValueText}>{ageRange.max} yrs</Text>
            </View>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={18}
            step={1}
            value={ageRange.max}
            onValueChange={(value) => {
              const newMax = Math.round(value);
              if (newMax > ageRange.min) {
                updateAgeRange(ageRange.min, newMax);
              }
            }}
            minimumTrackTintColor="#FF385C"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#FF385C"
          />
        </View>

        {/* Age Group Quick Select */}
        <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Quick Select</Text>
        <View style={styles.ageGroupQuickSelect}>
          <TouchableOpacity
            style={[styles.ageGroupChip, ageRange.min <= 3 && ageRange.max >= 1 && styles.ageGroupChipActive]}
            onPress={() => updateAgeRange(1, 3)}
          >
            <Text style={[styles.ageGroupChipText, ageRange.min <= 3 && ageRange.max >= 1 && ageRange.min === 1 && ageRange.max === 3 && styles.ageGroupChipTextActive]}>
              Toddler (1-3)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ageGroupChip, ageRange.min === 3 && ageRange.max === 5 && styles.ageGroupChipActive]}
            onPress={() => updateAgeRange(3, 5)}
          >
            <Text style={[styles.ageGroupChipText, ageRange.min === 3 && ageRange.max === 5 && styles.ageGroupChipTextActive]}>
              Preschool (3-5)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ageGroupChip, ageRange.min === 6 && ageRange.max === 10 && styles.ageGroupChipActive]}
            onPress={() => updateAgeRange(6, 10)}
          >
            <Text style={[styles.ageGroupChipText, ageRange.min === 6 && ageRange.max === 10 && styles.ageGroupChipTextActive]}>
              Elementary (6-10)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ageGroupChip, ageRange.min === 11 && ageRange.max === 13 && styles.ageGroupChipActive]}
            onPress={() => updateAgeRange(11, 13)}
          >
            <Text style={[styles.ageGroupChipText, ageRange.min === 11 && ageRange.max === 13 && styles.ageGroupChipTextActive]}>
              Pre-teen (11-13)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ageGroupChip, ageRange.min === 14 && ageRange.max === 18 && styles.ageGroupChipActive]}
            onPress={() => updateAgeRange(14, 18)}
          >
            <Text style={[styles.ageGroupChipText, ageRange.min === 14 && ageRange.max === 18 && styles.ageGroupChipTextActive]}>
              Teen (14-18)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ageGroupChip, ageRange.min === 0 && ageRange.max === 18 && styles.ageGroupChipActive]}
            onPress={() => updateAgeRange(0, 18)}
          >
            <Text style={[styles.ageGroupChipText, ageRange.min === 0 && ageRange.max === 18 && styles.ageGroupChipTextActive]}>
              All Ages
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderLocationsContent = () => (
    <View style={styles.sectionContent}>
      {cities.map((city) => (
        <View key={city.name} style={styles.cityContainer}>
          <TouchableOpacity
            style={styles.cityHeader}
            onPress={() => toggleCity(city.name)}
          >
            <Text style={styles.cityName}>{city.name}</Text>
            <View style={styles.cityHeaderRight}>
              <Text style={styles.locationCount}>{city.locations.length} locations</Text>
              <Icon
                name={city.expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#717171"
              />
            </View>
          </TouchableOpacity>
          
          {city.expanded && (
            <View style={styles.locationsContainer}>
              {city.locations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={styles.locationItem}
                  onPress={() => toggleLocation(location.name)}
                >
                  <View style={[
                    styles.checkbox,
                    preferences?.locations?.includes(location.name) && styles.checkboxActive,
                  ]}>
                    {preferences?.locations?.includes(location.name) && (
                      <Icon name="check" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>{location.name}</Text>
                    {location.activities && location.activities > 0 && (
                      <Text style={styles.locationActivities}>
                        {location.activities} activities
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderBudgetContent = () => {
    const priceRange = preferences?.priceRange || { min: 0, max: 1000 };
    const isUnlimited = priceRange.max >= 10000;

    const updateMaxCost = (max: number | null) => {
      preferencesService.updatePreferences({
        priceRange: { min: 0, max: max }
      });
      setPreferences(preferencesService.getPreferences());
    };

    const budgetPresets = [
      { label: '$25', value: 25 },
      { label: '$50', value: 50 },
      { label: '$100', value: 100 },
      { label: '$200', value: 200 },
      { label: '$500', value: 500 },
      { label: 'No Limit', value: 999999 },
    ];

    return (
      <View style={styles.sectionContent}>
        {/* Header with current value */}
        <View style={styles.ageRangeHeader}>
          <Text style={styles.rangeLabel}>Maximum Cost</Text>
          <Text style={styles.ageRangeValue}>
            {isUnlimited ? 'No Limit' : `Up to $${priceRange.max}`}
          </Text>
        </View>

        {/* Cost Range Visual */}
        {!isUnlimited && (
          <View style={styles.ageRangeVisual}>
            <View style={styles.ageRangeBar}>
              <View
                style={[
                  styles.ageRangeFill,
                  {
                    left: '0%',
                    right: `${100 - Math.min((priceRange.max / 500) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.ageRangeLabels}>
              <Text style={styles.ageRangeLabelText}>$0</Text>
              <Text style={styles.ageRangeLabelText}>$500+</Text>
            </View>
          </View>
        )}

        {/* Max Cost Slider */}
        {!isUnlimited && (
          <View style={styles.sliderSection}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={500}
              step={25}
              value={Math.min(priceRange.max || 0, 500)}
              onValueChange={(value) => {
                const newMax = Math.round(value);
                updateMaxCost(newMax);
              }}
              minimumTrackTintColor="#FF385C"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#FF385C"
            />
          </View>
        )}

        {/* Quick Select Chips */}
        <View style={styles.quickSelectSection}>
          <Text style={styles.quickSelectLabel}>Quick Select</Text>
          <View style={styles.quickSelectChips}>
            {budgetPresets.map((preset) => {
              const isPresetUnlimited = preset.value >= 10000;
              const isActive = isPresetUnlimited
                ? isUnlimited
                : !isUnlimited && priceRange.max === preset.value;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.quickSelectChip,
                    isActive && styles.quickSelectChipActive,
                    isPresetUnlimited && styles.quickSelectChipUnlimited,
                  ]}
                  onPress={() => updateMaxCost(preset.value)}
                >
                  <Text style={[
                    styles.quickSelectChipText,
                    isActive && styles.quickSelectChipTextActive,
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isUnlimited && (
          <View style={styles.unlimitedBanner}>
            <Text style={styles.unlimitedText}>
              No cost limit - showing all activities regardless of price
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderScheduleContent = () => {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const selectedDays = preferences?.daysOfWeek || [];
    
    return (
      <View style={styles.sectionContent}>
        <Text style={styles.subSectionTitle}>Preferred Days</Text>
        <View style={styles.daysGrid}>
          {daysOfWeek.map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayChip,
                selectedDays.includes(day) && styles.dayChipActive,
              ]}
              onPress={() => toggleDayOfWeek(day)}
            >
              <Text style={[
                styles.dayChipText,
                selectedDays.includes(day) && styles.dayChipTextActive,
              ]}>
                {day.substring(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <Text style={[styles.subSectionTitle, { marginTop: 24 }]}>Preferred Times</Text>
        <View style={styles.timePreferences}>
          <View style={styles.timePreference}>
            <Text style={styles.timeLabel}>Morning (6AM - 12PM)</Text>
            <Switch
              value={preferences?.timePreferences?.morning || false}
              onValueChange={(value) => 
                updatePreferences({
                  timePreferences: {
                    ...preferences?.timePreferences,
                    morning: value,
                  }
                })
              }
              trackColor={{ false: '#EEEEEE', true: '#FF385C' }}
              thumbColor={preferences?.timePreferences?.morning ? '#FFFFFF' : '#CCCCCC'}
            />
          </View>
          
          <View style={styles.timePreference}>
            <Text style={styles.timeLabel}>Afternoon (12PM - 5PM)</Text>
            <Switch
              value={preferences?.timePreferences?.afternoon || false}
              onValueChange={(value) => 
                updatePreferences({
                  timePreferences: {
                    ...preferences?.timePreferences,
                    afternoon: value,
                  }
                })
              }
              trackColor={{ false: '#EEEEEE', true: '#FF385C' }}
              thumbColor={preferences?.timePreferences?.afternoon ? '#FFFFFF' : '#CCCCCC'}
            />
          </View>
          
          <View style={styles.timePreference}>
            <Text style={styles.timeLabel}>Evening (5PM - 9PM)</Text>
            <Switch
              value={preferences?.timePreferences?.evening || false}
              onValueChange={(value) => 
                updatePreferences({
                  timePreferences: {
                    ...preferences?.timePreferences,
                    evening: value,
                  }
                })
              }
              trackColor={{ false: '#EEEEEE', true: '#FF385C' }}
              thumbColor={preferences?.timePreferences?.evening ? '#FFFFFF' : '#CCCCCC'}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderDatesContent = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.subSectionTitle}>Date Range Options</Text>
      <Text style={styles.helperText}>
        Choose how activities should match your preferred date range
      </Text>
      
      <TouchableOpacity style={styles.dateOption}>
        <View style={styles.dateOptionContent}>
          <Text style={styles.dateOptionTitle}>Partially Overlap</Text>
          <Text style={styles.dateOptionDescription}>
            Show activities that at least partially overlap with your date range
          </Text>
        </View>
        <View style={[styles.radio, styles.radioActive]}>
          <View style={styles.radioInner} />
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.dateOption}>
        <View style={styles.dateOptionContent}>
          <Text style={styles.dateOptionTitle}>Fully Between</Text>
          <Text style={styles.dateOptionDescription}>
            Show only activities that fall completely within your date range
          </Text>
        </View>
        <View style={styles.radio} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF385C" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Navigation - Fixed at top */}
      <TopTabNavigation />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Set Your Preferences
        </Text>
        <Text style={styles.headerSubtitle}>
          These preferences will filter your dashboard results
        </Text>
      </View>

      {/* Global Preference - Hide Closed or Full Activities */}
      <View style={styles.globalPreferenceContainer}>
        <View style={styles.globalPreferenceContent}>
          <Icon name="eye-off-outline" size={24} color="#222222" style={styles.globalPreferenceIcon} />
          <View style={styles.globalPreferenceText}>
            <Text style={styles.globalPreferenceTitle}>Hide Closed or Full Activities</Text>
            <Text style={styles.globalPreferenceDescription}>
              Only show activities that are open for registration
            </Text>
          </View>
        </View>
        <Switch
          value={preferences?.hideClosedOrFull ?? true}
          onValueChange={(value) => updatePreferences({ hideClosedOrFull: value })}
          trackColor={{ false: '#EEEEEE', true: '#FF385C' }}
          thumbColor={preferences?.hideClosedOrFull ? '#FFFFFF' : '#CCCCCC'}
        />
      </View>

      {/* Scrollable Content */}
      <Animated.ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.sectionsContainer}>
          {sections.map(renderExpandableSection)}
        </View>
        
        <View style={styles.bottomPadding} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#717171',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#717171',
  },
  topButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  topButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    position: 'relative',
  },
  iconEmoji: {
    fontSize: 28,
    marginBottom: 4,
    minHeight: 30,
    lineHeight: 30,
  },
  topButtonText: {
    fontSize: 12,
    color: '#717171',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#222',
    fontWeight: '600',
  },
  activeTabLine: {
    position: 'absolute',
    bottom: -8,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#222',
    borderRadius: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  sectionsContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderExpanded: {
    backgroundColor: '#F8F8F8',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 2,
  },
  sectionSummary: {
    fontSize: 14,
    color: '#717171',
  },
  sectionContent: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#FFFFFF',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    borderColor: '#FF385C',
    backgroundColor: '#FF385C',
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#717171',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
  },
  rangeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rangeValue: {
    fontSize: 14,
    color: '#717171',
  },
  helperText: {
    fontSize: 12,
    color: '#999999',
    fontStyle: 'italic',
  },
  // Age Range Slider Styles
  ageRangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ageRangeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF385C',
  },
  ageRangeVisual: {
    marginBottom: 24,
  },
  ageRangeBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ageRangeFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#FF385C',
    borderRadius: 4,
  },
  ageRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ageRangeLabelText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sliderSection: {
    marginBottom: 16,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  sliderValueBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sliderValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF385C',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  ageGroupQuickSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ageGroupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  ageGroupChipActive: {
    borderColor: '#FF385C',
    backgroundColor: '#FEF2F2',
  },
  ageGroupChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  ageGroupChipTextActive: {
    color: '#FF385C',
    fontWeight: '600',
  },
  cityContainer: {
    marginBottom: 16,
  },
  cityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  cityHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationCount: {
    fontSize: 12,
    color: '#717171',
  },
  locationsContainer: {
    paddingLeft: 16,
    paddingTop: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    borderColor: '#FF385C',
    backgroundColor: '#FF385C',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    color: '#222222',
    marginBottom: 2,
  },
  locationActivities: {
    fontSize: 12,
    color: '#717171',
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 12,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    borderColor: '#FF385C',
    backgroundColor: '#FF385C',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#717171',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  timePreferences: {
    gap: 16,
  },
  timePreference: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 14,
    color: '#222222',
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: -4,
    borderRadius: 8,
  },
  dateOptionContent: {
    flex: 1,
    marginRight: 12,
  },
  dateOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  dateOptionDescription: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: '#FF385C',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF385C',
  },
  bottomPadding: {
    height: 32,
  },
  globalPreferenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0CC',
  },
  globalPreferenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  globalPreferenceIcon: {
    marginRight: 12,
  },
  globalPreferenceText: {
    flex: 1,
  },
  globalPreferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 2,
  },
  globalPreferenceDescription: {
    fontSize: 13,
    color: '#717171',
  },
  quickSelectSection: {
    marginTop: 20,
  },
  quickSelectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  quickSelectChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickSelectChipActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FF385C',
  },
  quickSelectChipUnlimited: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  quickSelectChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  quickSelectChipTextActive: {
    color: '#FF385C',
  },
  unlimitedBanner: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  unlimitedText: {
    fontSize: 14,
    color: '#059669',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default FiltersScreen;