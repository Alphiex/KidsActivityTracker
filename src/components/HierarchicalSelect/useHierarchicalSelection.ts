import { useMemo, useCallback } from 'react';
import {
  HierarchicalProvince,
  HierarchicalCity,
  HierarchicalLocation,
  CheckboxState,
  LocationLookupMaps,
} from './types';

// Build lookup maps for O(1) access
export const buildLookupMaps = (
  hierarchy: HierarchicalProvince[]
): LocationLookupMaps => {
  const maps: LocationLookupMaps = {
    locationById: new Map(),
    locationIdsByCity: new Map(),
    locationIdsByProvince: new Map(),
    cityByLocationId: new Map(),
    provinceByLocationId: new Map(),
  };

  hierarchy.forEach(province => {
    const provinceLocationIds: string[] = [];

    province.cities.forEach(city => {
      const cityKey = `${province.name}::${city.name}`;
      const cityLocationIds: string[] = [];

      city.locations.forEach(location => {
        maps.locationById.set(location.id, location);
        maps.cityByLocationId.set(location.id, cityKey);
        maps.provinceByLocationId.set(location.id, province.name);
        cityLocationIds.push(location.id);
        provinceLocationIds.push(location.id);
      });

      maps.locationIdsByCity.set(cityKey, cityLocationIds);
    });

    maps.locationIdsByProvince.set(province.name, provinceLocationIds);
  });

  return maps;
};

// Build hierarchy from API data
export const buildHierarchyFromAPI = (
  cities: Array<{ city: string; province: string; venueCount: number; activityCount: number }>,
  locations: Array<{ id: string; name: string; city: string; address?: string; fullAddress?: string; _count?: { activities: number } }>
): HierarchicalProvince[] => {
  // Build city-to-province map
  const cityProvinceMap = new Map<string, string>();
  cities.forEach(c => {
    cityProvinceMap.set(c.city, c.province || 'Unknown');
  });

  // Group locations by city, then by province
  const provinceMap = new Map<string, Map<string, HierarchicalLocation[]>>();

  locations.forEach(location => {
    const cityName = location.city || 'Unknown';
    const provinceName = cityProvinceMap.get(cityName) || 'Unknown';

    if (!provinceMap.has(provinceName)) {
      provinceMap.set(provinceName, new Map());
    }
    const cityMap = provinceMap.get(provinceName)!;

    if (!cityMap.has(cityName)) {
      cityMap.set(cityName, []);
    }

    cityMap.get(cityName)!.push({
      id: location.id,
      name: location.name,
      city: cityName,
      province: provinceName,
      address: location.address,
      fullAddress: location.fullAddress,
      activityCount: location._count?.activities || 0,
    });
  });

  // Convert to array structure
  const hierarchy: HierarchicalProvince[] = [];

  provinceMap.forEach((cityMap, provinceName) => {
    const citiesArray: HierarchicalCity[] = [];
    let totalLocations = 0;
    let totalActivities = 0;

    cityMap.forEach((locs, cityName) => {
      const sortedLocations = locs.sort((a, b) => a.name.localeCompare(b.name));
      const cityActivityCount = sortedLocations.reduce((sum, loc) => sum + loc.activityCount, 0);

      citiesArray.push({
        name: cityName,
        province: provinceName,
        locations: sortedLocations,
        locationCount: sortedLocations.length,
        activityCount: cityActivityCount,
        expanded: false,
      });

      totalLocations += sortedLocations.length;
      totalActivities += cityActivityCount;
    });

    hierarchy.push({
      name: provinceName,
      cities: citiesArray.sort((a, b) => a.name.localeCompare(b.name)),
      cityCount: citiesArray.length,
      locationCount: totalLocations,
      activityCount: totalActivities,
      expanded: false,
    });
  });

  return hierarchy.sort((a, b) => a.name.localeCompare(b.name));
};

// Filter hierarchy by search query
export const filterHierarchy = (
  hierarchy: HierarchicalProvince[],
  query: string
): HierarchicalProvince[] => {
  if (!query.trim()) return hierarchy;

  const lowerQuery = query.toLowerCase().trim();

  return hierarchy
    .map(province => {
      const provinceMatches = province.name.toLowerCase().includes(lowerQuery);

      const filteredCities = province.cities
        .map(city => {
          const cityMatches = city.name.toLowerCase().includes(lowerQuery);

          const filteredLocations = city.locations.filter(
            location =>
              location.name.toLowerCase().includes(lowerQuery) ||
              location.address?.toLowerCase().includes(lowerQuery) ||
              location.fullAddress?.toLowerCase().includes(lowerQuery)
          );

          // Include city if: city matches, or has matching locations, or province matches
          if (cityMatches || filteredLocations.length > 0 || provinceMatches) {
            return {
              ...city,
              locations: cityMatches || provinceMatches ? city.locations : filteredLocations,
              expanded: true, // Auto-expand when searching
            };
          }
          return null;
        })
        .filter((city): city is HierarchicalCity => city !== null);

      if (provinceMatches || filteredCities.length > 0) {
        return {
          ...province,
          cities: provinceMatches
            ? province.cities.map(c => ({ ...c, expanded: true }))
            : filteredCities,
          expanded: true, // Auto-expand when searching
        };
      }
      return null;
    })
    .filter((province): province is HierarchicalProvince => province !== null);
};

// Hook for selection logic
export const useHierarchicalSelection = (
  hierarchy: HierarchicalProvince[],
  selectedLocationIds: Set<string>
) => {
  // Build lookup maps
  const lookupMaps = useMemo(() => buildLookupMaps(hierarchy), [hierarchy]);

  // Get checkbox state for province
  const getProvinceCheckboxState = useCallback(
    (provinceName: string): CheckboxState => {
      const locationIds = lookupMaps.locationIdsByProvince.get(provinceName) || [];
      if (locationIds.length === 0) return 'unchecked';

      const selectedCount = locationIds.filter(id => selectedLocationIds.has(id)).length;

      if (selectedCount === 0) return 'unchecked';
      if (selectedCount === locationIds.length) return 'checked';
      return 'indeterminate';
    },
    [lookupMaps, selectedLocationIds]
  );

  // Get checkbox state for city
  const getCityCheckboxState = useCallback(
    (provinceName: string, cityName: string): CheckboxState => {
      const cityKey = `${provinceName}::${cityName}`;
      const locationIds = lookupMaps.locationIdsByCity.get(cityKey) || [];
      if (locationIds.length === 0) return 'unchecked';

      const selectedCount = locationIds.filter(id => selectedLocationIds.has(id)).length;

      if (selectedCount === 0) return 'unchecked';
      if (selectedCount === locationIds.length) return 'checked';
      return 'indeterminate';
    },
    [lookupMaps, selectedLocationIds]
  );

  // Get selection counts for province
  const getProvinceSelectionCounts = useCallback(
    (provinceName: string): { selected: number; total: number } => {
      const locationIds = lookupMaps.locationIdsByProvince.get(provinceName) || [];
      return {
        selected: locationIds.filter(id => selectedLocationIds.has(id)).length,
        total: locationIds.length,
      };
    },
    [lookupMaps, selectedLocationIds]
  );

  // Get selection counts for city
  const getCitySelectionCounts = useCallback(
    (provinceName: string, cityName: string): { selected: number; total: number } => {
      const cityKey = `${provinceName}::${cityName}`;
      const locationIds = lookupMaps.locationIdsByCity.get(cityKey) || [];
      return {
        selected: locationIds.filter(id => selectedLocationIds.has(id)).length,
        total: locationIds.length,
      };
    },
    [lookupMaps, selectedLocationIds]
  );

  // Toggle location selection
  const toggleLocation = useCallback(
    (locationId: string, onSelectionChange: (newSelection: Set<string>) => void) => {
      const newSelection = new Set(selectedLocationIds);
      if (newSelection.has(locationId)) {
        newSelection.delete(locationId);
      } else {
        newSelection.add(locationId);
      }
      onSelectionChange(newSelection);
    },
    [selectedLocationIds]
  );

  // Toggle city selection (select/deselect all locations in city)
  const toggleCity = useCallback(
    (
      provinceName: string,
      cityName: string,
      onSelectionChange: (newSelection: Set<string>) => void
    ) => {
      const cityKey = `${provinceName}::${cityName}`;
      const cityLocationIds = lookupMaps.locationIdsByCity.get(cityKey) || [];
      const allSelected = cityLocationIds.every(id => selectedLocationIds.has(id));

      const newSelection = new Set(selectedLocationIds);
      if (allSelected) {
        cityLocationIds.forEach(id => newSelection.delete(id));
      } else {
        cityLocationIds.forEach(id => newSelection.add(id));
      }
      onSelectionChange(newSelection);
    },
    [lookupMaps, selectedLocationIds]
  );

  // Toggle province selection (select/deselect all locations in province)
  const toggleProvince = useCallback(
    (provinceName: string, onSelectionChange: (newSelection: Set<string>) => void) => {
      const provinceLocationIds = lookupMaps.locationIdsByProvince.get(provinceName) || [];
      const allSelected = provinceLocationIds.every(id => selectedLocationIds.has(id));

      const newSelection = new Set(selectedLocationIds);
      if (allSelected) {
        provinceLocationIds.forEach(id => newSelection.delete(id));
      } else {
        provinceLocationIds.forEach(id => newSelection.add(id));
      }
      onSelectionChange(newSelection);
    },
    [lookupMaps, selectedLocationIds]
  );

  return {
    lookupMaps,
    getProvinceCheckboxState,
    getCityCheckboxState,
    getProvinceSelectionCounts,
    getCitySelectionCounts,
    toggleLocation,
    toggleCity,
    toggleProvince,
  };
};
