import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import PreferencesService from '../services/preferencesService';
import ActivityService from '../services/activityService';
import { UserPreferences, HierarchicalProvince, EnhancedAddress } from '../types/preferences';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import { HierarchicalSelect, buildHierarchyFromAPI } from '../components/HierarchicalSelect';
import useSubscription from '../hooks/useSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';
import { LockedFeature } from '../components/PremiumBadge';
import DistanceFilterSection from '../components/filters/DistanceFilterSection';
import AddressAutocomplete from '../components/AddressAutocomplete/AddressAutocomplete';
import { getActivityTypeIcon } from '../utils/activityTypeIcons';
import DayTimeGridSelector, {
  DayTimeSlots,
  createDefaultDayTimeSlots,
  DAYS_OF_WEEK,
} from '../components/DayTimeGridSelector';
import { ModernColors } from '../theme/modernTheme';
import { Aggregations } from '../types/aggregations';

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

// Route params for controlling which filter sections to show
type FiltersRouteParams = {
  Filters: {
    hiddenSections?: string[];  // Section IDs to hide: 'locations', 'distance', 'budget', 'aiMatch', etc.
    screenTitle?: string;       // Custom title for the screen
    returnScreen?: string;      // Screen to return to after applying filters
    aggregations?: Aggregations; // Pre-computed aggregations from search results
  };
};

const FiltersScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<FiltersRouteParams, 'Filters'>>();
  const { colors } = useTheme();

  // Get hidden sections from route params (default: hide AI Match on all screens)
  const hiddenSections = route.params?.hiddenSections || ['aiMatch'];

  // Get aggregations from route params (if provided from search results)
  const routeAggregations = route.params?.aggregations;

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
  const originalPreferencesRef = useRef<UserPreferences | null>(null); // Store original for cancel
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [sections, setSections] = useState<ExpandableSection[]>([
    { id: 'activityTypes', title: 'Activity Type?', expanded: false },
    { id: 'environment', title: 'Indoor or Outdoor?', expanded: false },
    { id: 'age', title: 'Age Range?', expanded: false },
    { id: 'locations', title: 'Where?', expanded: false },
    { id: 'distance', title: 'How Far?', expanded: false },
    { id: 'budget', title: 'Cost?', expanded: false },
    { id: 'dayTime', title: 'Day & Time?', expanded: false },
    { id: 'dates', title: 'When?', expanded: false },
  ]);

  // Day/time grid selector state
  const [dayTimeSlots, setDayTimeSlots] = useState<DayTimeSlots>(createDefaultDayTimeSlots());

  // Location autocomplete state
  const [showLocationPicker, setShowLocationPicker] = useState(false);

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

  // Helper to get count from aggregations if available
  const getActivityTypeCount = useCallback((typeCode: string): number | undefined => {
    if (!routeAggregations?.activityTypes) return undefined;
    const match = routeAggregations.activityTypes.find(t => t.code === typeCode);
    return match?.count;
  }, [routeAggregations]);

  const getCostBracketCount = useCallback((minCost: number, maxCost: number): number | undefined => {
    if (!routeAggregations?.costBrackets) return undefined;
    const match = routeAggregations.costBrackets.find(b => b.min === minCost && b.max === maxCost);
    return match?.count;
  }, [routeAggregations]);

  const getDayOfWeekCount = useCallback((day: string): number | undefined => {
    if (!routeAggregations?.daysOfWeek) return undefined;
    const match = routeAggregations.daysOfWeek.find(d => d.day === day);
    return match?.count;
  }, [routeAggregations]);

  const getAgeGroupCount = useCallback((minAge: number, maxAge: number): number | undefined => {
    if (!routeAggregations?.ageGroups) return undefined;
    const match = routeAggregations.ageGroups.find(g => g.min === minAge && g.max === maxAge);
    return match?.count;
  }, [routeAggregations]);

  useEffect(() => {
    loadPreferences();
    loadActivityTypes();
    loadLocations();
    loadAgeGroups();
  }, []);

  // Auto-enable hideClosedOrFull when user becomes premium
  useEffect(() => {
    if (hasAdvancedFilters && preferences && !preferences.hideClosedOrFull) {
      // User just got premium - auto-enable the filter
      console.log('📋 [FiltersScreen] User became premium, auto-enabling hideClosedOrFull');
      updatePreferences({ hideClosedOrFull: true });
    }
  }, [hasAdvancedFilters]);

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

      // Store original preferences for cancel functionality (only on first load)
      if (!originalPreferencesRef.current) {
        originalPreferencesRef.current = { ...userPrefs };
      }

      // Initialize date state from preferences
      if (userPrefs.dateRange?.start) {
        setTempStartDate(new Date(userPrefs.dateRange.start));
      }
      if (userPrefs.dateRange?.end) {
        setTempEndDate(new Date(userPrefs.dateRange.end));
      }

      // Initialize dayTimeSlots from preferences
      if (userPrefs.dayTimeSlots) {
        setDayTimeSlots(userPrefs.dayTimeSlots);
      } else {
        // Create dayTimeSlots from legacy daysOfWeek/timePreferences
        const slots: DayTimeSlots = {};
        const enabledDays = userPrefs.daysOfWeek ?? DAYS_OF_WEEK;
        const timePrefs = userPrefs.timePreferences ?? { morning: true, afternoon: true, evening: true };

        DAYS_OF_WEEK.forEach(day => {
          const isDayEnabled = enabledDays.includes(day);
          slots[day] = {
            morning: isDayEnabled && timePrefs.morning,
            afternoon: isDayEnabled && timePrefs.afternoon,
            evening: isDayEnabled && timePrefs.evening,
          };
        });
        setDayTimeSlots(slots);
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
    const currentSubtypes = preferences.preferredSubtypes || [];
    const isCurrentlySelected = currentTypes.includes(activityTypeCode);

    // Find the activity type to get its subtypes
    const activityType = activityTypes.find(t => t.code === activityTypeCode);
    const subtypeCodes = activityType?.subtypes?.map(s => s.code) || [];

    if (isCurrentlySelected) {
      // Deselecting - remove type and all its subtypes
      const updatedTypes = currentTypes.filter(code => code !== activityTypeCode);
      const updatedSubtypes = currentSubtypes.filter(code => !subtypeCodes.includes(code));
      updatePreferences({
        preferredActivityTypes: updatedTypes,
        preferredSubtypes: updatedSubtypes
      });
    } else {
      // Selecting - add type and all its subtypes
      const updatedTypes = [...currentTypes, activityTypeCode];
      const updatedSubtypes = [...new Set([...currentSubtypes, ...subtypeCodes])];
      updatePreferences({
        preferredActivityTypes: updatedTypes,
        preferredSubtypes: updatedSubtypes
      });
    }
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

  // Cancel - restore original preferences and go back
  const handleCancel = useCallback(() => {
    if (originalPreferencesRef.current) {
      // Restore original preferences
      preferencesService.updatePreferences(originalPreferencesRef.current);
      console.log('📋 [FiltersScreen] Cancelled - restored original preferences');
    }
    navigation.goBack();
  }, [navigation, preferencesService]);

  // Apply - keep current preferences and go back
  const handleApply = useCallback(() => {
    console.log('📋 [FiltersScreen] Applied filters');
    navigation.goBack();
  }, [navigation]);

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
        const priceRange = preferences?.priceRange || { min: 0, max: 999999 };
        const budgetIsUnlimited = priceRange.max >= 10000;
        return budgetIsUnlimited ? 'No Limit' : `Up to $${priceRange.max}`;
      case 'dayTime':
        const enabledSlots = DAYS_OF_WEEK.reduce((total, day) => {
          const slots = dayTimeSlots[day];
          return total + (slots?.morning ? 1 : 0) + (slots?.afternoon ? 1 : 0) + (slots?.evening ? 1 : 0);
        }, 0);
        return enabledSlots === 21 ? 'Any time' : `${enabledSlots} time slots`;
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
      case 'dayTime':
        return 'calendar-clock';
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
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderContent}>
            <View style={styles.sectionIconContainer}>
              <Icon name={icon} size={22} color={ModernColors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSummary}>{summary}</Text>
            </View>
          </View>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#9CA3AF"
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
      case 'dayTime':
        return renderDayTimeContent();
      case 'dates':
        return renderDatesContent();
      default:
        return null;
    }
  };

  const renderEnvironmentContent = () => {
    if (!preferences) return null;

    // Gate environment filter for free users
    if (!hasAdvancedFilters) {
      return (
        <View style={styles.sectionContent}>
          <LockedFeature
            label="Indoor/Outdoor Filter"
            description="Filter activities by whether they take place indoors or outdoors"
            onPress={() => checkAndShowUpgrade('filters')}
          />
        </View>
      );
    }

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

    // Gate distance filter for free users
    if (!hasAdvancedFilters) {
      return (
        <View style={styles.sectionContent}>
          <View style={styles.lockedDistanceInfo}>
            <Icon name="map-marker-radius" size={24} color="#9CA3AF" />
            <Text style={styles.lockedDistanceText}>
              Distance filter locked at 25 km for free users
            </Text>
          </View>
          <LockedFeature
            label="Custom Distance Range"
            description="Set your preferred search radius from 5km to 100km"
            onPress={() => checkAndShowUpgrade('filters')}
          />
        </View>
      );
    }

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
          // Use proper icon from activityTypeIcons mapping
          const iconName = getActivityTypeIcon(type.name);
          // Get count from aggregations if available, otherwise use the type's count
          const count = getActivityTypeCount(type.code) ?? type.activityCount;

          return (
            <View key={type.code} style={styles.activityTypeContainer}>
              {/* Main activity type row */}
              <View style={styles.activityTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.activityTypeChip,
                    isTypeSelected && styles.activityTypeChipActive,
                    count === 0 && styles.activityTypeChipDisabled,
                  ]}
                  onPress={() => toggleActivityType(type.code)}
                  disabled={count === 0}
                >
                  <Icon
                    name={iconName}
                    size={20}
                    color={isTypeSelected ? '#FFFFFF' : count === 0 ? '#CCCCCC' : '#E8638B'}
                  />
                  <Text style={[
                    styles.activityTypeText,
                    isTypeSelected && styles.activityTypeTextActive,
                    count === 0 && styles.activityTypeTextDisabled,
                  ]}>
                    {type.name}
                    {count !== undefined && <Text style={styles.countText}> ({count})</Text>}
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

  // Handle location selection from autocomplete
  const handleLocationAutocompleteSelect = useCallback((address: EnhancedAddress | null) => {
    if (address) {
      // Save the address to preferences for distance-based filtering
      preferencesService.updatePreferences({
        savedAddress: address,
        locationSource: 'saved_address',
      });
      setPreferences(preferencesService.getPreferences());
      setShowLocationPicker(false);
    }
  }, []);

  const renderLocationsContent = () => {
    const savedAddress = preferences?.savedAddress;

    return (
      <View style={styles.sectionContent}>
        {/* Google Places Autocomplete for location search */}
        <Text style={styles.helperText}>
          Search for a city, province, or address to filter activities
        </Text>

        {/* Address Autocomplete */}
        <View style={{ marginTop: 12, zIndex: 100 }}>
          <AddressAutocomplete
            value={savedAddress as EnhancedAddress | undefined}
            onAddressSelect={handleLocationAutocompleteSelect}
            placeholder="Search city, province, or address..."
            types={['(cities)', 'geocode', 'address']}
            showFallbackOption={true}
          />
        </View>

        {/* Divider */}
        <View style={styles.locationDivider}>
          <View style={styles.locationDividerLine} />
          <Text style={styles.locationDividerText}>OR</Text>
          <View style={styles.locationDividerLine} />
        </View>

        {/* Hierarchical Location Selection */}
        <TouchableOpacity
          style={styles.locationExpandButton}
          onPress={() => setShowLocationPicker(!showLocationPicker)}
        >
          <Icon name="format-list-bulleted" size={20} color="#E8638B" />
          <Text style={styles.locationExpandText}>
            Browse by Province & City ({selectedLocationIds.size > 0 ? `${selectedLocationIds.size} selected` : 'None selected'})
          </Text>
          <Icon name={showLocationPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
        </TouchableOpacity>

        {showLocationPicker && (
          <View style={{ maxHeight: 300, marginTop: 12 }}>
            <HierarchicalSelect
              hierarchy={hierarchyData}
              selectedLocationIds={selectedLocationIds}
              onSelectionChange={handleLocationSelectionChange}
              loading={locationsLoading}
              searchPlaceholder="Search provinces, cities, locations..."
            />
          </View>
        )}
      </View>
    );
  };

  const renderBudgetContent = () => {
    // Gate budget filter for free users - show locked state with "Unlimited" as default
    if (!hasAdvancedFilters) {
      return (
        <View style={styles.sectionContent}>
          <View style={styles.freeUserBudgetInfo}>
            <Icon name="infinity" size={24} color="#10B981" />
            <View style={styles.freeUserBudgetText}>
              <Text style={styles.freeUserBudgetTitle}>Unlimited (Default)</Text>
              <Text style={styles.freeUserBudgetDescription}>
                Showing all activities regardless of price
              </Text>
            </View>
          </View>
          <LockedFeature
            label="Custom Budget Filter"
            description="Set a maximum price to find activities that fit your budget"
            onPress={() => checkAndShowUpgrade('filters')}
          />
        </View>
      );
    }

    const priceRange = preferences?.priceRange || { min: 0, max: 999999 };
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

  const handleDayTimeSlotsChange = useCallback((slots: DayTimeSlots) => {
    setDayTimeSlots(slots);

    // Convert dayTimeSlots to legacy format for backward compatibility
    const enabledDays = DAYS_OF_WEEK.filter(day =>
      slots[day]?.morning || slots[day]?.afternoon || slots[day]?.evening
    );

    const timePrefs = {
      morning: DAYS_OF_WEEK.some(day => slots[day]?.morning),
      afternoon: DAYS_OF_WEEK.some(day => slots[day]?.afternoon),
      evening: DAYS_OF_WEEK.some(day => slots[day]?.evening),
    };

    updatePreferences({
      dayTimeSlots: slots,
      daysOfWeek: enabledDays,
      timePreferences: timePrefs,
    });
  }, [updatePreferences]);

  const renderDayTimeContent = () => {
    return (
      <View style={styles.sectionContent}>
        <Text style={styles.helperText}>
          Select which days and times you're looking for activities
        </Text>
        <View style={{ marginTop: 12 }}>
          <DayTimeGridSelector
            selectedSlots={dayTimeSlots}
            onChange={handleDayTimeSlotsChange}
            accentColor={ModernColors.primary}
          />
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
          Search Filters
        </Text>
        <Text style={styles.headerSubtitle}>
          These filters apply to your activity search results in Explore
        </Text>
      </View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.sectionsContainer}>
          {sections
            .filter(section => !hiddenSections.includes(section.id))
            .map(renderExpandableSection)}
        </View>
        
        <View style={styles.bottomPadding} />
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Icon name="close" size={18} color="#6B7280" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <LinearGradient
            colors={[ModernColors.primary, '#D53F8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.applyButtonGradient}
          >
            <Icon name="check" size={18} color="#FFFFFF" />
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
  },
  sectionsContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  sectionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginVertical: 8,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
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
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ModernColors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionSummary: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(255, 248, 240, 0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 204, 0.5)',
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
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  activityTypeChipActive: {
    borderColor: ModernColors.primary,
    backgroundColor: ModernColors.primary,
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
  activityTypeChipDisabled: {
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    opacity: 0.6,
  },
  activityTypeTextDisabled: {
    color: '#AAAAAA',
  },
  countText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888888',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  subtypeChipActive: {
    borderColor: ModernColors.primary,
    backgroundColor: ModernColors.primary + '15',
  },
  subtypeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  subtypeTextActive: {
    color: ModernColors.primary,
    fontWeight: '600',
  },
  // Location section styles
  locationDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  locationDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  locationDividerText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 12,
    fontWeight: '500',
  },
  locationExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    gap: 8,
  },
  locationExpandText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  // Distance locked styles
  lockedDistanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  lockedDistanceText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  // Free user budget styles
  freeUserBudgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  freeUserBudgetText: {
    flex: 1,
  },
  freeUserBudgetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 2,
  },
  freeUserBudgetDescription: {
    fontSize: 13,
    color: '#10B981',
  },
  // Days of week quick select styles
  dayQuickSelect: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dayQuickSelectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  dayQuickSelectButtonActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#E8638B',
  },
  dayQuickSelectText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  dayQuickSelectTextActive: {
    color: '#E8638B',
  },
  // Preferred times styles
  timeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSubLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Bottom action bar styles
  bottomActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  applyButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 8,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FiltersScreen;