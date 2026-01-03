import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../../services/activityService';
import { getActivityTypeIcon } from '../../utils/activityTypeIcons';
import { ModernColors } from '../../theme/modernTheme';

export interface ChildActivitiesData {
  preferredActivityTypes: string[];
  preferredSubtypes?: string[];
}

interface SiblingOption {
  id: string;
  name: string;
  preferredActivityTypes: string[];
}

interface ChildActivitiesStepProps {
  childName: string;
  data: ChildActivitiesData;
  onChange: (data: ChildActivitiesData) => void;
  siblings?: SiblingOption[];
  onCopyFromSibling?: (siblingId: string) => void;
}

interface ActivitySubtype {
  id: string;
  name: string;
  code: string;
  activityCount: number;
}

interface ActivityType {
  code: string;
  name: string;
  iconName?: string;
  activityCount?: number;
  subtypes?: ActivitySubtype[];
}

const ChildActivitiesStep: React.FC<ChildActivitiesStepProps> = ({
  childName,
  data,
  onChange,
  siblings = [],
  onCopyFromSibling,
}) => {
  const activityService = ActivityService.getInstance();

  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadActivityTypes = async () => {
      setLoadError(null);
      try {
        // Pass false to NOT apply global filters - we want ALL activity types for preferences
        const types = await activityService.getActivityTypesWithCounts(false);
        console.log('[ChildActivitiesStep] Loaded activity types:', types?.length || 0);
        if (!types || types.length === 0) {
          console.warn('[ChildActivitiesStep] No activity types returned from API');
          setLoadError('No activity types available');
        }
        const sortedTypes = (types || []).sort((a: ActivityType, b: ActivityType) => (b.activityCount || 0) - (a.activityCount || 0));
        setActivityTypes(sortedTypes);
      } catch (error) {
        console.error('[ChildActivitiesStep] Error loading activity types:', error);
        setLoadError('Failed to load activity types');
      } finally {
        setIsLoading(false);
      }
    };
    loadActivityTypes();
  }, [activityService]);

  const toggleTypeExpand = useCallback((typeCode: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeCode)) {
        next.delete(typeCode);
      } else {
        next.add(typeCode);
      }
      return next;
    });
  }, []);

  const toggleType = useCallback((typeCode: string) => {
    const currentTypes = data.preferredActivityTypes || [];
    const currentSubtypes = data.preferredSubtypes || [];
    const isCurrentlySelected = currentTypes.includes(typeCode);

    // Find the activity type to get its subtypes
    const activityType = activityTypes.find(t => t.code === typeCode);
    const subtypeCodes = activityType?.subtypes?.map(s => s.code) || [];

    if (isCurrentlySelected) {
      // Deselecting - remove type and all its subtypes
      const updatedTypes = currentTypes.filter(code => code !== typeCode);
      const updatedSubtypes = currentSubtypes.filter(code => !subtypeCodes.includes(code));
      onChange({
        ...data,
        preferredActivityTypes: updatedTypes,
        preferredSubtypes: updatedSubtypes,
      });
    } else {
      // Selecting - add type and all its subtypes
      const updatedTypes = [...currentTypes, typeCode];
      const updatedSubtypes = [...new Set([...currentSubtypes, ...subtypeCodes])];
      onChange({
        ...data,
        preferredActivityTypes: updatedTypes,
        preferredSubtypes: updatedSubtypes,
      });
    }
  }, [data, onChange, activityTypes]);

  const toggleSubtype = useCallback((subtypeCode: string) => {
    const currentSubtypes = data.preferredSubtypes || [];
    const updatedSubtypes = currentSubtypes.includes(subtypeCode)
      ? currentSubtypes.filter(code => code !== subtypeCode)
      : [...currentSubtypes, subtypeCode];

    onChange({ ...data, preferredSubtypes: updatedSubtypes });
  }, [data, onChange]);

  const handleCopyFromSibling = (siblingId: string) => {
    const sibling = siblings.find(s => s.id === siblingId);
    if (sibling) {
      onChange({ ...data, preferredActivityTypes: [...sibling.preferredActivityTypes] });
      onCopyFromSibling?.(siblingId);
    }
  };

  const hasSiblings = siblings.length > 0;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8638B" />
        <Text style={styles.loadingText}>Loading activity types...</Text>
      </View>
    );
  }

  if (loadError && activityTypes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={styles.loadingText}>{loadError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setIsLoading(true);
            setLoadError(null);
            activityService.getActivityTypesWithCounts(false).then(types => {
              setActivityTypes((types || []).sort((a: ActivityType, b: ActivityType) => (b.activityCount || 0) - (a.activityCount || 0)));
              setIsLoading(false);
            }).catch(() => {
              setLoadError('Failed to load activity types');
              setIsLoading(false);
            });
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          Select activities {childName} enjoys. This helps us show relevant activities.
        </Text>
      </View>

      {/* Copy from sibling option */}
      {hasSiblings && (
        <View style={styles.copyContainer}>
          <Text style={styles.copyLabel}>Quick setup:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.siblingScroll}>
            {siblings.map((sibling) => (
              <TouchableOpacity
                key={sibling.id}
                style={styles.copyButton}
                onPress={() => handleCopyFromSibling(sibling.id)}
              >
                <Icon name="content-copy" size={14} color="#E8638B" />
                <Text style={styles.copyButtonText}>Copy from {sibling.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Activity Types List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {activityTypes.map((type) => {
          const isSelected = data.preferredActivityTypes.includes(type.code);
          const isExpanded = expandedTypes.has(type.code);
          const hasSubtypes = type.subtypes && type.subtypes.length > 0;
          const iconName = getActivityTypeIcon(type.name);

          return (
            <View key={type.code} style={styles.activityTypeContainer}>
              {/* Main activity type row */}
              <View style={styles.activityTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.activityTypeChip,
                    isSelected && styles.activityTypeChipSelected,
                  ]}
                  onPress={() => toggleType(type.code)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={iconName}
                    size={20}
                    color={isSelected ? '#FFFFFF' : ModernColors.primary}
                  />
                  <Text style={[
                    styles.activityTypeText,
                    isSelected && styles.activityTypeTextSelected,
                  ]}>
                    {type.name}
                  </Text>
                  {isSelected && (
                    <Icon name="check" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                {/* Expand button for subtypes */}
                {hasSubtypes && (
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => toggleTypeExpand(type.code)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Subtypes (when expanded) */}
              {isExpanded && hasSubtypes && (
                <View style={styles.subtypesContainer}>
                  {type.subtypes!.map((subtype) => {
                    const isSubtypeSelected = data.preferredSubtypes?.includes(subtype.code);
                    return (
                      <TouchableOpacity
                        key={subtype.code}
                        style={[
                          styles.subtypeChip,
                          isSubtypeSelected && styles.subtypeChipSelected,
                        ]}
                        onPress={() => toggleSubtype(subtype.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.subtypeText,
                          isSubtypeSelected && styles.subtypeTextSelected,
                        ]}>
                          {subtype.name}
                        </Text>
                        {isSubtypeSelected && (
                          <Icon name="check" size={14} color={ModernColors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Selection count */}
      <View style={styles.selectionInfo}>
        <Icon name="check-circle" size={16} color="#E8638B" />
        <Text style={styles.selectionText}>
          {data.preferredActivityTypes.length === 0
            ? 'No activities selected (will show all types)'
            : `${data.preferredActivityTypes.length} ${data.preferredActivityTypes.length === 1 ? 'type' : 'types'} selected`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  copyContainer: {
    marginBottom: 16,
  },
  copyLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  siblingScroll: {
    flexDirection: 'row',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  copyButtonText: {
    fontSize: 13,
    color: '#E8638B',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 16,
  },
  activityTypeContainer: {
    marginBottom: 12,
  },
  activityTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    gap: 10,
  },
  activityTypeChipSelected: {
    borderColor: ModernColors.primary,
    backgroundColor: ModernColors.primary,
  },
  activityTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  activityTypeTextSelected: {
    color: '#FFFFFF',
  },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtypesContainer: {
    marginTop: 8,
    marginLeft: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  subtypeChipSelected: {
    borderColor: ModernColors.primary,
    backgroundColor: ModernColors.primary + '15',
  },
  subtypeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  subtypeTextSelected: {
    color: ModernColors.primary,
    fontWeight: '600',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  selectionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#E8638B',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ChildActivitiesStep;
