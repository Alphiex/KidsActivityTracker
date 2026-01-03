import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import aiService from '../services/aiService';
import { ActivitySearchParams } from '../types/api';
import { useTheme } from '../contexts/ThemeContext';
import useSubscription from '../hooks/useSubscription';
import { LockedFeature } from '../components/PremiumBadge';
import { getActivityTypeIcon } from '../utils/activityTypeIcons';
import { aiRobotImage } from '../assets/images';
import LinearGradient from 'react-native-linear-gradient';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { EnhancedAddress } from '../types/preferences';
import { useAppSelector } from '../store';
import {
  selectAllChildren,
  ChildWithPreferences,
  ChildFilterMode,
  selectSelectedChildIds,
  selectFilterMode,
} from '../store/slices/childrenSlice';
import { ModernColors } from '../theme/modernTheme';
import ScreenBackground from '../components/ScreenBackground';
import ChildFilterSelector from '../components/ChildFilterSelector';

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const PREDEFINED_TIMES = [
  { label: 'Before School', value: 'before-school', timeRange: '6:00 AM - 8:00 AM' },
  { label: 'After School', value: 'after-school', timeRange: '3:00 PM - 6:00 PM' },
  { label: 'Morning', value: 'morning', timeRange: '8:00 AM - 12:00 PM' },
  { label: 'Day', value: 'day', timeRange: '9:00 AM - 5:00 PM' },
  { label: 'Evening', value: 'evening', timeRange: '6:00 PM - 9:00 PM' },
  { label: 'Night', value: 'night', timeRange: '7:00 PM - 10:00 PM' }
];

interface ExpandableSection {
  id: string;
  title: string;
  icon: string;
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

type SearchRouteProp = RouteProp<{
  Search: {
    returnToMap?: boolean;
    mapBounds?: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    };
  };
}, 'Search'>;

const SearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<SearchRouteProp>();
  const { isDark } = useTheme();

  // Check if we should return to map instead of SearchResults
  const returnToMap = route.params?.returnToMap || false;
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();

  // Get children and filter state from Redux (same as Explore page)
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const filterMode = useAppSelector(selectFilterMode);

  // Get selected children objects
  const selectedChildren = useMemo(() =>
    children.filter(c => selectedChildIds.includes(c.id)),
    [children, selectedChildIds]
  );

  // Subscription state for premium features
  const {
    checkAndShowUpgrade,
    hasAdvancedFilters,
    isPremium,
  } = useSubscription();

  // Search state
  const [searchText, setSearchText] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>([]);
  const [selectedSubtypes, setSelectedSubtypes] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [useCustomTimeRange, setUseCustomTimeRange] = useState(false);
  const [startTime, setStartTime] = useState(6);
  const [endTime, setEndTime] = useState(22);
  const [minCost, setMinCost] = useState(0);
  const [maxCost, setMaxCost] = useState(500);
  const [isUnlimitedCost, setIsUnlimitedCost] = useState(true);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [minAge, setMinAge] = useState(0);
  const [maxAge, setMaxAge] = useState(18);
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | 'indoor' | 'outdoor'>('all');
  const [distanceRadius, setDistanceRadius] = useState(25);
  const [distanceEnabled, setDistanceEnabled] = useState(false);

  // Activity Types data
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loadingActivityTypes, setLoadingActivityTypes] = useState(false);
  const [expandedActivityTypes, setExpandedActivityTypes] = useState<Set<string>>(new Set());

  // Location data
  const [searchedLocation, setSearchedLocation] = useState<EnhancedAddress | null>(null);

  // UI state - sections in same order as FiltersScreen (excludes 'what' which is always visible)
  const [sections, setSections] = useState<ExpandableSection[]>([
    { id: 'activityTypes', title: 'Activity Type?', icon: 'soccer', expanded: false },
    { id: 'environment', title: 'Indoor or Outdoor?', icon: 'weather-sunny', expanded: false },
    { id: 'age', title: 'Age Range?', icon: 'account-child', expanded: false },
    { id: 'where', title: 'Where?', icon: 'map-marker', expanded: false },
    { id: 'distance', title: 'Distance', icon: 'map-marker-distance', expanded: false },
    { id: 'cost', title: 'Cost?', icon: 'currency-usd', expanded: false },
    { id: 'days', title: 'Day of the Week?', icon: 'calendar-week', expanded: false },
    { id: 'time', title: 'Time?', icon: 'clock-outline', expanded: false },
  ]);

  const [fadeAnim] = useState(new Animated.Value(0));

  // Initial load - only runs on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    loadActivityTypes();

    // Load preferences from selected children on mount
    if (selectedChildren.length > 0) {
      loadChildrenPreferencesAsFilters(selectedChildren, filterMode);
    }
  }, []);

  const handleLocationAutocompleteSelect = (address: EnhancedAddress | null) => {
    setSearchedLocation(address);
    // Also add to selectedCities if it's a city
    if (address?.city) {
      setSelectedCities(prev =>
        prev.includes(address.city!) ? prev : [...prev, address.city!]
      );
    }
  };

  // Handler for child filter changes
  const handleChildFilterChange = useCallback((newSelectedIds: string[], newMode: ChildFilterMode) => {
    console.log('[SearchScreen] Child filter changed:', { selectedCount: newSelectedIds.length, mode: newMode });
    // Preferences will reload via the useEffect below
  }, []);

  // Load preferences when selected children change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedChildren.length > 0) {
      loadChildrenPreferencesAsFilters(selectedChildren, filterMode);
    }
  }, [selectedChildIds, filterMode]);

  const loadChildrenPreferencesAsFilters = (children: ChildWithPreferences[], mode: ChildFilterMode) => {
    if (children.length === 0) return;

    // Collect preferences from selected children
    const allActivityTypes = new Set<string>();
    const allDays = new Set<string>();
    const prices: { min: number; max: number }[] = [];
    const environments: ('all' | 'indoor' | 'outdoor')[] = [];
    const distances: number[] = [];

    children.forEach(child => {
      const prefs = child.preferences;
      if (prefs?.preferredActivityTypes) {
        prefs.preferredActivityTypes.forEach(t => allActivityTypes.add(t));
      }
      if (prefs?.daysOfWeek) {
        prefs.daysOfWeek.forEach(d => allDays.add(d));
      }
      if (prefs?.priceRangeMin !== undefined || prefs?.priceRangeMax !== undefined) {
        prices.push({
          min: prefs.priceRangeMin ?? 0,
          max: prefs.priceRangeMax ?? 500,
        });
      }
      if (prefs?.environmentFilter) {
        environments.push(prefs.environmentFilter);
      }
      if (prefs?.distanceRadiusKm) {
        distances.push(prefs.distanceRadiusKm);
      }
    });

    // Apply activity types (union of all selected children)
    if (allActivityTypes.size > 0) {
      setSelectedActivityTypes(Array.from(allActivityTypes));
    }

    // Apply days (union of all selected children)
    if (allDays.size > 0) {
      setSelectedDays(Array.from(allDays));
    }

    // Apply price range based on mode
    if (prices.length > 0) {
      if (mode === 'and') {
        // Together mode: use most restrictive (intersection)
        setMinCost(Math.max(...prices.map(p => p.min)));
        setMaxCost(Math.min(...prices.map(p => p.max)));
      } else {
        // Any mode: use most permissive (union)
        setMinCost(Math.min(...prices.map(p => p.min)));
        setMaxCost(Math.max(...prices.map(p => p.max)));
      }
      setIsUnlimitedCost(maxCost >= 10000);
    }

    // Apply environment (if all agree, use that; otherwise 'all')
    if (environments.length > 0) {
      const uniqueEnv = [...new Set(environments)];
      setEnvironmentFilter(uniqueEnv.length === 1 ? uniqueEnv[0] : 'all');
    }

    // Apply distance (use max for coverage)
    if (distances.length > 0) {
      setDistanceRadius(Math.max(...distances));
      setDistanceEnabled(true);
    }

    // Age range defaults to 0-18 (all ages) - don't override from child preferences
  };

  const loadActivityTypes = async () => {
    try {
      setLoadingActivityTypes(true);
      const types = await activityService.getActivityTypesWithCounts(true);

      if (types && Array.isArray(types)) {
        const mappedTypes: ActivityType[] = types.map((type: any) => ({
          id: type.id,
          name: type.name,
          code: type.code,
          iconName: type.iconName,
          activityCount: type.activityCount || 0,
          subtypes: type.subtypes || []
        }));
        setActivityTypes(mappedTypes);
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

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section =>
      section.id === sectionId
        ? { ...section, expanded: !section.expanded }
        : section
    ));
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const toggleActivityType = (activityTypeCode: string) => {
    const activityType = activityTypes.find(t => t.code === activityTypeCode);
    const subtypeCodes = activityType?.subtypes?.map(s => s.code) || [];
    const isCurrentlySelected = selectedActivityTypes.includes(activityTypeCode);

    if (isCurrentlySelected) {
      setSelectedActivityTypes(prev => prev.filter(code => code !== activityTypeCode));
      setSelectedSubtypes(prev => prev.filter(code => !subtypeCodes.includes(code)));
    } else {
      setSelectedActivityTypes(prev => [...prev, activityTypeCode]);
      setSelectedSubtypes(prev => [...new Set([...prev, ...subtypeCodes])]);
    }
  };

  const toggleSubtype = (subtypeCode: string) => {
    setSelectedSubtypes(prev =>
      prev.includes(subtypeCode)
        ? prev.filter(code => code !== subtypeCode)
        : [...prev, subtypeCode]
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
    setSelectedSubtypes([]);
    setSelectedTimes([]);
    setUseCustomTimeRange(false);
    setStartTime(6);
    setEndTime(22);
    setMinCost(0);
    setMaxCost(500);
    setIsUnlimitedCost(true);
    setSelectedCities([]);
    setSearchedLocation(null);
    setMinAge(0);
    setMaxAge(18);
    setEnvironmentFilter('all');
    setDistanceEnabled(false);
    setDistanceRadius(25);
    // Clear global filters as well
    PreferencesService.getInstance().clearActiveFilters();
  };

  const handleSearch = async () => {
    // Use selected cities for location filtering
    const allLocations = selectedCities.filter(Boolean);

    const searchParams: ActivitySearchParams = {
      search: searchText || undefined,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : undefined,
      activityTypes: selectedActivityTypes.length > 0 ? selectedActivityTypes : undefined,
      costMin: minCost > 0 ? minCost : undefined,
      costMax: !isUnlimitedCost ? maxCost : undefined,
      location: allLocations.length === 1 ? allLocations[0] : undefined,
      locations: allLocations.length > 1 ? allLocations : undefined,
      ageMin: minAge > 0 ? minAge : undefined,
      ageMax: maxAge < 18 ? maxAge : undefined,
      hideFullActivities: true,
    };

    console.log('🔍 [SearchScreen] Searching with params:', JSON.stringify(searchParams, null, 2));

    // Save filters globally so they apply across all screens
    const preferencesService = PreferencesService.getInstance();
    preferencesService.setActiveFilters({
      search: searchText || undefined,
      activityTypes: selectedActivityTypes.length > 0 ? selectedActivityTypes : undefined,
      ageMin: minAge > 0 ? minAge : undefined,
      ageMax: maxAge < 18 ? maxAge : undefined,
      costMin: minCost > 0 ? minCost : undefined,
      costMax: !isUnlimitedCost ? maxCost : undefined,
      locations: allLocations.length > 0 ? allLocations : undefined,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : undefined,
      hideFullActivities: true,
    });

    if (returnToMap) {
      // Return to map with filters applied
      navigation.navigate('MapSearch' as never, {
        filters: searchParams,
        searchQuery: searchText
      } as never);
    } else {
      // Navigate to SearchResults screen (not AI)
      navigation.navigate('SearchResults' as never, {
        filters: searchParams,
        searchQuery: searchText
      } as never);
    }
  };

  const handleAISearch = () => {
    if (!isPremium) {
      checkAndShowUpgrade('ai_search');
      return;
    }

    // Use selected cities for location filtering
    const allLocations = selectedCities.filter(Boolean);

    const filters = {
      search: searchText || undefined,
      daysOfWeek: selectedDays.length > 0 ? selectedDays : undefined,
      activityTypes: selectedActivityTypes.length > 0 ? selectedActivityTypes : undefined,
      costMin: minCost > 0 ? minCost : undefined,
      costMax: !isUnlimitedCost ? maxCost : undefined,
      location: allLocations.length === 1 ? allLocations[0] : undefined,
      locations: allLocations.length > 1 ? allLocations : undefined,
      ageMin: minAge > 0 ? minAge : undefined,
      ageMax: maxAge < 18 ? maxAge : undefined,
    };

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

  const getSectionSummary = (sectionId: string) => {
    switch (sectionId) {
      case 'activityTypes':
        return selectedActivityTypes.length > 0
          ? `${selectedActivityTypes.length} selected`
          : 'All types';
      case 'environment':
        if (environmentFilter === 'indoor') return 'Indoor only';
        if (environmentFilter === 'outdoor') return 'Outdoor only';
        return 'All activities';
      case 'age':
        if (minAge === 0 && maxAge === 18) return 'All ages';
        return `${minAge} - ${maxAge} years`;
      case 'where':
        if (selectedCities.length > 0) {
          return selectedCities.length <= 2 ? selectedCities.join(', ') : `${selectedCities.length} cities`;
        }
        return 'Anywhere';
      case 'distance':
        if (!distanceEnabled) return 'Disabled';
        return `Within ${distanceRadius} km`;
      case 'cost':
        if (minCost === 0 && isUnlimitedCost) return 'Any price';
        if (minCost === 0 && !isUnlimitedCost) return `Under $${maxCost}`;
        if (isUnlimitedCost) return `$${minCost}+`;
        return `$${minCost} - $${maxCost}`;
      case 'days':
        return selectedDays.length > 0 ? `${selectedDays.length} days` : 'Any day';
      case 'time':
        if (useCustomTimeRange) {
          return `${formatTime(startTime)} - ${formatTime(endTime)}`;
        }
        if (selectedTimes.length > 0) {
          return `${selectedTimes.length} selected`;
        }
        return 'Any time';
      default:
        return '';
    }
  };

  // Render section content
  const renderSectionContent = (section: ExpandableSection) => {
    switch (section.id) {
      case 'activityTypes':
        return renderActivityTypesContent();
      case 'environment':
        return renderEnvironmentContent();
      case 'age':
        return renderAgeContent();
      case 'where':
        return renderWhereContent();
      case 'distance':
        return renderDistanceContent();
      case 'cost':
        return renderCostContent();
      case 'days':
        return renderDaysContent();
      case 'time':
        return renderTimeContent();
      default:
        return null;
    }
  };

  const renderActivityTypesContent = () => {
    if (loadingActivityTypes) {
      return (
        <View style={styles.sectionContentInner}>
          <ActivityIndicator size="small" color="#E8638B" />
          <Text style={styles.loadingText}>Loading activity types...</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionContentInner}>
        {activityTypes.map((type) => {
          const isTypeSelected = selectedActivityTypes.includes(type.code);
          const isExpanded = expandedActivityTypes.has(type.code);
          const hasSubtypes = type.subtypes && type.subtypes.length > 0;
          const iconName = getActivityTypeIcon(type.name);

          return (
            <View key={type.code} style={styles.activityTypeContainer}>
              <View style={styles.activityTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.activityTypeChip,
                    isTypeSelected && styles.activityTypeChipActive,
                  ]}
                  onPress={() => toggleActivityType(type.code)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={iconName}
                    size={20}
                    color={isTypeSelected ? '#FFFFFF' : ModernColors.primary}
                  />
                  <Text style={[
                    styles.activityTypeText,
                    isTypeSelected && styles.activityTypeTextActive,
                  ]}>
                    {type.name}
                  </Text>
                  {isTypeSelected && (
                    <Icon name="check" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                {hasSubtypes && (
                  <TouchableOpacity
                    style={styles.expandSubtypesButton}
                    onPress={() => toggleActivityTypeExpand(type.code)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {isExpanded && hasSubtypes && (
                <View style={styles.subtypesContainer}>
                  {type.subtypes.map((subtype) => {
                    const isSubtypeSelected = selectedSubtypes.includes(subtype.code);
                    return (
                      <TouchableOpacity
                        key={subtype.code}
                        style={[
                          styles.subtypeChip,
                          isSubtypeSelected && styles.subtypeChipActive,
                        ]}
                        onPress={() => toggleSubtype(subtype.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.subtypeText,
                          isSubtypeSelected && styles.subtypeTextActive,
                        ]}>
                          {subtype.name}
                        </Text>
                        {isSubtypeSelected && (
                          <Icon name="check" size={14} color={ModernColors.primary} />
                        )}
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

  const renderEnvironmentContent = () => {
    // Gate for non-premium users
    if (!hasAdvancedFilters) {
      return (
        <View style={styles.sectionContentInner}>
          <LockedFeature
            label="Indoor/Outdoor Filter"
            description="Filter activities by whether they take place indoors or outdoors"
            onPress={() => checkAndShowUpgrade('filters')}
          />
        </View>
      );
    }

    const environmentOptions: { value: 'all' | 'indoor' | 'outdoor'; label: string; icon: string }[] = [
      { value: 'all', label: 'All', icon: 'checkbox-marked-circle-outline' },
      { value: 'indoor', label: 'Indoor', icon: 'home' },
      { value: 'outdoor', label: 'Outdoor', icon: 'tree' },
    ];

    return (
      <View style={styles.sectionContentInner}>
        <View style={styles.environmentContainer}>
          {environmentOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.environmentOption,
                environmentFilter === option.value && styles.environmentOptionSelected,
              ]}
              onPress={() => setEnvironmentFilter(option.value)}
              activeOpacity={0.7}
            >
              <Icon
                name={option.icon}
                size={24}
                color={environmentFilter === option.value ? ModernColors.primary : ModernColors.textSecondary}
              />
              <Text style={[
                styles.environmentLabel,
                environmentFilter === option.value && styles.environmentLabelSelected,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderAgeContent = () => (
    <View style={styles.sectionContentInner}>
      <View style={styles.rangeHeader}>
        <Text style={styles.rangeLabel}>Age Range</Text>
        <Text style={styles.rangeValue}>{minAge} - {maxAge} years</Text>
      </View>

      <Text style={styles.sliderLabel}>Minimum Age</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={17}
        step={1}
        value={minAge}
        onValueChange={setMinAge}
        minimumTrackTintColor="#E8638B"
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
        minimumTrackTintColor="#E8638B"
        maximumTrackTintColor="#DDDDDD"
      />
    </View>
  );

  const renderWhereContent = () => (
    <View style={styles.sectionContentInner}>
      {/* Google Places Autocomplete */}
      <Text style={styles.helperText}>
        Search for a city, province, or address
      </Text>
      <View style={{ marginTop: 12, zIndex: 100 }}>
        <AddressAutocomplete
          value={searchedLocation || undefined}
          onAddressSelect={handleLocationAutocompleteSelect}
          placeholder="Search city, province, or address..."
          types={['(cities)', 'geocode', 'address']}
          showFallbackOption={true}
        />
      </View>

      {/* Selected cities chips */}
      {selectedCities.length > 0 && (
        <View style={styles.selectedLocationsContainer}>
          <Text style={styles.selectedLocationsLabel}>Selected:</Text>
          <View style={styles.chipsContainer}>
            {selectedCities.map(city => (
              <TouchableOpacity
                key={city}
                style={[styles.chip, styles.chipSelected]}
                onPress={() => toggleCity(city)}
              >
                <Text style={styles.chipTextSelected}>{city}</Text>
                <Icon name="close" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderDistanceContent = () => {
    const DISTANCE_OPTIONS = [5, 10, 25, 50, 100];

    // Gate for non-premium users
    if (!hasAdvancedFilters) {
      return (
        <View style={styles.sectionContentInner}>
          <View style={styles.lockedInfo}>
            <Icon name="map-marker-radius" size={24} color="#9CA3AF" />
            <Text style={styles.lockedInfoText}>
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
      <View style={styles.sectionContentInner}>
        <View style={styles.distanceChips}>
          {DISTANCE_OPTIONS.map((distance) => (
            <TouchableOpacity
              key={distance}
              style={[
                styles.distanceChip,
                distanceRadius === distance && styles.distanceChipSelected,
              ]}
              onPress={() => {
                setDistanceRadius(distance);
                setDistanceEnabled(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.distanceChipText,
                distanceRadius === distance && styles.distanceChipTextSelected,
              ]}>
                {distance} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.distanceNote}>
          Activities within {distanceRadius} km of your location
        </Text>
      </View>
    );
  };

  const renderCostContent = () => (
    <View style={styles.sectionContentInner}>
      <View style={styles.rangeHeader}>
        <Text style={styles.rangeLabel}>Min: ${minCost}</Text>
        <Text style={styles.rangeLabel}>Max: {isUnlimitedCost ? 'Unlimited' : `$${maxCost}`}</Text>
      </View>

      <Text style={styles.sliderLabel}>Minimum Cost</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={500}
        step={25}
        value={minCost}
        onValueChange={setMinCost}
        minimumTrackTintColor="#E8638B"
        maximumTrackTintColor="#DDDDDD"
      />

      <Text style={styles.sliderLabel}>Maximum Cost</Text>
      <Slider
        style={[styles.slider, { opacity: isUnlimitedCost ? 0.5 : 1 }]}
        minimumValue={minCost}
        maximumValue={1500}
        step={50}
        value={maxCost}
        onValueChange={setMaxCost}
        disabled={isUnlimitedCost}
        minimumTrackTintColor="#E8638B"
        maximumTrackTintColor="#DDDDDD"
      />

      <TouchableOpacity
        style={[styles.chip, isUnlimitedCost && styles.chipSelected]}
        onPress={() => setIsUnlimitedCost(!isUnlimitedCost)}
      >
        <Text style={[styles.chipText, isUnlimitedCost && styles.chipTextSelected]}>
          Unlimited
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDaysContent = () => (
    <View style={styles.sectionContentInner}>
      <View style={styles.chipsContainer}>
        {DAYS_OF_WEEK.map(day => (
          <TouchableOpacity
            key={day}
            style={[
              styles.chip,
              selectedDays.includes(day) && styles.chipSelected
            ]}
            onPress={() => toggleDay(day)}
          >
            <Text style={[
              styles.chipText,
              selectedDays.includes(day) && styles.chipTextSelected
            ]}>
              {day.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTimeContent = () => (
    <View style={styles.sectionContentInner}>
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

      <TouchableOpacity
        style={[styles.chip, useCustomTimeRange && styles.chipSelected]}
        onPress={() => {
          setUseCustomTimeRange(!useCustomTimeRange);
          if (!useCustomTimeRange) {
            setSelectedTimes([]);
          }
        }}
      >
        <Text style={[styles.chipText, useCustomTimeRange && styles.chipTextSelected]}>
          Custom Time Range
        </Text>
      </TouchableOpacity>

      {useCustomTimeRange && (
        <View style={styles.customTimeContainer}>
          <View style={styles.rangeHeader}>
            <Text style={styles.rangeLabel}>Start: {formatTime(startTime)}</Text>
            <Text style={styles.rangeLabel}>End: {formatTime(endTime)}</Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={23}
            step={1}
            value={startTime}
            onValueChange={setStartTime}
            minimumTrackTintColor="#E8638B"
            maximumTrackTintColor="#DDDDDD"
          />

          <Slider
            style={styles.slider}
            minimumValue={startTime + 1}
            maximumValue={23}
            step={1}
            value={endTime}
            onValueChange={setEndTime}
            minimumTrackTintColor="#E8638B"
            maximumTrackTintColor="#DDDDDD"
          />
        </View>
      )}
    </View>
  );

  const renderExpandableSection = (section: ExpandableSection) => {
    const summary = getSectionSummary(section.id);

    return (
      <View key={section.id} style={styles.sectionContainer}>
        <TouchableOpacity
          style={[styles.sectionHeader, section.expanded && styles.sectionHeaderExpanded]}
          onPress={() => toggleSection(section.id)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeaderContent}>
            <View style={styles.sectionIconContainer}>
              <Icon name={section.icon} size={22} color={ModernColors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSummary}>{summary}</Text>
            </View>
          </View>
          <Icon
            name={section.expanded ? "chevron-up" : "chevron-down"}
            size={24}
            color="#9CA3AF"
          />
        </TouchableOpacity>

        {section.expanded && (
          <View style={styles.sectionContent}>
            {renderSectionContent(section)}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenBackground style={styles.container}>
      <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header with close button */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{returnToMap ? 'Filter Activities' : 'Search'}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#222222" />
          </TouchableOpacity>
        </View>

        {/* Child Preferences Selector - same as Explore page */}
        {children.length > 0 && (
          <View style={styles.childSelectorContainer}>
            <Text style={styles.childSelectorLabel}>Apply Preferences</Text>
            <ChildFilterSelector
              compact={false}
              showModeToggle={true}
              onSelectionChange={handleChildFilterChange}
            />
          </View>
        )}

        {/* Search Content */}
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.searchContainer}>
            {/* What? section - always visible, not collapsible */}
            <View style={styles.whatSection}>
              <View style={styles.whatSectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Icon name="magnify" size={22} color={ModernColors.primary} />
                </View>
                <Text style={styles.whatSectionTitle}>What?</Text>
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for activities, sports, camps..."
                placeholderTextColor="#999999"
                value={searchText}
                onChangeText={setSearchText}
                autoFocus={false}
              />
            </View>

            {/* Collapsible sections - hide location filters when filtering for map */}
            {sections
              .filter(section => !returnToMap || (section.id !== 'where' && section.id !== 'distance'))
              .map(section => renderExpandableSection(section))}
          </View>
        </ScrollView>

        {/* Bottom Actions - Compact layout */}
        <View style={styles.bottomActions}>
          <View style={styles.buttonRow}>
            {/* AI Match Button - Hidden when filtering for map */}
            {!returnToMap && (
              <TouchableOpacity
                onPress={handleAISearch}
                style={styles.aiMatchContainer}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isPremium ? ['#FFB5C5', '#E8638B'] : ['#D1D5DB', '#9CA3AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.aiMatchButtonGradient}
                >
                  <Image
                    source={aiRobotImage}
                    style={styles.robotImageInline}
                    resizeMode="contain"
                  />
                  <Text style={styles.aiMatchText}>AI Match</Text>
                  {!isPremium && (
                    <Icon name="lock" size={12} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Search Button */}
            <TouchableOpacity style={[styles.searchButton, returnToMap && { flex: 1 }]} onPress={handleSearch} activeOpacity={0.8}>
              <LinearGradient
                colors={[ModernColors.primary, '#D53F8C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.searchButtonGradient}
              >
                <Icon name={returnToMap ? 'filter-check' : 'magnify'} size={18} color="#FFFFFF" />
                <Text style={styles.searchButtonText}>{returnToMap ? 'Apply' : 'Search'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Clear All - small text link */}
          <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </Animated.View>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  childSelectorContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  childSelectorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 100,
  },
  // What section - always visible
  whatSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  whatSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  whatSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  sectionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionContentInner: {
    marginTop: 8,
  },
  searchInput: {
    fontSize: 16,
    color: '#222222',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#717171',
    textAlign: 'center',
    marginTop: 8,
  },
  // Activity types
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    flex: 1,
    gap: 10,
  },
  activityTypeChipActive: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  activityTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  activityTypeTextActive: {
    color: '#FFFFFF',
  },
  expandSubtypesButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 16,
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
    gap: 6,
  },
  subtypeChipActive: {
    backgroundColor: ModernColors.primary + '15',
    borderColor: ModernColors.primary,
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
  // Location section
  selectedLocationsContainer: {
    marginTop: 16,
  },
  selectedLocationsLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
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
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  locationExpandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FDF2F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F9A8D4',
  },
  locationExpandText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  // Chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  chipSelected: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  // Environment options (horizontal cards)
  environmentContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  environmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  environmentOptionSelected: {
    backgroundColor: ModernColors.primary + '10',
    borderColor: ModernColors.primary,
  },
  environmentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.textSecondary,
    marginTop: 8,
  },
  environmentLabelSelected: {
    color: ModernColors.primary,
  },
  // Distance chips
  distanceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  distanceChipSelected: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  distanceChipTextSelected: {
    color: '#FFFFFF',
  },
  distanceNote: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
  // Range sliders
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  rangeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8638B',
  },
  sliderLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    marginTop: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  // Switch row
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  // Locked info
  lockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 12,
  },
  lockedInfoText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  // Time buttons
  predefinedTimesContainer: {
    gap: 8,
    marginBottom: 16,
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
    backgroundColor: '#E8638B',
    borderColor: '#E8638B',
  },
  timeButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
  },
  timeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 2,
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
  customTimeContainer: {
    marginTop: 16,
  },
  // Bottom actions - compact horizontal layout
  bottomActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 6,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aiMatchContainer: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  aiMatchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 6,
  },
  aiMatchText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  robotImageInline: {
    width: 24,
    height: 24,
  },
  clearButton: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: ModernColors.textSecondary,
  },
});

export default SearchScreen;
