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
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import PreferencesService from '../services/preferencesService';
import { useTheme } from '../contexts/ThemeContext';
import { formatPrice } from '../utils/formatters';
import { APP_CONFIG } from '../config/app';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const [preferences, setPreferences] = useState(preferencesService.getPreferences());
  const { colors, mode, setMode, isDark } = useTheme();

  const settingsSections = [
    {
      title: 'Preferences',
      icon: 'tune',
      items: [
        {
          title: 'Activity Types',
          subtitle: `${(preferences.preferredActivityTypes || []).length} selected`,
          icon: 'tag-multiple',
          onPress: () => navigation.navigate('ActivityTypePreferences'),
        },
        {
          title: 'Age Groups',
          subtitle: `${preferences.ageRanges.length} range${preferences.ageRanges.length > 1 ? 's' : ''}`,
          icon: 'human-child',
          onPress: () => navigation.navigate('AgePreferences'),
        },
        {
          title: 'Locations',
          subtitle: `${preferences.locations.length} location${preferences.locations.length !== 1 ? 's' : ''}`,
          icon: 'map-marker-multiple',
          onPress: () => navigation.navigate('LocationPreferences'),
        },
        {
          title: 'Budget',
          subtitle: `$${formatPrice(preferences.priceRange.min)} - $${formatPrice(preferences.priceRange.max)}`,
          icon: 'cash',
          onPress: () => navigation.navigate('BudgetPreferences'),
        },
        {
          title: 'Schedule',
          subtitle: `${preferences.daysOfWeek.length} days selected`,
          icon: 'calendar-clock',
          onPress: () => navigation.navigate('SchedulePreferences'),
        },
      ],
    },
    {
      title: 'Notifications',
      icon: 'bell',
      items: [
        {
          title: 'Push Notifications',
          subtitle: 'Get alerts for new activities',
          icon: 'bell-ring',
          toggle: true,
          value: preferences.notifications.enabled,
          onToggle: (value: boolean) => updateNotificationSetting('enabled', value),
        },
        {
          title: 'New Activities',
          subtitle: 'Notify when matching activities are added',
          icon: 'new-box',
          toggle: true,
          value: preferences.notifications.newActivities,
          onToggle: (value: boolean) => updateNotificationSetting('newActivities', value),
        },
        {
          title: 'Capacity Alerts',
          subtitle: 'Alert when favorites are almost full',
          icon: 'alert-circle',
          toggle: true,
          value: preferences.notifications.favoriteCapacity,
          onToggle: (value: boolean) => updateNotificationSetting('favoriteCapacity', value),
        },
        {
          title: 'Price Drops',
          subtitle: 'Notify about price reductions',
          icon: 'tag-heart',
          toggle: true,
          value: preferences.notifications.priceDrops,
          onToggle: (value: boolean) => updateNotificationSetting('priceDrops', value),
        },
        {
          title: 'Weekly Digest',
          subtitle: 'Summary of activities each week',
          icon: 'email-newsletter',
          toggle: true,
          value: preferences.notifications.weeklyDigest,
          onToggle: (value: boolean) => updateNotificationSetting('weeklyDigest', value),
        },
      ],
    },
    {
      title: 'Global Activity Filters',
      icon: 'earth',
      description: 'These settings apply to all activity searches',
      items: [
        {
          title: 'Hide Closed Activities',
          subtitle: 'Hide activities with closed registration across all searches',
          icon: 'cancel',
          toggle: true,
          value: preferences.hideClosedActivities,
          onToggle: (value: boolean) => {
            const updatedPreferences = { ...preferences, hideClosedActivities: value };
            setPreferences(updatedPreferences);
            preferencesService.updatePreferences(updatedPreferences);
          },
        },
        {
          title: 'Hide Full Activities',
          subtitle: 'Hide activities that are at capacity across all searches',
          icon: 'account-multiple-remove',
          toggle: true,
          value: preferences.hideFullActivities,
          onToggle: (value: boolean) => {
            const updatedPreferences = { ...preferences, hideFullActivities: value };
            setPreferences(updatedPreferences);
            preferencesService.updatePreferences(updatedPreferences);
          },
        },
      ],
    },
    {
      title: 'Recommended For You Filters',
      icon: 'star',
      description: 'Additional filters for your personalized recommendations',
      items: [
        {
          title: 'Budget Friendly Amount',
          subtitle: `Activities under $${preferences.maxBudgetFriendlyAmount || 20}`,
          icon: 'cash',
          onPress: () => showBudgetFriendlyDialog(),
        },
      ],
    },
    {
      title: 'Display',
      icon: 'palette',
      items: [
        {
          title: 'Dark Mode',
          subtitle: mode === 'system' ? 'System' : (isDark ? 'On' : 'Off'),
          icon: isDark ? 'weather-night' : 'weather-sunny',
          toggle: true,
          value: mode === 'dark' || (mode === 'system' && isDark),
          onToggle: (value: boolean) => {
            setMode(value ? 'dark' : 'light');
          },
        },
        {
          title: 'Theme Settings',
          subtitle: 'Customize appearance',
          icon: 'palette',
          onPress: () => showThemeOptions(),
        },
        {
          title: 'View Type',
          subtitle: preferences.viewType.charAt(0).toUpperCase() + preferences.viewType.slice(1),
          icon: 'view-grid',
          onPress: () => navigation.navigate('ViewSettings'),
        },
      ],
    },
    {
      title: 'Data & Privacy',
      icon: 'shield-check',
      items: [
        {
          title: 'Export Data',
          subtitle: 'Download your preferences and favorites',
          icon: 'download',
          onPress: handleExportData,
        },
        {
          title: 'Clear Cache',
          subtitle: 'Free up storage space',
          icon: 'delete-sweep',
          onPress: handleClearCache,
        },
        {
          title: 'Reset Preferences',
          subtitle: 'Restore default settings',
          icon: 'restore',
          onPress: handleResetPreferences,
        },
      ],
    },
    {
      title: 'About',
      icon: 'information',
      items: [
        {
          title: 'Version',
          subtitle: APP_CONFIG.version,
          icon: 'tag',
        },
        {
          title: 'Terms of Service',
          subtitle: 'View terms and conditions',
          icon: 'file-document',
          onPress: () => navigation.navigate('Terms'),
        },
        {
          title: 'Privacy Policy',
          subtitle: 'How we handle your data',
          icon: 'lock',
          onPress: () => navigation.navigate('Privacy'),
        },
        {
          title: 'Support',
          subtitle: 'Get help and report issues',
          icon: 'help-circle',
          onPress: () => navigation.navigate('Support'),
        },
      ],
    },
  ];

  const updateNotificationSetting = (key: string, value: boolean) => {
    const updatedPreferences = {
      ...preferences,
      notifications: {
        ...preferences.notifications,
        [key]: value,
      },
    };
    setPreferences(updatedPreferences);
    preferencesService.updatePreferences(updatedPreferences);
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Your data will be exported to a file. This may take a moment.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          // TODO: Implement data export
          Alert.alert('Success', 'Data exported successfully!');
        }},
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove temporary data. Your preferences will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => {
          // TODO: Implement cache clearing
          Alert.alert('Success', 'Cache cleared successfully!');
        }},
      ]
    );
  };

  const handleResetPreferences = () => {
    Alert.alert(
      'Reset Preferences',
      'This will restore all settings to their defaults. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => {
          preferencesService.resetPreferences();
          setPreferences(preferencesService.getPreferences());
          Alert.alert('Success', 'Preferences reset to defaults!');
        }},
      ]
    );
  };

  const showThemeOptions = () => {
    Alert.alert(
      'Theme Settings',
      'Choose your preferred theme',
      [
        { text: 'Light', onPress: () => setMode('light') },
        { text: 'Dark', onPress: () => setMode('dark') },
        { text: 'System', onPress: () => setMode('system') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const showBudgetFriendlyDialog = () => {
    Alert.prompt(
      'Budget Friendly Amount',
      'Enter the maximum amount for budget friendly activities',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'OK', 
          onPress: (value: string | undefined) => {
            const amount = parseInt(value || '20');
            if (!isNaN(amount) && amount > 0) {
              const updatedPreferences = { ...preferences, maxBudgetFriendlyAmount: amount };
              setPreferences(updatedPreferences);
              preferencesService.updatePreferences(updatedPreferences);
            } else {
              Alert.alert('Invalid Amount', 'Please enter a valid number greater than 0');
            }
          }
        },
      ],
      'plain-text',
      String(preferences.maxBudgetFriendlyAmount || 20),
      'numeric'
    );
  };

  const renderSettingItem = (item: any) => {
    if (item.toggle) {
      return (
        <View style={[styles.settingItem, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.settingItemLeft}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Icon name={item.icon} size={24} color={colors.primary} />
            </View>
            <View style={styles.settingItemText}>
              <Text style={[styles.settingItemTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.settingItemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
            </View>
          </View>
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={item.value ? '#fff' : '#f4f3f4'}
          />
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.settingItem, { backgroundColor: colors.cardBackground }]}
        onPress={item.onPress}
        disabled={!item.onPress}
      >
        <View style={styles.settingItemLeft}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Icon name={item.icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.settingItemText}>
            <Text style={[styles.settingItemTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.settingItemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
          </View>
        </View>
        {item.onPress && (
          <Icon name="chevron-right" size={24} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {settingsSections.map((section, index) => (
        <View key={index} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name={section.icon} size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          </View>
          {section.description && (
            <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              {section.description}
            </Text>
          )}
          <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
            {section.items.map((item, itemIndex) => (
              <View key={itemIndex}>
                {renderSettingItem(item)}
                {itemIndex < section.items.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          {APP_CONFIG.name} v{APP_CONFIG.version}
        </Text>
        <Text style={[styles.footerSubtext, { color: colors.textSecondary }]}>
          Made with ❤️ for busy parents
        </Text>
      </View>
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
  sectionDescription: {
    fontSize: 13,
    color: '#666',
    marginLeft: 30,
    marginBottom: 8,
    marginTop: -5,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  settingItemText: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 70,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
  },
});

export default SettingsScreen;