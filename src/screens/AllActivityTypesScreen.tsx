import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import ScreenBackground from '../components/ScreenBackground';

type NavigationProp = StackNavigationProp<any>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Header illustration - child exploring different activity types
const ActivityTypesHeaderImage = require('../assets/images/browse-activity-types-header.png');

interface ActivityType {
  id?: string;
  code: string;
  name: string;
  activityCount: number;
}

const ModernColors = {
  primary: '#E8638B',
  text: '#222222',
  textLight: '#717171',
  background: '#FFFFFF',
  border: '#EEEEEE',
};

// Extracted ListHeader to avoid nested component warning
const ListHeader: React.FC<{ count: number }> = ({ count }) => (
  <View style={styles.listHeaderContainer}>
    {/* Hero Image Section */}
    <View style={styles.heroSection}>
      <Image
        source={ActivityTypesHeaderImage}
        style={styles.heroImage}
        resizeMode="contain"
      />
    </View>

    {/* Title Section */}
    <View style={styles.titleSection}>
      <Text style={styles.mainTitle}>Explore Activities</Text>
      <Text style={styles.subtitle}>
        {count} activity types to discover
      </Text>
    </View>
  </View>
);

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

  const renderActivityType = ({ item }: { item: ActivityType }) => {
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
            {item.activityCount.toLocaleString()} {item.activityCount === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenBackground>
          {/* Sticky Header */}
          <View style={styles.stickyHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color={ModernColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Browse by Activity Type</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ModernColors.primary} />
            <Text style={styles.loadingText}>Loading activity types...</Text>
          </View>
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenBackground>
          {/* Sticky Header */}
          <View style={styles.stickyHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-left" size={24} color={ModernColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Browse by Activity Type</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={60} color={ModernColors.primary} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadActivityTypes}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </ScreenBackground>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenBackground>
        {/* Sticky Header */}
        <View style={styles.stickyHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Browse by Activity Type</Text>
          <View style={styles.headerSpacer} />
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
              colors={[ModernColors.primary]}
              tintColor={ModernColors.primary}
            />
          }
          ListHeaderComponent={<ListHeader count={activityTypes.length} />}
          showsVerticalScrollIndicator={false}
        />
      </ScreenBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  listHeaderContainer: {
    paddingBottom: 16,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  heroImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.5,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: ModernColors.textLight,
    lineHeight: 22,
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8F8F8',
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
    fontSize: 15,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 4,
  },
  typeCount: {
    fontSize: 13,
    color: ModernColors.textLight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: ModernColors.textLight,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: ModernColors.text,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: ModernColors.primary,
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
