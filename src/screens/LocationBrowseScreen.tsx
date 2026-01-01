import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import { Activity } from '../types';
import { safeToISOString } from '../utils/safeAccessors';

const { width, height } = Dimensions.get('window');

interface LocationData {
  id: string;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  facility?: string;
  activityCount: number;
}

interface LocationGroup {
  location: string;
  locationData?: LocationData;
  activities?: Activity[];
  count: number;
}

const LocationBrowseScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();

  // Get city filter from navigation params
  const cityFilter = route.params?.city as string | undefined;
  
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [locationActivities, setLocationActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(0);
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [filteredOutCount, setFilteredOutCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);

  const locationColors = [
    ['#14B8A6', '#2DD4BF'],
    ['#4ECDC4', '#44A08D'],
    ['#A8E6CF', '#7FD1B3'],
    ['#FFD93D', '#FFB73D'],
    ['#C06EFF', '#9B59FF'],
    ['#4B9BFF', '#2E7FFF'],
    ['#00C9FF', '#0099CC'],
    ['#95E1D3', '#6FC9B8'],
  ];

  useEffect(() => {
    // Update navigation title if city is specified
    if (cityFilter) {
      navigation.setOptions({
        title: `${cityFilter} Locations`,
        headerShown: true,
      });
    }
    loadLocationData();
  }, [cityFilter]);

  const loadLocationData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading location data, cityFilter:', cityFilter);
      
      // Only load locations if we have a city filter
      if (!cityFilter) {
        console.log('No city filter provided, skipping location load');
        setLocations([]);
        setIsLoading(false);
        return;
      }
      
      // Use the city-specific endpoint to get locations
      console.log('Using getCityLocations for city:', cityFilter);
      const locationData = await activityService.getCityLocations(cityFilter);
      console.log('City locations response:', locationData);
      console.log('Raw location data:', locationData);
      console.log('Location data length:', locationData?.length);
      
      // Check if locationData is valid
      if (!locationData || !Array.isArray(locationData)) {
        console.error('Invalid location data:', locationData);
        setLocations([]);
        return;
      }
      
      // Sort by activity count descending
      const sortedLocations = locationData
        .filter(loc => loc.activityCount > 0)
        .sort((a, b) => b.activityCount - a.activityCount);
      
      console.log('Sorted locations:', sortedLocations);
      setLocations(sortedLocations);
    } catch (error) {
      console.error('Error loading location data:', error);
      setLocations([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLocationData();
  };

  const selectLocation = async (location: LocationData) => {
    setSelectedLocation(location);
    setIsLoading(true);
    setLocationActivities([]);
    setCurrentOffset(0);
    
    try {
      // Get user preferences
      const preferences = preferencesService.getPreferences();
      
      // Fetch activities for the selected venue using the dedicated venue endpoint
      const venueParams = {
        limit: 50,
        offset: 0,
        hideClosedActivities: preferences.hideClosedActivities,
        hideFullActivities: preferences.hideFullActivities
      };
      
      console.log(`🎯 LocationBrowseScreen: Fetching activities for venue ${location.name} (${location.id}) using venue-specific API`);
      const result = await activityService.getVenueActivities(location.id, venueParams);
      setLocationActivities(result.items);
      setTotalActivitiesCount(result.total);
      setHasMore(result.hasMore);
      setCurrentOffset(50);
      
      // If global filters are applied, also get unfiltered count to show difference
      if (preferences.hideClosedActivities || preferences.hideFullActivities) {
        const unfilteredParams = {
          limit: 1,  // We only need the count
          offset: 0,
          hideClosedActivities: false,
          hideFullActivities: false
        };
        
        try {
          console.log(`🎯 LocationBrowseScreen: Fetching unfiltered count for venue ${location.name}`);
          const unfilteredResult = await activityService.getVenueActivities(location.id, unfilteredParams);
          setUnfilteredCount(unfilteredResult.total);
          setFilteredOutCount(unfilteredResult.total - result.total);
        } catch (error) {
          console.error('Error fetching unfiltered count:', error);
          setUnfilteredCount(result.total);
          setFilteredOutCount(0);
        }
      } else {
        setUnfilteredCount(result.total);
        setFilteredOutCount(0);
      }
    } catch (error) {
      console.error('Error loading location activities:', error);
      setLocationActivities([]);
      setTotalActivitiesCount(0);
      setUnfilteredCount(0);
      setFilteredOutCount(0);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreActivities = async () => {
    if (!hasMore || isLoadingMore || !selectedLocation) return;
    
    setIsLoadingMore(true);
    
    try {
      const preferences = preferencesService.getPreferences();
      
      const venueParams = {
        limit: 50,
        offset: currentOffset,
        hideClosedActivities: preferences.hideClosedActivities,
        hideFullActivities: preferences.hideFullActivities
      };
      
      console.log(`🎯 LocationBrowseScreen: Loading more activities for venue ${selectedLocation.name} (offset: ${currentOffset})`);
      const result = await activityService.getVenueActivities(selectedLocation.id, venueParams);
      setLocationActivities(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setCurrentOffset(prev => prev + 50);
    } catch (error) {
      console.error('Error loading more activities:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setLocationActivities([]);
    setTotalActivitiesCount(0);
    setUnfilteredCount(0);
    setFilteredOutCount(0);
    setCurrentOffset(0);
    setHasMore(false);
  };

  const renderLocationCard = ({ item, index }: { item: LocationData; index: number }) => {
    const colors = locationColors[index % locationColors.length];
    
    return (
      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => selectLocation(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors}
          style={styles.locationGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.locationHeader}>
            <Icon name="map-marker" size={40} color="#fff" />
            <View style={styles.locationBadge}>
              <Text style={styles.locationCount}>{item.activityCount}</Text>
            </View>
          </View>
          <Text style={styles.locationName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.locationSubtext}>
            {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderLocationList = ({ item, index }: { item: LocationData; index: number }) => {
    const colors = locationColors[index % locationColors.length];
    
    return (
      <TouchableOpacity
        style={styles.locationListItem}
        onPress={() => selectLocation(item)}
      >
        <LinearGradient
          colors={colors}
          style={styles.locationListIcon}
        >
          <Icon name="map-marker" size={24} color="#fff" />
        </LinearGradient>
        <View style={styles.locationListContent}>
          <Text style={styles.locationListName}>{item.name}</Text>
          <Text style={styles.locationListSubtext}>
            {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderActivityItem = ({ item }: { item: Activity }) => (
    <View style={styles.activityCardWrapper}>
      <ActivityCard 
        activity={item}
        onPress={() => {
          console.log('LocationBrowseScreen - Activity pressed:', item.name);
          
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
    </View>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#14B8A6', '#0D9488']}
      style={styles.header}
    >
      {selectedLocation ? (
        <View>
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={clearSelection}>
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>{selectedLocation.name}</Text>
          <Text style={styles.headerSubtitle}>
            {filteredOutCount > 0 ? (
              `${totalActivitiesCount} ${totalActivitiesCount === 1 ? 'activity' : 'activities'} (${filteredOutCount} filtered out from global settings)`
            ) : (
              `${totalActivitiesCount} ${totalActivitiesCount === 1 ? 'activity' : 'activities'} available`
            )}
          </Text>
        </View>
      ) : (
        <View>
          <View style={styles.headerNav}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              style={styles.viewModeButton}
            >
              <Icon 
                name={viewMode === 'grid' ? 'view-list' : 'view-grid'} 
                size={24} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Browse by Location</Text>
          <Text style={styles.headerSubtitle}>
            {locations.length} locations with activities
          </Text>
        </View>
      )}
    </LinearGradient>
  );

  const renderLocationsGrid = () => (
    <FlatList
      key="grid-view"
      data={locations}
      renderItem={renderLocationCard}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.locationRow}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  const renderLocationsList = () => (
    <FlatList
      key="list-view"
      data={locations}
      renderItem={renderLocationList}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      ) : selectedLocation ? (
        isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading activities...</Text>
          </View>
        ) : (
          <FlatList
            data={locationActivities}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.activityList}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreActivities}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => {
              if (isLoadingMore) {
                return (
                  <View style={styles.loadingMore}>
                    <Text style={styles.loadingMoreText}>Loading more activities...</Text>
                  </View>
                );
              }
              if (!hasMore && locationActivities.length > 0) {
                return (
                  <View style={styles.endOfList}>
                    <Text style={styles.endOfListText}>All activities loaded</Text>
                  </View>
                );
              }
              return null;
            }}
          />
        )
      ) : locations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="map-marker-off" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No locations found</Text>
          {cityFilter && (
            <Text style={styles.emptySubtext}>No venues in {cityFilter}</Text>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }} key={viewMode}>
          {viewMode === 'grid' ? renderLocationsGrid() : renderLocationsList()}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  viewModeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  gridContent: {
    padding: 10,
  },
  locationRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  locationCard: {
    width: (width - 40) / 2,
    marginBottom: 15,
  },
  locationGradient: {
    padding: 20,
    borderRadius: 20,
    height: 150,
    justifyContent: 'space-between',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  locationBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  locationCount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  locationSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  listContent: {
    paddingVertical: 10,
  },
  locationListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 5,
    padding: 15,
    borderRadius: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationListIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationListContent: {
    flex: 1,
    marginLeft: 15,
  },
  locationListName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  locationListSubtext: {
    fontSize: 14,
    color: '#666',
  },
  activityList: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  activityCardWrapper: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#666',
  },
  endOfList: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 14,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default LocationBrowseScreen;