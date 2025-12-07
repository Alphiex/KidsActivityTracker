import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { logout, updateUserProfile } from '../store/slices/authSlice';
import PreferencesService from '../services/preferencesService';
import * as SecureStore from '../utils/secureStorage';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { authService } from '../services/authService';
// Optional import for DeviceInfo - may not be available in all environments
let DeviceInfo: any;
try {
  DeviceInfo = require('react-native-device-info').default;
} catch (e) {
  console.log('DeviceInfo not available, using defaults');
  DeviceInfo = null;
}

const ModernColors = {
  primary: '#FF385C',
  text: '#222222',
  textLight: '#717171',
  border: '#DDDDDD',
  background: '#FFFFFF',
  surface: '#F7F7F7',
  success: '#00A699',
  error: '#C13515',
};

const ProfileScreenModern = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    location: user?.location || '',
  });
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

      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/api/v1/users/profile`,
        {
          name: profileData.name || undefined,
          location: profileData.location || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        dispatch(updateUserProfile({
          name: profileData.name,
          location: profileData.location,
        }));
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
      Alert.alert('Error', 'Please enter your password to confirm account deletion');
      return;
    }

    setIsLoading(true);
    try {
      await authService.deleteAccount(deleteAccountPassword);

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
  }: {
    icon?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    value?: string;
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
          <Text style={styles.profileItemTitle}>{title}</Text>
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
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Info Section */}
        <ProfileSection>
          <View style={styles.userInfoContainer}>
            <View style={styles.avatarContainer}>
              <Icon name="account-circle" size={60} color={ModernColors.textLight} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.name || 'Guest User'}</Text>
              <Text style={styles.userEmail}>{user?.email || ''}</Text>
              {profileData.location && (
                <View style={styles.locationContainer}>
                  <Icon name="map-marker" size={14} color={ModernColors.textLight} />
                  <Text style={styles.userLocation}>{profileData.location}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditingProfile(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
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
            onPress={() => Alert.alert('Help Center', 'Coming soon!')}
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
            onPress={() => navigation.navigate('Legal' as never, { type: 'privacy' } as never)}
          />
          <View style={styles.divider} />
          <ProfileItem
            icon="file-document-outline"
            title="Terms of Service"
            subtitle="Terms and conditions"
            onPress={() => navigation.navigate('Legal' as never, { type: 'terms' } as never)}
          />
        </ProfileSection>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Version {appVersion} ({buildNumber})</Text>
      </ScrollView>

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

            <View style={styles.modalBody}>
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

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.location}
                  onChangeText={(text) => setProfileData({ ...profileData, location: text })}
                  placeholder="Enter your location"
                  placeholderTextColor={ModernColors.textLight}
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
            </View>
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
    backgroundColor: ModernColors.background,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: ModernColors.text,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sectionContent: {
    backgroundColor: ModernColors.background,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: ModernColors.background,
  },
  avatarContainer: {
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
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
    marginTop: 2,
  },
  userLocation: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginLeft: 4,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ModernColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    color: ModernColors.text,
    marginBottom: 2,
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
    marginLeft: 64,
  },
  logoutButton: {
    marginTop: 32,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.error,
  },
  versionText: {
    fontSize: 12,
    color: ModernColors.textLight,
    textAlign: 'center',
    marginBottom: 32,
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: ModernColors.text,
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