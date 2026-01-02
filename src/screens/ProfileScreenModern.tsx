import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { logout, updateUserProfile } from '../store/slices/authSlice';
import PreferencesService from '../services/preferencesService';
import * as SecureStore from '../utils/secureStorage';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { authService } from '../services/authService';
import useSubscription from '../hooks/useSubscription';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';
import { revenueCatService } from '../services/revenueCatService';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { locationService } from '../services/locationService';
import { EnhancedAddress, isEnhancedAddress } from '../types/preferences';

const ProfileIllustration = require('../assets/images/profile-illustration.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Optional import for DeviceInfo - may not be available in all environments
let DeviceInfo: any;
try {
  DeviceInfo = require('react-native-device-info').default;
} catch (e) {
  console.log('DeviceInfo not available, using defaults');
  DeviceInfo = null;
}

const ModernColors = {
  primary: '#E8638B',
  primaryLight: '#FFB5C5',
  secondary: '#7C9EF5',
  accent: '#FFD166',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E8E8F0',
  background: '#FFFFFF',
  surface: '#FFF5F7',
  surfaceBlue: '#EEF4FF',
  surfaceYellow: '#FFFBEB',
  success: '#48BB78',
  error: '#E53E3E',
  gradientStart: '#FFE5EC',
  gradientEnd: '#E8F4FF',
};

const ProfileScreenModern = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Subscription state
  const {
    tier,
    isPremium,
    isTrialing,
    limits,
    usage,
    openPaywall,
  } = useSubscription();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    location: user?.location || '',
  });
  const [selectedAddress, setSelectedAddress] = useState<EnhancedAddress | null>(null);
  const editProfileScrollRef = useRef<ScrollView>(null);

  // Scroll to address field when focused to keep it visible above keyboard
  const handleAddressFieldFocus = () => {
    // Small delay to allow keyboard to start appearing
    setTimeout(() => {
      editProfileScrollRef.current?.scrollTo({ y: 150, animated: true });
    }, 100);
  };

  // Get subscription details
  const expirationDate = revenueCatService.getExpirationDate();
  const billingCycle = revenueCatService.getBillingCycle(revenueCatService.state.customerInfo!);

  const formatExpirationDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleManageSubscription = () => {
    // Open device subscription settings (required by Apple/Google)
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  // Load saved address from preferences on mount
  useEffect(() => {
    const loadSavedAddress = () => {
      const preferencesService = PreferencesService.getInstance();
      const prefs = preferencesService.getPreferences();
      if (prefs.savedAddress && isEnhancedAddress(prefs.savedAddress)) {
        const enhancedAddr = prefs.savedAddress;
        setSelectedAddress(enhancedAddr);
        // Update profileData.location for display
        setProfileData(prev => ({
          ...prev,
          location: enhancedAddr.formattedAddress || enhancedAddr.city || '',
        }));
      }
    };
    loadSavedAddress();
  }, []);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get app version from native iOS project settings
  let appVersion = '1.0.0';
  let buildNumber = '1';

  if (DeviceInfo) {
    try {
      appVersion = DeviceInfo.getVersion();
      buildNumber = DeviceInfo.getBuildNumber();
    } catch (error) {
      console.log('DeviceInfo error, using defaults');
    }
  }

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            dispatch(logout());
          },
        },
      ],
    );
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const token = await SecureStore.getAccessToken();
      if (!token) throw new Error('No token found');

      // Get display location from selected address or manual entry
      const displayLocation = selectedAddress
        ? selectedAddress.city || selectedAddress.formattedAddress
        : profileData.location;

      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/api/v1/users/profile`,
        {
          name: profileData.name || undefined,
          location: displayLocation || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        // Save enhanced address to preferences if selected
        if (selectedAddress) {
          await locationService.saveEnhancedAddress(selectedAddress);
        }

        dispatch(updateUserProfile({
          name: profileData.name,
          location: displayLocation,
        }));
        setProfileData(prev => ({ ...prev, location: displayLocation || '' }));
        setIsEditingProfile(false);
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const token = await SecureStore.getAccessToken();
      if (!token) throw new Error('No token found');

      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/api/v1/auth/change-password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Password changed successfully');
        setIsChangingPassword(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact us?',
      [
        {
          text: 'Email',
          onPress: () => {
            // Open email client
            Alert.alert('Support', 'Email: support@kidsactivitytracker.com');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword) {
      Alert.alert('Error', 'Please type "DELETE" to confirm account deletion');
      return;
    }

    setIsLoading(true);
    try {
      await authService.deleteAccount();

      // Clear local data and logout
      await SecureStore.clearAllAuthData();
      setIsDeletingAccount(false);
      setDeleteAccountPassword('');

      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => dispatch(logout()),
          },
        ],
      );
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', error.message || 'Failed to delete account. Please check your password and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action is permanent and cannot be undone. All your data including children profiles, favorites, and preferences will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setIsDeletingAccount(true),
        },
      ],
    );
  };

  const ProfileSection = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const ProfileItem = ({
    icon,
    title,
    subtitle,
    onPress,
    showArrow = true,
    value,
    showPremiumBadge,
  }: {
    icon?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    value?: string;
    showPremiumBadge?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.profileItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.profileItemLeft}>
        {icon && (
          <View style={styles.iconContainer}>
            <Icon name={icon} size={20} color={ModernColors.text} />
          </View>
        )}
        <View style={styles.profileItemContent}>
          <View style={styles.profileItemTitleRow}>
            <Text style={styles.profileItemTitle}>{title}</Text>
            {showPremiumBadge && (
              <View style={styles.premiumBadge}>
                <Icon name="lock" size={10} color="#FFD700" />
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>
          {subtitle && <Text style={styles.profileItemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {value && <Text style={styles.profileItemValue}>{value}</Text>}
      {showArrow && onPress && (
        <Icon name="chevron-right" size={20} color={ModernColors.textLight} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenBackground>
        {/* Top Tab Navigation */}
        <TopTabNavigation />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header with Illustration */}
          <View style={styles.headerSection}>
            {/* Header Title */}
            <Text style={styles.headerTitle}>My Profile</Text>

            {/* Profile Illustration */}
            <View style={styles.illustrationContainer}>
              <Image
                source={ProfileIllustration}
                style={styles.illustration}
                resizeMode="contain"
              />
            </View>
          </View>

        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userInfoContainer}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[ModernColors.primary, ModernColors.secondary]}
                style={styles.avatarGradient}
              >
                <Icon name="account" size={36} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.name || 'Guest User'}</Text>
              <Text style={styles.userEmail}>{user?.email || ''}</Text>
              {profileData.location && (
                <View style={styles.locationContainer}>
                  <Icon name="map-marker" size={14} color={ModernColors.primary} />
                  <Text style={styles.userLocation}>{profileData.location}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditingProfile(true)}
            >
              <Icon name="pencil" size={16} color={ModernColors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription Section */}
        <ProfileSection title="Subscription">
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <View style={styles.subscriptionTitleRow}>
                  <Text style={styles.subscriptionPlan}>
                    {isPremium ? 'Premium' : 'Discovery'}
                  </Text>
                  {isPremium && (
                    <View style={styles.proBadge}>
                      <Icon name="crown" size={12} color="#FFFFFF" />
                      <Text style={styles.proBadgeText}>PREMIUM</Text>
                    </View>
                  )}
                  {isTrialing && (
                    <View style={styles.trialBadge}>
                      <Text style={styles.trialBadgeText}>TRIAL</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.subscriptionDescription}>
                  {isPremium
                    ? 'Unlimited access to all features'
                    : 'Upgrade to unlock premium features'}
                </Text>
                {/* Subscription expiration info */}
                {isPremium && expirationDate && (
                  <Text style={styles.subscriptionExpiry}>
                    {isTrialing ? 'Trial ends' : `Renews ${billingCycle === 'annual' ? 'annually' : 'monthly'}`}: {formatExpirationDate(expirationDate)}
                  </Text>
                )}
              </View>
              {!isPremium && (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={openPaywall}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Manage Subscription Button - Only for Premium users */}
            {isPremium && (
              <TouchableOpacity
                style={styles.manageSubscriptionButton}
                onPress={handleManageSubscription}
              >
                <Icon name="cog-outline" size={18} color={ModernColors.textLight} />
                <Text style={styles.manageSubscriptionText}>Manage Subscription</Text>
                <Icon name="chevron-right" size={18} color={ModernColors.textLight} />
              </TouchableOpacity>
            )}

            {/* Usage Stats */}
            {!isPremium && usage && (
              <View style={styles.usageContainer}>
                <View style={styles.usageItem}>
                  <View style={styles.usageIconContainer}>
                    <Icon name="account-child" size={18} color={ModernColors.primary} />
                  </View>
                  <View style={styles.usageInfo}>
                    <Text style={styles.usageLabel}>Children</Text>
                    <Text style={styles.usageValue}>
                      {usage.childrenCount} / {limits.maxChildren}
                    </Text>
                  </View>
                  <View style={styles.usageBarContainer}>
                    <View
                      style={[
                        styles.usageBar,
                        { width: `${Math.min((usage.childrenCount / limits.maxChildren) * 100, 100)}%` }
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.usageItem}>
                  <View style={styles.usageIconContainer}>
                    <Icon name="heart" size={18} color={ModernColors.primary} />
                  </View>
                  <View style={styles.usageInfo}>
                    <Text style={styles.usageLabel}>Favorites</Text>
                    <Text style={styles.usageValue}>
                      {usage.favoritesCount} / {limits.maxFavorites}
                    </Text>
                  </View>
                  <View style={styles.usageBarContainer}>
                    <View
                      style={[
                        styles.usageBar,
                        { width: `${Math.min((usage.favoritesCount / limits.maxFavorites) * 100, 100)}%` }
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.usageItem}>
                  <View style={styles.usageIconContainer}>
                    <Icon name="share-variant" size={18} color={ModernColors.primary} />
                  </View>
                  <View style={styles.usageInfo}>
                    <Text style={styles.usageLabel}>Sharing</Text>
                    <Text style={styles.usageValue}>
                      {usage.sharedUsersCount} / {limits.maxSharedUsers}
                    </Text>
                  </View>
                  <View style={styles.usageBarContainer}>
                    <View
                      style={[
                        styles.usageBar,
                        { width: `${Math.min((usage.sharedUsersCount / limits.maxSharedUsers) * 100, 100)}%` }
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        </ProfileSection>

        {/* Account Settings */}
        <ProfileSection title="Account Settings">
          <ProfileItem
            icon="lock-outline"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => setIsChangingPassword(true)}
          />
          <View style={styles.divider} />
          <ProfileItem
            icon="bell-outline"
            title="Notifications"
            subtitle="Manage your notification preferences"
            onPress={() => navigation.navigate('NotificationPreferences' as never)}
            showPremiumBadge={!isPremium}
          />
          <View style={styles.divider} />
          <ProfileItem
            icon="account-remove-outline"
            title="Delete Account"
            subtitle="Permanently delete your account and data"
            onPress={confirmDeleteAccount}
          />
        </ProfileSection>

        {/* Support */}
        <ProfileSection title="Support">
          <ProfileItem
            icon="help-circle-outline"
            title="Help Center"
            subtitle="Get help and find answers"
            onPress={() => Linking.openURL('mailto:support@kidsactivitytracker.com?subject=Help%20Request')}
          />
          <View style={styles.divider} />
          <ProfileItem
            icon="email-outline"
            title="Contact Support"
            subtitle="Get in touch with our team"
            onPress={handleContactSupport}
          />
        </ProfileSection>

        {/* Legal */}
        <ProfileSection title="Legal">
          <ProfileItem
            icon="shield-check-outline"
            title="Privacy Policy"
            subtitle="How we protect your data"
            onPress={() => Linking.openURL('https://kidsactivitytracker.app/privacy')}
          />
          <View style={styles.divider} />
          <ProfileItem
            icon="file-document-outline"
            title="Terms of Service"
            subtitle="Terms and conditions"
            onPress={() => Linking.openURL('https://kidsactivitytracker.app/terms')}
          />
        </ProfileSection>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version {appVersion} ({buildNumber})</Text>
        </ScrollView>
      </ScreenBackground>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditingProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditingProfile(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditingProfile(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={handleSaveProfile} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={ModernColors.primary} />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={editProfileScrollRef}
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalBodyContent}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.name}
                  onChangeText={(text) => setProfileData({ ...profileData, name: text })}
                  placeholder="Enter your name"
                  placeholderTextColor={ModernColors.textLight}
                />
              </View>

              <View style={[styles.inputGroup, { zIndex: 10 }]}>
                <Text style={styles.inputLabel}>Location (Optional)</Text>
                <AddressAutocomplete
                  value={selectedAddress}
                  onAddressSelect={(address) => setSelectedAddress(address)}
                  placeholder="Search for your address..."
                  country={['ca', 'us']}
                  showFallbackOption={true}
                  containerStyle={{ marginBottom: 0 }}
                  onFocus={handleAddressFieldFocus}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={user?.email || ''}
                  editable={false}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={isChangingPassword}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChangingPassword(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setIsChangingPassword(false);
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
              }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={handleChangePassword} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={ModernColors.primary} />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.currentPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
                  placeholder="Enter current password"
                  placeholderTextColor={ModernColors.textLight}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.newPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                  placeholder="Enter new password"
                  placeholderTextColor={ModernColors.textLight}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={passwordData.confirmPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                  placeholder="Confirm new password"
                  placeholderTextColor={ModernColors.textLight}
                  secureTextEntry
                />
              </View>

              <Text style={styles.passwordHint}>Password must be at least 6 characters long</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={isDeletingAccount}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsDeletingAccount(false);
          setDeleteAccountPassword('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setIsDeletingAccount(false);
                setDeleteAccountPassword('');
              }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <View style={{ width: 50 }} />
            </View>

            <View style={styles.modalBody}>
              <View style={styles.deleteWarningBox}>
                <Icon name="alert-circle" size={24} color={ModernColors.error} />
                <Text style={styles.deleteWarningTitle}>This action cannot be undone</Text>
                <Text style={styles.deleteWarningText}>
                  Deleting your account will permanently remove:
                </Text>
                <View style={styles.deleteList}>
                  <Text style={styles.deleteListItem}>Your profile and personal information</Text>
                  <Text style={styles.deleteListItem}>All children profiles</Text>
                  <Text style={styles.deleteListItem}>Your saved favorites</Text>
                  <Text style={styles.deleteListItem}>Sharing settings with family members</Text>
                  <Text style={styles.deleteListItem}>All preferences and settings</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enter your password to confirm</Text>
                <TextInput
                  style={styles.input}
                  value={deleteAccountPassword}
                  onChangeText={setDeleteAccountPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={ModernColors.textLight}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.deleteButton, !deleteAccountPassword && styles.deleteButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={isLoading || !deleteAccountPassword}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete My Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerSection: {
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: 16,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  illustration: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.5,
  },
  userCard: {
    marginTop: -20,
    marginHorizontal: 20,
    backgroundColor: ModernColors.background,
    borderRadius: 20,
    shadowColor: ModernColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ModernColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionContent: {
    backgroundColor: ModernColors.background,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userLocation: {
    fontSize: 14,
    color: ModernColors.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: ModernColors.surface,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: ModernColors.background,
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ModernColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    color: ModernColors.text,
    marginBottom: 2,
  },
  profileItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B8860B',
    marginLeft: 3,
  },
  profileItemSubtitle: {
    fontSize: 14,
    color: ModernColors.textLight,
  },
  profileItemValue: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: ModernColors.border,
    marginLeft: 74,
  },
  logoutButton: {
    marginTop: 32,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.error,
  },
  versionText: {
    fontSize: 13,
    color: ModernColors.textLight,
    textAlign: 'center',
    marginBottom: 40,
  },
  // Subscription styles
  subscriptionCard: {
    padding: 20,
    backgroundColor: ModernColors.background,
    marginHorizontal: 20,
    borderRadius: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  subscriptionPlan: {
    fontSize: 18,
    fontWeight: '700',
    color: ModernColors.text,
  },
  subscriptionDescription: {
    fontSize: 14,
    color: ModernColors.textLight,
  },
  subscriptionExpiry: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginTop: 4,
  },
  manageSubscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    backgroundColor: ModernColors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
    gap: 8,
  },
  manageSubscriptionText: {
    flex: 1,
    fontSize: 14,
    color: ModernColors.textLight,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ModernColors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  proBadgeText: {
    color: '#744210',
    fontSize: 11,
    fontWeight: '700',
  },
  trialBadge: {
    backgroundColor: ModernColors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  upgradeButton: {
    backgroundColor: ModernColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: ModernColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  usageContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
    gap: 16,
  },
  usageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usageIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ModernColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageInfo: {
    flex: 1,
  },
  usageLabel: {
    fontSize: 14,
    color: ModernColors.textLight,
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
  },
  usageBarContainer: {
    width: 80,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBar: {
    height: '100%',
    backgroundColor: ModernColors.primary,
    borderRadius: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: ModernColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  modalCancel: {
    fontSize: 16,
    color: ModernColors.textLight,
  },
  modalSave: {
    fontSize: 16,
    color: ModernColors.primary,
    fontWeight: '600',
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
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: ModernColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: ModernColors.text,
    backgroundColor: '#FAFAFA',
  },
  disabledInput: {
    backgroundColor: ModernColors.surface,
    color: ModernColors.textLight,
  },
  passwordHint: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginTop: 8,
  },
  deleteWarningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteWarningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.error,
    marginTop: 8,
    marginBottom: 8,
  },
  deleteWarningText: {
    fontSize: 14,
    color: ModernColors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteList: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  deleteListItem: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 4,
    paddingLeft: 8,
  },
  deleteButton: {
    backgroundColor: ModernColors.error,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ProfileScreenModern;