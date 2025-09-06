import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  fetchChildActivityHistory,
  updateActivityStatus,
  unlinkActivity,
  selectChildActivitiesLoading,
  ActivityStatus,
} from '../../store/slices/childActivitiesSlice';
import { ChildActivity } from '../../services/childActivityService';

type FilterStatus = ActivityStatus | 'all';

const ChildActivityHistoryScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectChildActivitiesLoading);
  
  const { childId, childName } = route.params as { childId: string; childName: string };
  
  const [activities, setActivities] = useState<ChildActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedActivity, setSelectedActivity] = useState<ChildActivity | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editRating, setEditRating] = useState<number | null>(null);

  useEffect(() => {
    loadActivityHistory();
  }, [childId, filterStatus]);

  const loadActivityHistory = async () => {
    try {
      const filters: any = { childId };
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }
      
      const result = await dispatch(fetchChildActivityHistory(filters)).unwrap();
      setActivities(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to load activity history');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivityHistory();
    setRefreshing(false);
  };

  const handleStatusChange = async (activity: ChildActivity, newStatus: ActivityStatus) => {
    try {
      await dispatch(updateActivityStatus({
        childId: activity.childId,
        activityId: activity.activityId,
        input: { status: newStatus },
      })).unwrap();
      
      await loadActivityHistory();
      Alert.alert('Success', 'Activity status updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update activity status');
    }
  };

  const handleEditActivity = (activity: ChildActivity) => {
    setSelectedActivity(activity);
    setEditNotes(activity.notes || '');
    setEditRating(activity.rating || null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedActivity) return;

    try {
      await dispatch(updateActivityStatus({
        childId: selectedActivity.childId,
        activityId: selectedActivity.activityId,
        input: {
          status: selectedActivity.status,
          notes: editNotes,
          rating: editRating || undefined,
        },
      })).unwrap();
      
      setShowEditModal(false);
      await loadActivityHistory();
      Alert.alert('Success', 'Activity updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update activity');
    }
  };

  const handleRemoveActivity = async (activity: ChildActivity) => {
    Alert.alert(
      'Remove Activity',
      'Are you sure you want to remove this activity from the child\'s history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(unlinkActivity({
                childId: activity.childId,
                activityId: activity.activityId,
              })).unwrap();
              
              await loadActivityHistory();
              Alert.alert('Success', 'Activity removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove activity');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: ActivityStatus) => {
    switch (status) {
      case 'interested': return '#FFA500';
      case 'registered': return '#4CAF50';
      case 'completed': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusIcon = (status: ActivityStatus) => {
    switch (status) {
      case 'interested': return 'star-border';
      case 'registered': return 'check-circle';
      case 'completed': return 'done-all';
      case 'cancelled': return 'cancel';
      default: return 'help-outline';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'interested', label: 'Interested' },
    { value: 'registered', label: 'Registered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const renderActivityCard = (item: ChildActivity) => {
    const activity = item.activity;
    if (!activity) return null;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.activityCard}
        onPress={() => navigation.navigate('ActivityDetail', { activity })}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityInfo}>
            <Text style={styles.activityName}>{activity.name}</Text>
            <View style={styles.statusBadge}>
              <Icon
                name={getStatusIcon(item.status)}
                size={16}
                color={getStatusColor(item.status)}
              />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => handleEditActivity(item)}
          >
            <Icon name="more-vert" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.activityDetails}>
          <View style={styles.detailRow}>
            <Icon name="calendar-today" size={16} color="#666" />
            <Text style={styles.detailText}>
              {activity.dateRange 
                ? `${formatDate(activity.dateRange.start)} - ${formatDate(activity.dateRange.end)}`
                : 'Date TBD'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="location-on" size={16} color="#666" />
            <Text style={styles.detailText}>
              {typeof activity.location === 'string' 
                ? activity.location 
                : activity.location?.name || 'Location TBD'}
            </Text>
          </View>
          {item.rating && (
            <View style={styles.detailRow}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.detailText}>Rating: {item.rating}/5</Text>
            </View>
          )}
        </View>

        {item.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes:</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        <View style={styles.activityActions}>
          {item.status === 'interested' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.registerButton]}
              onPress={() => handleStatusChange(item, 'registered')}
            >
              <Icon name="check-circle" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Register</Text>
            </TouchableOpacity>
          )}
          {item.status === 'registered' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => handleStatusChange(item, 'completed')}
            >
              <Icon name="done-all" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Mark Complete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveActivity(item)}
          >
            <Icon name="delete-outline" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{childName}'s Activities</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filterOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterChip,
              filterStatus === option.value && styles.filterChipActive,
            ]}
            onPress={() => setFilterStatus(option.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === option.value && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading && activities.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="history" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No activities found</Text>
            <Text style={styles.emptySubtext}>
              {filterStatus === 'all' 
                ? 'Start by registering your child for activities'
                : `No ${filterStatus} activities`}
            </Text>
          </View>
        ) : (
          activities.map(renderActivityCard)
        )}
      </ScrollView>

      {/* Edit Modal */}
      {showEditModal && selectedActivity && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Activity</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add notes about this activity..."
                multiline
                numberOfLines={4}
              />

              {selectedActivity.status === 'completed' && (
                <>
                  <Text style={styles.inputLabel}>Rating</Text>
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setEditRating(star)}
                      >
                        <Icon
                          name={star <= (editRating || 0) ? 'star' : 'star-border'}
                          size={32}
                          color="#FFD700"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  filterContainer: {
    backgroundColor: '#fff',
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4CAF50',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  moreButton: {
    padding: 4,
  },
  activityDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  notesSection: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
  },
  activityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  registerButton: {
    backgroundColor: '#4CAF50',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  removeButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ChildActivityHistoryScreen;