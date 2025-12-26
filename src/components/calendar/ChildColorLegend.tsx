import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ModernColors } from '../../theme/modernTheme';

interface ChildLegendItem {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  isShared?: boolean;
  sharedBy?: string;
  activityCount?: number;
}

interface ChildColorLegendProps {
  children: ChildLegendItem[];
  onToggleChild: (childId: string, isShared: boolean) => void;
  showActivityCount?: boolean;
  horizontal?: boolean;
}

export const ChildColorLegend: React.FC<ChildColorLegendProps> = ({
  children,
  onToggleChild,
  showActivityCount = false,
  horizontal = true,
}) => {
  if (children.length === 0) {
    return null;
  }

  const renderChild = (child: ChildLegendItem) => {
    const displayName = child.isShared && child.sharedBy
      ? `${child.name} (${child.sharedBy})`
      : child.name;

    return (
      <TouchableOpacity
        key={child.id}
        style={[
          styles.legendItem,
          !child.isVisible && styles.legendItemInactive,
          horizontal && styles.legendItemHorizontal,
        ]}
        onPress={() => onToggleChild(child.id, child.isShared || false)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.colorDot,
            { backgroundColor: child.isVisible ? child.color : ModernColors.border },
          ]}
        />
        <Text
          style={[
            styles.childName,
            !child.isVisible && styles.childNameInactive,
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {showActivityCount && child.activityCount !== undefined && (
          <View style={[styles.countBadge, { backgroundColor: child.color + '20' }]}>
            <Text style={[styles.countText, { color: child.color }]}>
              {child.activityCount}
            </Text>
          </View>
        )}
        {child.isShared && (
          <Icon
            name="share-variant"
            size={12}
            color={child.isVisible ? ModernColors.textSecondary : ModernColors.border}
            style={styles.sharedIcon}
          />
        )}
        {!child.isVisible && (
          <Icon
            name="eye-off"
            size={14}
            color={ModernColors.border}
            style={styles.eyeIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalContainer}
        contentContainerStyle={styles.horizontalContent}
      >
        {children.map(renderChild)}
      </ScrollView>
    );
  }

  return (
    <View style={styles.verticalContainer}>
      {children.map(renderChild)}
    </View>
  );
};

const styles = StyleSheet.create({
  horizontalContainer: {
    flexGrow: 0,
    marginVertical: 8,
  },
  horizontalContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  verticalContainer: {
    padding: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ModernColors.cardBackground,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  legendItemHorizontal: {
    marginRight: 8,
  },
  legendItemInactive: {
    backgroundColor: ModernColors.background,
    borderColor: ModernColors.border,
    opacity: 0.6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  childName: {
    fontSize: 13,
    fontWeight: '500',
    color: ModernColors.text,
    maxWidth: 120,
  },
  childNameInactive: {
    color: ModernColors.textMuted,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sharedIcon: {
    marginLeft: 4,
  },
  eyeIcon: {
    marginLeft: 4,
  },
});

export default ChildColorLegend;
