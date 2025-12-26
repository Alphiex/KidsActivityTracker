import {
  HierarchicalLocation,
  HierarchicalCity,
  HierarchicalProvince,
  CheckboxState,
} from '../../types/preferences';

export type { HierarchicalLocation, HierarchicalCity, HierarchicalProvince, CheckboxState };

// Lookup maps for O(1) access
export interface LocationLookupMaps {
  locationById: Map<string, HierarchicalLocation>;
  locationIdsByCity: Map<string, string[]>; // "Province::City" -> locationIds
  locationIdsByProvince: Map<string, string[]>; // provinceName -> locationIds
  cityByLocationId: Map<string, string>; // locationId -> "Province::City"
  provinceByLocationId: Map<string, string>; // locationId -> provinceName
}

// Props for HierarchicalSelect component
export interface HierarchicalSelectProps {
  hierarchy: HierarchicalProvince[];
  selectedLocationIds: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
  loading?: boolean;
  searchPlaceholder?: string;
}

// Props for row components
export interface ProvinceRowProps {
  province: HierarchicalProvince;
  checkboxState: CheckboxState;
  selectedCount: number;
  totalCount: number;
  onToggle: () => void;
  onExpand: () => void;
  children?: React.ReactNode;
}

export interface CityRowProps {
  city: HierarchicalCity;
  provinceName: string;
  checkboxState: CheckboxState;
  selectedCount: number;
  totalCount: number;
  onToggle: () => void;
  onExpand: () => void;
  children?: React.ReactNode;
}

export interface LocationRowProps {
  location: HierarchicalLocation;
  isSelected: boolean;
  onToggle: () => void;
}

export interface HierarchicalCheckboxProps {
  state: CheckboxState;
  onPress: () => void;
  size?: number;
  color?: string;
}

export interface SelectionBadgeProps {
  selected: number;
  total: number;
}

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}
