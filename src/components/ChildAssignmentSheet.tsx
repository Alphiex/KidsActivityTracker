/**
 * ChildAssignmentSheet - Bottom sheet for assigning activities to children
 * Used for favorite, watching, and calendar actions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppSelector, useAppDispatch } from '../store';
import { selectAllChildren, Child } from '../store/slices/childrenSlice';
import {
  addChildFavorite,
  removeChildFavorite,
  addChildWatching,
  removeChildWatching,
  joinChildWaitlist,
  leaveChildWaitlist,
  selectChildrenWhoFavoritedWithDetails,
  selectChildrenWatchingWithDetails,
  selectChildrenOnWaitlistWithDetails,
} from '../store/slices/childFavoritesSlice';
import {
  linkActivity,
  unlinkActivity,
  selectActivityChildren,
} from '../store/slices/childActivitiesSlice';
import { Activity } from '../types';
import { Colors } from '../theme';
import { ChildAvatar } from './children';
import { getChildColor } from '../theme/childColors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

export type ActionType = 'favorite' | 'watching' | 'waitlist' | 'calendar';

interface ChildAssignmentSheetProps {
  visible: boolean;
  actionType: ActionType;
  activity: Activity;
  onClose: () => void;
  onSuccess?: (childId: string, childName: string, added: boolean) => void;
}

const ACTION_CONFIG = {
  favorite: {
    icon: 'heart',
    title: 'Add to Favorites',
    color: Colors.primary,
  },
  watching: {
    icon: 'bell-ring',
    title: 'Watch for Spots',
    color: '#FFB800',
  },
  waitlist: {
    icon: 'account-clock',
    title: 'Join Waiting List',
    color: '#8B5CF6',
  },
  calendar: {
    icon: 'calendar-plus',
    title: 'Add to Calendar',
    color: '#4ECDC4',
  },
};

const ChildAssignmentSheet: React.FC<ChildAssignmentSheetProps> = ({
  visible,
  actionType,
  activity,
  onClose,
  onSuccess,
}) => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const children = useAppSelector(selectAllChildren);

  // Get current assignment status based on action type
  const favoriteChildIds = useAppSelector(selectChildrenWhoFavoritedWithDetails(activity.id))
    .map(c => c.childId);
  const watchingChildIds = useAppSelector(selectChildrenWatchingWithDetails(activity.id))
    .map(c => c.childId);
  const waitlistChildIds = useAppSelector(selectChildrenOnWaitlistWithDetails(activity.id))
    .map(c => c.childId);
  const calendarChildIds = useAppSelector(selectActivityChildren(activity.id));

  const [loadingChildId, setLoadingChildId] = useState<string | null>(null);
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));

  // Get the assigned child IDs based on action type
  const getAssignedChildIds = (): string[] => {
    switch (actionType) {
      case 'favorite':
        return favoriteChildIds;
      case 'watching':
        return watchingChildIds;
      case 'waitlist':
        return waitlistChildIds;
      case 'calendar':
        return calendarChildIds;
      default:
        return [];
    }
  };

  const assignedChildIds = getAssignedChildIds();
  const config = ACTION_CONFIG[actionType];

  // Animate sheet in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleAddChild = () => {
    onClose();
    navigation.navigate('FriendsAndFamily' as never, { openAddChild: true } as never);
  };

  const handleToggleChild = async (child: Child) => {
    console.log('[ChildAssignmentSheet] handleToggleChild called for:', child.name, 'actionType:', actionType);
    console.log('[ChildAssignmentSheet] child.id:', child.id, 'activity.id:', activity.id);
    const isAssigned = assignedChildIds.includes(child.id);
    console.log('[ChildAssignmentSheet] isAssigned:', isAssigned, 'assignedChildIds:', assignedChildIds);
    setLoadingChildId(child.id);

    try {
      if (actionType === 'favorite') {
        if (isAssigned) {
          console.log('[ChildAssignmentSheet] Removing favorite...');
          await dispatch(removeChildFavorite({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Remove favorite SUCCESS');
        } else {
          console.log('[ChildAssignmentSheet] Adding favorite...');
          await dispatch(addChildFavorite({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Add favorite SUCCESS');
        }
      } else if (actionType === 'watching') {
        if (isAssigned) {
          console.log('[ChildAssignmentSheet] Removing watching...');
          await dispatch(removeChildWatching({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Remove watching SUCCESS');
        } else {
          console.log('[ChildAssignmentSheet] Adding watching...');
          await dispatch(addChildWatching({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Add watching SUCCESS');
        }
      } else if (actionType === 'waitlist') {
        if (isAssigned) {
          console.log('[ChildAssignmentSheet] Leaving waitlist...');
          await dispatch(leaveChildWaitlist({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Leave waitlist SUCCESS');
        } else {
          console.log('[ChildAssignmentSheet] Joining waitlist...');
          await dispatch(joinChildWaitlist({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Join waitlist SUCCESS');
        }
      } else if (actionType === 'calendar') {
        if (isAssigned) {
          console.log('[ChildAssignmentSheet] Unlinking activity...');
          await dispatch(unlinkActivity({ childId: child.id, activityId: activity.id })).unwrap();
          console.log('[ChildAssignmentSheet] Unlink SUCCESS');
        } else {
          console.log('[ChildAssignmentSheet] Linking activity...');
          await dispatch(linkActivity({
            childId: child.id,
            activityId: activity.id,
            status: 'planned',
          })).unwrap();
          console.log('[ChildAssignmentSheet] Link SUCCESS');
        }
      }
      console.log('[ChildAssignmentSheet] Calling onSuccess');
      onSuccess?.(child.id, child.name, !isAssigned);
    } catch (error: any) {
      console.error(`[ChildAssignmentSheet] Failed to toggle ${actionType}:`, error);
      console.error('[ChildAssignmentSheet] Error message:', error?.message);
      console.error('[ChildAssignmentSheet] Error response:', error?.response?.data);
    } finally {
      setLoadingChildId(null);
    }
  };

  const hasChildren = children.length > 0;

  console.log('[ChildAssignmentSheet] visible:', visible, 'actionType:', actionType, 'children:', children.length);
  console.log('[ChildAssignmentSheet] activity.id:', activity.id);
  console.log('[ChildAssignmentSheet] favoriteChildIds:', favoriteChildIds);
  console.log('[ChildAssignmentSheet] watchingChildIds:', watchingChildIds);
  console.log('[ChildAssignmentSheet] waitlistChildIds:', waitlistChildIds);
  console.log('[ChildAssignmentSheet] calendarChildIds:', calendarChildIds);
  console.log('[ChildAssignmentSheet] assignedChildIds:', assignedChildIds);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable style={{ width: '100%' }} onPress={() => {}}>
          <Animated.View
            style={[
              styles.container,
              {
                backgroundColor: colors.surface,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
              {/* Drag handle */}
              <View style={styles.dragHandleContainer}>
                <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
                  <Icon name={config.icon} size={28} color={config.color} />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {config.title}
                  </Text>
                  <Text style={[styles.activityName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {activity.name}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Icon name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {hasChildren ? (
                <>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Select children (tap to toggle):
                  </Text>

                  <ScrollView style={styles.childrenList} showsVerticalScrollIndicator={false}>
                    {children.map((child) => {
                      const isAssigned = assignedChildIds.includes(child.id);
                      const isLoading = loadingChildId === child.id;
                      const childColor = getChildColor(child.colorId);
                      const age = calculateAge(child.dateOfBirth);

                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={[
                            styles.childRow,
                            {
                              backgroundColor: isAssigned
                                ? childColor.hex + '15'
                                : colors.background,
                              borderColor: isAssigned
                                ? childColor.hex
                                : colors.border,
                            }
                          ]}
                          onPress={() => handleToggleChild(child)}
                          disabled={isLoading}
                        >
                          <ChildAvatar child={child} size={48} showBorder={isAssigned} borderWidth={3} />
                          <View style={styles.childInfo}>
                            <Text style={[styles.childName, { color: colors.text }]}>
                              {child.name}
                            </Text>
                            <Text style={[styles.childAge, { color: colors.textSecondary }]}>
                              {age} {age === 1 ? 'year' : 'years'} old
                            </Text>
                          </View>
                          {isLoading ? (
                            <ActivityIndicator size="small" color={childColor.hex} />
                          ) : (
                            <View style={[
                              styles.checkbox,
                              {
                                backgroundColor: isAssigned ? childColor.hex : 'transparent',
                                borderColor: isAssigned ? childColor.hex : colors.border,
                              }
                            ]}>
                              {isAssigned && (
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

                  {/* Done button */}
                  <TouchableOpacity
                    style={[styles.doneButton, { backgroundColor: Colors.primary }]}
                    onPress={onClose}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>

                  {/* Cancel link */}
                  <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                      Cancel
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
                    Add a child profile to start saving activities for them.
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
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34, // Safe area padding
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  activityName: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
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
  childInfo: {
    flex: 1,
    marginLeft: 12,
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
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
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
});

export default ChildAssignmentSheet;
