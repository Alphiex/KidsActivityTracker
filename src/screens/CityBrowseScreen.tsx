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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Theme } from '../theme';
import ActivityService from '../services/activityService';

const { width, height } = Dimensions.get('window');

interface CityData {
  city: string;
  province: string;
  venueCount: number;
  activityCount: number;
}

const CityBrowseScreen = () => {
  const navigation = useNavigation<any>();
  const activityService = ActivityService.getInstance();
  
  const [cities, setCities] = useState<CityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cityColors = [
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
    navigation.setOptions({
      title: 'Choose Your City',
      headerShown: true,
      headerStyle: {
        backgroundColor: Colors.primary,
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadCityData();
  }, [navigation]);

  const loadCityData = async () => {
    try {
      setIsLoading(true);
      const cityData = await activityService.getCities();
      
      // Sort by activity count descending
      const sortedCities = cityData.sort((a: CityData, b: CityData) => 
        b.activityCount - a.activityCount
      );
      
      setCities(sortedCities);
    } catch (error) {
      console.error('Error loading city data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCityData();
  };

  const selectCity = (city: CityData) => {
    // Navigate to location browse screen with city filter
    console.log('Navigating to LocationBrowse with city:', city.city);
    navigation.navigate('LocationBrowse', { city: city.city });
  };

  const renderCityCard = ({ item, index }: { item: CityData; index: number }) => {
    const colors = cityColors[index % cityColors.length];
    
    return (
      <TouchableOpacity
        style={styles.cityCard}
        onPress={() => selectCity(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={colors}
          style={styles.cityGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cityHeader}>
            <Icon name="city-variant" size={50} color="#fff" />
          </View>
          
          <View style={styles.cityInfo}>
            <Text style={styles.cityName}>{item.city}</Text>
            <Text style={styles.cityProvince}>{item.province}</Text>
          </View>
          
          <View style={styles.cityStats}>
            <View style={styles.statItem}>
              <Icon name="map-marker-multiple" size={20} color="#fff" />
              <Text style={styles.statNumber}>{item.venueCount}</Text>
              <Text style={styles.statLabel}>Venues</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Icon name="calendar-star" size={20} color="#fff" />
              <Text style={styles.statNumber}>{item.activityCount}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading cities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your City</Text>
        <Text style={styles.subtitle}>
          Discover activities in your area
        </Text>
      </View>
      
      <FlatList
        data={cities}
        renderItem={renderCityCard}
        keyExtractor={(item) => item.city}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      
      {cities.length === 0 && !isLoading && (
        <View style={styles.emptyContainer}>
          <Icon name="city-variant-outline" size={80} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No cities available</Text>
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
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
    backgroundColor: Colors.white,
    ...Theme.shadows.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  listContainer: {
    padding: Theme.spacing.lg,
  },
  cityCard: {
    marginBottom: Theme.spacing.lg,
    borderRadius: 20,
    overflow: 'hidden',
    ...Theme.shadows.md,
    elevation: 5,
  },
  cityGradient: {
    padding: Theme.spacing.lg,
  },
  cityHeader: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  cityInfo: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  cityName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: Theme.spacing.xs,
  },
  cityProvince: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cityStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 15,
    padding: Theme.spacing.md,
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginVertical: Theme.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: Theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    marginTop: Theme.spacing.md,
    fontSize: 18,
    color: Colors.textSecondary,
  },
});

export default CityBrowseScreen;