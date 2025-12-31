import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SkillProgressCard, SkillProgress } from '../../components/skills';
import { Colors, Theme } from '../../theme';
import { API_CONFIG } from '../../config/api';
import { useAppSelector } from '../../store';

interface Child {
  id: string;
  name: string;
  dateOfBirth: string;
}

const ChildProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { child } = route.params as { child: Child };
  const { token } = useAppSelector((state) => state.auth);

  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, [child.id]);

  const loadSkills = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/children/${child.id}/skills`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      
      if (data.success) {
        setSkills(data.skills || []);
      } else {
        setError(data.error || 'Failed to load skills');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSkills();
  };

  const getTotalStats = () => {
    return skills.reduce(
      (acc, skill) => ({
        totalActivities: acc.totalActivities + skill.activitiesCompleted,
        totalHours: acc.totalHours + skill.totalHours,
        totalAchievements: acc.totalAchievements + skill.achievements.length,
      }),
      { totalActivities: 0, totalHours: 0, totalAchievements: 0 }
    );
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#222" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{child.name}'s Progress</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading skills...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{child.name}'s Progress</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Overall Progress</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Icon name="star-circle" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.summaryValue}>{skills.length}</Text>
              <Text style={styles.summaryLabel}>Skills</Text>
            </View>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryIcon, { backgroundColor: Colors.success + '20' }]}>
                <Icon name="checkbox-marked-circle" size={24} color={Colors.success} />
              </View>
              <Text style={styles.summaryValue}>{stats.totalActivities}</Text>
              <Text style={styles.summaryLabel}>Activities</Text>
            </View>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryIcon, { backgroundColor: Colors.secondary + '20' }]}>
                <Icon name="clock" size={24} color={Colors.secondary} />
              </View>
              <Text style={styles.summaryValue}>{Math.round(stats.totalHours)}h</Text>
              <Text style={styles.summaryLabel}>Total Time</Text>
            </View>
            <View style={styles.summaryStat}>
              <View style={[styles.summaryIcon, { backgroundColor: '#FEF3C7' }]}>
                <Icon name="trophy" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.summaryValue}>{stats.totalAchievements}</Text>
              <Text style={styles.summaryLabel}>Badges</Text>
            </View>
          </View>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={48} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadSkills}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!error && skills.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Icon name="school" size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No Skills Yet</Text>
            <Text style={styles.emptyText}>
              Skills will be tracked as {child.name} completes activities.
              Register for activities to start building skills!
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => (navigation as any).navigate('Dashboard')}
            >
              <Icon name="magnify" size={18} color="#FFF" />
              <Text style={styles.browseButtonText}>Browse Activities</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Skills List */}
        {skills.length > 0 && (
          <View style={styles.skillsSection}>
            <Text style={styles.sectionTitle}>Skills in Progress</Text>
            {skills.map((skill) => (
              <SkillProgressCard
                key={skill.id}
                skill={skill}
              />
            ))}
          </View>
        )}

        {/* Tip Section */}
        {skills.length > 0 && (
          <View style={styles.tipCard}>
            <Icon name="lightbulb-outline" size={24} color="#F59E0B" />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Keep it up!</Text>
              <Text style={styles.tipText}>
                Regular practice helps build skills faster. Try to complete at least
                one activity per week in each skill area.
              </Text>
            </View>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Theme.shadows.md,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStat: {
    alignItems: 'center',
    flex: 1,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222222',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 20,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skillsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B45309',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  bottomPadding: {
    height: 40,
  },
});

export default ChildProgressScreen;
