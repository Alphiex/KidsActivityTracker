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
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityCard from '../components/ActivityCard';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import { Activity } from '../types';

const { width, height } = Dimensions.get('window');

interface LocationGroup {
  location: string;
  activities: Activity[];
  count: number;
}

const LocationBrowseScreen = () => {
  const navigation = useNavigation();
  const activityService = ActivityService.getInstance();
  const preferencesService = PreferencesService.getInstance();
  
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const locationColors = [
    ['#FF6B6B', '#FF8787'],
    ['#4ECDC4', '#44A08D'],
    ['#A8E6CF', '#7FD1B3'],
    ['#FFD93D', '#FFB73D'],
    ['#C06EFF', '#9B59FF'],
    ['#4B9BFF', '#2E7FFF'],
    ['#00C9FF', '#0099CC'],
    ['#95E1D3', '#6FC9B8'],
  ];

  useEffect(() => {
    loadLocationData();
  }, []);

  const loadLocationData = async () => {
    try {
      setIsLoading(true);
      const allActivities = await activityService.searchActivities({});
      
      // Group activities by location
      const groups = allActivities.reduce((acc, activity) => {
        let location = 'Unknown Location';
        
        // Handle various location formats
        if (activity.location) {
          if (typeof activity.location === 'string') {
            location = activity.location;
          } else if (typeof activity.location === 'object' && activity.location.name) {
            location = activity.location.name;
          }
        } else if (activity.locationName) {
          location = activity.locationName;
        } else if (activity.facility) {
          location = activity.facility;
        }
        
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push(activity);
        return acc;
      }, {} as { [key: string]: Activity[] });

      // Convert to array and sort by count
      const groupArray = Object.entries(groups)
        .map(([location, activities]) => ({
          location,
          activities,
          count: activities.length,
        }))
        .sort((a, b) => b.count - a.count);

      setLocationGroups(groupArray);
    } catch (error) {
      console.error('Error loading location data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLocationData();
  };

  const selectLocation = (location: string) => {
    const group = locationGroups.find(g => g.location === location);
    if (group) {
      setSelectedLocation(location);
      setFilteredActivities(group.activities);
    }
  };

  const clearSelection = () => {
    setSelectedLocation(null);
    setFilteredActivities([]);
  };

  const renderLocationCard = ({ item, index }: { item: LocationGroup; index: number }) => {
    const colors = locationColors[index % locationColors.length];
    
    return (
      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => selectLocation(item.location)}
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
              <Text style={styles.locationCount}>{item.count}</Text>
            </View>
          </View>
          <Text style={styles.locationName} numberOfLines={2}>
            {item.location}
          </Text>
          <Text style={styles.locationSubtext}>
            {item.count} {item.count === 1 ? 'activity' : 'activities'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderLocationList = ({ item, index }: { item: LocationGroup; index: number }) => {
    const colors = locationColors[index % locationColors.length];
    
    return (
      <TouchableOpacity
        style={styles.locationListItem}
        onPress={() => selectLocation(item.location)}
      >
        <LinearGradient
          colors={colors}
          style={styles.locationListIcon}
        >
          <Icon name="map-marker" size={24} color="#fff" />
        </LinearGradient>
        <View style={styles.locationListContent}>
          <Text style={styles.locationListName}>{item.location}</Text>
          <Text style={styles.locationListSubtext}>
            {item.count} {item.count === 1 ? 'activity' : 'activities'}
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
            dateRange: item.dateRange && item.dateRange.start && item.dateRange.end ? {
              start: item.dateRange.start instanceof Date ? item.dateRange.start.toISOString() : item.dateRange.start,
              end: item.dateRange.end instanceof Date ? item.dateRange.end.toISOString() : item.dateRange.end,
            } : null,
            scrapedAt: item.scrapedAt instanceof Date ? item.scrapedAt.toISOString() : item.scrapedAt,
          };
          
          navigation.navigate('ActivityDetail' as never, { activity: serializedActivity } as never);
        }}
      />
    </View>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
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
          <Text style={styles.headerTitle}>{selectedLocation}</Text>
          <Text style={styles.headerSubtitle}>
            {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'} available
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
            {locationGroups.length} locations with activities
          </Text>
        </View>
      )}
    </LinearGradient>
  );

  const renderLocationsGrid = () => (
    <FlatList
      key="grid-view"
      data={locationGroups}
      renderItem={renderLocationCard}
      keyExtractor={(item) => item.location}
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
      data={locationGroups}
      renderItem={renderLocationList}
      keyExtractor={(item) => item.location}
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
        <FlatList
          data={filteredActivities}
          renderItem={renderActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.activityList}
          showsVerticalScrollIndicator={false}
        />
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
});

export default LocationBrowseScreen;