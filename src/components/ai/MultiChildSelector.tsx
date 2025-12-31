import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MultiChildMode } from '../../types/ai';

interface Child {
  id: string;
  name: string;
  age: number;
}

interface MultiChildSelectorProps {
  children: Child[];
  selectedChildIds: string[];
  mode: MultiChildMode;
  onSelectionChange: (childIds: string[]) => void;
  onModeChange: (mode: MultiChildMode) => void;
}

const MODE_OPTIONS: { value: MultiChildMode; label: string; icon: string; description: string }[] = [
  {
    value: 'together',
    label: 'Together',
    icon: 'account-group',
    description: 'Activities all kids can do at the same time',
  },
  {
    value: 'parallel',
    label: 'Parallel',
    icon: 'arrow-split-vertical',
    description: 'Different activities at the same location/time',
  },
  {
    value: 'any',
    label: 'Any',
    icon: 'account-multiple',
    description: 'Best activities for each child individually',
  },
];

/**
 * Multi-child selector for AI recommendations
 * Allows selecting which children to optimize for and the optimization mode
 */
export const MultiChildSelector: React.FC<MultiChildSelectorProps> = ({
  children,
  selectedChildIds,
  mode,
  onSelectionChange,
  onModeChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // If only one child, don't show selector
  if (children.length <= 1) {
    return null;
  }

  const toggleChild = (childId: string) => {
    if (selectedChildIds.includes(childId)) {
      // Can't deselect if only one selected
      if (selectedChildIds.length > 1) {
        onSelectionChange(selectedChildIds.filter(id => id !== childId));
      }
    } else {
      onSelectionChange([...selectedChildIds, childId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(children.map(c => c.id));
  };

  const renderChildChip = (child: Child) => {
    const isSelected = selectedChildIds.includes(child.id);
    return (
      <TouchableOpacity
        key={child.id}
        style={[styles.childChip, isSelected && styles.childChipSelected]}
        onPress={() => toggleChild(child.id)}
      >
        <View style={[styles.childAvatar, isSelected && styles.childAvatarSelected]}>
          <Text style={[styles.childInitial, isSelected && styles.childInitialSelected]}>
            {child.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.childInfo}>
          <Text style={[styles.childName, isSelected && styles.childNameSelected]}>
            {child.name}
          </Text>
          <Text style={[styles.childAge, isSelected && styles.childAgeSelected]}>
            {child.age} years
          </Text>
        </View>
        {isSelected && (
          <Icon name="check-circle" size={18} color="#10B981" />
        )}
      </TouchableOpacity>
    );
  };

  const renderModeOption = (option: typeof MODE_OPTIONS[0]) => {
    const isActive = mode === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        style={[styles.modeOption, isActive && styles.modeOptionActive]}
        onPress={() => onModeChange(option.value)}
      >
        <Icon
          name={option.icon}
          size={24}
          color={isActive ? '#6B46C1' : '#6B7280'}
        />
        <Text style={[styles.modeLabel, isActive && styles.modeLabelActive]}>
          {option.label}
        </Text>
        {isActive && (
          <Text style={styles.modeDescription}>{option.description}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.headerLeft}>
          <Icon name="account-child-circle" size={22} color="#6B46C1" />
          <View>
            <Text style={styles.headerTitle}>
              {selectedChildIds.length === children.length
                ? 'All Children'
                : `${selectedChildIds.length} Child${selectedChildIds.length > 1 ? 'ren' : ''} Selected`}
            </Text>
            <Text style={styles.headerSubtitle}>
              Mode: {MODE_OPTIONS.find(m => m.value === mode)?.label}
            </Text>
          </View>
        </View>
        <Icon
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.content}>
          {/* Child selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Select Children</Text>
              <TouchableOpacity onPress={selectAll}>
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.childrenContainer}>
              {children.map(child => renderChildChip(child))}
            </View>
          </View>

          {/* Mode selection - only show when 2+ children selected */}
          {selectedChildIds.length >= 2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Optimization Mode</Text>
              <View style={styles.modesContainer}>
                {MODE_OPTIONS.map(option => renderModeOption(option))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  selectAllText: {
    fontSize: 13,
    color: '#6B46C1',
    fontWeight: '500',
  },
  childrenContainer: {
    gap: 8,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  childChipSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  childAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarSelected: {
    backgroundColor: '#10B981',
  },
  childInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  childInitialSelected: {
    color: '#FFFFFF',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  childNameSelected: {
    color: '#065F46',
  },
  childAge: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  childAgeSelected: {
    color: '#059669',
  },
  modesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  modeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modeOptionActive: {
    borderColor: '#6B46C1',
    backgroundColor: '#F3E8FF',
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 6,
  },
  modeLabelActive: {
    color: '#6B46C1',
  },
  modeDescription: {
    fontSize: 10,
    color: '#6B46C1',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 14,
  },
});

export default MultiChildSelector;
