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
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import ScreenBackground from '../components/ScreenBackground';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import EmptyState from '../components/EmptyState';

type NavigationProp = StackNavigationProp<any>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Header image
const ActivityTypesHeaderImage = require('../assets/images/browse-activity-types-header.png');

interface ActivityType {
  id?: string;
  code: string;
  name: string;
  activityCount: number;
}

const AllActivityTypesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivityTypes = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      const activityTypesData = await activityService.getActivityTypesWithCounts(false);

      // Sort by count descending
      const sortedTypes = activityTypesData.sort((a, b) => b.activityCount - a.activityCount);

      // Calculate total activities
      const total = sortedTypes.reduce((sum, type) => sum + type.activityCount, 0);
      setTotalActivities(total);

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
        <View style={styles.cardImageContainer}>
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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <ImageBackground
        source={ActivityTypesHeaderImage}
        style={styles.heroSection}
        imageStyle={styles.heroImageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
          style={styles.heroGradient}
        >
          {/* Back Button */}
          <SafeAreaView edges={['top']} style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backButtonHero} onPress={() => navigation.goBack()}>
              <View style={styles.backButtonInner}>
                <Icon name="arrow-left" size={22} color="#333" />
              </View>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Title */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Activity Types</Text>
          </View>

          {/* Count Badge */}
          <View style={styles.countBadgeRow}>
            <View style={styles.countBadge}>
              <Text style={styles.countNumber}>{totalActivities.toLocaleString()}</Text>
              <Text style={styles.countLabel}>activities</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenBackground>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8638B" />
          <Text style={styles.loadingText}>Loading activity types...</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (error) {
    return (
      <ScreenBackground>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle"
            title="Something went wrong"
            subtitle={error}
          />
          <TouchableOpacity style={styles.retryButton} onPress={loadActivityTypes}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      {renderHeader()}
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
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="shape-outline"
            title="No activity types"
            subtitle="Check back later for new activities"
          />
        }
      />
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 16,
  },
  heroSection: {
    height: SCREEN_HEIGHT * 0.26,
    width: '100%',
  },
  heroImageStyle: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    resizeMode: 'cover',
    top: 30,
  },
  heroGradient: {
    flex: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  backButtonHero: {},
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  countBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8638B',
  },
  countLabel: {
    fontSize: 14,
    fontWeight: '500',
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 100,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  typeCount: {
    fontSize: 12,
    color: '#717171',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  retryButton: {
    backgroundColor: '#E8638B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AllActivityTypesScreen;
