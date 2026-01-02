/**
 * ChildWaitlistButton - Child-centric waitlist button component
 * Shows which children are on waitlist for an activity and allows toggling per child
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppSelector, useAppDispatch } from '../store';
import { selectSelectedChildIds, selectAllChildren } from '../store/slices/childrenSlice';
import {
  fetchActivityStatus,
  joinChildWaitlist,
  leaveChildWaitlist,
  selectActivityStatus,
  selectStatusLoading,
} from '../store/slices/childFavoritesSlice';
import { useTheme } from '../contexts/ThemeContext';

interface ChildWaitlistButtonProps {
  activityId: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

const ChildWaitlistButton: React.FC<ChildWaitlistButtonProps> = ({
  activityId,
  size = 'medium',
  showLabel = false,
  onPress: customOnPress,
  disabled = false,
}) => {
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedChildIds = useAppSelector(selectSelectedChildIds);
  const allChildren = useAppSelector(selectAllChildren);
  const activityStatus = useAppSelector(selectActivityStatus(activityId));
  const isLoading = useAppSelector(selectStatusLoading);

  // Get children that are currently selected
  const selectedChildren = allChildren.filter(c => selectedChildIds.includes(c.id));

  // Calculate waitlist state
  const childrenOnWaitlist = activityStatus.filter(s => s.isOnWaitlist);
  const anyChildOnWaitlist = childrenOnWaitlist.length > 0;

  // Fetch status when component mounts or refreshes
  useEffect(() => {
    if (selectedChildIds.length > 0) {
      dispatch(fetchActivityStatus({ activityId, childIds: selectedChildIds }));
    }
  }, [activityId, selectedChildIds, refreshKey, dispatch]);

  const handlePress = useCallback(() => {
    if (customOnPress) {
      customOnPress();
      return;
    }

    // If only one child, toggle directly
    if (selectedChildren.length === 1) {
      const child = selectedChildren[0];
      const status = activityStatus.find(s => s.childId === child.id);
      const isOnWaitlist = status?.isOnWaitlist || false;

      if (isOnWaitlist) {
        dispatch(leaveChildWaitlist({ childId: child.id, activityId }));
      } else {
        dispatch(joinChildWaitlist({ childId: child.id, activityId }));
      }
      setRefreshKey(k => k + 1);
    } else {
      // Multiple children - show modal to select
      setModalVisible(true);
    }
  }, [selectedChildren, activityStatus, activityId, customOnPress, dispatch]);

  const handleToggleChild = useCallback(async (childId: string) => {
    const status = activityStatus.find(s => s.childId === childId);
    const isOnWaitlist = status?.isOnWaitlist || false;

    try {
      if (isOnWaitlist) {
        await dispatch(leaveChildWaitlist({ childId, activityId })).unwrap();
      } else {
        await dispatch(joinChildWaitlist({ childId, activityId })).unwrap();
      }
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Failed to toggle waitlist:', error);
    }
  }, [activityStatus, activityId, dispatch]);

  const getIconSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 32;
      default: return 24;
    }
  };

  const getButtonStyle = () => {
    switch (size) {
      case 'small': return styles.buttonSmall;
      case 'large': return styles.buttonLarge;
      default: return styles.buttonMedium;
    }
  };

  const renderChildItem = ({ item }: { item: { id: string; name: string } }) => {
    const status = activityStatus.find(s => s.childId === item.id);
    const isOnWaitlist = status?.isOnWaitlist || false;

    return (
      <TouchableOpacity
        style={[styles.childItem, { borderBottomColor: colors.border }]}
        onPress={() => handleToggleChild(item.id)}
      >
        <View style={styles.childInfo}>
          <Icon name="account" size={24} color={colors.textSecondary} />
          <Text style={[styles.childName, { color: colors.text }]}>{item.name}</Text>
        </View>
        <View style={[
          styles.waitlistToggle,
          { backgroundColor: isOnWaitlist ? '#E8F4FF' : colors.background }
        ]}>
          <Icon
            name={isOnWaitlist ? 'bell-ring' : 'bell-outline'}
            size={24}
            color={isOnWaitlist ? '#007AFF' : colors.textSecondary}
          />
          <Text style={[
            styles.waitlistStatus,
            { color: isOnWaitlist ? '#007AFF' : colors.textSecondary }
          ]}>
            {isOnWaitlist ? 'On List' : 'Join'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (selectedChildIds.length === 0) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          getButtonStyle(),
          { backgroundColor: anyChildOnWaitlist ? '#E8F4FF' : colors.surface },
          disabled && styles.disabled,
        ]}
        onPress={handlePress}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <>
            <Icon
              name={anyChildOnWaitlist ? 'bell-ring' : 'bell-outline'}
              size={getIconSize()}
              color={anyChildOnWaitlist ? '#007AFF' : colors.textSecondary}
            />
            {showLabel && (
              <Text
                style={[
                  styles.label,
                  { color: anyChildOnWaitlist ? '#007AFF' : colors.textSecondary },
                ]}
              >
                {anyChildOnWaitlist ? 'Waitlist' : 'Notify Me'}
              </Text>
            )}
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Join Waitlist
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Get notified when spots become available
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedChildren}
              keyExtractor={item => item.id}
              renderItem={renderChildItem}
              style={styles.childList}
            />

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  buttonMedium: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  buttonLarge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  childList: {
    flexGrow: 0,
  },
  childItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childName: {
    fontSize: 16,
    fontWeight: '500',
  },
  waitlistToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  waitlistStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  doneButton: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChildWaitlistButton;
