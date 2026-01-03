import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppSelector, useAppDispatch } from '../store';
import {
  selectAllChildren,
  selectSelectedChildIds,
  selectFilterMode,
  setSelectedChildIds,
  toggleChildSelection,
  setFilterMode,
  ChildWithPreferences,
  ChildFilterMode,
} from '../store/slices/childrenSlice';
import { selectSubscription } from '../store/slices/subscriptionSlice';
import { ChildAvatar } from './children';
import { getChildColor } from '../theme/childColors';

interface ChildFilterSelectorProps {
  /**
   * Compact mode for smaller spaces (e.g., dashboard header)
   */
  compact?: boolean;
  /**
   * Show the filter mode toggle (OR/AND)
   */
  showModeToggle?: boolean;
  /**
   * Called when selection changes
   */
  onSelectionChange?: (selectedIds: string[], mode: ChildFilterMode) => void;
}

/**
 * Component for selecting which children to filter activities by.
 * Shows child avatars/chips in a horizontal scroll, with "All" option.
 * Premium users can toggle between OR and AND filter modes.
 */
// Default colors if theme not available
const defaultColors = {
  primary: '#E8638B',
  primaryLight: '#FFF0F5',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: '#1A1A2E',
  textSecondary: '#666666',
  border: '#E0E0E0',
  warning: '#F59E0B',
};

const ChildFilterSelector: React.FC<ChildFilterSelectorProps> = ({
  compact = false,
  showModeToggle = true,
  onSelectionChange,
}) => {
  const dispatch = useAppDispatch();
  const colors = defaultColors;

  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds) || [];
  const filterMode = useAppSelector(selectFilterMode) || 'or';
  const subscription = useAppSelector(selectSubscription);

  const isPremium = subscription?.currentPlan?.code === 'premium';
  const allSelected = selectedChildIds.length === children.length && children.length > 0;

  // Calculate child age from dateOfBirth
  const calculateAge = useCallback((dateOfBirth: string): number => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return Math.max(0, Math.min(18, age));
  }, []);

  // Handle selecting all children
  const handleSelectAll = useCallback(() => {
    const allIds = children.map((c: ChildWithPreferences) => c.id);
    dispatch(setSelectedChildIds(allIds));
    onSelectionChange?.(allIds, filterMode);
  }, [children, dispatch, filterMode, onSelectionChange]);

  // Handle toggling a single child
  const handleToggleChild = useCallback((childId: string) => {
    dispatch(toggleChildSelection(childId));

    // Calculate new selection for callback
    const isCurrentlySelected = selectedChildIds.includes(childId);
    let newSelection: string[];
    if (isCurrentlySelected) {
      newSelection = selectedChildIds.filter((id: string) => id !== childId);
      // Don't allow empty selection
      if (newSelection.length === 0) {
        newSelection = [childId];
      }
    } else {
      newSelection = [...selectedChildIds, childId];
    }
    onSelectionChange?.(newSelection, filterMode);
  }, [dispatch, selectedChildIds, filterMode, onSelectionChange]);

  // Handle filter mode toggle
  const handleModeToggle = useCallback(() => {
    if (!isPremium) {
      // Show premium upsell - could navigate to subscription screen
      console.log('[ChildFilterSelector] AND mode requires premium');
      return;
    }

    const newMode: ChildFilterMode = filterMode === 'or' ? 'and' : 'or';
    dispatch(setFilterMode(newMode));
    onSelectionChange?.(selectedChildIds, newMode);
  }, [dispatch, filterMode, isPremium, selectedChildIds, onSelectionChange]);

  // Render child chip
  const renderChildChip = useCallback((child: ChildWithPreferences) => {
    const isSelected = selectedChildIds.includes(child.id);
    const age = calculateAge(child.dateOfBirth);
    const childColor = getChildColor(child.colorId);
    const avatarSize = compact ? 32 : 44;

    return (
      <TouchableOpacity
        key={child.id}
        style={[
          styles.childChip,
          compact && styles.childChipCompact,
          isSelected && { backgroundColor: childColor.hex + '25', borderColor: childColor.hex, borderWidth: 2.5 },
          !isSelected && { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => handleToggleChild(child.id)}
        activeOpacity={0.7}
      >
        <ChildAvatar
          child={child}
          size={avatarSize}
          showBorder={isSelected}
          borderWidth={3}
        />
        {!compact && (
          <View style={styles.childInfo}>
            <Text
              style={[
                styles.childName,
                { color: isSelected ? colors.primary : colors.text },
              ]}
              numberOfLines={1}
            >
              {child.name}
            </Text>
            <Text
              style={[
                styles.childAge,
                { color: colors.textSecondary },
              ]}
            >
              {age} yrs
            </Text>
          </View>
        )}
        {compact && (
          <Text
            style={[
              styles.childNameCompact,
              { color: isSelected ? colors.primary : colors.text },
            ]}
            numberOfLines={1}
          >
            {child.name.split(' ')[0]}
          </Text>
        )}
        {isSelected && (
          <View style={[styles.checkBadge, { backgroundColor: childColor.hex }]}>
            <Icon name="check" size={10} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedChildIds, compact, colors, calculateAge, handleToggleChild]);

  // Don't render if only one child
  if (children.length <= 1) {
    return null;
  }

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All Children Button */}
        <TouchableOpacity
          style={[
            styles.allChip,
            compact && styles.allChipCompact,
            allSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
            !allSelected && { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={handleSelectAll}
          activeOpacity={0.7}
        >
          <Icon
            name="account-group"
            size={compact ? 16 : 20}
            color={allSelected ? colors.background : colors.text}
          />
          {!compact && (
            <Text
              style={[
                styles.allText,
                { color: allSelected ? colors.background : colors.text },
              ]}
            >
              All
            </Text>
          )}
        </TouchableOpacity>

        {/* Child Chips */}
        {children.map(renderChildChip)}

        {/* Filter Mode Toggle */}
        {showModeToggle && children.length > 1 && (
          <TouchableOpacity
            style={[
              styles.modeToggle,
              compact && styles.modeToggleCompact,
              {
                backgroundColor: filterMode === 'and' ? colors.primary : colors.surface,
                borderColor: filterMode === 'and' ? colors.primary : colors.border,
              },
              !isPremium && { opacity: 0.6 },
            ]}
            onPress={handleModeToggle}
            activeOpacity={0.7}
          >
            <Icon
              name={filterMode === 'or' ? 'set-merge' : 'set-center'}
              size={compact ? 14 : 18}
              color={filterMode === 'and' ? colors.background : colors.text}
            />
            {!compact && (
              <Text
                style={[
                  styles.modeText,
                  { color: filterMode === 'and' ? colors.background : colors.text },
                ]}
              >
                {filterMode === 'or' ? 'Any' : 'Together'}
              </Text>
            )}
            {!isPremium && (
              <Icon
                name="crown"
                size={12}
                color={colors.warning}
                style={styles.premiumIcon}
              />
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Mode Description */}
      {!compact && selectedChildIds.length > 1 && (
        <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
          {filterMode === 'or'
            ? 'Showing activities for any selected child'
            : 'Showing activities all children can do together'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  containerCompact: {
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  allChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  allChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  allText: {
    fontSize: 14,
    fontWeight: '600',
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  childChipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  childInfo: {
    marginRight: 4,
  },
  childName: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 80,
  },
  childNameCompact: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 60,
  },
  childAge: {
    fontSize: 11,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginLeft: 8,
  },
  modeToggleCompact: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 4,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  premiumIcon: {
    marginLeft: 2,
  },
  modeDescription: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
});

export default ChildFilterSelector;
