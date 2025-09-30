import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  Platform
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import childrenService from '../services/childrenService';
import { Child } from '../store/slices/childrenSlice';

const { width } = Dimensions.get('window');

const FriendsAndFamilyScreenSimple = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [children, setChildren] = useState<Child[]>([]);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [childName, setChildName] = useState('');
  const [childDateOfBirth, setChildDateOfBirth] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Date picker state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();
  
  const [selectedYear, setSelectedYear] = useState(currentYear - 5);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState(currentDay);

  const childColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD',
    '#00d2d3', '#ff9ff3', '#54a0ff', '#48dbfb', '#1dd1a1',
  ];
  
  // Generate date options
  const yearOptions = Array.from({ length: 18 }, (_, i) => currentYear - i);
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

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    loadChildren();
  }, []);
  
  // Adjust day if it exceeds days in the selected month
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth, selectedDay]);

  const loadChildren = async () => {
    try {
      console.log('Loading children from service...');
      const loadedChildren = await childrenService.getChildren();
      console.log('Loaded children:', loadedChildren);
      setChildren(Array.isArray(loadedChildren) ? loadedChildren : []);
    } catch (error) {
      console.error('Error loading children:', error);
      setChildren([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChildren().finally(() => setRefreshing(false));
  };

  const handleAddChild = async () => {
    if (!childName.trim()) {
      Alert.alert('Error', 'Please enter child\'s name');
      return;
    }
    
    // Format as ISO 8601 for API validation
    const dateOfBirth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}T00:00:00.000Z`;

    try {
      await childrenService.createChild({
        name: childName.trim(),
        dateOfBirth: dateOfBirth,
      });
      
      await loadChildren();
      resetModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to add child');
    }
  };

  const resetModal = () => {
    setShowAddChildModal(false);
    setChildName('');
    setSelectedYear(currentYear - 5);
    setSelectedMonth(currentMonth);
    setSelectedDay(currentDay);
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark || colors.primary]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Friends & Family</Text>
        <Text style={styles.headerSubtitle}>
          Manage your children and share activities
        </Text>
      </LinearGradient>
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
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
      </ScrollView>

      {/* Add Child Modal */}
      <Modal
        visible={showAddChildModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Child</Text>
            
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
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 20,
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
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#4A90E2',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    color: '#666666',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: '#666666',
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
  dateSection: {
    marginBottom: 20,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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
    marginBottom: 4,
    textAlign: 'center',
  },
  pickerBox: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 120 : 50,
    width: '100%',
  },
  pickerItem: {
    fontSize: 16,
    height: Platform.OS === 'ios' ? 120 : 50,
  },
});

export default FriendsAndFamilyScreenSimple;