import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ActivityService from '../services/activityService';
import ActivityTypeService from '../services/activityTypeService';
import PreferencesService from '../services/preferencesService';
import EmptyState from '../components/EmptyState';
import ScreenBackground from '../components/ScreenBackground';
import { getActivityImageKey } from '../utils/activityHelpers';
import { getActivityImageByKey } from '../assets/images';
import { Activity } from '../types';
import useWaitlistSubscription from '../hooks/useWaitlistSubscription';
import UpgradePromptModal from '../components/UpgradePromptModal';

const { height } = Dimensions.get('window');

interface Subtype {
  code: string;
  name: string;
  activityCount: number;
}

const ActivityTypeDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const params = route.params as any;
  const activityType = params?.activityType;
  const typeCode = activityType?.code || params?.typeCode;
  const typeName = activityType?.name || params?.typeName;

  const [_activities, setActivities] = useState<Activity[]>([]);
  const [subtypes, setSubtypes] = useState<Subtype[]>([]);
  const [selectedSubtype, _setSelectedSubtype] = useState<string | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [consecutiveEmptyResponses, setConsecutiveEmptyResponses] = useState(0);
  const MAX_EMPTY_RESPONSES = 3;

  const ITEMS_PER_PAGE = 50;

  const {
    showUpgradeModal: showWaitlistUpgradeModal,
    hideUpgradeModal: hideWaitlistUpgradeModal,
  } = useWaitlistSubscription();

  const loadTypeDetails = useCallback(async () => {
    try {
      setError(null);

      if (!typeName && !typeCode) {
        setError('Activity type not specified');
        setIsLoading(false);
        return;
      }

      const activityService = ActivityService.getInstance();
      const types = await activityService.getActivityTypesWithCounts();

      const currentType = types.find(t => t.name === typeName || t.code === typeCode);

      if (currentType && (currentType as any).subtypes) {
        const subtypesWithCounts = (currentType as any).subtypes
          .filter((s: any) => s.activityCount > 0)
          .map((subtype: any) => ({
            code: subtype.code,
            name: subtype.name,
            activityCount: subtype.activityCount
          }))
          .sort((a: any, b: any) => b.activityCount - a.activityCount);

        setSubtypes(subtypesWithCounts);
        setTotalCount(currentType.activityCount || 0);
      } else {
        const activityTypeService = ActivityTypeService.getInstance();
        const typeInfo = await activityTypeService.getActivityTypeWithSubtypes(typeName);

        if (typeInfo && typeInfo.subtypes) {
          const subtypesWithCounts = typeInfo.subtypes
            .filter((s: any) => s && s.count > 0 && s.name)
            .map((subtype: any) => ({
              code: subtype.code || (subtype.name ? subtype.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''),
              name: subtype.name || '',
              activityCount: subtype.count || 0
            }))
            .sort((a: any, b: any) => b.activityCount - a.activityCount);

          setSubtypes(subtypesWithCounts);
          setTotalCount(typeInfo.totalCount || 0);
        } else {
          setSubtypes([]);
          setTotalCount(0);
        }
      }
    } catch (err: any) {
      console.error('Error loading type details:', err);
      setError(err.message || 'Failed to load activity type details.');
    } finally {
      setIsLoading(false);
    }
  }, [typeName, typeCode]);

  const loadActivities = useCallback(async (reset = false) => {
    if (isLoadingMore && !reset) return;
    if (!reset && !hasMore) return;

    try {
      if (reset) {
        setCurrentOffset(0);
        setHasMore(true);
        setConsecutiveEmptyResponses(0);
      }
      setIsLoadingMore(!reset);
      setError(null);

      const offset = reset ? 0 : currentOffset;
      const activityService = ActivityService.getInstance();
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();

      const result = await activityService.searchActivities({
        activityType: typeName,
        subtype: selectedSubtype || undefined,
        lat: preferences?.location?.lat,
        lng: preferences?.location?.lng,
        maxDistance: preferences?.maxDistance || 50,
        limit: ITEMS_PER_PAGE,
        offset: offset,
      });

      if (result.activities.length === 0) {
        const newEmptyCount = consecutiveEmptyResponses + 1;
        setConsecutiveEmptyResponses(newEmptyCount);
        if (newEmptyCount >= MAX_EMPTY_RESPONSES) {
          setHasMore(false);
        }
      } else {
        setConsecutiveEmptyResponses(0);
      }

      if (reset) {
        setActivities(result.activities);
      } else {
        setActivities(prev => [...prev, ...result.activities]);
      }

      setTotalCount(result.total);
      setCurrentOffset(offset + result.activities.length);
      setHasMore(offset + result.activities.length < result.total);
    } catch (err: any) {
      console.error('Error loading activities:', err);
      setError(err.message || 'Failed to load activities.');
    } finally {
      setIsLoadingMore(false);
      setRefreshing(false);
    }
  }, [typeName, selectedSubtype, isLoadingMore, hasMore, currentOffset, consecutiveEmptyResponses]);

  useEffect(() => {
    loadTypeDetails();
  }, [loadTypeDetails]);

  useEffect(() => {
    if (selectedSubtype !== undefined && !isLoading) {
      loadActivities(true);
    }
  }, [selectedSubtype, isLoading, loadActivities]);

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedSubtype === undefined) {
      loadTypeDetails();
    } else {
      loadActivities(true);
    }
  };

  const selectSubtype = (subtypeName: string | null) => {
    navigation.navigate('UnifiedResults' as never, {
      type: 'activityType',
      title: subtypeName || `All ${typeName}`,
      subtitle: `${typeName} activities`,
      activityType: typeName,
      subtype: subtypeName,
    } as never);
  };

  // Get the header image for this activity type
  const getHeaderImage = () => {
    const imageKey = getActivityImageKey(typeName || '', typeCode || '');
    return getActivityImageByKey(imageKey, typeName);
  };

  const renderHeroHeader = () => {
    const headerImage = getHeaderImage();

    return (
      <View style={styles.headerContainer}>
        <ImageBackground
          source={headerImage}
          style={styles.heroSection}
          imageStyle={styles.heroImageStyle}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
            style={styles.heroGradient}
          >
            {/* Back Button only - no filter button */}
            <SafeAreaView edges={['top']} style={styles.heroTopRow}>
              <TouchableOpacity style={styles.backButtonHero} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonInner}>
                  <Icon name="arrow-left" size={22} color="#333" />
                </View>
              </TouchableOpacity>
              <View style={styles.spacer} />
            </SafeAreaView>

            {/* Title and Count */}
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle} numberOfLines={2}>{typeName}</Text>
            </View>
            <View style={styles.countBadgeRow}>
              <View style={styles.countBadge}>
                <Text style={styles.countNumber}>{totalCount.toLocaleString()}</Text>
                <Text style={styles.countLabel}>ACTIVITIES</Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  };

  const renderSubtypeCard = ({ item }: { item: Subtype }) => {
    const itemImageKey = getActivityImageKey(item.name, item.code);
    const imageSource = getActivityImageByKey(itemImageKey, activityType?.name);

    return (
      <TouchableOpacity
        style={styles.subtypeCard}
        onPress={() => selectSubtype(item.name)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.subtypeImage} />
        </View>
        <View style={styles.subtypeContent}>
          <Text style={styles.subtypeName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.subtypeCount}>
            {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ScreenBackground>
        {renderHeroHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8638B" />
          <Text style={styles.loadingText}>Loading {typeName}...</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (error) {
    return (
      <ScreenBackground>
        {renderHeroHeader()}
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle"
            title="Something went wrong"
            subtitle={error}
          />
          <TouchableOpacity style={styles.retryButton} onPress={() => loadTypeDetails()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScreenBackground>
    );
  }

  // Show subtypes selection screen
  return (
    <ScreenBackground>
      {renderHeroHeader()}
      <FlatList
        data={subtypes}
        renderItem={renderSubtypeCard}
        keyExtractor={(item) => item.code}
        numColumns={2}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E8638B']}
            tintColor="#E8638B"
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => selectSubtype(null)}
              activeOpacity={0.7}
            >
              <Icon name="view-list" size={20} color="#E8638B" />
              <Text style={styles.viewAllText}>View All {typeName}</Text>
              <Text style={styles.viewAllCount}>({totalCount} activities)</Text>
              <Icon name="chevron-right" size={20} color="#717171" />
            </TouchableOpacity>
            {subtypes.length > 0 && (
              <Text style={styles.subtitle}>Browse by category</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No categories found"
            subtitle="View all activities to see what's available"
          />
        }
      />

      <UpgradePromptModal
        visible={showWaitlistUpgradeModal}
        feature="notifications"
        onClose={hideWaitlistUpgradeModal}
      />
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 16,
  },
  heroSection: {
    height: height * 0.22,
    width: '100%',
  },
  heroImageStyle: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroGradient: {
    flex: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonHero: {},
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  spacer: {
    width: 44,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E8638B',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginLeft: 12,
    flex: 1,
  },
  viewAllCount: {
    fontSize: 14,
    color: '#717171',
    marginRight: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#717171',
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  subtypeCard: {
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
    height: 100,
    backgroundColor: '#F8F8F8',
  },
  subtypeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  subtypeContent: {
    padding: 12,
  },
  subtypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  subtypeCount: {
    fontSize: 12,
    color: '#717171',
  },
  listContent: {
    paddingBottom: 20,
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
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    color: '#717171',
    marginTop: 4,
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#717171',
  },
  endText: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '500',
  },
});

export default ActivityTypeDetailScreen;
