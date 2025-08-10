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
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Child } from '../store/slices/childrenSlice';
import childrenService from '../services/childrenService';

const { width } = Dimensions.get('window');

const FriendsAndFamilyScreenSimple = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [children, setChildren] = useState<Child[]>([]);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [childName, setChildName] = useState('');
  const [childDateOfBirth, setChildDateOfBirth] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const childColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B731', '#5F27CD',
    '#00d2d3', '#ff9ff3', '#54a0ff', '#48dbfb', '#1dd1a1',
  ];

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    try {
      const loadedChildren = await childrenService.getChildren();
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
    if (!childName.trim() || !childDateOfBirth.trim()) {
      Alert.alert('Error', 'Please enter both name and date of birth');
      return;
    }

    try {
      if (editingChild) {
        await childrenService.updateChild(editingChild.id, {
          name: childName.trim(),
          dateOfBirth: childDateOfBirth,
        });
      } else {
        await childrenService.createChild({
          name: childName.trim(),
          dateOfBirth: childDateOfBirth,
        });
      }
      
      await loadChildren();
      resetModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to save child information');
    }
  };

  const resetModal = () => {
    setShowAddChildModal(false);
    setEditingChild(null);
    setChildName('');
    setChildDateOfBirth('');
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

  const handleEditChild = (child: Child) => {
    setEditingChild(child);
    setChildName(child.name);
    setChildDateOfBirth(child.dateOfBirth);
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
            <Icon name="delete" size={20} color={colors.error || '#FF0000'} />
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

          <View style={styles.inputContainer}>
            <Icon name="cake-variant" size={24} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Date of Birth (YYYY-MM-DD)"
              placeholderTextColor={colors.textSecondary}
              value={childDateOfBirth}
              onChangeText={setChildDateOfBirth}
              keyboardType="default"
            />
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart || colors.primary, colors.gradientEnd || colors.primaryDark || colors.primary]}
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
              onPress={() => navigation.navigate('SharingManagement' as never)}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.quickActionGradient}
              >
                <Icon name="share-variant" size={32} color="#FFFFFF" />
                <Text style={styles.quickActionText}>Sharing</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('ActivityHistory' as never)}
            >
              <LinearGradient
                colors={['#f093fb', '#f5576c']}
                style={styles.quickActionGradient}
              >
                <Icon name="history" size={32} color="#FFFFFF" />
                <Text style={styles.quickActionText}>Activity History</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {renderAddChildModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
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
});

export default FriendsAndFamilyScreenSimple;