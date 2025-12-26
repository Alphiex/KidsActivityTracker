import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CityRowProps } from './types';
import HierarchicalCheckbox from './HierarchicalCheckbox';
import SelectionBadge from './SelectionBadge';
import { styles, COLORS } from './styles';

const CityRow: React.FC<CityRowProps> = ({
  city,
  checkboxState,
  selectedCount,
  totalCount,
  onToggle,
  onExpand,
  children,
}) => {
  return (
    <>
      <View style={styles.cityRow}>
        <View style={styles.cityCheckbox}>
          <HierarchicalCheckbox state={checkboxState} onPress={onToggle} />
        </View>
        <TouchableOpacity
          style={styles.cityContent}
          onPress={onExpand}
          activeOpacity={0.7}
        >
          <Text style={styles.cityName}>{city.name}</Text>
          <View style={styles.cityRight}>
            <SelectionBadge selected={selectedCount} total={totalCount} />
            <Text style={styles.activityCount}>
              {city.locationCount} {city.locationCount === 1 ? 'location' : 'locations'}
            </Text>
            <Icon
              name={city.expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textSecondary}
              style={styles.expandIcon}
            />
          </View>
        </TouchableOpacity>
      </View>
      {city.expanded && children}
    </>
  );
};

export default React.memo(CityRow);
