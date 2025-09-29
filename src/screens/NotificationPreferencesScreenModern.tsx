import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../services/preferencesService';

const ModernColors = {
  primary: '#FF385C',
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
  const [preferences, setPreferences] = useState(preferencesService.getPreferences());

  const [notificationSettings, setNotificationSettings] = useState({
    newActivities: preferences.notifications?.newActivities ?? true,
    priceDrops: preferences.notifications?.priceDrops ?? true,
    spotsAvailable: preferences.notifications?.spotsAvailable ?? true,
    reminders: preferences.notifications?.reminders ?? true,
    weeklyDigest: preferences.notifications?.weeklyDigest ?? false,
    instantAlerts: true,
    capacityAlerts: {
      threeSpotsLeft: true,
      twoSpotsLeft: true,
      oneSpotLeft: true,
      fullAlert: false,
    },
    priceAlerts: {
      anyDrop: false,
      threshold: 20,
    },
    quietHours: {
      enabled: true,
      startHour: 21,
      endHour: 8,
    },
  });

  const updateNotificationSetting = (key: string, value: boolean) => {
    const updatedSettings = {
      ...notificationSettings,
      [key]: value,
    };
    setNotificationSettings(updatedSettings);

    // Update preferences service
    const updatedPreferences = {
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [key]: value,
      },
    };
    preferencesService.updatePreferences(updatedPreferences);
    setPreferences(updatedPreferences);
  };

  const updateCapacityAlert = (type: string, value: boolean) => {
    const updatedSettings = {
      ...notificationSettings,
      capacityAlerts: {
        ...notificationSettings.capacityAlerts,
        [type]: value,
      },
    };
    setNotificationSettings(updatedSettings);
  };

  const updatePriceAlert = (key: string, value: any) => {
    const updatedSettings = {
      ...notificationSettings,
      priceAlerts: {
        ...notificationSettings.priceAlerts,
        [key]: value,
      },
    };
    setNotificationSettings(updatedSettings);
  };

  const updateQuietHours = (key: string, value: any) => {
    const updatedSettings = {
      ...notificationSettings,
      quietHours: {
        ...notificationSettings.quietHours,
        [key]: value,
      },
    };
    setNotificationSettings(updatedSettings);
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
  }: {
    icon?: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onToggle: (value: boolean) => void;
  }) => (
    <View style={styles.toggleItem}>
      <View style={styles.toggleLeft}>
        {icon && (
          <View style={styles.iconContainer}>
            <Icon name={icon} size={20} color={ModernColors.text} />
          </View>
        )}
        <View style={styles.toggleContent}>
          <Text style={styles.toggleTitle}>{title}</Text>
          {subtitle && <Text style={styles.toggleSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E0E0E0', true: ModernColors.primary }}
        thumbColor={value ? '#FFFFFF' : '#F4F4F4'}
        ios_backgroundColor="#E0E0E0"
      />
    </View>
  );

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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Main Notifications */}
        <NotificationSection
          title="Push Notifications"
          description="Stay updated with the latest activities"
        >
          <NotificationToggle
            icon="bell-outline"
            title="New Activities"
            subtitle="Get notified when new activities match your preferences"
            value={notificationSettings.newActivities}
            onToggle={(value) => updateNotificationSetting('newActivities', value)}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="tag-outline"
            title="Price Drops"
            subtitle="Alert when activities reduce their prices"
            value={notificationSettings.priceDrops}
            onToggle={(value) => updateNotificationSetting('priceDrops', value)}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="account-check-outline"
            title="Spots Available"
            subtitle="Know when spots open up in waitlisted activities"
            value={notificationSettings.spotsAvailable}
            onToggle={(value) => updateNotificationSetting('spotsAvailable', value)}
          />
          <View style={styles.divider} />
          <NotificationToggle
            icon="clock-outline"
            title="Reminders"
            subtitle="Get reminded about upcoming registration deadlines"
            value={notificationSettings.reminders}
            onToggle={(value) => updateNotificationSetting('reminders', value)}
          />
        </NotificationSection>

        {/* Capacity Alerts */}
        <NotificationSection
          title="Capacity Alerts"
          description="Be notified when activities are filling up"
        >
          <NotificationToggle
            title="3 spots left"
            value={notificationSettings.capacityAlerts.threeSpotsLeft}
            onToggle={(value) => updateCapacityAlert('threeSpotsLeft', value)}
          />
          <View style={styles.divider} />
          <NotificationToggle
            title="2 spots left"
            value={notificationSettings.capacityAlerts.twoSpotsLeft}
            onToggle={(value) => updateCapacityAlert('twoSpotsLeft', value)}
          />
          <View style={styles.divider} />
          <NotificationToggle
            title="1 spot left"
            value={notificationSettings.capacityAlerts.oneSpotLeft}
            onToggle={(value) => updateCapacityAlert('oneSpotLeft', value)}
          />
          <View style={styles.divider} />
          <NotificationToggle
            title="Activity full"
            value={notificationSettings.capacityAlerts.fullAlert}
            onToggle={(value) => updateCapacityAlert('fullAlert', value)}
          />
        </NotificationSection>

        {/* Price Alerts */}
        <NotificationSection
          title="Price Alerts"
          description="Customize how you want to be notified about price changes"
        >
          <NotificationToggle
            title="Any price drop"
            subtitle="Alert for any price reduction"
            value={notificationSettings.priceAlerts.anyDrop}
            onToggle={(value) => updatePriceAlert('anyDrop', value)}
          />
          <View style={styles.divider} />
          <View style={styles.thresholdContainer}>
            <Text style={styles.thresholdLabel}>Alert when price drops by</Text>
            <TouchableOpacity
              style={styles.thresholdPicker}
              onPress={() => {
                Alert.alert(
                  'Price Drop Threshold',
                  'Select minimum percentage drop',
                  [
                    { text: '10%', onPress: () => updatePriceAlert('threshold', 10) },
                    { text: '20%', onPress: () => updatePriceAlert('threshold', 20) },
                    { text: '30%', onPress: () => updatePriceAlert('threshold', 30) },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Text style={styles.thresholdValue}>
                {notificationSettings.priceAlerts.threshold}%
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
            title="Enable quiet hours"
            subtitle="Silence notifications during sleep"
            value={notificationSettings.quietHours.enabled}
            onToggle={(value) => updateQuietHours('enabled', value)}
          />
          {notificationSettings.quietHours.enabled && (
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
                          { text: '8 PM', onPress: () => updateQuietHours('startHour', 20) },
                          { text: '9 PM', onPress: () => updateQuietHours('startHour', 21) },
                          { text: '10 PM', onPress: () => updateQuietHours('startHour', 22) },
                          { text: '11 PM', onPress: () => updateQuietHours('startHour', 23) },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.timeValue}>
                      {notificationSettings.quietHours.startHour > 12
                        ? `${notificationSettings.quietHours.startHour - 12} PM`
                        : `${notificationSettings.quietHours.startHour} AM`}
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
                          { text: '6 AM', onPress: () => updateQuietHours('endHour', 6) },
                          { text: '7 AM', onPress: () => updateQuietHours('endHour', 7) },
                          { text: '8 AM', onPress: () => updateQuietHours('endHour', 8) },
                          { text: '9 AM', onPress: () => updateQuietHours('endHour', 9) },
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.timeValue}>
                      {notificationSettings.quietHours.endHour} AM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </NotificationSection>

        {/* Email Notifications */}
        <NotificationSection
          title="Email Notifications"
          description="Receive updates via email"
        >
          <NotificationToggle
            icon="email-outline"
            title="Weekly digest"
            subtitle="Summary of activities and updates every week"
            value={notificationSettings.weeklyDigest}
            onToggle={(value) => updateNotificationSetting('weeklyDigest', value)}
          />
        </NotificationSection>
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
    width: 32,
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
});

export default NotificationPreferencesScreenModern;