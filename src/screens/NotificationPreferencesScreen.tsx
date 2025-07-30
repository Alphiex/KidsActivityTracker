import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
// import DateTimePicker from '@react-native-community/datetimepicker';
import PreferencesService from '../services/preferencesService';

const NotificationPreferencesScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const [preferences, setPreferences] = useState(preferencesService.getPreferences());
  // const [showTimePicker, setShowTimePicker] = useState(false);
  // const [showDayPicker, setShowDayPicker] = useState(false);
  
  // Extended notification preferences
  const [notificationSettings, setNotificationSettings] = useState({
    ...preferences.notifications,
    instantAlerts: true,
    digestTime: new Date(2024, 0, 1, 9, 0), // Default 9 AM
    digestDay: 'Monday',
    capacityAlerts: {
      threeSpotsLeft: true,
      twoSpotsLeft: true,
      oneSpotLeft: true,
      fullAlert: false,
    },
    priceAlerts: {
      anyDrop: false,
      threshold: 20, // Percentage
      absoluteThreshold: 50, // Dollar amount
    },
    quietHours: {
      enabled: true,
      start: new Date(2024, 0, 1, 21, 0), // 9 PM
      end: new Date(2024, 0, 1, 8, 0), // 8 AM
    },
    categories: preferences.preferredCategories.reduce((acc, cat) => {
      acc[cat] = true;
      return acc;
    }, {} as { [key: string]: boolean }),
  });

  const daysOfWeek = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  ];

  const updateNotificationSetting = (key: string, value: any) => {
    const updatedSettings = {
      ...notificationSettings,
      [key]: value,
    };
    setNotificationSettings(updatedSettings);
    
    // Update preferences service
    preferencesService.updatePreferences({
      notifications: {
        ...preferences.notifications,
        [key]: value,
      },
    });
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

  const updateCategoryNotification = (category: string, value: boolean) => {
    const updatedSettings = {
      ...notificationSettings,
      categories: {
        ...notificationSettings.categories,
        [category]: value,
      },
    };
    setNotificationSettings(updatedSettings);
  };

  const testNotification = () => {
    Alert.alert(
      '🔔 Test Notification',
      'If notifications are enabled, you should receive a test notification shortly.',
      [{ text: 'OK' }]
    );
  };

  const renderSection = (title: string, icon: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={20} color="#667eea" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const renderToggleItem = (
    title: string,
    subtitle: string,
    value: boolean,
    onToggle: (value: boolean) => void,
    icon?: string
  ) => (
    <View style={styles.toggleItem}>
      <View style={styles.toggleItemContent}>
        {icon && (
          <View style={styles.itemIcon}>
            <Icon name={icon} size={20} color="#667eea" />
          </View>
        )}
        <View style={styles.toggleItemText}>
          <Text style={styles.toggleItemTitle}>{title}</Text>
          <Text style={styles.toggleItemSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#ddd', true: '#667eea' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity onPress={testNotification}>
            <Icon name="bell-ring" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Master Switch */}
      <View style={styles.masterSwitch}>
        <LinearGradient
          colors={notificationSettings.enabled ? ['#667eea', '#764ba2'] : ['#999', '#666']}
          style={styles.masterSwitchGradient}
        >
          <Icon 
            name={notificationSettings.enabled ? 'bell-ring' : 'bell-off'} 
            size={40} 
            color="#fff" 
          />
          <View style={styles.masterSwitchContent}>
            <Text style={styles.masterSwitchTitle}>
              Notifications {notificationSettings.enabled ? 'Enabled' : 'Disabled'}
            </Text>
            <Text style={styles.masterSwitchSubtitle}>
              {notificationSettings.enabled 
                ? 'You\'ll receive alerts for matching activities' 
                : 'Turn on to receive activity alerts'}
            </Text>
          </View>
          <Switch
            value={notificationSettings.enabled}
            onValueChange={(value) => updateNotificationSetting('enabled', value)}
            trackColor={{ false: '#ddd', true: '#fff' }}
            thumbColor={notificationSettings.enabled ? '#667eea' : '#f4f3f4'}
            style={styles.masterSwitchToggle}
          />
        </LinearGradient>
      </View>

      {notificationSettings.enabled && (
        <>
          {/* Activity Alerts */}
          {renderSection('Activity Alerts', 'new-box', (
            <>
              {renderToggleItem(
                'New Matching Activities',
                'Get notified when new activities match your preferences',
                notificationSettings.newActivities,
                (value) => updateNotificationSetting('newActivities', value),
                'sparkles'
              )}
              {renderToggleItem(
                'Instant Alerts',
                'Receive notifications immediately when activities are found',
                notificationSettings.instantAlerts,
                (value) => updateNotificationSetting('instantAlerts', value),
                'lightning-bolt'
              )}
            </>
          ))}

          {/* Capacity Alerts */}
          {renderSection('Capacity Alerts', 'alert-circle', (
            <>
              <Text style={styles.subsectionTitle}>
                Get notified when your favorite activities have limited spots:
              </Text>
              {renderToggleItem(
                '3 Spots Remaining',
                'Alert when only 3 spots are left',
                notificationSettings.capacityAlerts.threeSpotsLeft,
                (value) => updateCapacityAlert('threeSpotsLeft', value)
              )}
              {renderToggleItem(
                '2 Spots Remaining',
                'Alert when only 2 spots are left',
                notificationSettings.capacityAlerts.twoSpotsLeft,
                (value) => updateCapacityAlert('twoSpotsLeft', value)
              )}
              {renderToggleItem(
                'Last Spot Alert',
                'Urgent alert for the final spot',
                notificationSettings.capacityAlerts.oneSpotLeft,
                (value) => updateCapacityAlert('oneSpotLeft', value)
              )}
              {renderToggleItem(
                'Activity Full',
                'Notify when a favorite activity becomes full',
                notificationSettings.capacityAlerts.fullAlert,
                (value) => updateCapacityAlert('fullAlert', value)
              )}
            </>
          ))}

          {/* Price Alerts */}
          {renderSection('Price Alerts', 'tag-heart', (
            <>
              {renderToggleItem(
                'Price Drops',
                'Get notified when activities reduce their prices',
                notificationSettings.priceDrops,
                (value) => updateNotificationSetting('priceDrops', value),
                'trending-down'
              )}
              {notificationSettings.priceDrops && (
                <View style={styles.priceSettings}>
                  <TouchableOpacity 
                    style={[
                      styles.priceOption,
                      notificationSettings.priceAlerts.anyDrop && styles.priceOptionActive
                    ]}
                    onPress={() => updatePriceAlert('anyDrop', !notificationSettings.priceAlerts.anyDrop)}
                  >
                    <Text style={[
                      styles.priceOptionText,
                      notificationSettings.priceAlerts.anyDrop && styles.priceOptionTextActive
                    ]}>
                      Any Price Drop
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.priceThreshold}>
                    <Text style={styles.priceThresholdLabel}>
                      Or drops of ${notificationSettings.priceAlerts.absoluteThreshold}+
                    </Text>
                  </View>
                </View>
              )}
            </>
          ))}

          {/* Weekly Digest */}
          {renderSection('Weekly Summary', 'email-newsletter', (
            <>
              {renderToggleItem(
                'Weekly Digest',
                `Receive a summary every ${notificationSettings.digestDay}`,
                notificationSettings.weeklyDigest,
                (value) => updateNotificationSetting('weeklyDigest', value),
                'calendar-week'
              )}
              {notificationSettings.weeklyDigest && (
                <View style={styles.digestSettings}>
                  <View style={styles.digestOption}>
                    <Icon name="calendar" size={20} color="#667eea" />
                    <Text style={styles.digestOptionText}>
                      Every {notificationSettings.digestDay}
                    </Text>
                  </View>
                  <View style={styles.digestOption}>
                    <Icon name="clock-outline" size={20} color="#667eea" />
                    <Text style={styles.digestOptionText}>
                      at {formatTime(notificationSettings.digestTime)}
                    </Text>
                  </View>
                </View>
              )}
            </>
          ))}

          {/* Category Preferences */}
          {renderSection('Category Notifications', 'tag-multiple', (
            <>
              <Text style={styles.subsectionTitle}>
                Choose which activity categories to get notified about:
              </Text>
              {Object.entries(notificationSettings.categories).map(([category, enabled]) => (
                <View key={category} style={styles.categoryItem}>
                  <Text style={styles.categoryName}>{category}</Text>
                  <Switch
                    value={enabled}
                    onValueChange={(value) => updateCategoryNotification(category, value)}
                    trackColor={{ false: '#ddd', true: '#667eea' }}
                    thumbColor={enabled ? '#fff' : '#f4f3f4'}
                  />
                </View>
              ))}
            </>
          ))}

          {/* Quiet Hours */}
          {renderSection('Quiet Hours', 'sleep', (
            <>
              {renderToggleItem(
                'Do Not Disturb',
                `Silent from ${formatTime(notificationSettings.quietHours.start)} to ${formatTime(notificationSettings.quietHours.end)}`,
                notificationSettings.quietHours.enabled,
                (value) => updateQuietHours('enabled', value),
                'moon-waning-crescent'
              )}
            </>
          ))}
        </>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Notification settings are saved automatically
        </Text>
      </View>

      {/* DateTimePicker would go here if installed */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  masterSwitch: {
    margin: 20,
  },
  masterSwitchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
  },
  masterSwitchContent: {
    flex: 1,
    marginLeft: 15,
  },
  masterSwitchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  masterSwitchSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  masterSwitchToggle: {
    transform: [{ scale: 1.2 }],
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#667eea20',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleItemText: {
    flex: 1,
  },
  toggleItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  toggleItemSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  subsectionTitle: {
    fontSize: 14,
    color: '#666',
    padding: 15,
    paddingBottom: 5,
  },
  priceSettings: {
    padding: 15,
    paddingTop: 0,
  },
  priceOption: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  priceOptionActive: {
    borderColor: '#667eea',
    backgroundColor: '#667eea10',
  },
  priceOptionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  priceOptionTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  priceThreshold: {
    alignItems: 'center',
  },
  priceThresholdLabel: {
    fontSize: 14,
    color: '#666',
  },
  digestSettings: {
    padding: 15,
    paddingTop: 0,
  },
  digestOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  digestOptionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryName: {
    fontSize: 15,
    color: '#333',
  },
  footer: {
    padding: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});

export default NotificationPreferencesScreen;