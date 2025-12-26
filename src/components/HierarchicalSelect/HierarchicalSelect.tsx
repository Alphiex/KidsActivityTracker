import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { HierarchicalSelectProps, HierarchicalProvince, HierarchicalCity } from './types';
import { useHierarchicalSelection, filterHierarchy } from './useHierarchicalSelection';
import SearchBar from './SearchBar';
import ProvinceRow from './ProvinceRow';
import CityRow from './CityRow';
import LocationRow from './LocationRow';
import { styles, COLORS } from './styles';

// Flattened item type for FlatList
type FlatListItem =
  | { type: 'province'; data: HierarchicalProvince }
  | { type: 'city'; data: HierarchicalCity; provinceName: string }
  | { type: 'location'; data: { id: string; name: string; activityCount: number }; provinceName: string; cityName: string };

const HierarchicalSelect: React.FC<HierarchicalSelectProps> = ({
  hierarchy,
  selectedLocationIds,
  onSelectionChange,
  loading = false,
  searchPlaceholder = 'Search provinces, cities, locations...',
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Expansion state
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Selection helpers
  const {
    getProvinceCheckboxState,
    getCityCheckboxState,
    getProvinceSelectionCounts,
    getCitySelectionCounts,
    toggleLocation,
    toggleCity,
    toggleProvince,
  } = useHierarchicalSelection(hierarchy, selectedLocationIds);

  // Filter hierarchy based on search
  const filteredHierarchy = useMemo(() => {
    const filtered = filterHierarchy(hierarchy, searchQuery);
    // When searching, override expansion state
    if (searchQuery.trim()) {
      return filtered.map(p => ({
        ...p,
        expanded: true,
        cities: p.cities.map(c => ({ ...c, expanded: true })),
      }));
    }
    // Apply expansion state
    return filtered.map(p => ({
      ...p,
      expanded: expandedProvinces.has(p.name),
      cities: p.cities.map(c => ({
        ...c,
        expanded: expandedCities.has(`${p.name}::${c.name}`),
      })),
    }));
  }, [hierarchy, searchQuery, expandedProvinces, expandedCities]);

  // Flatten hierarchy for FlatList
  const flattenedItems = useMemo((): FlatListItem[] => {
    const items: FlatListItem[] = [];

    filteredHierarchy.forEach(province => {
      items.push({ type: 'province', data: province });

      if (province.expanded) {
        province.cities.forEach(city => {
          items.push({ type: 'city', data: city, provinceName: province.name });

          if (city.expanded) {
            city.locations.forEach(location => {
              items.push({
                type: 'location',
                data: location,
                provinceName: province.name,
                cityName: city.name,
              });
            });
          }
        });
      }
    });

    return items;
  }, [filteredHierarchy]);

  // Toggle handlers
  const handleToggleProvince = useCallback(
    (provinceName: string) => {
      setExpandedProvinces(prev => {
        const next = new Set(prev);
        if (next.has(provinceName)) {
          next.delete(provinceName);
        } else {
          next.add(provinceName);
        }
        return next;
      });
    },
    []
  );

  const handleToggleCity = useCallback(
    (provinceName: string, cityName: string) => {
      const key = `${provinceName}::${cityName}`;
      setExpandedCities(prev => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    []
  );

  // Render item for FlatList
  const renderItem = useCallback(
    ({ item }: { item: FlatListItem }) => {
      switch (item.type) {
        case 'province': {
          const province = item.data;
          const checkboxState = getProvinceCheckboxState(province.name);
          const counts = getProvinceSelectionCounts(province.name);

          return (
            <ProvinceRow
              province={province}
              checkboxState={checkboxState}
              selectedCount={counts.selected}
              totalCount={counts.total}
              onToggle={() => toggleProvince(province.name, onSelectionChange)}
              onExpand={() => handleToggleProvince(province.name)}
            />
          );
        }

        case 'city': {
          const city = item.data;
          const checkboxState = getCityCheckboxState(item.provinceName, city.name);
          const counts = getCitySelectionCounts(item.provinceName, city.name);

          return (
            <CityRow
              city={city}
              provinceName={item.provinceName}
              checkboxState={checkboxState}
              selectedCount={counts.selected}
              totalCount={counts.total}
              onToggle={() => toggleCity(item.provinceName, city.name, onSelectionChange)}
              onExpand={() => handleToggleCity(item.provinceName, city.name)}
            />
          );
        }

        case 'location': {
          const location = item.data;
          const isSelected = selectedLocationIds.has(location.id);

          return (
            <LocationRow
              location={location as any}
              isSelected={isSelected}
              onToggle={() => toggleLocation(location.id, onSelectionChange)}
            />
          );
        }

        default:
          return null;
      }
    },
    [
      selectedLocationIds,
      onSelectionChange,
      getProvinceCheckboxState,
      getCityCheckboxState,
      getProvinceSelectionCounts,
      getCitySelectionCounts,
      toggleProvince,
      toggleCity,
      toggleLocation,
      handleToggleProvince,
      handleToggleCity,
    ]
  );

  // Key extractor
  const keyExtractor = useCallback((item: FlatListItem, index: number) => {
    switch (item.type) {
      case 'province':
        return `province-${item.data.name}`;
      case 'city':
        return `city-${item.provinceName}-${item.data.name}`;
      case 'location':
        return `location-${item.data.id}`;
      default:
        return `item-${index}`;
    }
  }, []);

  // Empty component
  const ListEmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    if (searchQuery && flattenedItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No locations found matching "{searchQuery}"
          </Text>
        </View>
      );
    }

    if (flattenedItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No locations available</Text>
        </View>
      );
    }

    return null;
  }, [loading, searchQuery, flattenedItems.length]);

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={searchPlaceholder}
      />
      <FlatList
        data={flattenedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={10}
        initialNumToRender={15}
        getItemLayout={undefined} // Variable height items
      />
    </View>
  );
};

export default HierarchicalSelect;
