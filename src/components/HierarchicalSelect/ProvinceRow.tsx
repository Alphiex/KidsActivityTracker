import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ProvinceRowProps } from './types';
import HierarchicalCheckbox from './HierarchicalCheckbox';
import SelectionBadge from './SelectionBadge';
import { styles, COLORS } from './styles';

const ProvinceRow: React.FC<ProvinceRowProps> = ({
  province,
  checkboxState,
  selectedCount,
  totalCount,
  onToggle,
  onExpand,
  children,
}) => {
  return (
    <>
      <View style={styles.provinceRow}>
        <View style={styles.provinceCheckbox}>
          <HierarchicalCheckbox state={checkboxState} onPress={onToggle} />
        </View>
        <TouchableOpacity
          style={styles.provinceContent}
          onPress={onExpand}
          activeOpacity={0.7}
        >
          <Text style={styles.provinceName}>{province.name}</Text>
          <View style={styles.provinceRight}>
            <SelectionBadge selected={selectedCount} total={totalCount} />
            <Text style={styles.activityCount}>
              {province.cityCount} {province.cityCount === 1 ? 'city' : 'cities'}
            </Text>
            <Icon
              name={province.expanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={COLORS.textSecondary}
              style={styles.expandIcon}
            />
          </View>
        </TouchableOpacity>
      </View>
      {province.expanded && children}
    </>
  );
};

export default React.memo(ProvinceRow);
