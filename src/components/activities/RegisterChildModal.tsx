import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store';
import { selectAllChildren } from '../../store/slices/childrenSlice';
import { 
  linkActivity, 
  selectActivityChildren,
  selectChildActivityStatus,
  ActivityStatus 
} from '../../store/slices/childActivitiesSlice';

interface RegisterChildModalProps {
  visible: boolean;
  onClose: () => void;
  activityId: string;
  activityName: string;
}

const RegisterChildModal: React.FC<RegisterChildModalProps> = ({
  visible,
  onClose,
  activityId,
  activityName,
}) => {
  const dispatch = useAppDispatch();
  const children = useAppSelector(selectAllChildren);
  const registeredChildIds = useAppSelector(selectActivityChildren(activityId));
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [status, setStatus] = useState<ActivityStatus>('interested');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reset form when modal opens
    if (visible) {
      setSelectedChildId(null);
      setStatus('interested');
      setNotes('');
    }
  }, [visible]);

  const handleRegister = async () => {
    if (!selectedChildId) {
      Alert.alert('Error', 'Please select a child');
      return;
    }

    setLoading(true);
    try {
      await dispatch(linkActivity({
        childId: selectedChildId,
        activityId,
        status,
        notes: notes.trim() || undefined,
      })).unwrap();

      Alert.alert(
        'Success',
        `Child has been ${status === 'registered' ? 'registered for' : 'linked to'} the activity`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to register child for activity');
    } finally {
      setLoading(false);
    }
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

  const statusOptions: { value: ActivityStatus; label: string; icon: string }[] = [
    { value: 'interested', label: 'Interested', icon: 'star-border' },
    { value: 'registered', label: 'Registered', icon: 'check-circle' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Register Child for Activity</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.activityName}>{activityName}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Child</Text>
              {children.map((child) => {
                const childStatus = useAppSelector(selectChildActivityStatus(child.id, activityId));
                const isRegistered = childStatus !== null;
                
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[
                      styles.childOption,
                      selectedChildId === child.id && styles.childOptionSelected,
                      isRegistered && styles.childOptionDisabled,
                    ]}
                    onPress={() => !isRegistered && setSelectedChildId(child.id)}
                    disabled={isRegistered}
                  >
                    <View style={styles.childInfo}>
                      <Text style={[
                        styles.childName,
                        isRegistered && styles.childNameDisabled
                      ]}>
                        {child.name}
                      </Text>
                      {isRegistered && (
                        <Text style={[
                          styles.childStatus,
                          { color: getStatusColor(childStatus) }
                        ]}>
                          {childStatus.charAt(0).toUpperCase() + childStatus.slice(1)}
                        </Text>
                      )}
                    </View>
                    <Icon
                      name={selectedChildId === child.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={24}
                      color={isRegistered ? '#ccc' : (selectedChildId === child.id ? '#4CAF50' : '#666')}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedChildId && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Registration Status</Text>
                  <View style={styles.statusOptions}>
                    {statusOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.statusOption,
                          status === option.value && styles.statusOptionSelected,
                        ]}
                        onPress={() => setStatus(option.value)}
                      >
                        <Icon
                          name={option.icon}
                          size={20}
                          color={status === option.value ? '#fff' : '#666'}
                        />
                        <Text style={[
                          styles.statusOptionText,
                          status === option.value && styles.statusOptionTextSelected,
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add any notes about this registration..."
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.registerButton,
                (!selectedChildId || loading) && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={!selectedChildId || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.registerButtonText}>
                  {status === 'registered' ? 'Register' : 'Add to Interested'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  closeButton: {
    padding: 8,
  },
  modalBody: {
    padding: 20,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  childOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  childOptionSelected: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  childOptionDisabled: {
    opacity: 0.6,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  childNameDisabled: {
    color: '#999',
  },
  childStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 8,
  },
  statusOptionSelected: {
    backgroundColor: '#4CAF50',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  statusOptionTextSelected: {
    color: '#fff',
  },
  notesInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
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
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  registerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default RegisterChildModal;