import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '../store';
import { Child } from '../store/slices/childrenSlice';
import childrenService, { ChildActivity, SharedChild } from '../services/childrenService';

const { width } = Dimensions.get('window');

const FriendsAndFamilyScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [children, setChildren] = useState<Child[]>([]);
  const [sharedChildren, setSharedChildren] = useState<SharedChild[]>([]);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [childName, setChildName] = useState('');
  const [childDateOfBirth, setChildDateOfBirth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 8);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedDay, setSelectedDay] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const childColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD',
    '#00d2d3', '#ff9ff3', '#54a0ff', '#48dbfb', '#1dd1a1',
  ];

  // Generate year options (last 18 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 18 }, (_, i) => currentYear - i);
  
  // Generate month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];
  
  // Generate day options based on selected month and year
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    loadChildren();
  }, []);

  // Adjust selected day if it exceeds days in month
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear]);

  const loadChildren = async () => {
    try {
      const loadedChildren = await childrenService.getChildren();
      // Ensure we have an array
      setChildren(Array.isArray(loadedChildren) ? loadedChildren : []);
    } catch (error) {
      console.error('Error loading children:', error);
      // Use empty array if API fails
      setChildren([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChildren().finally(() => setRefreshing(false));
  };

  const handleAddChild = async () => {
    if (!childName.trim()) {
      Alert.alert('Error', 'Please enter the child\'s name');
      return;
    }

    // Construct date from selected values
    const dateOfBirth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

    try {
      if (editingChild) {
        await childrenService.updateChild(editingChild.id, {
          name: childName.trim(),
          dateOfBirth: dateOfBirth,
        });
      } else {
        await childrenService.createChild({
          name: childName.trim(),
          dateOfBirth: dateOfBirth,
        });
      }
      
      await loadChildren();
      resetModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to save child information');
    }
  };

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setChildName(child.name);
    setChildDateOfBirth(child.dateOfBirth);
    
    // Parse date for pickers
    if (child.dateOfBirth) {
      const date = new Date(child.dateOfBirth);
      setSelectedYear(date.getFullYear());
      setSelectedMonth(date.getMonth() + 1);
      setSelectedDay(date.getDate());
    }
    
    setShowAddChildModal(true);
  };

  const handleDeleteChild = (childId: string) => {
    Alert.alert(
      'Delete Child',
      'Are you sure you want to remove this child? All associated activity records will be deleted.',
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
              Alert.alert('Error', 'Failed to delete child');
            }
          },
        },
      ]
    );
  };

  const resetModal = () => {
    setShowAddChildModal(false);
    setEditingChild(null);
    setChildName('');
    setChildDateOfBirth('');
    setSelectedYear(new Date().getFullYear() - 8);
    setSelectedMonth(1);
    setSelectedDay(1);
  };
  
  const calculateAge = (dateOfBirth: string): number => {
    try {
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
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

  const renderChildCard = ({ item }: { item: Child }) => {
    const age = calculateAge(item.dateOfBirth);
    const avatarColor = childColors[parseInt(item.id) % childColors.length] || childColors[0];
    
    return (
      <TouchableOpacity
        style={[styles.childCard, { backgroundColor: colors.surface }]}
        onPress={() => setSelectedChild(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.childAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.childInitial}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.childInfo}>
          <Text style={[styles.childName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.childAge, { color: colors.textSecondary }]}>
            {age} years old
          </Text>
        </View>
        <View style={styles.childActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditChild(item)}
          >
            <Icon name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { marginLeft: 10 }]}
            onPress={() => handleDeleteChild(item.id)}
          >
            <Icon name="delete" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAddChildModal = () => (
    <Modal
      visible={showAddChildModal}
      animationType="slide"
      transparent={true}
      onRequestClose={resetModal}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {editingChild ? 'Edit Child' : 'Add Child'}
          </Text>
          
          <View style={styles.inputContainer}>
            <Icon name="account-child" size={24} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Child's Name"
              placeholderTextColor={colors.textSecondary}
              value={childName}
              onChangeText={setChildName}
            />
          </View>

          <View style={styles.dateSection}>
            <View style={styles.dateSectionHeader}>
              <Icon name="cake-variant" size={24} color={colors.textSecondary} />
              <Text style={[styles.dateSectionTitle, { color: colors.text }]}>Date of Birth</Text>
            </View>
            
            <View style={styles.datePickerContainer}>
              {/* Year Picker */}
              <View style={styles.pickerWrapper}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Year</Text>
                <View style={[styles.pickerBox, { backgroundColor: colors.inputBackground || '#f5f5f5', borderColor: colors.border }]}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={setSelectedYear}
                    style={[styles.picker, { color: colors.text }]}
                    itemStyle={styles.pickerItem}
                  >
                    {yearOptions.map(year => (
                      <Picker.Item key={year} label={year.toString()} value={year} color={colors.text} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Month Picker */}
              <View style={styles.pickerWrapper}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Month</Text>
                <View style={[styles.pickerBox, { backgroundColor: colors.inputBackground || '#f5f5f5', borderColor: colors.border }]}>
                  <Picker
                    selectedValue={selectedMonth}
                    onValueChange={setSelectedMonth}
                    style={[styles.picker, { color: colors.text }]}
                    itemStyle={styles.pickerItem}
                  >
                    {monthOptions.map(month => (
                      <Picker.Item key={month.value} label={month.label} value={month.value} color={colors.text} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Day Picker */}
              <View style={styles.pickerWrapper}>
                <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Day</Text>
                <View style={[styles.pickerBox, { backgroundColor: colors.inputBackground || '#f5f5f5', borderColor: colors.border }]}>
                  <Picker
                    selectedValue={selectedDay}
                    onValueChange={setSelectedDay}
                    style={[styles.picker, { color: colors.text }]}
                    itemStyle={styles.pickerItem}
                  >
                    {dayOptions.map(day => (
                      <Picker.Item key={day} label={day.toString()} value={day} color={colors.text} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={resetModal}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleAddChild}
            >
              <Text style={styles.saveButtonText}>
                {editingChild ? 'Update' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Friends & Family</Text>
        <Text style={styles.headerSubtitle}>
          Manage your children and share activities
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* My Children Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Children</Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddChildModal(true)}
            >
              <Icon name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Child</Text>
            </TouchableOpacity>
          </View>

          {children.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Icon name="account-child-circle" size={60} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                No children added yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Add your children to track their activities
              </Text>
            </View>
          ) : (
            <FlatList
              data={children}
              renderItem={renderChildCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('ActivityHistory')}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.quickActionGradient}
              >
                <Icon name="history" size={32} color="#FFFFFF" />
                <Text style={styles.quickActionText}>Activity History</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('SharedActivities')}
            >
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.quickActionGradient}
              >
                <Icon name="share-variant" size={32} color="#FFFFFF" />
                <Text style={styles.quickActionText}>Shared Activities</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Friends' Children Section */}
        {sharedChildren.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Friends' Children</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Children shared with you
            </Text>
            {/* TODO: Implement shared children list */}
          </View>
        )}
      </ScrollView>

      {renderAddChildModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 25,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: -10,
    marginBottom: 15,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  childInfo: {
    flex: 1,
    marginLeft: 16,
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  childAge: {
    fontSize: 14,
  },
  childActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - 50) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width - 40,
    padding: 24,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 20,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  pickerLabel: {
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  pickerBox: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    height: Platform.OS === 'ios' ? 120 : 50,
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 120 : 50,
  },
  pickerItem: {
    fontSize: 16,
    height: Platform.OS === 'ios' ? 120 : 50,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    marginLeft: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default FriendsAndFamilyScreen;