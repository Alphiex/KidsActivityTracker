import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { HierarchicalSelect, buildHierarchyFromAPI } from '../components/HierarchicalSelect';
import { HierarchicalProvince, EnhancedAddress } from '../types/preferences';

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

const SearchScreen = () => {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();

  // Subscription state for premium features
  const {
    checkAndShowUpgrade,
    hasAdvancedFilters,
    isPremium,
  } = useSubscription();

  // Use preferences toggle
  const [usePreferences, setUsePreferences] = useState(true);

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
  const [isUnlimitedCost, setIsUnlimitedCost] = useState(false);
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
  const [hierarchyData, setHierarchyData] = useState<HierarchicalProvince[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState<EnhancedAddress | null>(null);

  // UI state - sections in same order as FiltersScreen (excludes 'what' which is always visible)
  const [sections, setSections] = useState<ExpandableSection[]>([
    { id: 'activityTypes', title: 'Activity Type?', icon: 'soccer', expanded: false },
    { id: 'environment', title: 'Indoor or Outdoor?', icon: 'weather-sunny', expanded: false },
    { id: 'age', title: 'Age Range?', icon: 'account-child', expanded: false },
    { id: 'where', title: 'Where?', icon: 'map-marker', expanded: false },
    { id: 'distance', title: 'How Far?', icon: 'map-marker-radius', expanded: false },
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
    loadLocations();

    // Load preferences as initial values if toggle is on
    if (usePreferences) {
      loadPreferencesAsFilters();
    }
  }, []);

  const loadLocations = async () => {
    try {
      setLocationsLoading(true);
      const [citiesData, locationsData] = await Promise.all([
        activityService.getCities(),
        activityService.getLocations(),
      ]);

      if (locationsData && locationsData.length > 0) {
        const hierarchy = buildHierarchyFromAPI(citiesData || [], locationsData);
        setHierarchyData(hierarchy);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLocationsLoading(false);
    }
  };

  const handleLocationSelectionChange = (newSelection: Set<string>) => {
    setSelectedLocationIds(newSelection);
  };

  const handleLocationAutocompleteSelect = (address: EnhancedAddress) => {
    setSearchedLocation(address);
    // Also add to selectedCities if it's a city
    if (address.city) {
      setSelectedCities(prev =>
        prev.includes(address.city!) ? prev : [...prev, address.city!]
      );
    }
  };

  // Load preferences when toggle changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (usePreferences) {
      loadPreferencesAsFilters();
    }
  }, [usePreferences]);

  const loadPreferencesAsFilters = () => {
    const prefs = preferencesService.getPreferences();

    // Apply preferences to search filters
    if (prefs.preferredActivityTypes && prefs.preferredActivityTypes.length > 0) {
      setSelectedActivityTypes(prefs.preferredActivityTypes);
    }
    if (prefs.preferredSubtypes && prefs.preferredSubtypes.length > 0) {
      setSelectedSubtypes(prefs.preferredSubtypes);
    }
    if (prefs.daysOfWeek && prefs.daysOfWeek.length > 0) {
      setSelectedDays(prefs.daysOfWeek);
    }
    if (prefs.ageRanges && prefs.ageRanges.length > 0) {
      setMinAge(prefs.ageRanges[0].min);
      setMaxAge(prefs.ageRanges[0].max);
    }
    if (prefs.priceRange) {
      setMinCost(prefs.priceRange.min);
      setMaxCost(prefs.priceRange.max);
      setIsUnlimitedCost(prefs.priceRange.max >= 10000);
    }
    if (prefs.environmentFilter) {
      setEnvironmentFilter(prefs.environmentFilter);
    }
    if (prefs.distanceFilterEnabled !== undefined) {
      setDistanceEnabled(prefs.distanceFilterEnabled);
    }
    if (prefs.distanceRadiusKm) {
      setDistanceRadius(prefs.distanceRadiusKm);
    }
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
    setIsUnlimitedCost(false);
    setSelectedCities([]);
    setSelectedLocationIds(new Set());
    setSearchedLocation(null);
    setShowLocationPicker(false);
    setMinAge(0);
    setMaxAge(18);
    setEnvironmentFilter('all');
    setDistanceEnabled(false);
    setDistanceRadius(25);
  };

  const handleSearch = async () => {
    // Merge selected cities and location IDs into a single locations array
    // Backend handles both UUIDs (location IDs) and city names automatically
    const allLocations = [
      ...selectedCities,
      ...Array.from(selectedLocationIds)
    ].filter(Boolean);

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

    // Navigate to SearchResults screen (not AI)
    navigation.navigate('SearchResults' as never, {
      filters: searchParams,
      searchQuery: searchText
    } as never);
  };

  const handleAISearch = () => {
    if (!isPremium) {
      checkAndShowUpgrade('ai_search');
      return;
    }

    // Merge selected cities and location IDs into a single locations array
    const allLocations = [
      ...selectedCities,
      ...Array.from(selectedLocationIds)
    ].filter(Boolean);

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
        const totalLocations = selectedCities.length + selectedLocationIds.size;
        if (totalLocations > 0) {
          if (selectedCities.length > 0 && selectedLocationIds.size > 0) {
            return `${selectedCities.length} cities, ${selectedLocationIds.size} locations`;
          } else if (selectedCities.length > 0) {
            return selectedCities.length <= 2 ? selectedCities.join(', ') : `${selectedCities.length} cities`;
          } else {
            return `${selectedLocationIds.size} locations`;
          }
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
                >
                  <Icon
                    name={iconName}
                    size={20}
                    color={isTypeSelected ? '#FFFFFF' : '#E8638B'}
                  />
                  <Text style={[
                    styles.activityTypeText,
                    isTypeSelected && styles.activityTypeTextActive,
                  ]}>
                    {type.name}
                  </Text>
                </TouchableOpacity>

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

    const environmentOptions = [
      { value: 'all', label: 'All Activities', description: 'Show both indoor and outdoor activities', icon: 'earth' },
      { value: 'indoor', label: 'Indoor Only', description: 'Swimming pools, gyms, studios, rinks', icon: 'home-roof' },
      { value: 'outdoor', label: 'Outdoor Only', description: 'Parks, fields, nature, adventure', icon: 'pine-tree' },
    ];

    return (
      <View style={styles.sectionContentInner}>
        {environmentOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionCard,
              environmentFilter === option.value && styles.optionCardSelected
            ]}
            onPress={() => setEnvironmentFilter(option.value as 'all' | 'indoor' | 'outdoor')}
          >
            <View style={styles.optionCardContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={option.icon} size={20} color={environmentFilter === option.value ? '#E8638B' : '#6B7280'} style={{ marginRight: 10 }} />
                <Text style={styles.optionTitle}>{option.label}</Text>
              </View>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            <View style={[styles.radio, environmentFilter === option.value && styles.radioActive]}>
              {environmentFilter === option.value && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
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

  const renderDistanceContent = () => {
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
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enable Distance Filter</Text>
          <Switch
            value={distanceEnabled}
            onValueChange={setDistanceEnabled}
            trackColor={{ false: '#D1D5DB', true: '#F9A8D4' }}
            thumbColor={distanceEnabled ? '#E8638B' : '#F3F4F6'}
          />
        </View>

        {distanceEnabled && (
          <>
            <View style={styles.rangeHeader}>
              <Text style={styles.rangeLabel}>Search Radius</Text>
              <Text style={styles.rangeValue}>{distanceRadius} km</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={5}
              maximumValue={100}
              step={5}
              value={distanceRadius}
              onValueChange={setDistanceRadius}
              minimumTrackTintColor="#E8638B"
              maximumTrackTintColor="#DDDDDD"
            />
          </>
        )}
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
        >
          <View style={styles.sectionHeaderContent}>
            <Icon name={section.icon} size={24} color="#222222" style={styles.sectionIcon} />
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSummary}>{summary}</Text>
            </View>
          </View>
          <Icon
            name={section.expanded ? "chevron-up" : "chevron-down"}
            size={24}
            color="#717171"
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
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Fogged Background */}
      <View style={styles.foggedBackground} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header with close button */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#222222" />
          </TouchableOpacity>
        </View>

        {/* Use Preferences Toggle */}
        <View style={styles.preferencesToggle}>
          <View style={styles.preferencesToggleContent}>
            <Icon name="tune-variant" size={20} color="#E8638B" />
            <View style={styles.preferencesToggleText}>
              <Text style={styles.preferencesToggleTitle}>Use My Preferences</Text>
              <Text style={styles.preferencesToggleDescription}>
                Start with your saved preference settings
              </Text>
            </View>
          </View>
          <Switch
            value={usePreferences}
            onValueChange={setUsePreferences}
            trackColor={{ false: '#D1D5DB', true: '#F9A8D4' }}
            thumbColor={usePreferences ? '#E8638B' : '#F3F4F6'}
          />
        </View>

        {/* Search Content */}
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.searchContainer}>
            {/* What? section - always visible, not collapsible */}
            <View style={styles.whatSection}>
              <View style={styles.whatSectionHeader}>
                <Icon name="magnify" size={24} color="#222222" style={styles.sectionIcon} />
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

            {/* Collapsible sections */}
            {sections.map(section => renderExpandableSection(section))}
          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>

          <View style={styles.searchActions}>
            {/* AI Match Button with Robot */}
            <TouchableOpacity
              onPress={handleAISearch}
              style={styles.aiMatchContainer}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isPremium ? ['#FFB5C5', '#E8638B', '#D53F8C'] : ['#D1D5DB', '#9CA3AF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.aiMatchButton}
              >
                <Text style={styles.aiMatchText}>AI Match</Text>
                {!isPremium && (
                  <Icon name="lock" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                )}
              </LinearGradient>
              <Image
                source={aiRobotImage}
                style={styles.robotImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222222',
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
  preferencesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#FFF5F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F9A8D4',
  },
  preferencesToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  preferencesToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  preferencesToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  preferencesToggleDescription: {
    fontSize: 12,
    color: '#717171',
    marginTop: 2,
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
    marginBottom: 20,
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
  sectionIcon: {
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 2,
  },
  sectionSummary: {
    fontSize: 13,
    color: '#717171',
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
    marginBottom: 8,
  },
  activityTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8638B',
    backgroundColor: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  activityTypeChipActive: {
    backgroundColor: '#E8638B',
  },
  activityTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#E8638B',
    marginLeft: 10,
  },
  activityTypeTextActive: {
    color: '#FFFFFF',
  },
  expandSubtypesButton: {
    padding: 8,
  },
  subtypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 20,
    gap: 8,
  },
  subtypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  subtypeChipActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#F9A8D4',
  },
  subtypeText: {
    fontSize: 13,
    color: '#6B7280',
  },
  subtypeTextActive: {
    color: '#E8638B',
    fontWeight: '500',
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
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: '#E8638B',
    borderColor: '#E8638B',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222222',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  // Option cards (environment)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  optionCardSelected: {
    borderColor: '#E8638B',
    backgroundColor: '#FDF2F8',
  },
  optionCardContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222222',
  },
  optionDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginLeft: 30,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
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
  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiMatchContainer: {
    position: 'relative',
    marginRight: 30,
    marginTop: 10,
  },
  aiMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingRight: 40,
    borderRadius: 12,
  },
  aiMatchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  robotImage: {
    position: 'absolute',
    right: -20,
    top: -15,
    width: 50,
    height: 50,
  },
  searchButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#E8638B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SearchScreen;
