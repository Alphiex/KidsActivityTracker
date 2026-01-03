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
  ImageBackground,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../store';
import { fetchChildren } from '../store/slices/childrenSlice';
import childrenService from '../services/childrenService';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { EnhancedAddress } from '../types/preferences';
import { locationService } from '../services/locationService';
import ScreenBackground from '../components/ScreenBackground';
import TopTabNavigation from '../components/TopTabNavigation';
import { friendsFamilyHeaderImage } from '../assets/images';
import { ChildAvatar, AvatarPicker, ColorPicker } from '../components/children';
import { getNextAvailableAvatarId, getNextAvailableColorId } from '../theme/childColors';

const { width, height } = Dimensions.get('window');

type FriendsAndFamilyRouteParams = {
  FriendsAndFamily: {
    openAddChild?: boolean;
  };
};

// Airbnb-style colors
const ModernColors = {
  primary: '#E8638B',
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
  gender?: 'male' | 'female' | null;
  location?: string;
  avatarUrl?: string;
  avatarId?: number;
  colorId?: number;
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
  const route = useRoute<RouteProp<FriendsAndFamilyRouteParams, 'FriendsAndFamily'>>();
  const dispatch = useAppDispatch();
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

  // Handle navigation param to open add child modal
  useEffect(() => {
    if (route.params?.openAddChild) {
      setEditingChild(null);
      setShowAddChildModal(true);
      // Clear the param to prevent re-opening on navigation back
      navigation.setParams({ openAddChild: undefined } as any);
    }
  }, [route.params?.openAddChild]);

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
    // Also refresh Redux store
    dispatch(fetchChildren());
    setRefreshing(false);
  }, [dispatch]);

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
              // Also update Redux store
              dispatch(fetchChildren());
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
          <ChildAvatar
            name={child.name}
            avatarId={child.avatarId}
            colorId={child.colorId}
            size={50}
          />
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
      <ScreenBackground>
        {/* Top Tab Navigation */}
        <TopTabNavigation />

        {/* Hero Header */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={friendsFamilyHeaderImage}
            style={styles.heroSection}
            imageStyle={styles.heroImageStyle}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
              style={styles.heroGradient}
            >
              {/* Add Button */}
              <TouchableOpacity style={styles.heroAddButton} onPress={handleAddChild}>
                <View style={styles.heroAddButtonInner}>
                  <Icon name="plus" size={22} color="#333" />
                </View>
              </TouchableOpacity>

              {/* Title */}
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Friends & Family</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
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
        keyboardShouldPersistTaps="handled"
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
            // Also update Redux store so other screens get the updated data
            dispatch(fetchChildren());
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
      </ScreenBackground>
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

interface SavedAddress {
  label: string;
  address: EnhancedAddress;
  type: 'preferences' | 'child';
}

const AddEditChildModal: React.FC<AddEditChildModalProps> = ({
  visible,
  onClose,
  onSave,
  child,
  defaultLocation: _defaultLocation,
}) => {
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [avatarId, setAvatarId] = useState(1);
  const [colorId, setColorId] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<EnhancedAddress | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<SavedAddress | null>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()));

  // Load saved addresses (preferences + other children) on mount
  useEffect(() => {
    const loadSavedAddresses = async () => {
      const addresses: SavedAddress[] = [];

      // Load preferences address (user's default location)
      const prefAddress = locationService.getEnhancedAddress();
      if (prefAddress) {
        addresses.push({
          label: 'My saved location',
          address: prefAddress,
          type: 'preferences',
        });
      }

      // Load other children's addresses (for "copy from another child" feature)
      try {
        const allChildren = await childrenService.getMyChildren();
        allChildren.forEach((c: Child) => {
          // Skip the current child being edited
          if (child && c.id === child.id) return;

          if (c.location) {
            // Check if this location is already in the list
            const exists = addresses.some(a =>
              a.address.city === c.location ||
              a.address.formattedAddress === c.location
            );
            if (!exists) {
              addresses.push({
                label: `${c.name}'s location`,
                address: {
                  formattedAddress: c.location,
                  city: c.location,
                  latitude: 0,
                  longitude: 0,
                  updatedAt: new Date().toISOString(),
                },
                type: 'child',
              });
            }
          }
        });
      } catch (err) {
        console.error('Error loading children addresses:', err);
      }

      setSavedAddresses(addresses);

      // Auto-select preferences address if available and creating new child
      if (!child && prefAddress) {
        setSelectedSavedAddress(addresses[0] || null);
      }
    };

    if (visible) {
      loadSavedAddresses();
    }
  }, [visible, child]);

  useEffect(() => {
    const initializeForm = async () => {
      if (child) {
        setName(child.name || '');
        setGender(child.gender || null);
        setAvatarId(child.avatarId || 1);
        setColorId(child.colorId || 1);
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
        // If child has location, try to create an EnhancedAddress from it
        if (child.location) {
          setSelectedAddress({
            formattedAddress: child.location,
            latitude: 0,
            longitude: 0,
            city: child.location,
            updatedAt: new Date().toISOString(),
          });
          setSelectedSavedAddress(null); // Show current address, not a saved one
          setIsEditingAddress(false); // Not editing, just displaying
        } else {
          setSelectedAddress(null);
          setIsEditingAddress(true); // No address, show input
          // Will auto-select first saved address in the loadSavedAddresses effect
        }
      } else {
        // New child - get unique avatar/color
        try {
          const allChildren = await childrenService.getMyChildren();
          const usedAvatarIds = allChildren.map((c: Child) => c.avatarId).filter((id): id is number => !!id);
          const usedColorIds = allChildren.map((c: Child) => c.colorId).filter((id): id is number => !!id);
          setAvatarId(getNextAvailableAvatarId(usedAvatarIds));
          setColorId(getNextAvailableColorId(usedColorIds));
        } catch (err) {
          console.error('Error getting children for avatar/color defaults:', err);
          setAvatarId(1);
          setColorId(1);
        }
        setName('');
        setGender(null);
        setDateOfBirth('');
        setSelectedAddress(null);
        setSelectedSavedAddress(null);
        setIsEditingAddress(true); // New child, show address input
        setSelectedDate(new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate()));
      }
    };

    if (visible) {
      initializeForm();
    }
  }, [child, visible]);

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
    // Determine effective address - priority: selected saved address > manual address
    const effectiveAddress = selectedSavedAddress?.address || selectedAddress;
    console.log('HandleSave called with:', { name, dateOfBirth, effectiveAddress, selectedSavedAddress });

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
      gender: gender, // Optional - can be 'male', 'female', or null
      avatarId,
      colorId,
    };

    // Add location data if available
    if (effectiveAddress) {
      childData.location = effectiveAddress.city || effectiveAddress.formattedAddress;
      childData.locationDetails = {
        formattedAddress: effectiveAddress.formattedAddress,
        city: effectiveAddress.city,
        state: effectiveAddress.state,
        postalCode: effectiveAddress.postalCode,
        country: effectiveAddress.country,
        latitude: effectiveAddress.latitude,
        longitude: effectiveAddress.longitude,
      };
    }

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {child ? 'Edit Child' : 'Add Child'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={ModernColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBodyContent}
          >
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

            {/* Gender (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender (Optional)</Text>
              <View style={styles.genderOptions}>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'male' && styles.genderOptionSelected,
                  ]}
                  onPress={() => setGender(gender === 'male' ? null : 'male')}
                >
                  <Icon
                    name="gender-male"
                    size={20}
                    color={gender === 'male' ? ModernColors.primary : ModernColors.textLight}
                  />
                  <Text style={[
                    styles.genderOptionText,
                    gender === 'male' && styles.genderOptionTextSelected,
                  ]}>
                    Boy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'female' && styles.genderOptionSelected,
                  ]}
                  onPress={() => setGender(gender === 'female' ? null : 'female')}
                >
                  <Icon
                    name="gender-female"
                    size={20}
                    color={gender === 'female' ? ModernColors.primary : ModernColors.textLight}
                  />
                  <Text style={[
                    styles.genderOptionText,
                    gender === 'female' && styles.genderOptionTextSelected,
                  ]}>
                    Girl
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Avatar Preview */}
            <View style={styles.avatarPreviewSection}>
              <ChildAvatar
                name={name || 'Child'}
                avatarId={avatarId}
                colorId={colorId}
                size={80}
              />
            </View>

            {/* Avatar Selection */}
            <AvatarPicker
              selectedId={avatarId}
              colorId={colorId}
              onSelect={setAvatarId}
            />

            {/* Color Selection */}
            <ColorPicker
              selectedId={colorId}
              onSelect={setColorId}
            />

            <View style={[styles.inputGroup, { zIndex: 100 }]}>
              <Text style={styles.inputLabel}>Location (Optional)</Text>

              {/* If address is set and not editing, show current address with Edit button */}
              {!isEditingAddress && (selectedAddress || selectedSavedAddress) ? (
                <View style={styles.currentAddressContainer}>
                  <View style={styles.currentAddressInfo}>
                    <Icon name="map-marker-check" size={20} color={ModernColors.success} />
                    <Text style={styles.currentAddressText} numberOfLines={2}>
                      {selectedSavedAddress?.address.city || selectedSavedAddress?.address.formattedAddress ||
                       selectedAddress?.city || selectedAddress?.formattedAddress}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editAddressButton}
                    onPress={() => setIsEditingAddress(true)}
                  >
                    <Icon name="pencil" size={16} color={ModernColors.primary} />
                    <Text style={styles.editAddressButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Show saved addresses from other children (copy address feature) */}
                  {savedAddresses.length > 0 && (
                    <View style={styles.savedAddressesList}>
                      {savedAddresses.map((savedAddr, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.savedAddressOption,
                            selectedSavedAddress === savedAddr && styles.savedAddressOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedSavedAddress(savedAddr);
                            setSelectedAddress(null);
                            setIsEditingAddress(false);
                          }}
                        >
                          <Icon
                            name={savedAddr.type === 'preferences' ? 'home-map-marker' : 'account-child'}
                            size={20}
                            color={selectedSavedAddress === savedAddr ? ModernColors.primary : ModernColors.textLight}
                          />
                          <View style={styles.savedAddressTextContainer}>
                            <Text style={[
                              styles.savedAddressLabel,
                              selectedSavedAddress === savedAddr && styles.savedAddressLabelSelected,
                            ]}>
                              {savedAddr.label}
                            </Text>
                            <Text style={styles.savedAddressValue} numberOfLines={1}>
                              {savedAddr.address.city || savedAddr.address.formattedAddress}
                            </Text>
                          </View>
                          {selectedSavedAddress === savedAddr && (
                            <Icon name="check-circle" size={20} color={ModernColors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Address search */}
                  <View style={styles.addressAutocompleteContainer}>
                    <AddressAutocomplete
                      value={selectedAddress}
                      onAddressSelect={(addr) => {
                        setSelectedAddress(addr);
                        setSelectedSavedAddress(null);
                        setIsEditingAddress(false);
                      }}
                      placeholder="Search for an address..."
                      country={['ca', 'us']}
                      showFallbackOption={true}
                    />
                  </View>
                </>
              )}
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
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  heroContainer: {
    marginBottom: 0,
  },
  heroSection: {
    height: height * 0.14,
    width: width,
  },
  heroImageStyle: {
    borderRadius: 0,
  },
  heroGradient: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  heroAddButton: {
    alignSelf: 'flex-end',
  },
  heroAddButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'flex-start',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    flexGrow: 1,
  },
  modalBodyContent: {
    paddingBottom: 350, // Extra padding to allow scrolling above keyboard
  },
  inputGroup: {
    marginBottom: 20,
    zIndex: 1,
  },
  avatarPreviewSection: {
    alignItems: 'center',
    marginVertical: 16,
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
  addressAutocompleteContainer: {
    marginTop: 8,
    zIndex: 1000,
    minHeight: 60,
  },
  effectiveAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  effectiveAddressText: {
    fontSize: 13,
    color: ModernColors.success,
    marginLeft: 6,
  },
  savedAddressesList: {
    marginBottom: 8,
  },
  savedAddressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: ModernColors.backgroundLight,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: ModernColors.borderLight,
  },
  savedAddressOptionSelected: {
    backgroundColor: '#FDF2F8',
    borderColor: ModernColors.primary,
  },
  savedAddressTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  savedAddressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.text,
  },
  savedAddressLabelSelected: {
    color: ModernColors.primary,
  },
  savedAddressValue: {
    fontSize: 13,
    color: ModernColors.textLight,
    marginTop: 2,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: ModernColors.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.borderLight,
    gap: 8,
  },
  genderOptionSelected: {
    backgroundColor: '#FDF2F8',
    borderColor: ModernColors.primary,
  },
  genderOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: ModernColors.textLight,
  },
  genderOptionTextSelected: {
    color: ModernColors.primary,
  },
  currentAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: ModernColors.backgroundLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.borderLight,
    marginTop: 8,
  },
  currentAddressInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentAddressText: {
    flex: 1,
    fontSize: 14,
    color: ModernColors.text,
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FDF2F8',
    borderRadius: 6,
    gap: 4,
  },
  editAddressButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.primary,
  },
});

export default FriendsAndFamilyScreenModern;