import React from 'react';
import { TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { HierarchicalCheckboxProps } from './types';
import { COLORS } from './styles';

const HierarchicalCheckbox: React.FC<HierarchicalCheckboxProps> = ({
  state,
  onPress,
  size = 24,
  color = COLORS.primary,
}) => {
  const getIconName = (): string => {
    switch (state) {
      case 'checked':
        return 'checkbox-marked';
      case 'indeterminate':
        return 'minus-box';
      case 'unchecked':
      default:
        return 'checkbox-blank-outline';
    }
  };

  const getIconColor = (): string => {
    switch (state) {
      case 'checked':
      case 'indeterminate':
        return color;
      case 'unchecked':
      default:
        return COLORS.checkboxUnchecked;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Icon name={getIconName()} size={size} color={getIconColor()} />
    </TouchableOpacity>
  );
};

export default React.memo(HierarchicalCheckbox);
