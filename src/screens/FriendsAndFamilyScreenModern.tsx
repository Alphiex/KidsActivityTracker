import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store';
import childrenService, { Child as ServiceChild, SharedChild as ServiceSharedChild } from '../services/childrenService';

// Airbnb-style colors
const ModernColors = {
  primary: '#14B8A6',
  secondary: '#00A699',
  text: '#222222',
  textLight: '#717171',
  background: '#FFFFFF',
  backgroundLight: '#F7F7F7',
  border: '#DDDDDD',
  borderLight: '#EBEBEB',
  success: '#008A05',
  warning: '#FFA500',
  error: '#C13515',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

interface Child {
  id: string;
  name: string;
  dateOfBirth?: string;
  location?: string;
  avatarUrl?: string;
  activityCount?: number;
  upcomingActivities?: number;
}

interface SharedChild {
  id: string;
  childId: string;
  childName: string;
  sharedBy: string;
  sharedByEmail: string;
  canView: boolean;
  canEdit: boolean;
}

const FriendsAndFamilyScreenModern: React.FC = () => {
  const navigation = useNavigation();
  const user = useAppSelector((state) => state.auth.user);
  const [children, setChildren] = useState<Child[]>([]);
  const [sharedChildren, setSharedChildren] = useState<SharedChild[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [activeTab, setActiveTab] = useState<'myChildren' | 'shared'>('myChildren');

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const [myChildrenData, sharedChildrenData] = await Promise.all([
        childrenService.getMyChildren().catch(err => {
          console.error('Error loading my children:', err);
          // Don't fail completely, just return empty array
          return [];
        }),
        childrenService.getSharedChildren().catch(err => {
          console.error('Error loading shared children:', err);
          // Don't fail completely, just return empty array
          return [];
        }),
      ]);
      setChildren(myChildrenData);
      setSharedChildren(sharedChildrenData as any);
    } catch (error) {
      console.error('Error loading children:', error);
      // Don't alert or block the UI, just show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, []);

  const handleAddChild = () => {
    setEditingChild(null);
    setShowAddChildModal(true);
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setShowAddChildModal(true);
  };

  const handleDeleteChild = (childId: string) => {
    Alert.alert(
      'Delete Child',
      'Are you sure you want to delete this child profile? All associated activities will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await childrenService.deleteChild(childId);
              await loadChildren();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete child profile');
            }
          },
        },
      ]
    );
  };

  const handleChildPress = (child: Child | SharedChild) => {
    navigation.navigate('ChildDetail' as never, {
      childId: 'childId' in child ? child.childId : child.id,
      childName: 'childName' in child ? child.childName : child.name,
      isShared: 'sharedBy' in child,
    } as never);
  };

  const handleShareChild = (child: Child) => {
    navigation.navigate('ShareChild' as never, {
      childId: child.id,
      childName: child.name,
    } as never);
  };

  const renderChildCard = (child: Child) => {
    const age = child.dateOfBirth
      ? Math.floor((Date.now() - new Date(child.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;

    return (
      <TouchableOpacity
        key={child.id}
        style={styles.childCard}
        onPress={() => handleChildPress(child)}
        activeOpacity={0.7}
      >
        <View style={styles.childAvatar}>
          <Icon name="account-child" size={40} color={ModernColors.primary} />
        </View>

        <View style={styles.childInfo}>
          <Text style={styles.childName}>{child.name}</Text>
          {age !== null && (
            <Text style={styles.childAge}>{age} years old</Text>
          )}
          {child.location && (
            <View style={styles.locationRow}>
              <Icon name="map-marker" size={14} color={ModernColors.textLight} />
              <Text style={styles.childLocation}>{child.location}</Text>
            </View>
          )}
          {child.upcomingActivities !== undefined && child.upcomingActivities > 0 && (
            <Text style={styles.activityBadge}>
              {child.upcomingActivities} upcoming {child.upcomingActivities === 1 ? 'activity' : 'activities'}
            </Text>
          )}
        </View>

        <View style={styles.childActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditChild(child)}
          >
            <Icon name="pencil" size={20} color={ModernColors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareChild(child)}
          >
            <Icon name="share-variant" size={20} color={ModernColors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteChild(child.id)}
          >
            <Icon name="delete-outline" size={20} color={ModernColors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSharedChildCard = (sharedChild: SharedChild) => {
    return (
      <TouchableOpacity
        key={sharedChild.id}
        style={styles.childCard}
        onPress={() => handleChildPress(sharedChild)}
        activeOpacity={0.7}
      >
        <View style={styles.childAvatar}>
          <Icon name="account-child" size={40} color={ModernColors.secondary} />
        </View>

        <View style={styles.childInfo}>
          <Text style={styles.childName}>{sharedChild.childName}</Text>
          <Text style={styles.sharedByText}>
            Shared by {sharedChild.sharedBy}
          </Text>
          <Text style={styles.sharedEmail}>{sharedChild.sharedByEmail}</Text>
        </View>

        <View style={styles.childActions}>
          <Icon name="chevron-right" size={24} color={ModernColors.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const isMyChildren = activeTab === 'myChildren';
    return (
      <View style={styles.emptyState}>
        <Icon
          name={isMyChildren ? "account-child-outline" : "share-variant"}
          size={64}
          color={ModernColors.borderLight}
        />
        <Text style={styles.emptyTitle}>
          {isMyChildren ? "No children added yet" : "No shared children"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isMyChildren
            ? "Add your children to track their activities"
            : "When friends share their children with you, they'll appear here"}
        </Text>
        {isMyChildren && (
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddChild}>
            <Text style={styles.emptyButtonText}>Add Your First Child</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends & Family</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddChild}>
          <Icon name="plus" size={24} color={ModernColors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myChildren' && styles.activeTab]}
          onPress={() => setActiveTab('myChildren')}
        >
          <Text style={[styles.tabText, activeTab === 'myChildren' && styles.activeTabText]}>
            My Children
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.activeTab]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.activeTabText]}>
            Shared with Me
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ModernColors.primary} />
          </View>
        ) : (
          <>
            {activeTab === 'myChildren' ? (
              children.length > 0 ? (
                <View style={styles.childrenList}>
                  {children.map(renderChildCard)}
                </View>
              ) : (
                renderEmptyState()
              )
            ) : (
              sharedChildren.length > 0 ? (
                <View style={styles.childrenList}>
                  {sharedChildren.map(renderSharedChildCard)}
                </View>
              ) : (
                renderEmptyState()
              )
            )}
          </>
        )}
      </ScrollView>

      {/* Add/Edit Child Modal */}
      <AddEditChildModal
        visible={showAddChildModal}
        onClose={() => setShowAddChildModal(false)}
        onSave={async (childData) => {
          try {
            if (editingChild) {
              await childrenService.updateChild(editingChild.id, childData);
            } else {
              await childrenService.createChild(childData);
            }
            await loadChildren();
            setShowAddChildModal(false);
            setEditingChild(null);
          } catch (error) {
            console.error('Error saving child:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to save child profile';
            Alert.alert('Error', errorMessage);
          }
        }}
        child={editingChild}
        defaultLocation={user?.location}
      />
    </SafeAreaView>
  );
};

interface AddEditChildModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  child: Child | null;
  defaultLocation?: string;
}

const AddEditChildModal: React.FC<AddEditChildModalProps> = ({
  visible,
  onClose,
  onSave,
  child,
  defaultLocation,
}) => {
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()));

  useEffect(() => {
    if (child) {
      setName(child.name || '');
      if (child.dateOfBirth) {
        // Parse date as local date, not UTC
        // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.SSSZ" formats
        const datePart = child.dateOfBirth.split('T')[0];
        setDateOfBirth(datePart);  // Store just the YYYY-MM-DD part
        const parts = datePart.split('-');
        setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      } else {
        setDateOfBirth('');
      }
      setLocation(child.location || '');
    } else {
      setName('');
      setDateOfBirth('');
      setLocation(defaultLocation || '');
      setSelectedDate(new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()));
    }
  }, [child, defaultLocation, visible]);

  const onDateChange = (event: any, date?: Date) => {
    // On Android, automatically close the picker after selection
    // On iOS, keep it open so user can adjust and then tap elsewhere to close
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (date) {
      setSelectedDate(date);
      // Format date as YYYY-MM-DD in local timezone (not UTC)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setDateOfBirth(`${year}-${month}-${day}`);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Select date';
    // Parse the date string components directly without creating a Date object
    // to avoid timezone and off-by-one issues
    // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.SSSZ" formats
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // month is already 1-indexed in the string, so subtract 1 for array access
    return `${months[month - 1]} ${day}, ${year}`;
  };

  const handleSave = async () => {
    console.log('HandleSave called with:', { name, dateOfBirth, location });

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    setSaving(true);

    // Build child data with required fields
    // Format date as ISO 8601 (YYYY-MM-DDTHH:MM:SS.SSSZ)
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}T00:00:00.000Z`;

    const childData: any = {
      name: name.trim(),
      // Always provide a dateOfBirth in ISO 8601 format
      dateOfBirth: dateOfBirth ? `${dateOfBirth}T00:00:00.000Z` : formattedDate,
    };

    console.log('Saving child data:', childData);

    try {
      await onSave(childData);
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'Failed to save child profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
            <Text style={styles.modalTitle}>
              {child ? 'Edit Child' : 'Add Child'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Child's name"
                placeholderTextColor={ModernColors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth (Optional)</Text>
              {Platform.OS === 'ios' ? (
                <>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => {
                      console.log('Date picker button pressed, current showDatePicker:', showDatePicker);
                      setShowDatePicker(!showDatePicker);
                    }}
                  >
                    <Icon name="calendar" size={20} color={ModernColors.textLight} />
                    <Text style={[styles.datePickerText, !dateOfBirth && styles.placeholderText]}>
                      {dateOfBirth ? formatDate(dateOfBirth) : 'Select date'}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <View style={styles.datePickerContainer}>
                      <DateTimePicker
                        testID="dateTimePicker"
                        value={selectedDate}
                        mode="date"
                        is24Hour={true}
                        display="spinner"
                        onChange={onDateChange}
                        maximumDate={new Date()}
                        minimumDate={new Date(new Date().getFullYear() - 18, 0, 1)}
                        themeVariant="light"
                      />
                      <TouchableOpacity
                        style={styles.datePickerDoneButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.datePickerDoneText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="calendar" size={20} color={ModernColors.textLight} />
                  <Text style={[styles.datePickerText, !dateOfBirth && styles.placeholderText]}>
                    {dateOfBirth ? formatDate(dateOfBirth) : 'Select date'}
                  </Text>
                </TouchableOpacity>
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  testID="dateTimePicker"
                  value={selectedDate}
                  mode="date"
                  is24Hour={true}
                  display="default"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(new Date().getFullYear() - 18, 0, 1)}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location (Optional)</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="City or area"
                placeholderTextColor={ModernColors.textLight}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={ModernColors.background} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  addButton: {
    padding: 5,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: ModernColors.text,
  },
  tabText: {
    fontSize: 16,
    color: ModernColors.textLight,
  },
  activeTabText: {
    color: ModernColors.text,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  childrenList: {
    padding: 20,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ModernColors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ModernColors.borderLight,
  },
  childAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ModernColors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  childLocation: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginLeft: 4,
  },
  activityBadge: {
    fontSize: 14,
    color: ModernColors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  childActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  sharedByText: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 2,
  },
  sharedEmail: {
    fontSize: 12,
    color: ModernColors.textLight,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: ModernColors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: ModernColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: ModernColors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: ModernColors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ModernColors.background,
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
    borderBottomColor: ModernColors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: ModernColors.text,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: ModernColors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: ModernColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: ModernColors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: ModernColors.borderLight,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  saveButton: {
    backgroundColor: ModernColors.primary,
    marginLeft: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.background,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: ModernColors.backgroundLight,
    borderRadius: 8,
    marginTop: 8,
  },
  datePickerText: {
    fontSize: 16,
    color: ModernColors.text,
    marginLeft: 12,
    flex: 1,
  },
  placeholderText: {
    color: ModernColors.textLight,
  },
  datePickerContainer: {
    backgroundColor: ModernColors.backgroundLight,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
    height: 250,
    justifyContent: 'space-between',
  },
  datePickerDoneButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  datePickerDoneText: {
    fontSize: 16,
    color: ModernColors.primary,
    fontWeight: '600',
  },
});

export default FriendsAndFamilyScreenModern;