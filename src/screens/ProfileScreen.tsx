import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/slices/authSlice';
import { useTheme } from '../contexts/ThemeContext';
import { Colors } from '../theme';
import { APP_CONFIG } from '../config/app';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import * as SecureStore from '../utils/secureStorage';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { colors, isDark } = useTheme();
  const [userStats, setUserStats] = useState({
    favorites: 0,
    children: 0,
    enrolled: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    fetchUserStats();
  }, [user]);

  const fetchUserStats = async () => {
    if (!user?.id) {
      setIsLoadingStats(false);
      return;
    }

    try {
      const token = await SecureStore.getAccessToken();
      if (!token) {
        setIsLoadingStats(false);
        return;
      }

      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/api/v1/users/${user.id}/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setUserStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            dispatch(logout());
          },
        },
      ],
    );
  };

  const menuSections = [
    {
      title: 'Account',
      items: [
        {
          title: 'Children',
          subtitle: 'Manage your children\'s profiles',
          icon: 'account-child',
          iconColor: '#4CAF50',
          onPress: () => navigation.navigate('Children' as never),
        },
        {
          title: 'Site Accounts',
          subtitle: 'Manage provider credentials',
          icon: 'account-key',
          iconColor: '#FF9800',
          onPress: () => navigation.navigate('SiteAccounts' as never),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          title: 'Settings',
          subtitle: 'App settings and preferences',
          icon: 'cog',
          iconColor: '#2196F3',
          onPress: () => navigation.navigate('Settings' as never),
        },
        {
          title: 'Notification Preferences',
          subtitle: 'Control your notifications',
          icon: 'bell-outline',
          iconColor: '#9C27B0',
          onPress: () => navigation.navigate('NotificationPreferences' as never),
        },
        {
          title: 'Activity Preferences',
          subtitle: 'Set your activity preferences',
          icon: 'tune',
          iconColor: '#00BCD4',
          onPress: () => navigation.navigate('CategoryPreferences' as never),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          title: 'Help & FAQ',
          subtitle: 'Get help and answers',
          icon: 'help-circle-outline',
          iconColor: '#607D8B',
          onPress: () => Alert.alert('Help', 'Help section coming soon!'),
        },
        {
          title: 'Contact Support',
          subtitle: 'Reach out to our team',
          icon: 'email-outline',
          iconColor: '#795548',
          onPress: () => Alert.alert('Support', 'Support feature coming soon!'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <LinearGradient
          colors={isDark ? ['#1a1a1a', '#2d2d2d'] : [Colors.primary, Colors.primaryDark]}
          style={styles.header}
        >
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
              <Icon name="account" size={60} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {user?.isVerified === false && (
            <View style={styles.verificationBadge}>
              <Icon name="alert-circle" size={16} color="#FF9800" />
              <Text style={styles.verificationText}>Email not verified</Text>
            </View>
          )}
        </LinearGradient>

        {/* Stats Section */}
        <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
          {isLoadingStats ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{userStats.favorites}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Favorites</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{userStats.children}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Children</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{userStats.enrolled}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Enrolled</Text>
              </View>
            </>
          )}
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.menuSection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.divider,
                    },
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}>
                      <Icon name={item.icon} size={24} color={item.iconColor} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={[styles.menuItemText, { color: colors.text }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.menuItemSubtext, { color: colors.textSecondary }]}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['#FF5252', '#F44336']}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="logout" size={24} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            {APP_CONFIG.name}
          </Text>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            Version {APP_CONFIG.version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 40,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  userName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  verificationText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 5,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    margin: 20,
    marginTop: -20,
    borderRadius: 15,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
  },
  statDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: 20,
  },
  menuSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionContent: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuItemSubtext: {
    fontSize: 13,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
    fontWeight: '600',
  },
  versionContainer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  versionText: {
    fontSize: 12,
    marginBottom: 2,
  },
});

export default ProfileScreen;