import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../services/preferencesService';
import NotificationService, { NotificationPreferences } from '../services/notificationService';

const ModernColors = {
  primary: '#14B8A6',
  text: '#222222',
  textLight: '#717171',
  border: '#DDDDDD',
  background: '#FFFFFF',
  surface: '#F7F7F7',
  success: '#00A699',
};

const NotificationPreferencesScreenModern = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const notificationService = NotificationService.getInstance();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    enabled: false,
    newActivities: true,
    dailyDigest: false,
    priceDrops: true,
    spotsAvailable: true,
    reminders: true,
    weeklyDigest: false,
    favoriteCapacity: true,
    capacityThreshold: 3,
    quietHoursEnabled: true,
    quietHoursStart: 21,
    quietHoursEnd: 8,
  });

  // Load preferences from server on mount
  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [])
  );

  const loadPreferences = async () => {
    setIsLoading(true);
    try {
      const serverPrefs = await notificationService.getPreferences();

      // Parse quiet hours from string format
      let quietHoursStart = 21;
      let quietHoursEnd = 8;
      if (serverPrefs.quietHoursStart) {
        const [hour] = serverPrefs.quietHoursStart.split(':');
        quietHoursStart = parseInt(hour, 10);
      }
      if (serverPrefs.quietHoursEnd) {
        const [hour] = serverPrefs.quietHoursEnd.split(':');
        quietHoursEnd = parseInt(hour, 10);
      }

      setNotificationSettings({
        enabled: serverPrefs.enabled ?? false,
        newActivities: serverPrefs.newActivities ?? true,
        dailyDigest: serverPrefs.dailyDigest ?? false,
        priceDrops: serverPrefs.priceDrops ?? true,
        spotsAvailable: serverPrefs.spotsAvailable ?? true,
        reminders: serverPrefs.reminders ?? true,
        weeklyDigest: serverPrefs.weeklyDigest ?? false,
        favoriteCapacity: serverPrefs.favoriteCapacity ?? true,
        capacityThreshold: serverPrefs.capacityThreshold ?? 3,
        quietHoursEnabled: !!(serverPrefs.quietHoursStart && serverPrefs.quietHoursEnd),
        quietHoursStart,
        quietHoursEnd,
      });
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const quietHoursStart = notificationSettings.quietHoursEnabled
        ? `${String(notificationSettings.quietHoursStart).padStart(2, '0')}:00`
        : undefined;
      const quietHoursEnd = notificationSettings.quietHoursEnabled
        ? `${String(notificationSettings.quietHoursEnd).padStart(2, '0')}:00`
        : undefined;

      await notificationService.updatePreferences({
        enabled: notificationSettings.enabled,
        newActivities: notificationSettings.newActivities,
        dailyDigest: notificationSettings.dailyDigest,
        priceDrops: notificationSettings.priceDrops,
        spotsAvailable: notificationSettings.spotsAvailable,
        weeklyDigest: notificationSettings.weeklyDigest,
        favoriteCapacity: notificationSettings.favoriteCapacity,
        capacityThreshold: notificationSettings.capacityThreshold,
        quietHoursStart,
        quietHoursEnd,
      });

      // Also update local preferences
      const localPrefs = preferencesService.getPreferences();
      preferencesService.updatePreferences({
        ...localPrefs,
        notifications: {
          ...localPrefs.notifications,
          enabled: notificationSettings.enabled,
          newActivities: notificationSettings.newActivities,
          priceDrops: notificationSettings.priceDrops,
          weeklyDigest: notificationSettings.weeklyDigest,
          favoriteCapacity: notificationSettings.favoriteCapacity,
          capacityThreshold: notificationSettings.capacityThreshold,
          spotsAvailable: notificationSettings.spotsAvailable,
          reminders: notificationSettings.reminders,
        },
      });

      setHasChanges(false);
      Alert.alert('Success', 'Notification preferences saved');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const sendTestNotification = async () => {
    const result = await notificationService.sendTestNotification();
    Alert.alert(
      result.success ? 'Success' : 'Note',
      result.message
    );
  };

  const NotificationSection = ({
    title,
    children,
    description
  }: {
    title: string;
    children: React.ReactNode;
    description?: string;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description && <Text style={styles.sectionDescription}>{description}</Text>}
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const NotificationToggle = ({
    icon,
    title,
    subtitle,
    value,
    onToggle,
    disabled,
  }: {
    icon?: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <View style={[styles.toggleItem, disabled && styles.toggleDisabled]}>
      <View style={styles.toggleLeft}>
        {icon && (
          <View style={styles.iconContainer}>
            <Icon name={icon} size={20} color={disabled ? ModernColors.textLight : ModernColors.text} />
          </View>
        )}
        <View style={styles.toggleContent}>
          <Text style={[styles.toggleTitle, disabled && styles.textDisabled]}>{title}</Text>
          {subtitle && <Text style={styles.toggleSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E0E0E0', true: ModernColors.primary }}
        thumbColor={value ? '#FFFFFF' : '#F4F4F4'}
        ios_backgroundColor="#E0E0E0"
        disabled={disabled}
      />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasChanges ? (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={savePreferences}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={ModernColors.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Master Toggle */}
        <NotificationSection
          title="Email Notifications"
          description="Enable email notifications to stay updated"
        >
          <NotificationToggle
            icon="email-check-outline"
            title="Enable Email Notifications"
            subtitle="Receive activity updates via email"
            value={notificationSettings.enabled}
            onToggle={(value) => updateSetting('enabled', value)}
          />
        </NotificationSection>

        {/* Push Notifications */}
        <NotificationSection
          title="Notification Types"
          description="Choose what you want to be notified about"
        >
          <NotificationToggle
            icon="bell-outline"
            title="New Activities"
            subtitle="Get notified when new activities match your preferences"
            value={notificationSettings.newActivities}
            onToggle={(value) => updateSetting('newActivities', value)}
            disabled={!notificationSettings.enabled}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="calendar-today"
            title="Daily Digest"
            subtitle="Receive a daily summary of new activities"
            value={notificationSettings.dailyDigest}
            onToggle={(value) => updateSetting('dailyDigest', value)}
            disabled={!notificationSettings.enabled}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="tag-outline"
            title="Price Drops"
            subtitle="Alert when activities reduce their prices"
            value={notificationSettings.priceDrops}
            onToggle={(value) => updateSetting('priceDrops', value)}
            disabled={!notificationSettings.enabled}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="account-check-outline"
            title="Spots Available"
            subtitle="Know when spots open up in waitlisted activities"
            value={notificationSettings.spotsAvailable}
            onToggle={(value) => updateSetting('spotsAvailable', value)}
            disabled={!notificationSettings.enabled}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="calendar-week"
            title="Weekly Digest"
            subtitle="Summary of activities and updates every week"
            value={notificationSettings.weeklyDigest}
            onToggle={(value) => updateSetting('weeklyDigest', value)}
            disabled={!notificationSettings.enabled}
          />
        </NotificationSection>

        {/* Capacity Alerts */}
        <NotificationSection
          title="Capacity Alerts"
          description="Be notified when saved activities are filling up"
        >
          <NotificationToggle
            icon="alert-circle-outline"
            title="Enable Capacity Alerts"
            subtitle="Get notified when favorites are almost full"
            value={notificationSettings.favoriteCapacity}
            onToggle={(value) => updateSetting('favoriteCapacity', value)}
            disabled={!notificationSettings.enabled}
          />
          <View style={styles.divider} />
          <View style={[styles.thresholdContainer, (!notificationSettings.enabled || !notificationSettings.favoriteCapacity) && styles.toggleDisabled]}>
            <Text style={[styles.thresholdLabel, (!notificationSettings.enabled || !notificationSettings.favoriteCapacity) && styles.textDisabled]}>
              Alert when spots remaining:
            </Text>
            <TouchableOpacity
              style={styles.thresholdPicker}
              disabled={!notificationSettings.enabled || !notificationSettings.favoriteCapacity}
              onPress={() => {
                Alert.alert(
                  'Capacity Threshold',
                  'Alert when this many spots are left',
                  [
                    { text: '1 spot', onPress: () => updateSetting('capacityThreshold', 1) },
                    { text: '2 spots', onPress: () => updateSetting('capacityThreshold', 2) },
                    { text: '3 spots', onPress: () => updateSetting('capacityThreshold', 3) },
                    { text: '5 spots', onPress: () => updateSetting('capacityThreshold', 5) },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={styles.thresholdValue}>
                {notificationSettings.capacityThreshold} {notificationSettings.capacityThreshold === 1 ? 'spot' : 'spots'}
              </Text>
              <Icon name="chevron-down" size={20} color={ModernColors.textLight} />
            </TouchableOpacity>
          </View>
        </NotificationSection>

        {/* Quiet Hours */}
        <NotificationSection
          title="Quiet Hours"
          description="Pause notifications during specific hours"
        >
          <NotificationToggle
            icon="moon-waning-crescent"
            title="Enable Quiet Hours"
            subtitle="Silence notifications during sleep"
            value={notificationSettings.quietHoursEnabled}
            onToggle={(value) => updateSetting('quietHoursEnabled', value)}
            disabled={!notificationSettings.enabled}
          />
          {notificationSettings.quietHoursEnabled && notificationSettings.enabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.timeRangeContainer}>
                <View style={styles.timePickerContainer}>
                  <Text style={styles.timeLabel}>From</Text>
                  <TouchableOpacity
                    style={styles.timePicker}
                    onPress={() => {
                      Alert.alert(
                        'Start Time',
                        'Select quiet hours start',
                        [
                          { text: '8 PM', onPress: () => updateSetting('quietHoursStart', 20) },
                          { text: '9 PM', onPress: () => updateSetting('quietHoursStart', 21) },
                          { text: '10 PM', onPress: () => updateSetting('quietHoursStart', 22) },
                          { text: '11 PM', onPress: () => updateSetting('quietHoursStart', 23) },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.timeValue}>
                      {notificationSettings.quietHoursStart > 12
                        ? `${notificationSettings.quietHoursStart - 12} PM`
                        : `${notificationSettings.quietHoursStart} AM`}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.timePickerContainer}>
                  <Text style={styles.timeLabel}>To</Text>
                  <TouchableOpacity
                    style={styles.timePicker}
                    onPress={() => {
                      Alert.alert(
                        'End Time',
                        'Select quiet hours end',
                        [
                          { text: '6 AM', onPress: () => updateSetting('quietHoursEnd', 6) },
                          { text: '7 AM', onPress: () => updateSetting('quietHoursEnd', 7) },
                          { text: '8 AM', onPress: () => updateSetting('quietHoursEnd', 8) },
                          { text: '9 AM', onPress: () => updateSetting('quietHoursEnd', 9) },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.timeValue}>
                      {notificationSettings.quietHoursEnd} AM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </NotificationSection>

        {/* Test Notification */}
        {notificationSettings.enabled && (
          <View style={styles.testSection}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={sendTestNotification}
            >
              <Icon name="send-outline" size={20} color={ModernColors.primary} />
              <Text style={styles.testButtonText}>Send Test Email</Text>
            </TouchableOpacity>
            <Text style={styles.testHint}>
              Sends a sample daily digest to your email
            </Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerSpacer: {
    width: 60,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: ModernColors.textLight,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ModernColors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: ModernColors.textLight,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: ModernColors.background,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: ModernColors.background,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: ModernColors.textLight,
  },
  toggleLeft: {
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
  toggleContent: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 16,
    color: ModernColors.text,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 14,
    color: ModernColors.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: ModernColors.border,
    marginLeft: 20,
  },
  thresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  thresholdLabel: {
    fontSize: 16,
    color: ModernColors.text,
  },
  thresholdPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  thresholdValue: {
    fontSize: 16,
    color: ModernColors.text,
    marginRight: 8,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  timePickerContainer: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginBottom: 8,
  },
  timePicker: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.border,
    backgroundColor: ModernColors.surface,
  },
  timeValue: {
    fontSize: 16,
    color: ModernColors.text,
    fontWeight: '500',
  },
  testSection: {
    marginTop: 32,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ModernColors.primary,
  },
  testButtonText: {
    fontSize: 16,
    color: ModernColors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  testHint: {
    marginTop: 8,
    fontSize: 13,
    color: ModernColors.textLight,
  },
  bottomPadding: {
    height: 40,
  },
});

export default NotificationPreferencesScreenModern;
