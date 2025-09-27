import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
import TopTabNavigation from '../components/TopTabNavigation';

const CalendarScreen = () => {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Navigation - Fixed at top */}
      <TopTabNavigation />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Your Activity Calendar
        </Text>
        <Text style={styles.headerSubtitle}>
          View your upcoming enrolled activities
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.placeholderCard}>
          <Icon name="calendar-month" size={80} color="#717171" />
          <Text style={styles.placeholderTitle}>
            Calendar View Coming Soon
          </Text>
          <Text style={styles.placeholderText}>
            This feature will display all your enrolled activities in a beautiful calendar view.
            You'll be able to see upcoming sessions, manage schedules, and set reminders.
          </Text>
        </View>

        <View style={styles.featureList}>
          <Text style={styles.featureTitle}>
            Upcoming Features:
          </Text>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>
              Monthly calendar view with enrolled activities
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>
              Weekly schedule view for quick overview
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>
              Activity reminders and notifications
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>
              Export to device calendar
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#717171',
  },
  content: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  contentContainer: {
    padding: 20,
  },
  placeholderCard: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#222222',
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    color: '#717171',
  },
  featureList: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    color: '#222222',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    color: '#717171',
  },
});

export default CalendarScreen;