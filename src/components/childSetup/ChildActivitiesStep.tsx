import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../../services/activityService';

const { width: screenWidth } = Dimensions.get('window');

export interface ChildActivitiesData {
  preferredActivityTypes: string[];
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

interface ActivityType {
  code: string;
  name: string;
  iconName?: string;
  activityCount?: number;
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

  useEffect(() => {
    const loadActivityTypes = async () => {
      try {
        const types = await activityService.getActivityTypesWithCounts(false);
        const sortedTypes = types.sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0));
        setActivityTypes(sortedTypes);
      } catch (error) {
        console.error('[ChildActivitiesStep] Error loading activity types:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadActivityTypes();
  }, [activityService]);

  const toggleType = useCallback((typeName: string) => {
    const newTypes = data.preferredActivityTypes.includes(typeName)
      ? data.preferredActivityTypes.filter(t => t !== typeName)
      : [...data.preferredActivityTypes, typeName];

    onChange({ ...data, preferredActivityTypes: newTypes });
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

      {/* Activity Types Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        {activityTypes.map((type) => {
          const isSelected = data.preferredActivityTypes.includes(type.name);
          return (
            <TouchableOpacity
              key={type.code}
              style={[styles.typeCard, isSelected && styles.typeCardSelected]}
              onPress={() => toggleType(type.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                <Icon
                  name={type.iconName || 'tag'}
                  size={24}
                  color={isSelected ? '#FFFFFF' : '#E8638B'}
                />
              </View>
              <Text style={[styles.typeName, isSelected && styles.typeNameSelected]} numberOfLines={2}>
                {type.name}
              </Text>
              {isSelected && (
                <View style={styles.checkmark}>
                  <Icon name="check" size={14} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
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
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 16,
  },
  typeCard: {
    width: (screenWidth - 80) / 3, // Account for padding and gaps
    aspectRatio: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  typeCardSelected: {
    backgroundColor: '#FFF0F5',
    borderWidth: 2,
    borderColor: '#E8638B',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainerSelected: {
    backgroundColor: '#E8638B',
  },
  typeName: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  typeNameSelected: {
    color: '#E8638B',
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E8638B',
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default ChildActivitiesStep;
