import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Switch,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import PreferencesService from '../services/preferencesService';
import ActivityService from '../services/activityService';
import { UserPreferences, HierarchicalProvince } from '../types/preferences';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import { HierarchicalSelect, buildHierarchyFromAPI } from '../components/HierarchicalSelect';
import useSubscription from '../hooks/useSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';
import { LockedFeature } from '../components/PremiumBadge';
import DistanceFilterSection from '../components/filters/DistanceFilterSection';

interface ExpandableSection {
  id: string;
  title: string;
  expanded: boolean;
}

interface ActivitySubtype {
  id: string;
  name: string;
  code: string;
  activityCount: number;
}

interface ActivityType {
  id: string;
  name: string;
  code: string;
  iconName?: string;
  activityCount: number;
  subtypes: ActivitySubtype[];
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

interface AgeGroup {
  code: string;
  label: string;
  minAge: number;
  maxAge: number;
}

const FiltersScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  // Subscription state for advanced filters
  const {
    checkAndShowUpgrade,
    showUpgradeModal,
    upgradeFeature,
    hideUpgradeModal,
    hasAdvancedFilters,
  } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [sections, setSections] = useState<ExpandableSection[]>([
    { id: 'activityTypes', title: 'Activity Type?', expanded: false },
    { id: 'environment', title: 'Indoor or Outdoor?', expanded: false },
    { id: 'age', title: 'Age Range?', expanded: false },
    { id: 'locations', title: 'Where?', expanded: false },
    { id: 'distance', title: 'How Far?', expanded: false },
    { id: 'budget', title: 'Cost?', expanded: false },
    { id: 'schedule', title: 'Day of the Week?', expanded: false },
    { id: 'dates', title: 'When?', expanded: false },
  ]);

  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [expandedActivityTypes, setExpandedActivityTypes] = useState<Set<string>>(new Set());
  const [cities, setCities] = useState<City[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [activityTypesLoading, setActivityTypesLoading] = useState(true);

  // Hierarchical location state
  const [hierarchyData, setHierarchyData] = useState<HierarchicalProvince[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [locationsLoading, setLocationsLoading] = useState(true);

  // Date picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date());
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();

  useEffect(() => {
    loadPreferences();
    loadActivityTypes();
    loadLocations();
    loadAgeGroups();
  }, []);

  const loadPreferences = async () => {
    try {
      const userPrefs = preferencesService.getPreferences();
      console.log('📖 [FiltersScreen] Loaded preferences:', {
        hideClosedOrFull: userPrefs.hideClosedOrFull,
        hideClosedActivities: userPrefs.hideClosedActivities,
        hideFullActivities: userPrefs.hideFullActivities,
        dateFilter: userPrefs.dateFilter,
        dateRange: userPrefs.dateRange,
        dateMatchMode: userPrefs.dateMatchMode
      });
      setPreferences(userPrefs);

      // Initialize date state from preferences
      if (userPrefs.dateRange?.start) {
        setTempStartDate(new Date(userPrefs.dateRange.start));
      }
      if (userPrefs.dateRange?.end) {
        setTempEndDate(new Date(userPrefs.dateRange.end));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivityTypes = async () => {
    try {
      setActivityTypesLoading(true);
      console.log('📋 [FiltersScreen] Loading activity types...');

      // Use activityService which properly handles auth and global filters
      const types = await activityService.getActivityTypesWithCounts(true);
      console.log('📋 [FiltersScreen] Received activity types:', types?.length || 0);

      if (types && Array.isArray(types)) {
        // Map to include subtypes properly
        const mappedTypes: ActivityType[] = types.map((type: any) => ({
          id: type.id,
          name: type.name,
          code: type.code,
          iconName: type.iconName,
          activityCount: type.activityCount || 0,
          subtypes: type.subtypes || []
        }));
        setActivityTypes(mappedTypes);
        console.log('📋 [FiltersScreen] Activity types loaded:', mappedTypes.length, 'with subtypes');
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
    } finally {
      setActivityTypesLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      setLocationsLoading(true);
      console.log('📍 [FiltersScreen] Loading locations and cities...');

      // Fetch both cities (with province) and locations in parallel
      const [citiesData, locationsData] = await Promise.all([
        activityService.getCities(),
        activityService.getLocations(),
      ]);

      console.log('📍 [FiltersScreen] Received cities:', citiesData?.length || 0);
      console.log('📍 [FiltersScreen] Sample city:', citiesData?.[0]);
      console.log('📍 [FiltersScreen] Received locations:', locationsData?.length || 0);
      console.log('📍 [FiltersScreen] Sample location:', locationsData?.[0]);

      if (!locationsData || locationsData.length === 0) {
        console.warn('📍 [FiltersScreen] No locations returned from API');
        setLocationsLoading(false);
        return;
      }

      // Build hierarchical structure (Province -> City -> Location)
      const hierarchy = buildHierarchyFromAPI(citiesData || [], locationsData);
      console.log('📍 [FiltersScreen] Built hierarchy with provinces:', hierarchy.length);
      if (hierarchy.length > 0) {
        console.log('📍 [FiltersScreen] First province:', hierarchy[0].name, 'with', hierarchy[0].cities.length, 'cities');
      }
      setHierarchyData(hierarchy);

      // Initialize selectedLocationIds from preferences
      const userPrefs = preferencesService.getPreferences();
      if (userPrefs.locationIds && userPrefs.locationIds.length > 0) {
        setSelectedLocationIds(new Set(userPrefs.locationIds));
      } else if (userPrefs.locations && userPrefs.locations.length > 0) {
        // Migration: convert old location names to IDs
        const locationNameToId = new Map<string, string>();
        locationsData.forEach((loc: any) => {
          locationNameToId.set(loc.name.toLowerCase(), loc.id);
        });

        const migratedIds: string[] = [];
        userPrefs.locations.forEach((name: string) => {
          const id = locationNameToId.get(name.toLowerCase());
          if (id) {
            migratedIds.push(id);
          }
        });

        if (migratedIds.length > 0) {
          console.log('📍 [FiltersScreen] Migrated', migratedIds.length, 'locations to IDs');
          setSelectedLocationIds(new Set(migratedIds));
          // Save migrated IDs
          preferencesService.updatePreferences({
            locationIds: migratedIds,
            locations: [], // Clear old format
          });
        }
      }

      // Also update legacy cities state for backward compatibility
      const cityMap = new Map<string, Location[]>();
      locationsData.forEach((location: any) => {
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
    } finally {
      setLocationsLoading(false);
    }
  };

  const loadAgeGroups = async () => {
    try {
      const ageGroupsData = await activityService.getAgeGroups();
      setAgeGroups(ageGroupsData);
    } catch (error) {
      console.error('Error loading age groups:', error);
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

  // Handler for hierarchical location selection
  const handleLocationSelectionChange = useCallback((newSelection: Set<string>) => {
    setSelectedLocationIds(newSelection);
    // Persist to preferences
    const locationIdsArray = Array.from(newSelection);
    preferencesService.updatePreferences({ locationIds: locationIdsArray });
    setPreferences(preferencesService.getPreferences());
  }, []);

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
      case 'environment':
        const envFilter = preferences?.environmentFilter || 'all';
        if (envFilter === 'indoor') return 'Indoor only';
        if (envFilter === 'outdoor') return 'Outdoor only';
        return 'All activities';
      case 'age':
        const ageRange = preferences?.ageRanges?.[0] || { min: 0, max: 18 };
        return `${ageRange.min} - ${ageRange.max} years`;
      case 'locations':
        // Use hierarchical selection count
        const locationCount = selectedLocationIds.size;
        return locationCount > 0
          ? `${locationCount} selected`
          : 'Anywhere';
      case 'distance':
        if (!preferences?.distanceFilterEnabled) {
          return 'Disabled';
        }
        return `Within ${preferences.distanceRadiusKm || 25} km`;
      case 'budget':
        const priceRange = preferences?.priceRange || { min: 0, max: 1000 };
        const budgetIsUnlimited = priceRange.max >= 10000;
        return budgetIsUnlimited ? 'No Limit' : `Up to $${priceRange.max}`;
      case 'schedule':
        const days = preferences?.daysOfWeek || [];
        return days.length === 7 || days.length === 0 ? 'Any day' : `${days.length} days`;
      case 'dates':
        const dateFilter = preferences?.dateFilter || 'any';
        if (dateFilter === 'any') {
          return 'Any dates';
        }
        const dateRange = preferences?.dateRange;
        if (dateRange?.start) {
          const startDate = new Date(dateRange.start);
          const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `${startStr} - ${endStr}`;
          }
          return `From ${startStr}`;
        }
        return 'Any dates';
      default:
        return '';
    }
  };

  const getSectionIcon = (sectionId: string) => {
    switch (sectionId) {
      case 'activityTypes':
        return 'soccer';
      case 'environment':
        return 'weather-sunny';
      case 'age':
        return 'account-child';
      case 'locations':
        return 'map-marker';
      case 'distance':
        return 'map-marker-radius';
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
      case 'environment':
        return renderEnvironmentContent();
      case 'age':
        return renderAgeContent();
      case 'locations':
        return renderLocationsContent();
      case 'distance':
        return renderDistanceContent();
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

  const renderEnvironmentContent = () => {
    if (!preferences) return null;

    const currentEnv = preferences.environmentFilter || 'all';
    
    const environmentOptions = [
      { 
        value: 'all', 
        label: 'All Activities', 
        description: 'Show both indoor and outdoor activities',
        icon: 'earth' 
      },
      { 
        value: 'indoor', 
        label: 'Indoor Only', 
        description: 'Swimming pools, gyms, studios, rinks',
        icon: 'home-roof' 
      },
      { 
        value: 'outdoor', 
        label: 'Outdoor Only', 
        description: 'Parks, fields, nature, adventure',
        icon: 'pine-tree' 
      },
    ];

    return (
      <View style={styles.sectionContent}>
        <Text style={styles.helperText}>
          Filter activities by whether they take place indoors or outdoors
        </Text>
        <View style={{ marginTop: 12 }}>
          {environmentOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.dateOption,
                currentEnv === option.value && styles.dateOptionSelected
              ]}
              onPress={() => updatePreferences({ environmentFilter: option.value as 'all' | 'indoor' | 'outdoor' })}
            >
              <View style={styles.dateOptionContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name={option.icon} size={20} color={currentEnv === option.value ? '#E8638B' : '#6B7280'} style={{ marginRight: 10 }} />
                  <Text style={styles.dateOptionTitle}>{option.label}</Text>
                </View>
                <Text style={styles.dateOptionDescription}>
                  {option.description}
                </Text>
              </View>
              <View style={[styles.radio, currentEnv === option.value && styles.radioActive]}>
                {currentEnv === option.value && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDistanceContent = () => {
    if (!preferences) return null;

    return (
      <DistanceFilterSection
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        onConfigurePress={() => {
          // Navigate to distance settings screen
          (navigation as any).navigate('DistancePreferences');
        }}
      />
    );
  };

  const toggleActivityTypeExpand = (typeCode: string) => {
    setExpandedActivityTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeCode)) {
        next.delete(typeCode);
      } else {
        next.add(typeCode);
      }
      return next;
    });
  };

  const toggleSubtype = (subtypeCode: string) => {
    if (!preferences) return;

    const currentSubtypes = preferences.preferredSubtypes || [];
    const updatedSubtypes = currentSubtypes.includes(subtypeCode)
      ? currentSubtypes.filter(code => code !== subtypeCode)
      : [...currentSubtypes, subtypeCode];

    updatePreferences({ preferredSubtypes: updatedSubtypes });
  };

  const renderActivityTypesContent = () => {
    if (activityTypesLoading) {
      return (
        <View style={styles.sectionContent}>
          <ActivityIndicator size="small" color="#E8638B" />
          <Text style={styles.loadingText}>Loading activity types...</Text>
        </View>
      );
    }

    if (activityTypes.length === 0) {
      return (
        <View style={styles.sectionContent}>
          <Text style={styles.emptyText}>No activity types available</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionContent}>
        {activityTypes.map((type) => {
          const isTypeSelected = preferences?.preferredActivityTypes?.includes(type.code);
          const isExpanded = expandedActivityTypes.has(type.code);
          const hasSubtypes = type.subtypes && type.subtypes.length > 0;

          return (
            <View key={type.code} style={styles.activityTypeContainer}>
              {/* Main activity type row */}
              <View style={styles.activityTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.activityTypeChip,
                    isTypeSelected && styles.activityTypeChipActive,
                  ]}
                  onPress={() => toggleActivityType(type.code)}
                >
                  <Icon
                    name={type.iconName || 'tag'}
                    size={18}
                    color={isTypeSelected ? '#FFFFFF' : '#717171'}
                  />
                  <Text style={[
                    styles.activityTypeText,
                    isTypeSelected && styles.activityTypeTextActive,
                  ]}>
                    {type.name}
                  </Text>
                  <Text style={[
                    styles.activityTypeCount,
                    isTypeSelected && styles.activityTypeCountActive,
                  ]}>
                    ({type.activityCount})
                  </Text>
                </TouchableOpacity>

                {/* Expand button for subtypes */}
                {hasSubtypes && (
                  <TouchableOpacity
                    style={styles.expandSubtypesButton}
                    onPress={() => toggleActivityTypeExpand(type.code)}
                  >
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#717171"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Subtypes (when expanded) */}
              {isExpanded && hasSubtypes && (
                <View style={styles.subtypesContainer}>
                  {type.subtypes.map((subtype) => {
                    const isSubtypeSelected = preferences?.preferredSubtypes?.includes(subtype.code);
                    return (
                      <TouchableOpacity
                        key={subtype.code}
                        style={[
                          styles.subtypeChip,
                          isSubtypeSelected && styles.subtypeChipActive,
                        ]}
                        onPress={() => toggleSubtype(subtype.code)}
                      >
                        <Text style={[
                          styles.subtypeText,
                          isSubtypeSelected && styles.subtypeTextActive,
                        ]}>
                          {subtype.name}
                        </Text>
                        <Text style={[
                          styles.subtypeCount,
                          isSubtypeSelected && styles.subtypeCountActive,
                        ]}>
                          ({subtype.activityCount})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

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
            minimumTrackTintColor="#E8638B"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#E8638B"
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
            minimumTrackTintColor="#E8638B"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#E8638B"
          />
        </View>

        {/* Age Group Quick Select */}
        <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Quick Select</Text>
        <View style={styles.ageGroupQuickSelect}>
          {ageGroups.map((group) => (
            <TouchableOpacity
              key={group.code}
              style={[
                styles.ageGroupChip,
                ageRange.min === group.minAge && ageRange.max === group.maxAge && styles.ageGroupChipActive
              ]}
              onPress={() => updateAgeRange(group.minAge, group.maxAge)}
            >
              <Text style={[
                styles.ageGroupChipText,
                ageRange.min === group.minAge && ageRange.max === group.maxAge && styles.ageGroupChipTextActive
              ]}>
                {group.label}
              </Text>
            </TouchableOpacity>
          ))}
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
    <View style={[styles.sectionContent, { maxHeight: 400 }]}>
      <HierarchicalSelect
        hierarchy={hierarchyData}
        selectedLocationIds={selectedLocationIds}
        onSelectionChange={handleLocationSelectionChange}
        loading={locationsLoading}
        searchPlaceholder="Search provinces, cities, locations..."
      />
    </View>
  );

  const renderBudgetContent = () => {
    // Gate budget filter for free users
    if (!hasAdvancedFilters) {
      return (
        <View style={styles.sectionContent}>
          <LockedFeature
            label="Budget Filter"
            description="Filter activities by price range to find options that fit your budget"
            onPress={() => checkAndShowUpgrade('filters')}
          />
        </View>
      );
    }

    const priceRange = preferences?.priceRange || { min: 0, max: 1000 };
    const isUnlimited = priceRange.max >= 10000;

    const updateMaxCost = (max: number) => {
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
              minimumTrackTintColor="#E8638B"
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor="#E8638B"
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
                    morning: value,
                    afternoon: preferences?.timePreferences?.afternoon ?? false,
                    evening: preferences?.timePreferences?.evening ?? false,
                  }
                })
              }
              trackColor={{ false: '#EEEEEE', true: '#E8638B' }}
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
                    morning: preferences?.timePreferences?.morning ?? false,
                    afternoon: value,
                    evening: preferences?.timePreferences?.evening ?? false,
                  }
                })
              }
              trackColor={{ false: '#EEEEEE', true: '#E8638B' }}
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
                    morning: preferences?.timePreferences?.morning ?? false,
                    afternoon: preferences?.timePreferences?.afternoon ?? false,
                    evening: value,
                  }
                })
              }
              trackColor={{ false: '#EEEEEE', true: '#E8638B' }}
              thumbColor={preferences?.timePreferences?.evening ? '#FFFFFF' : '#CCCCCC'}
            />
          </View>
        </View>
      </View>
    );
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDateFilterChange = (filter: 'any' | 'range') => {
    if (filter === 'any') {
      updatePreferences({
        dateFilter: 'any',
        dateRange: undefined
      });
    } else {
      // When enabling range, set start date to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTempStartDate(today);
      setTempEndDate(null);
      updatePreferences({
        dateFilter: 'range',
        dateRange: { start: today.toISOString() }
      });
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (selectedDate) {
      selectedDate.setHours(0, 0, 0, 0);
      setTempStartDate(selectedDate);

      // Update preferences
      const newDateRange: { start: string; end?: string } = {
        start: selectedDate.toISOString()
      };
      if (tempEndDate && tempEndDate >= selectedDate) {
        newDateRange.end = tempEndDate.toISOString();
      } else if (tempEndDate && tempEndDate < selectedDate) {
        // If end date is before start, clear it
        setTempEndDate(null);
      }
      updatePreferences({ dateRange: newDateRange });
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (selectedDate) {
      selectedDate.setHours(23, 59, 59, 999);
      setTempEndDate(selectedDate);

      // Update preferences
      updatePreferences({
        dateRange: {
          start: tempStartDate.toISOString(),
          end: selectedDate.toISOString()
        }
      });
    }
  };

  const clearEndDate = () => {
    setTempEndDate(null);
    updatePreferences({
      dateRange: {
        start: tempStartDate.toISOString(),
        end: undefined
      }
    });
  };

  const handleDateMatchModeChange = (mode: 'partial' | 'full') => {
    updatePreferences({ dateMatchMode: mode });
  };

  const renderDatesContent = () => {
    const currentDateFilter = preferences?.dateFilter || 'any';
    const currentMatchMode = preferences?.dateMatchMode || 'partial';
    const isRangeMode = currentDateFilter === 'range';

    return (
      <View style={styles.sectionContent}>
        {/* Date Filter Type Selection */}
        <Text style={styles.subSectionTitle}>Date Filter</Text>

        <TouchableOpacity
          style={[styles.dateOption, currentDateFilter === 'any' && styles.dateOptionSelected]}
          onPress={() => handleDateFilterChange('any')}
        >
          <View style={styles.dateOptionContent}>
            <Text style={styles.dateOptionTitle}>Any Dates</Text>
            <Text style={styles.dateOptionDescription}>
              Show all activities regardless of when they occur
            </Text>
          </View>
          <View style={[styles.radio, currentDateFilter === 'any' && styles.radioActive]}>
            {currentDateFilter === 'any' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateOption, currentDateFilter === 'range' && styles.dateOptionSelected]}
          onPress={() => handleDateFilterChange('range')}
        >
          <View style={styles.dateOptionContent}>
            <Text style={styles.dateOptionTitle}>Specific Date Range</Text>
            <Text style={styles.dateOptionDescription}>
              Filter activities by start and/or end date
            </Text>
          </View>
          <View style={[styles.radio, currentDateFilter === 'range' && styles.radioActive]}>
            {currentDateFilter === 'range' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Date Range Selection (only shown when range mode is selected) */}
        {isRangeMode && (
          <>
            <View style={styles.dateRangeDivider} />
            <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Select Dates</Text>

            {/* Start Date */}
            <View style={styles.datePickerRow}>
              <Text style={styles.datePickerLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Icon name="calendar" size={20} color="#E8638B" />
                <Text style={styles.datePickerButtonText}>
                  {formatDateForDisplay(tempStartDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Date (Optional) */}
            <View style={styles.datePickerRow}>
              <Text style={styles.datePickerLabel}>End Date (Optional)</Text>
              {tempEndDate ? (
                <View style={styles.datePickerWithClear}>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Icon name="calendar" size={20} color="#E8638B" />
                    <Text style={styles.datePickerButtonText}>
                      {formatDateForDisplay(tempEndDate)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.clearDateButton}
                    onPress={clearEndDate}
                  >
                    <Icon name="close-circle" size={24} color="#999" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.datePickerButton, styles.datePickerButtonEmpty]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Icon name="calendar-plus" size={20} color="#999" />
                  <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextEmpty]}>
                    Set End Date
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Match Mode */}
            <View style={styles.dateRangeDivider} />
            <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Match Mode</Text>
            <Text style={styles.helperText}>
              Choose how activities should match your date range
            </Text>

            <TouchableOpacity
              style={[styles.dateOption, currentMatchMode === 'partial' && styles.dateOptionSelected]}
              onPress={() => handleDateMatchModeChange('partial')}
            >
              <View style={styles.dateOptionContent}>
                <Text style={styles.dateOptionTitle}>Partially Overlap</Text>
                <Text style={styles.dateOptionDescription}>
                  Show activities that at least partially overlap with your date range
                </Text>
              </View>
              <View style={[styles.radio, currentMatchMode === 'partial' && styles.radioActive]}>
                {currentMatchMode === 'partial' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dateOption, currentMatchMode === 'full' && styles.dateOptionSelected]}
              onPress={() => handleDateMatchModeChange('full')}
            >
              <View style={styles.dateOptionContent}>
                <Text style={styles.dateOptionTitle}>Fully Between</Text>
                <Text style={styles.dateOptionDescription}>
                  Show only activities that fall completely within your date range
                </Text>
              </View>
              <View style={[styles.radio, currentMatchMode === 'full' && styles.radioActive]}>
                {currentMatchMode === 'full' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* iOS Date Pickers (shown as modals) */}
        {Platform.OS === 'ios' && showStartDatePicker && (
          <Modal
            transparent
            animationType="slide"
            visible={showStartDatePicker}
            onRequestClose={() => setShowStartDatePicker(false)}
          >
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerModalContent}>
                <View style={styles.datePickerModalHeader}>
                  <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                    <Text style={styles.datePickerModalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerModalTitle}>Start Date</Text>
                  <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                    <Text style={styles.datePickerModalDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempStartDate}
                  mode="date"
                  display="spinner"
                  onChange={handleStartDateChange}
                  minimumDate={new Date()}
                  style={styles.iosDatePicker}
                />
              </View>
            </View>
          </Modal>
        )}

        {Platform.OS === 'ios' && showEndDatePicker && (
          <Modal
            transparent
            animationType="slide"
            visible={showEndDatePicker}
            onRequestClose={() => setShowEndDatePicker(false)}
          >
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerModalContent}>
                <View style={styles.datePickerModalHeader}>
                  <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                    <Text style={styles.datePickerModalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerModalTitle}>End Date</Text>
                  <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                    <Text style={styles.datePickerModalDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempEndDate || tempStartDate}
                  mode="date"
                  display="spinner"
                  onChange={handleEndDateChange}
                  minimumDate={tempStartDate}
                  style={styles.iosDatePicker}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Android Date Pickers (shown inline) */}
        {Platform.OS === 'android' && showStartDatePicker && (
          <DateTimePicker
            value={tempStartDate}
            mode="date"
            display="default"
            onChange={handleStartDateChange}
            minimumDate={new Date()}
          />
        )}

        {Platform.OS === 'android' && showEndDatePicker && (
          <DateTimePicker
            value={tempEndDate || tempStartDate}
            mode="date"
            display="default"
            onChange={handleEndDateChange}
            minimumDate={tempStartDate}
          />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E8638B" />
            <Text style={styles.loadingText}>Loading preferences...</Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
            <View style={styles.globalPreferenceTitleRow}>
              <Text style={styles.globalPreferenceTitle}>Hide Closed or Full Activities</Text>
              {!hasAdvancedFilters && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PREMIUM</Text>
                </View>
              )}
            </View>
            <Text style={styles.globalPreferenceDescription}>
              Only show activities that are open for registration
            </Text>
          </View>
        </View>
        <Switch
          value={hasAdvancedFilters ? (preferences?.hideClosedOrFull ?? true) : false}
          onValueChange={(value) => {
            if (!hasAdvancedFilters) {
              checkAndShowUpgrade('filters');
              return;
            }
            updatePreferences({ hideClosedOrFull: value });
          }}
          trackColor={{ false: '#EEEEEE', true: '#E8638B' }}
          thumbColor={hasAdvancedFilters && preferences?.hideClosedOrFull ? '#FFFFFF' : '#CCCCCC'}
          disabled={!hasAdvancedFilters}
        />
      </View>

      {/* Quick Filter Chips */}
      <View style={styles.quickFiltersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickFiltersContent}
        >
          <TouchableOpacity 
            style={[
              styles.quickFilterChip,
              preferences?.daysOfWeek?.length === 1 && preferences?.daysOfWeek?.includes(new Date().toLocaleDateString('en-US', { weekday: 'long' })) && styles.quickFilterChipActive
            ]}
            onPress={() => {
              const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
              updatePreferences({ daysOfWeek: [today] });
            }}
          >
            <Icon name="calendar-today" size={16} color={preferences?.daysOfWeek?.length === 1 && preferences?.daysOfWeek?.includes(new Date().toLocaleDateString('en-US', { weekday: 'long' })) ? '#FFF' : '#6B7280'} />
            <Text style={[styles.quickFilterChipText, preferences?.daysOfWeek?.length === 1 && preferences?.daysOfWeek?.includes(new Date().toLocaleDateString('en-US', { weekday: 'long' })) && styles.quickFilterChipTextActive]}>Today</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.quickFilterChip,
              preferences?.daysOfWeek?.length === 2 && preferences?.daysOfWeek?.includes('Saturday') && preferences?.daysOfWeek?.includes('Sunday') && styles.quickFilterChipActive
            ]}
            onPress={() => {
              updatePreferences({ daysOfWeek: ['Saturday', 'Sunday'] });
            }}
          >
            <Icon name="calendar-weekend" size={16} color={preferences?.daysOfWeek?.length === 2 && preferences?.daysOfWeek?.includes('Saturday') && preferences?.daysOfWeek?.includes('Sunday') ? '#FFF' : '#6B7280'} />
            <Text style={[styles.quickFilterChipText, preferences?.daysOfWeek?.length === 2 && preferences?.daysOfWeek?.includes('Saturday') && preferences?.daysOfWeek?.includes('Sunday') && styles.quickFilterChipTextActive]}>Weekend</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.quickFilterChip,
              preferences?.priceRange?.max === 0 && styles.quickFilterChipActive
            ]}
            onPress={() => {
              updatePreferences({ priceRange: { min: 0, max: 0 } });
            }}
          >
            <Icon name="gift-outline" size={16} color={preferences?.priceRange?.max === 0 ? '#FFF' : '#6B7280'} />
            <Text style={[styles.quickFilterChipText, preferences?.priceRange?.max === 0 && styles.quickFilterChipTextActive]}>Free</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.quickFilterChip,
              preferences?.priceRange?.max === 50 && styles.quickFilterChipActive
            ]}
            onPress={() => {
              updatePreferences({ priceRange: { min: 0, max: 50 } });
            }}
          >
            <Icon name="currency-usd" size={16} color={preferences?.priceRange?.max === 50 ? '#FFF' : '#6B7280'} />
            <Text style={[styles.quickFilterChipText, preferences?.priceRange?.max === 50 && styles.quickFilterChipTextActive]}>Under $50</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickFilterChipReset}
            onPress={() => {
              updatePreferences({ 
                daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                priceRange: { min: 0, max: 1000 },
                environmentFilter: 'all',
              });
            }}
          >
            <Icon name="refresh" size={16} color="#E8638B" />
            <Text style={styles.quickFilterChipResetText}>Reset</Text>
          </TouchableOpacity>
        </ScrollView>
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

      {/* Upgrade Modal */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        feature={upgradeFeature || 'filters'}
        onClose={hideUpgradeModal}
      />
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
    backgroundColor: 'transparent',
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
  quickFiltersContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  quickFiltersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    gap: 6,
  },
  quickFilterChipActive: {
    backgroundColor: '#E8638B',
    borderColor: '#E8638B',
  },
  quickFilterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  quickFilterChipTextActive: {
    color: '#FFFFFF',
  },
  quickFilterChipReset: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginRight: 8,
    gap: 6,
  },
  quickFilterChipResetText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E8638B',
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
    borderColor: '#E8638B',
    backgroundColor: '#E8638B',
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
    color: '#E8638B',
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
    backgroundColor: '#E8638B',
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
    color: '#E8638B',
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
    borderColor: '#E8638B',
    backgroundColor: '#FEF2F2',
  },
  ageGroupChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  ageGroupChipTextActive: {
    color: '#E8638B',
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
    borderColor: '#E8638B',
    backgroundColor: '#E8638B',
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
    borderColor: '#E8638B',
    backgroundColor: '#E8638B',
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
    borderColor: '#E8638B',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E8638B',
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
  globalPreferenceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  globalPreferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  proBadge: {
    backgroundColor: '#E8638B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
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
    borderColor: '#E8638B',
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
    color: '#E8638B',
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
  // Date picker styles
  dateOptionSelected: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  dateRangeDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
    marginHorizontal: -20,
  },
  datePickerRow: {
    marginBottom: 16,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#E8638B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerButtonEmpty: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  datePickerButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#E8638B',
  },
  datePickerButtonTextEmpty: {
    color: '#9CA3AF',
  },
  datePickerWithClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearDateButton: {
    padding: 4,
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Account for home indicator
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222222',
  },
  datePickerModalCancel: {
    fontSize: 17,
    color: '#717171',
  },
  datePickerModalDone: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E8638B',
  },
  iosDatePicker: {
    height: 200,
  },
  // Activity type styles
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  activityTypeContainer: {
    marginBottom: 12,
  },
  activityTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  activityTypeChipActive: {
    borderColor: '#E8638B',
    backgroundColor: '#E8638B',
  },
  activityTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222222',
    flex: 1,
  },
  activityTypeTextActive: {
    color: '#FFFFFF',
  },
  activityTypeCount: {
    fontSize: 13,
    color: '#717171',
  },
  activityTypeCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  expandSubtypesButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtypesContainer: {
    marginTop: 8,
    marginLeft: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  subtypeChipActive: {
    borderColor: '#E8638B',
    backgroundColor: '#FEF2F2',
  },
  subtypeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  subtypeTextActive: {
    color: '#E8638B',
  },
  subtypeCount: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  subtypeCountActive: {
    color: '#E8638B',
  },
});

export default FiltersScreen;