import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  FlatList,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import PreferencesService from '../services/preferencesService';
import ActivityService from '../services/activityService';
import FavoritesService from '../services/favoritesService';
import Card from '../components/modern/Card';
import Badge from '../components/modern/Badge';
import SearchBar from '../components/modern/SearchBar';
import ActivityCard from '../components/modern/ActivityCard';
import { 
  ModernColors, 
  ModernSpacing, 
  ModernTypography, 
  ModernBorderRadius,
  ActivityTypeEmojis,
  AgeGroupEmojis,
} from '../theme/modernTheme';

const { width } = Dimensions.get('window');

const recommendedSearches = [
  'Swimming lessons',
  'Art classes', 
  'Soccer camps',
  'Music lessons',
  'Dance classes',
  'Coding workshops',
];

const DashboardScreenModern = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newActivities, setNewActivities] = useState<any[]>([]);
  const [budgetFriendlyActivities, setBudgetFriendlyActivities] = useState<any[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [stats, setStats] = useState({
    matchingActivities: 0,
    newThisWeek: 0,
    savedFavorites: 0,
    budgetFriendly: 0,
    budgetFriendlyUnfiltered: 0,
    budgetFriendlyFilteredOut: 0,
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const activityService = ActivityService.getInstance();
      const favoritesService = FavoritesService.getInstance();
      const preferencesService = PreferencesService.getInstance();
      const preferences = preferencesService.getPreferences();

      // Load new activities
      const newResult = await activityService.searchActivitiesPaginated({
        limit: 3,
        offset: 0,
        sortBy: 'newest',
      });
      setNewActivities(newResult.items);
      setStats(prev => ({ ...prev, newThisWeek: newResult.total }));

      // Load budget friendly activities  
      const budgetParams: any = {
        maxCost: 20,
        limit: 3,
        offset: 0,
      };
      
      // Apply global filters
      if (preferences.hideClosedActivities) {
        budgetParams.hideClosedActivities = true;
      }
      if (preferences.hideFullActivities) {
        budgetParams.hideFullActivities = true;
      }
      if (preferences.locations && preferences.locations.length > 0) {
        budgetParams.locations = preferences.locations;
      }

      const budgetResult = await activityService.searchActivitiesPaginated(budgetParams);
      setBudgetFriendlyActivities(budgetResult.items);
      
      // Get unfiltered count for transparency
      const unfilteredBudgetResult = await activityService.searchActivitiesPaginated({
        maxCost: 20,
        limit: 1,
      });
      
      setStats(prev => ({ 
        ...prev, 
        budgetFriendly: budgetResult.total,
        budgetFriendlyUnfiltered: unfilteredBudgetResult.total,
        budgetFriendlyFilteredOut: unfilteredBudgetResult.total - budgetResult.total,
      }));

      // Load activity types with counts
      const typesWithCounts = await activityService.getActivityTypesWithCounts();
      setActivityTypes(typesWithCounts.slice(0, 6));

      // Load favorites count
      const favorites = await favoritesService.getFavorites();
      setStats(prev => ({ ...prev, savedFavorites: favorites.length }));

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleSearch = () => {
    navigation.navigate('Search' as never, { query: searchQuery } as never);
  };

  const handleFilter = () => {
    navigation.navigate('Search' as never, { openFilter: true } as never);
  };

  const renderQuickActionCard = (
    title: string,
    subtitle: string,
    icon: string,
    gradientColors: string[],
    onPress: () => void
  ) => (
    <Card
      onPress={onPress}
      gradientColors={gradientColors}
      style={styles.quickActionCard}
      animated
      shadow="lg"
    >
      <View style={styles.quickActionContent}>
        <Icon name={icon} size={32} color={ModernColors.textOnPrimary} />
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
    </Card>
  );

  const renderActivityType = ({ item }: any) => (
    <Card
      onPress={() => navigation.navigate('ActivityTypeDetail' as never, { 
        typeCode: item.code, 
        typeName: item.name 
      } as never)}
      style={styles.activityTypeCard}
      animated
      backgroundColor={ModernColors.surface}
      borderColor={ModernColors.borderLight}
    >
      <View style={styles.activityTypeContent}>
        <Text style={styles.activityTypeEmoji}>
          {ActivityTypeEmojis[item.name] || '🎯'}
        </Text>
        <Text style={styles.activityTypeName}>{item.name}</Text>
        <Text style={styles.activityTypeCount}>{item.activityCount}</Text>
      </View>
    </Card>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={ModernColors.background} />
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={ModernColors.primaryGradient}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.openDrawer?.()} style={styles.menuButton}>
                <Icon name="menu" size={28} color={ModernColors.textOnPrimary} />
              </TouchableOpacity>
              <View>
                <Text style={styles.appName}>KidsPlay</Text>
                <Text style={styles.appTagline}>Find Amazing Activities</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton}>
                <Icon name="bell-outline" size={24} color={ModernColors.textOnPrimary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => navigation.navigate('Profile' as never)}
              >
                <Icon name="account-circle-outline" size={24} color={ModernColors.textOnPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>
              Discover Amazing Activities for Your Kids! 🌟
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Find the perfect activities to keep your children engaged, learning, and having fun
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <SearchBar
              placeholder="Search for activities, locations, or age groups..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSearch={handleSearch}
              onFilter={handleFilter}
            />
          </View>

          {/* Recommended Searches */}
          <Card style={styles.recommendedCard} padding="lg">
            <View style={styles.sectionHeader}>
              <Icon name="sparkles" size={20} color={ModernColors.primary} />
              <Text style={styles.sectionTitle}>Recommended Searches</Text>
            </View>
            <View style={styles.badgeContainer}>
              {recommendedSearches.map((search, index) => (
                <Badge
                  key={index}
                  variant="ghost"
                  size="lg"
                  onPress={() => {
                    setSearchQuery(search);
                    handleSearch();
                  }}
                  style={styles.searchBadge}
                >
                  {search}
                </Badge>
              ))}
            </View>
          </Card>

          {/* Quick Actions Grid */}
          <View style={styles.quickActionsGrid}>
            {renderQuickActionCard(
              'Browse by Location',
              'Find activities near you',
              'map-marker',
              ModernColors.categoryGradients.location,
              () => navigation.navigate('LocationBrowse' as never)
            )}
            {renderQuickActionCard(
              'Favorites',
              `${stats.savedFavorites} saved`,
              'heart',
              ModernColors.categoryGradients.favorites,
              () => navigation.navigate('Favorites' as never)
            )}
            {renderQuickActionCard(
              'Budget Friendly',
              `${stats.budgetFriendly} activities`,
              'currency-usd',
              ModernColors.categoryGradients.budget,
              () => navigation.navigate('ActivityList' as never, {
                category: 'Budget Friendly',
                filters: { maxCost: 20 }
              } as never)
            )}
            {renderQuickActionCard(
              'New Activities',
              `${stats.newThisWeek} this week`,
              'calendar-star',
              ModernColors.categoryGradients.new,
              () => navigation.navigate('NewActivities' as never)
            )}
          </View>

          {/* New Activities Section */}
          {newActivities.length > 0 && (
            <Card style={styles.sectionCard} padding="lg">
              <View style={styles.sectionHeader}>
                <Icon name="sparkles" size={20} color={ModernColors.success} />
                <Text style={styles.sectionTitle}>New Activities This Week</Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('NewActivities' as never)}
                  style={styles.seeAllButton}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                  <Icon name="chevron-right" size={16} color={ModernColors.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {newActivities.map((activity) => (
                  <View key={activity.id} style={styles.activityCardWrapper}>
                    <ActivityCard
                      activity={{ ...activity, isNew: true }}
                      onPress={() => navigation.navigate('ActivityDetail' as never, {
                        activity: {
                          ...activity,
                          dateRange: activity.dateRange ? {
                            start: activity.dateRange.start.toISOString(),
                            end: activity.dateRange.end.toISOString(),
                          } : null,
                        }
                      } as never)}
                    />
                  </View>
                ))}
              </ScrollView>
            </Card>
          )}

          {/* Budget Friendly Activities */}
          {budgetFriendlyActivities.length > 0 && (
            <Card style={styles.sectionCard} padding="lg">
              <View style={styles.sectionHeader}>
                <Icon name="currency-usd" size={20} color={ModernColors.accent} />
                <Text style={styles.sectionTitle}>Budget Friendly Activities</Text>
                {stats.budgetFriendlyFilteredOut > 0 && (
                  <Text style={styles.filteredText}>
                    ({stats.budgetFriendlyFilteredOut} filtered)
                  </Text>
                )}
              </View>
              <View style={styles.compactList}>
                {budgetFriendlyActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    variant="compact"
                    onPress={() => navigation.navigate('ActivityDetail' as never, {
                      activity: {
                        ...activity,
                        dateRange: activity.dateRange ? {
                          start: activity.dateRange.start.toISOString(),
                          end: activity.dateRange.end.toISOString(),
                        } : null,
                      }
                    } as never)}
                  />
                ))}
              </View>
              <TouchableOpacity 
                style={styles.viewMoreButton}
                onPress={() => navigation.navigate('ActivityList' as never, {
                  category: 'Budget Friendly',
                  filters: { maxCost: 20 }
                } as never)}
              >
                <Text style={styles.viewMoreText}>View All Budget Activities</Text>
                <Icon name="arrow-right" size={20} color={ModernColors.primary} />
              </TouchableOpacity>
            </Card>
          )}

          {/* Browse by Activity Type */}
          {activityTypes.length > 0 && (
            <Card style={styles.sectionCard} padding="lg">
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Browse by Activity Type</Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('AllActivityTypes' as never)}
                  style={styles.seeAllButton}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                  <Icon name="chevron-right" size={16} color={ModernColors.primary} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={activityTypes}
                renderItem={renderActivityType}
                keyExtractor={(item) => item.code}
                numColumns={3}
                scrollEnabled={false}
                columnWrapperStyle={styles.activityTypeRow}
              />
            </Card>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  header: {
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: ModernSpacing.md,
    borderBottomLeftRadius: ModernBorderRadius.xxl,
    borderBottomRightRadius: ModernBorderRadius.xxl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ModernSpacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    marginRight: ModernSpacing.md,
  },
  appName: {
    fontSize: ModernTypography.sizes['2xl'],
    fontWeight: ModernTypography.weights.bold as any,
    color: ModernColors.textOnPrimary,
  },
  appTagline: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textOnPrimary,
    opacity: 0.9,
  },
  headerRight: {
    flexDirection: 'row',
    gap: ModernSpacing.sm,
  },
  headerButton: {
    padding: ModernSpacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    padding: ModernSpacing.lg,
    paddingBottom: 0,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: ModernTypography.sizes['3xl'],
    fontWeight: ModernTypography.weights.bold as any,
    color: ModernColors.text,
    textAlign: 'center',
    marginBottom: ModernSpacing.sm,
  },
  welcomeSubtitle: {
    fontSize: ModernTypography.sizes.lg,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    maxWidth: '90%',
  },
  searchSection: {
    paddingHorizontal: ModernSpacing.lg,
    paddingVertical: ModernSpacing.lg,
  },
  recommendedCard: {
    marginHorizontal: ModernSpacing.lg,
    marginBottom: ModernSpacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ModernSpacing.md,
  },
  sectionTitle: {
    fontSize: ModernTypography.sizes.lg,
    fontWeight: ModernTypography.weights.semibold as any,
    color: ModernColors.text,
    marginLeft: ModernSpacing.sm,
    flex: 1,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.primary,
    fontWeight: ModernTypography.weights.medium as any,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ModernSpacing.sm,
  },
  searchBadge: {
    marginBottom: ModernSpacing.xs,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: ModernSpacing.lg,
    gap: ModernSpacing.md,
    marginBottom: ModernSpacing.lg,
  },
  quickActionCard: {
    width: (width - ModernSpacing.lg * 2 - ModernSpacing.md) / 2,
  },
  quickActionContent: {
    alignItems: 'center',
    paddingVertical: ModernSpacing.lg,
  },
  quickActionTitle: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: ModernTypography.weights.semibold as any,
    color: ModernColors.textOnPrimary,
    marginTop: ModernSpacing.sm,
  },
  quickActionSubtitle: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textOnPrimary,
    opacity: 0.9,
    marginTop: ModernSpacing.xs,
  },
  sectionCard: {
    marginHorizontal: ModernSpacing.lg,
    marginBottom: ModernSpacing.lg,
  },
  horizontalScroll: {
    paddingRight: ModernSpacing.lg,
  },
  activityCardWrapper: {
    width: width * 0.75,
    marginRight: ModernSpacing.md,
  },
  compactList: {
    gap: ModernSpacing.sm,
  },
  filteredText: {
    fontSize: ModernTypography.sizes.sm,
    color: ModernColors.textMuted,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ModernSpacing.md,
    paddingHorizontal: ModernSpacing.lg,
    backgroundColor: ModernColors.primaryLight + '20',
    borderRadius: ModernBorderRadius.lg,
    marginTop: ModernSpacing.md,
  },
  viewMoreText: {
    fontSize: ModernTypography.sizes.base,
    fontWeight: ModernTypography.weights.medium as any,
    color: ModernColors.primary,
    marginRight: ModernSpacing.sm,
  },
  activityTypeRow: {
    justifyContent: 'space-between',
  },
  activityTypeCard: {
    width: (width - ModernSpacing.lg * 2 - ModernSpacing.md * 2) / 3,
    marginBottom: ModernSpacing.md,
  },
  activityTypeContent: {
    alignItems: 'center',
    paddingVertical: ModernSpacing.md,
  },
  activityTypeEmoji: {
    fontSize: 32,
    marginBottom: ModernSpacing.sm,
  },
  activityTypeName: {
    fontSize: ModernTypography.sizes.sm,
    fontWeight: ModernTypography.weights.medium as any,
    color: ModernColors.text,
    textAlign: 'center',
  },
  activityTypeCount: {
    fontSize: ModernTypography.sizes.xs,
    color: ModernColors.textMuted,
    marginTop: ModernSpacing.xs,
  },
  bottomSpacer: {
    height: ModernSpacing.xxl,
  },
});

export default DashboardScreenModern;