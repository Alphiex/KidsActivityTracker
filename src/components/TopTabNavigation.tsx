import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type TabName = 'Dashboard' | 'Filters' | 'Calendar';

const TopTabNavigation = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Determine active tab based on current route
  const getActiveTab = (): TabName => {
    const routeName = route.name;
    if (routeName === 'Dashboard' || routeName === 'Explore') return 'Dashboard';
    if (routeName === 'Filters') return 'Filters';
    if (routeName === 'Calendar') return 'Calendar';
    return 'Dashboard';
  };

  const activeTab = getActiveTab();

  const navigateToTab = (tab: TabName) => {
    if (tab === 'Dashboard') {
      navigation.navigate('Dashboard' as never);
    } else if (tab === 'Filters') {
      navigation.navigate('Filters' as never);
    } else if (tab === 'Calendar') {
      navigation.navigate('Calendar' as never);
    }
  };

  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={styles.topButton}
        onPress={() => navigateToTab('Dashboard')}
      >
        <Icon
          name="target"
          size={28}
          color={activeTab === 'Dashboard' ? '#FF385C' : '#717171'}
        />
        <Text style={[
          styles.topButtonText,
          activeTab === 'Dashboard' && styles.activeTabText
        ]}>
          Activities
        </Text>
        {activeTab === 'Dashboard' && <View style={styles.activeTabLine} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.topButton}
        onPress={() => navigateToTab('Filters')}
      >
        <Icon
          name="magnify"
          size={28}
          color={activeTab === 'Filters' ? '#FF385C' : '#717171'}
        />
        <Text style={[
          styles.topButtonText,
          activeTab === 'Filters' && styles.activeTabText
        ]}>
          Filters
        </Text>
        {activeTab === 'Filters' && <View style={styles.activeTabLine} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.topButton}
        onPress={() => navigateToTab('Calendar')}
      >
        <Icon
          name="calendar-month"
          size={28}
          color={activeTab === 'Calendar' ? '#FF385C' : '#717171'}
        />
        <Text style={[
          styles.topButtonText,
          activeTab === 'Calendar' && styles.activeTabText
        ]}>
          Calendar
        </Text>
        {activeTab === 'Calendar' && <View style={styles.activeTabLine} />}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  topButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  iconContainer: {
    marginBottom: 4,
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
    bottom: -12,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#222222',
    borderRadius: 1,
  },
});

export default TopTabNavigation;