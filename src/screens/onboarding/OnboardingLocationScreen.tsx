import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PreferencesService from '../../services/preferencesService';
import ActivityService from '../../services/activityService';
import { locationService } from '../../services/locationService';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingLocation'>;

interface City {
  city: string;
  state: string;
  count: number;
}

type LocationMode = 'none' | 'gps' | 'cities';

const distanceOptions = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 25, label: '25 km' },
  { value: 50, label: '50 km' },
  { value: 100, label: '100 km' },
];

const OnboardingLocationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();

  const [locationMode, setLocationMode] = useState<LocationMode>('none');
  const [selectedDistance, setSelectedDistance] = useState<number>(25);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);

  // City selection state
  const [cities, setCities] = useState<City[]>([]);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isCitiesLoading, setIsCitiesLoading] = useState(false);

  useEffect(() => {
    if (locationMode === 'cities' && cities.length === 0) {
      loadCities();
    }
  }, [locationMode]);

  useEffect(() => {
    if (searchText.length > 0) {
      const filtered = cities.filter(city =>
        city.city.toLowerCase().includes(searchText.toLowerCase()) ||
        city.state.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredCities(filtered);
    } else {
      setFilteredCities(cities.slice(0, 20));
    }
  }, [searchText, cities]);

  const loadCities = async () => {
    setIsCitiesLoading(true);
    try {
      const citiesData = await activityService.getCitiesWithCounts(true);
      const sortedCities = citiesData.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.city.localeCompare(b.city);
      });
      setCities(sortedCities);
      setFilteredCities(sortedCities.slice(0, 20));
    } catch (error) {
      console.error('Error loading cities:', error);
      setCities([]);
      setFilteredCities([]);
    } finally {
      setIsCitiesLoading(false);
    }
  };

  const handleSelectGps = async () => {
    setIsGpsLoading(true);
    try {
      const status = await locationService.requestPermission();

      if (status === 'granted') {
        setLocationMode('gps');
        setGpsEnabled(true);
      } else if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
        setLocationMode('none');
        setGpsEnabled(false);
      } else {
        Alert.alert(
          'Location Not Available',
          'Location permission was not granted. You can select cities instead.',
          [
            { text: 'OK', onPress: () => setLocationMode('none') },
          ]
        );
      }
    } catch (error) {
      console.error('[OnboardingLocation] Error requesting GPS:', error);
      Alert.alert('Error', 'Could not access location. Please try again or select cities instead.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleSelectCities = () => {
    setLocationMode('cities');
    setGpsEnabled(false);
  };

  const handleToggleCity = (cityName: string) => {
    setSelectedCities(prev =>
      prev.includes(cityName)
        ? prev.filter(c => c !== cityName)
        : [...prev, cityName]
    );
  };

  const handleNext = async () => {
    if (locationMode === 'gps') {
      await preferencesService.updatePreferences({
        distanceFilterEnabled: true,
        locationSource: 'gps',
        locationPermissionAsked: true,
        distanceRadiusKm: selectedDistance,
      });
    } else if (locationMode === 'cities' && selectedCities.length > 0) {
      await preferencesService.updatePreferences({
        preferredLocation: selectedCities[0], // Use first selected city as primary
        locationPermissionAsked: true,
      });
    } else {
      await preferencesService.updatePreferences({
        locationPermissionAsked: true,
      });
    }
    navigation.navigate('OnboardingComplete');
  };

  const handleSkip = async () => {
    await preferencesService.updatePreferences({
      locationPermissionAsked: true,
    });
    navigation.navigate('OnboardingComplete');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderCityItem = ({ item }: { item: City }) => {
    const isSelected = selectedCities.includes(item.city);
    return (
      <TouchableOpacity
        style={[styles.cityItem, isSelected && styles.cityItemSelected]}
        onPress={() => handleToggleCity(item.city)}
        activeOpacity={0.7}
      >
        <View style={styles.cityInfo}>
          <Icon
            name="map-marker"
            size={20}
            color={isSelected ? '#14B8A6' : '#9CA3AF'}
            style={styles.cityIcon}
          />
          <View>
            <Text style={[styles.cityName, isSelected && styles.cityNameSelected]}>
              {item.city}
            </Text>
            <Text style={styles.cityState}>{item.state}</Text>
          </View>
        </View>
        <View style={styles.cityRight}>
          <Text style={styles.activityCount}>{item.count} activities</Text>
          {isSelected && (
            <View style={styles.checkmark}>
              <Icon name="check" size={14} color="#FFFFFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Icon name="arrow-left" size={24} color="#1F2937" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
        <Text style={styles.title}>Where are you located?</Text>
        <Text style={styles.subtitle}>
          Find activities near you
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* GPS Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            locationMode === 'gps' && styles.optionCardSelected,
          ]}
          onPress={handleSelectGps}
          activeOpacity={0.7}
          disabled={isGpsLoading}
        >
          <View style={[styles.iconContainer, locationMode === 'gps' && styles.iconContainerSelected]}>
            {isGpsLoading ? (
              <ActivityIndicator size="small" color={locationMode === 'gps' ? '#FFFFFF' : '#14B8A6'} />
            ) : (
              <Icon
                name="crosshairs-gps"
                size={28}
                color={locationMode === 'gps' ? '#FFFFFF' : '#14B8A6'}
              />
            )}
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, locationMode === 'gps' && styles.optionTitleSelected]}>
              Use my location
            </Text>
            <Text style={styles.optionDescription}>
              Allow GPS access for automatic location
            </Text>
          </View>
          {locationMode === 'gps' && gpsEnabled && (
            <View style={styles.optionCheckmark}>
              <Icon name="check" size={16} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Distance selector - only show when GPS is enabled */}
        {locationMode === 'gps' && gpsEnabled && (
          <View style={styles.distanceSection}>
            <Text style={styles.distanceLabel}>Show activities within:</Text>
            <View style={styles.distanceOptions}>
              {distanceOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.distanceChip,
                    selectedDistance === option.value && styles.distanceChipSelected,
                  ]}
                  onPress={() => setSelectedDistance(option.value)}
                >
                  <Text
                    style={[
                      styles.distanceChipText,
                      selectedDistance === option.value && styles.distanceChipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Cities Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            locationMode === 'cities' && styles.optionCardSelected,
          ]}
          onPress={handleSelectCities}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, locationMode === 'cities' && styles.iconContainerSelected]}>
            <Icon
              name="city-variant"
              size={28}
              color={locationMode === 'cities' ? '#FFFFFF' : '#14B8A6'}
            />
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, locationMode === 'cities' && styles.optionTitleSelected]}>
              Select cities
            </Text>
            <Text style={styles.optionDescription}>
              Choose specific cities of interest
            </Text>
          </View>
          {locationMode === 'cities' && selectedCities.length > 0 && (
            <View style={styles.selectedCount}>
              <Text style={styles.selectedCountText}>{selectedCities.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* City selection - only show when cities mode is selected */}
        {locationMode === 'cities' && (
          <View style={styles.citiesSection}>
            <View style={styles.searchContainer}>
              <Icon name="magnify" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search cities..."
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Icon name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {isCitiesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#14B8A6" />
              </View>
            ) : (
              <View style={styles.cityListContainer}>
                {filteredCities.slice(0, 10).map((city) => (
                  <View key={`${city.city}-${city.state}`}>
                    {renderCityItem({ item: city })}
                  </View>
                ))}
                {filteredCities.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Icon name="map-marker-off" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyText}>No cities found</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Icon name="information-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            You can change this anytime in Settings.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#14B8A6',
    width: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#14B8A6',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#14B8A6',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#14B8A6',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  optionCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  distanceSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  distanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  distanceChipSelected: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  distanceChipTextSelected: {
    color: '#FFFFFF',
  },
  citiesSection: {
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  cityListContainer: {
    marginBottom: 16,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cityItemSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#14B8A6',
  },
  cityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityIcon: {
    marginRight: 12,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  cityNameSelected: {
    color: '#14B8A6',
  },
  cityState: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  cityRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityCount: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  nextButton: {
    backgroundColor: '#14B8A6',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingLocationScreen;
