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
    { id: 'activityTypes', title: 'Activity Types', expanded: false },
    { id: 'age', title: 'Age', expanded: false },
    { id: 'locations', title: 'Locations', expanded: false },
    { id: 'budget', title: 'Budget', expanded: false },
    { id: 'schedule', title: 'Schedule', expanded: false },
    { id: 'dates', title: 'Dates', expanded: false },
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
    
    const updatedPrefs = preferencesService.updatePreferences(updates);
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

  // Animation values for scrolling behavior - match Dashboard
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [140, 90],
    extrapolate: 'clamp',
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerSubtitleOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const renderExpandableSection = (section: ExpandableSection) => (
    <View key={section.id} style={styles.sectionContainer}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(section.id)}
      >
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Icon
          name={section.expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#717171"
        />
      </TouchableOpacity>
      
      {section.expanded && renderSectionContent(section)}
    </View>
  );

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
        <Text style={styles.rangeLabel}>
          Age Range: {ageRange.min} - {ageRange.max} years
        </Text>
        <View style={styles.rangeContainer}>
          <Text style={styles.rangeValue}>Min: {ageRange.min}</Text>
          <Text style={styles.rangeValue}>Max: {ageRange.max}</Text>
        </View>
        <Text style={styles.helperText}>Tap to adjust age range</Text>
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
    
    return (
      <View style={styles.sectionContent}>
        <Text style={styles.rangeLabel}>
          Budget: ${priceRange.min} - ${priceRange.max}
        </Text>
        <View style={styles.rangeContainer}>
          <Text style={styles.rangeValue}>Min: ${priceRange.min}</Text>
          <Text style={styles.rangeValue}>Max: ${priceRange.max}</Text>
        </View>
        <Text style={styles.helperText}>Tap to adjust budget range</Text>
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

      {/* Animated Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Animated.View style={{ opacity: headerTitleOpacity }}>
          <Text style={styles.headerTitle}>Set Your Preferences</Text>
        </Animated.View>
        <Animated.View style={{ opacity: headerSubtitleOpacity }}>
          <Text style={styles.headerSubtitle}>
            These preferences will filter your dashboard results
          </Text>
        </Animated.View>
      </Animated.View>

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
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 18,
    textAlign: 'center',
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
    paddingTop: 16,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  sectionContent: {
    padding: 20,
    paddingTop: 16,
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
    marginBottom: 12,
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
});

export default FiltersScreen;