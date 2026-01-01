/**
 * AddToCalendarModal - Shows when user taps calendar button on activity card
 * Allows selecting which child's calendar to add the activity to
 * If no children exist, prompts to add a child first
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import { selectAllChildren, Child } from '../store/slices/childrenSlice';
import {
  linkActivity,
  unlinkActivity,
  selectActivityChildren,
  selectChildActivities
} from '../store/slices/childActivitiesSlice';
import { Activity } from '../types';
import { Colors } from '../theme';

// Calculate age from date of birth
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Avatar colors for children
const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

interface AddToCalendarModalProps {
  visible: boolean;
  activity: Activity;
  onClose: () => void;
  onSuccess?: (childId: string, childName: string, added: boolean) => void;
}

const AddToCalendarModal: React.FC<AddToCalendarModalProps> = ({
  visible,
  activity,
  onClose,
  onSuccess,
}) => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const children = useAppSelector(selectAllChildren);
  const activityChildIds = useAppSelector(selectActivityChildren(activity.id));
  const [loadingChildId, setLoadingChildId] = useState<string | null>(null);

  const handleAddChild = () => {
    onClose();
    // Navigate to add child screen
    navigation.navigate('AddChild');
  };

  const handleToggleChild = async (child: Child) => {
    const isOnCalendar = activityChildIds.includes(child.id);
    setLoadingChildId(child.id);

    try {
      if (isOnCalendar) {
        // Remove from calendar
        await dispatch(unlinkActivity({
          childId: child.id,
          activityId: activity.id
        })).unwrap();
        onSuccess?.(child.id, child.name, false);
      } else {
        // Add to calendar
        await dispatch(linkActivity({
          childId: child.id,
          activityId: activity.id,
          status: 'planned',
        })).unwrap();
        onSuccess?.(child.id, child.name, true);
      }
    } catch (error) {
      console.error('Failed to toggle activity on calendar:', error);
    } finally {
      setLoadingChildId(null);
    }
  };

  const hasChildren = children.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.container, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '20' }]}>
                  <Icon name="calendar-plus" size={28} color={Colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Add to Calendar
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Icon name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Activity name */}
              <Text style={[styles.activityName, { color: colors.textSecondary }]} numberOfLines={2}>
                {activity.name}
              </Text>

              {hasChildren ? (
                <>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Select which child's calendar to add this activity to:
                  </Text>

                  <ScrollView style={styles.childrenList} showsVerticalScrollIndicator={false}>
                    {children.map((child, index) => {
                      const isOnCalendar = activityChildIds.includes(child.id);
                      const isLoading = loadingChildId === child.id;
                      const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
                      const age = calculateAge(child.dateOfBirth);

                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={[
                            styles.childRow,
                            {
                              backgroundColor: isOnCalendar
                                ? Colors.primary + '15'
                                : colors.background,
                              borderColor: isOnCalendar
                                ? Colors.primary
                                : colors.border,
                            }
                          ]}
                          onPress={() => handleToggleChild(child)}
                          disabled={isLoading}
                        >
                          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                            <Text style={styles.avatarText}>{getInitials(child.name)}</Text>
                          </View>
                          <View style={styles.childInfo}>
                            <Text style={[styles.childName, { color: colors.text }]}>
                              {child.name}
                            </Text>
                            <Text style={[styles.childAge, { color: colors.textSecondary }]}>
                              {age} years old
                            </Text>
                          </View>
                          {isLoading ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                          ) : (
                            <View style={[
                              styles.checkbox,
                              {
                                backgroundColor: isOnCalendar ? Colors.primary : 'transparent',
                                borderColor: isOnCalendar ? Colors.primary : colors.border,
                              }
                            ]}>
                              {isOnCalendar && (
                                <Icon name="check" size={16} color="#FFF" />
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.addChildLink}
                    onPress={handleAddChild}
                  >
                    <Icon name="plus" size={18} color={Colors.primary} />
                    <Text style={[styles.addChildLinkText, { color: Colors.primary }]}>
                      Add another child
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* No children - prompt to add */
                <View style={styles.noChildrenContainer}>
                  <View style={[styles.noChildrenIcon, { backgroundColor: colors.background }]}>
                    <Icon name="account-child-outline" size={48} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.noChildrenTitle, { color: colors.text }]}>
                    No Children Added Yet
                  </Text>
                  <Text style={[styles.noChildrenMessage, { color: colors.textSecondary }]}>
                    Add a child profile to start organizing activities on their personal calendar.
                  </Text>
                  <TouchableOpacity
                    style={[styles.addChildButton, { backgroundColor: Colors.primary }]}
                    onPress={handleAddChild}
                  >
                    <Icon name="account-plus" size={20} color="#FFF" />
                    <Text style={styles.addChildButtonText}>Add Your First Child</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Done button */}
              {hasChildren && (
                <TouchableOpacity
                  style={[styles.doneButton, { backgroundColor: Colors.primary }]}
                  onPress={onClose}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  activityName: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  childrenList: {
    maxHeight: 280,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  childAge: {
    fontSize: 13,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addChildLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  addChildLinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  noChildrenContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noChildrenIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noChildrenTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  noChildrenMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  addChildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addChildButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddToCalendarModal;
