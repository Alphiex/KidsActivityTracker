import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppSelector } from '../../store';
import { selectAllChildren } from '../../store/slices/childrenSlice';
import { selectActivityChildren, ActivityStatus } from '../../store/slices/childActivitiesSlice';

interface ChildActivityStatusProps {
  activityId: string;
  onPress?: () => void;
  compact?: boolean;
}

const ChildActivityStatus: React.FC<ChildActivityStatusProps> = ({
  activityId,
  onPress,
  compact = false,
}) => {
  const children = useAppSelector(selectAllChildren);
  const registeredChildIds = useAppSelector(selectActivityChildren(activityId));
  
  const registeredChildren = children.filter(child => 
    registeredChildIds.includes(child.id)
  );

  if (registeredChildren.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer}
        onPress={onPress}
        disabled={!onPress}
      >
        <Icon name="child-care" size={16} color="#4CAF50" />
        <Text style={styles.compactText}>
          {registeredChildren.length} {registeredChildren.length === 1 ? 'child' : 'children'} registered
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Icon name="child-care" size={20} color="#4CAF50" />
        <Text style={styles.title}>Registered Children</Text>
      </View>
      <View style={styles.childrenList}>
        {registeredChildren.map((child, index) => (
          <View key={child.id} style={styles.childBadge}>
            <Text style={styles.childName}>{child.name}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  compactText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  childrenList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  childBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  childName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4CAF50',
  },
});

export default ChildActivityStatus;