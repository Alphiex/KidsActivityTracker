import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import { Colors } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

type NavigationProp = StackNavigationProp<any>;
type RouteParams = {
  activityType: string;
  activityTypeCode: string;
};

interface ActivitySubtype {
  code: string;
  name: string;
  activityCount: number;
}

const ActivityTypeSubtypesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { colors } = useTheme();
  
  const [subtypes, setSubtypes] = useState<ActivitySubtype[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { activityType, activityTypeCode } = route.params;

  const loadSubtypes = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      
      // Get the activity type details including subtypes
      const response = await activityService.getActivityTypeDetails(activityTypeCode || activityType);
      
      if (response && response.subtypes) {
        setSubtypes(response.subtypes);
      } else {
        setSubtypes([]);
      }
    } catch (err: any) {
      console.error('Error loading subtypes:', err);
      setError(err.message || 'Failed to load subtypes');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: activityType,
      headerStyle: {
        backgroundColor: colors.headerBackground,
      },
      headerTintColor: colors.headerText,
    });
    loadSubtypes();
  }, [activityType]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSubtypes();
  };

  const navigateToActivities = (subtype?: string) => {
    navigation.navigate('ActivityType', {
      category: activityType,
      subtype: subtype,
      isActivityType: true
    });
  };

  const getSubtypeIcon = (subtypeName: string) => {
    const iconMap: { [key: string]: string } = {
      // Swimming subtypes
      'Learn to Swim': 'swim',
      'Competitive Swimming': 'medal',
      'Diving': 'arrow-down-bold',
      'Water Polo': 'water-polo',
      'Aqua Fitness': 'dumbbell',
      'Lifeguard Training': 'whistle',
      'Water Safety': 'lifebuoy',
      
      // Team Sports subtypes
      'Basketball': 'basketball',
      'Soccer': 'soccer',
      'Volleyball': 'volleyball',
      'Baseball': 'baseball',
      'Hockey': 'hockey-sticks',
      'Football': 'football',
      
      // Martial Arts subtypes
      'Karate': 'karate',
      'Taekwondo': 'karate',
      'Boxing': 'boxing-glove',
      'Judo': 'karate',
      
      // Dance subtypes
      'Ballet': 'dance-ballroom',
      'Hip Hop': 'music',
      'Jazz Dance': 'music-note',
      'Tap Dance': 'shoe-formal',
      
      // Music subtypes
      'Piano': 'piano',
      'Guitar': 'guitar-acoustic',
      'Drums': 'drum',
      'Violin': 'violin',
      'Voice': 'microphone',
      
      // Default
      'default': 'tag'
    };
    
    return iconMap[subtypeName] || iconMap['default'];
  };

  const renderSubtype = ({ item }: { item: ActivitySubtype }) => {
    return (
      <TouchableOpacity
        style={styles.subtypeCard}
        onPress={() => navigateToActivities(item.name)}
        activeOpacity={0.8}
      >
        <View style={styles.subtypeContent}>
          <Icon 
            name={getSubtypeIcon(item.name)} 
            size={40} 
            color={Colors.primary} 
            style={styles.subtypeIcon}
          />
          <View style={styles.subtypeInfo}>
            <Text style={[styles.subtypeName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.subtypeCount, { color: colors.textSecondary }]}>
              {item.activityCount || 0} activities
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    // Show "View All Activities" button at the top
    return (
      <TouchableOpacity
        style={[styles.viewAllCard, { backgroundColor: Colors.primary }]}
        onPress={() => navigateToActivities()}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.viewAllGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name="view-grid" size={30} color="#fff" />
          <View style={styles.viewAllInfo}>
            <Text style={styles.viewAllTitle}>View All {activityType}</Text>
            <Text style={styles.viewAllSubtext}>Browse all activities in this category</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading subtypes...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={60} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSubtypes}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={subtypes}
        renderItem={renderSubtype}
        keyExtractor={(item) => item.code}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="folder-open" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No subtypes available
            </Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigateToActivities()}
            >
              <Text style={styles.viewAllButtonText}>View All Activities</Text>
            </TouchableOpacity>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 15,
  },
  viewAllCard: {
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  viewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  viewAllInfo: {
    flex: 1,
    marginLeft: 15,
  },
  viewAllTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  viewAllSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  subtypeCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginBottom: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subtypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtypeIcon: {
    marginRight: 15,
  },
  subtypeInfo: {
    flex: 1,
  },
  subtypeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtypeCount: {
    fontSize: 14,
    marginTop: 2,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
  },
  viewAllButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 25,
  },
  viewAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ActivityTypeSubtypesScreen;