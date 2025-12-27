import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import LoadingIndicator from '../components/LoadingIndicator';
import { Colors } from '../theme';
import { Activity } from '../types';
import sharingService from '../services/sharingService';
import { safeToISOString } from '../utils/safeAccessors';

interface SharedActivity extends Activity {
  sharedBy?: string;
  sharedDate?: Date;
  sharedNote?: string;
}

interface SharedSection {
  title: string;
  data: SharedActivity[];
}

const SharedActivitiesScreen = () => {
  const navigation = useNavigation();
  const [sections, setSections] = useState<SharedSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: 'Shared Activities',
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadSharedActivities();
  }, [navigation]);

  const loadSharedActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load shared children with their activities from the sharing service
      const sharedWithMe = await sharingService.getSharedWithMe();

      // Transform shared children data into activities grouped by sharer
      const sharedActivities: SharedActivity[] = [];

      for (const sharedChild of sharedWithMe) {
        // Get activities for this shared child (if available in the response)
        const childActivities = (sharedChild as any).activities || [];

        for (const activity of childActivities) {
          sharedActivities.push({
            ...activity,
            sharedBy: sharedChild.sharedByName || sharedChild.sharedByEmail || 'Unknown',
            sharedDate: sharedChild.sharedAt ? new Date(sharedChild.sharedAt) : undefined,
            sharedNote: `Activities for ${sharedChild.childName}`,
          });
        }

        // If no activities but we have a shared child, show it as a placeholder
        if (childActivities.length === 0 && sharedChild.childName) {
          // Could add a "no activities yet" placeholder per shared child
        }
      }

      // Group activities by who shared them
      const groupedActivities = sharedActivities.reduce((acc, activity) => {
        const sharedBy = activity.sharedBy || 'Unknown';
        if (!acc[sharedBy]) {
          acc[sharedBy] = [];
        }
        acc[sharedBy].push(activity);
        return acc;
      }, {} as Record<string, SharedActivity[]>);

      const sectionData: SharedSection[] = Object.entries(groupedActivities).map(([sharedBy, activities]) => ({
        title: `Shared by ${sharedBy}`,
        data: activities.sort((a, b) => {
          const dateA = a.sharedDate?.getTime() || 0;
          const dateB = b.sharedDate?.getTime() || 0;
          return dateB - dateA;
        }),
      }));

      setSections(sectionData);
    } catch (err: any) {
      console.error('Error loading shared activities:', err);
      setError(err.message || 'Failed to load shared activities');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSharedActivities();
  };

  const renderActivity = ({ item }: { item: SharedActivity }) => (
    <View style={styles.activityWrapper}>
      <ActivityCard
        activity={item}
        onPress={() => {
          const serializedActivity = {
            ...item,
            dateRange: item.dateRange ? {
              start: safeToISOString(item.dateRange.start),
              end: safeToISOString(item.dateRange.end),
            } : null,
            scrapedAt: safeToISOString(item.scrapedAt),
          };
          navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
        }}
      />
      {item.sharedNote && (
        <View style={styles.noteContainer}>
          <Icon name="message-text" size={16} color={Colors.textSecondary} />
          <Text style={styles.noteText}>{item.sharedNote}</Text>
        </View>
      )}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: SharedSection }) => (
    <View style={styles.sectionHeader}>
      <Icon name="account-circle" size={24} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>({section.data.length})</Text>
    </View>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#00BCD4', '#0097A7']}
      style={styles.header}
    >
      <Icon name="share-variant" size={50} color="#fff" />
      <Text style={styles.headerTitle}>Shared Activities</Text>
      <Text style={styles.headerSubtitle}>
        Activities shared with you by friends and family
      </Text>
    </LinearGradient>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="share-variant-outline" size={80} color={Colors.textSecondary} />
      <Text style={styles.emptyText}>No shared activities yet</Text>
      <Text style={styles.emptySubtext}>
        When friends and family share activities with you, they'll appear here
      </Text>
      <TouchableOpacity 
        style={styles.inviteButton}
        onPress={() => navigation.navigate('SharingManagement' as never)}
      >
        <Icon name="account-plus" size={20} color="#fff" />
        <Text style={styles.inviteButtonText}>Manage Sharing</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <LoadingIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shared activities...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="alert-circle" size={60} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSharedActivities}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          renderItem={renderActivity}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.emptyListContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  header: {
    padding: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  activityWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    marginTop: -8,
    marginHorizontal: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noteText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default SharedActivitiesScreen;