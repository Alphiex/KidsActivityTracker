import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { aiRobotImage } from '../assets/images';

// Use colorful emojis by default
const TabIcon = ({ emoji }: { emoji: string }) => {
  return <Text style={styles.iconEmoji}>{emoji}</Text>;
};

type TabName = 'Dashboard' | 'MapSearch' | 'AIChat' | 'Calendar' | null;

const TopTabNavigation = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Determine active tab based on current route
  // Returns null for screens that shouldn't show an active tab
  const getActiveTab = (): TabName => {
    const routeName = route.name;
    if (routeName === 'Dashboard' || routeName === 'Explore') return 'Dashboard';
    if (routeName === 'MapSearch') return 'MapSearch';
    if (routeName === 'AIChat') return 'AIChat';
    if (routeName === 'Calendar') return 'Calendar';
    // Return null for Preferences, Favourites, Friends & Family, AIRecommendations screens
    return null;
  };

  const activeTab = getActiveTab();

  const navigateToTab = (tab: TabName) => {
    if (!tab) return;
    // All top tab screens are in the HomeStack under FiltersTab
    // Need to navigate to the tab first, then the screen within the stack
    navigation.navigate('FiltersTab' as never, { screen: tab } as never);
  };

  return (
    <View style={styles.tabContainer} pointerEvents="box-none">
      {/* Explore Tab (was Activities) - goes to Dashboard */}
      <View style={styles.tabWrapper}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => navigateToTab('Dashboard')}
        >
          <TabIcon emoji="🎯" />
          <Text style={[
            styles.topButtonText,
            activeTab === 'Dashboard' && styles.activeTabText
          ]}>
            Explore
          </Text>
        </TouchableOpacity>
        {activeTab === 'Dashboard' && <View style={styles.activeTabLine} pointerEvents="none" />}
      </View>

      {/* Map Tab (was Filters) - goes to MapSearch */}
      <View style={styles.tabWrapper}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => navigateToTab('MapSearch')}
        >
          <TabIcon emoji="🗺️" />
          <Text style={[
            styles.topButtonText,
            activeTab === 'MapSearch' && styles.activeTabText
          ]}>
            Map
          </Text>
        </TouchableOpacity>
        {activeTab === 'MapSearch' && <View style={styles.activeTabLine} pointerEvents="none" />}
      </View>

      {/* AI Tab - goes to AIChat */}
      <View style={styles.tabWrapper}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => navigateToTab('AIChat')}
        >
          <View style={styles.aiIconWrapper}>
            <Image source={aiRobotImage} style={styles.aiRobotIcon} />
          </View>
          <Text style={[
            styles.topButtonText,
            activeTab === 'AIChat' && styles.activeTabText
          ]}>
            AI
          </Text>
        </TouchableOpacity>
        {activeTab === 'AIChat' && <View style={styles.activeTabLine} pointerEvents="none" />}
      </View>

      {/* Calendar Tab - unchanged */}
      <View style={styles.tabWrapper}>
        <TouchableOpacity
          style={styles.topButton}
          onPress={() => navigateToTab('Calendar')}
        >
          <TabIcon emoji="📅" />
          <Text style={[
            styles.topButtonText,
            activeTab === 'Calendar' && styles.activeTabText
          ]}>
            Calendar
          </Text>
        </TouchableOpacity>
        {activeTab === 'Calendar' && <View style={styles.activeTabLine} pointerEvents="none" />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  tabWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  topButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    position: 'relative',
  },
  iconEmoji: {
    fontSize: 28,
    marginBottom: 4,
    minHeight: 30,
    lineHeight: 34,
  },
  aiIconWrapper: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiRobotIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  topButtonText: {
    fontSize: 12,
    color: '#717171',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#222222',
    fontWeight: '600',
  },
  activeTabLine: {
    position: 'absolute',
    bottom: -4,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#222222',
    borderRadius: 1,
  },
});

export default TopTabNavigation;