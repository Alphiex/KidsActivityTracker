import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { Activity } from '../../types';
import { Child } from '../../store/slices/childrenSlice';
import childrenService, { ChildActivity } from '../../services/childrenService';
import { shareActivityViaEmail } from '../../utils/sharing';

interface AssignActivityToChildModalProps {
  visible: boolean;
  activity: Activity;
  onClose: () => void;
}

const AssignActivityToChildModal = ({ visible, activity, onClose }: AssignActivityToChildModalProps) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignedChildren, setAssignedChildren] = useState<{ [childId: string]: ChildActivity | null }>({});
  
  const calculateAge = (dateOfBirth: string): number => {
    try {
      const today = new Date();
      // Parse date as local date, not UTC
      // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.SSSZ" formats
      const datePart = dateOfBirth.split('T')[0];
      const parts = datePart.split('-');
      const birthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return age;
    } catch (error) {
      return 0;
    }
  };

  useEffect(() => {
    if (visible) {
      loadChildrenAndAssignments();
    }
  }, [visible]);

  const loadChildrenAndAssignments = async () => {
    try {
      setLoading(true);
      const loadedChildren = await childrenService.getChildren();
      setChildren(loadedChildren);

      // Check which children already have this activity assigned
      const assignments: { [childId: string]: ChildActivity | null } = {};
      for (const child of loadedChildren) {
        const childActivities = await childrenService.getChildActivitiesList(child.id);
        const existingAssignment = childActivities.find(ca => ca.activityId === activity.id);
        assignments[child.id] = existingAssignment || null;
      }
      setAssignedChildren(assignments);
    } catch (error) {
      console.error('Error loading children:', error);
      Alert.alert('Error', 'Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignActivity = async (child: Child) => {
    try {
      const existingAssignment = assignedChildren[child.id];
      
      if (existingAssignment) {
        // If already assigned, show options to update status
        Alert.alert(
          'Update Activity Status',
          `This activity is already assigned to ${child.name}. What would you like to do?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Share via Email',
              onPress: () => shareActivityViaEmail({ 
                activity, 
                child, 
                status: existingAssignment.status 
              }),
            },
            {
              text: 'Mark as Planned',
              onPress: () => updateActivityStatus(existingAssignment.id, 'planned'),
            },
            {
              text: 'Mark as In Progress',
              onPress: () => updateActivityStatus(existingAssignment.id, 'in_progress'),
            },
            {
              text: 'Mark as Completed',
              onPress: () => updateActivityStatus(existingAssignment.id, 'completed'),
            },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => removeActivity(existingAssignment.id, child.id),
            },
          ]
        );
      } else {
        // Assign new activity
        const newAssignment = await childrenService.addActivityToChild(child.id, activity.id, 'planned');
        setAssignedChildren(prev => ({
          ...prev,
          [child.id]: newAssignment,
        }));
        Alert.alert(
          'Success', 
          `Activity assigned to ${child.name}`,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Share via Email', 
              onPress: () => shareActivityViaEmail({ activity, child, status: 'planned' })
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to assign activity');
    }
  };

  const updateActivityStatus = async (childActivityId: string, status: ChildActivity['status']) => {
    try {
      await childrenService.updateActivityStatus(childActivityId, status);
      await loadChildrenAndAssignments();
      Alert.alert('Success', 'Activity status updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update activity status');
    }
  };

  const removeActivity = async (childActivityId: string, childId: string) => {
    try {
      await childrenService.removeActivityFromChild(childId, childActivityId);
      setAssignedChildren(prev => ({
        ...prev,
        [childId]: null,
      }));
      Alert.alert('Success', 'Activity removed');
    } catch (error) {
      Alert.alert('Error', 'Failed to remove activity');
    }
  };

  const getStatusIcon = (status?: ChildActivity['status']) => {
    switch (status) {
      case 'planned':
        return { name: 'calendar-clock', color: colors.primary };
      case 'in_progress':
        return { name: 'progress-clock', color: colors.warning };
      case 'completed':
        return { name: 'check-circle', color: colors.success };
      default:
        return { name: 'plus-circle', color: colors.textSecondary };
    }
  };

  const renderChild = ({ item }: { item: Child }) => {
    const assignment = assignedChildren[item.id];
    const statusIcon = getStatusIcon(assignment?.status);
    const age = calculateAge(item.dateOfBirth);

    return (
      <TouchableOpacity
        style={[styles.childItem, { backgroundColor: colors.surface }]}
        onPress={() => handleAssignActivity(item)}
      >
        <View style={styles.childInfo}>
          <Text style={[styles.childName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.childAge, { color: colors.textSecondary }]}>{age} years old</Text>
          {assignment && (
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Status: {assignment.status.replace('_', ' ')}
            </Text>
          )}
        </View>
        <View style={styles.childActions}>
          {assignment && (
            <TouchableOpacity
              style={styles.shareIconButton}
              onPress={() => shareActivityViaEmail({ activity, child: item, status: assignment.status })}
            >
              <Icon name="share-variant" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          <Icon name={statusIcon.name} size={24} color={statusIcon.color} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Assign Activity to Child</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.activityInfo}>
            <Text style={[styles.activityName, { color: colors.text }]}>{activity.name}</Text>
            <Text style={[styles.activityDetails, { color: colors.textSecondary }]}>
              {activity.ageRange ? `Ages ${activity.ageRange.min}-${activity.ageRange.max}` : ''}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : children.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="account-child-circle" size={60} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No children added yet
              </Text>
              <TouchableOpacity
                style={[styles.addChildButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  onClose();
                  // Navigate to Friends & Family screen with param to open add child modal
                  navigation.navigate('FriendsAndFamily' as never, { openAddChild: true } as never);
                }}
              >
                <Text style={styles.addChildButtonText}>Add Child</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={children}
              renderItem={renderChild}
              keyExtractor={(item) => item.id}
              style={styles.childrenList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  activityInfo: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 14,
  },
  childrenList: {
    paddingHorizontal: 20,
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 10,
    borderRadius: 12,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  childActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareIconButton: {
    padding: 8,
    marginRight: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  addChildButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  addChildButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AssignActivityToChildModal;