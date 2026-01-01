import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';

type NavigationProp = StackNavigationProp<any>;

interface ActivityType {
  id?: string;
  code: string;
  name: string;
  activityCount: number;
}

const AllActivityTypesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivityTypes = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      // Load without filters to show all activity types
      const activityTypesData = await activityService.getActivityTypesWithCounts(false);

      // Sort by count descending
      const sortedTypes = activityTypesData.sort((a, b) => b.activityCount - a.activityCount);

      setActivityTypes(sortedTypes);
    } catch (err: any) {
      console.error('Error loading activity types:', err);
      setError(err.message || 'Failed to load activity types. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivityTypes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityTypes();
  };

  const navigateToActivityType = (item: ActivityType) => {
    navigation.navigate('ActivityTypeDetail', {
      activityType: {
        id: item.code,
        code: item.code,
        name: item.name
      }
    });
  };

  const renderActivityType = ({ item, index }: { item: ActivityType; index: number }) => {
    const imageKey = getActivityImageKey(item.name, item.code);
    const imageSource = getActivityImageByKey(imageKey, item.name);

    return (
      <TouchableOpacity
        style={styles.typeCard}
        onPress={() => navigateToActivityType(item)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.typeImage} />
        </View>
        <View style={styles.typeContent}>
          <Text style={styles.typeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.typeCount}>
            {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8638B" />
        <Text style={styles.loadingText}>Loading activity types...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle" size={60} color="#E8638B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadActivityTypes}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#222222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Activity Types</Text>
      </View>

      {/* Activity Types Grid */}
      <FlatList
        data={activityTypes}
        renderItem={renderActivityType}
        keyExtractor={(item) => item.code}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E8638B']}
            tintColor="#E8638B"
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.subtitle}>
              {activityTypes.length} types available
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222222',
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#717171',
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#F0F0F0',
  },
  typeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  typeContent: {
    padding: 12,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  typeCount: {
    fontSize: 13,
    color: '#717171',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 16,
    color: '#717171',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#222222',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#E8638B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AllActivityTypesScreen;