import React from 'react';
import { View, Text } from 'react-native';
import { SelectionBadgeProps } from './types';
import { styles } from './styles';

const SelectionBadge: React.FC<SelectionBadgeProps> = ({ selected, total }) => {
  const hasSelection = selected > 0;

  return (
    <View style={[styles.badgeContainer, hasSelection && styles.badgeSelected]}>
      <Text style={[styles.badgeText, hasSelection && styles.badgeTextSelected]}>
        {selected}/{total}
      </Text>
    </View>
  );
};

export default React.memo(SelectionBadge);
