import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PreferencesService from '../../services/preferencesService';
import ActivityService from '../../services/activityService';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingLocation'>;

interface City {
  city: string;
  state: string;
  count: number;
}

const OnboardingLocationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();

  const [cities, setCities] = useState<City[]>([]);
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCities();
  }, []);

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
    try {
      // Load all cities from the database (includeEmpty=true to show all Vancouver metro cities)
      const citiesData = await activityService.getCitiesWithCounts(true);

      // Sort by count (most activities first), then alphabetically
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
      setIsLoading(false);
    }
  };

  const handleSelectCity = (city: string) => {
    setSelectedCity(city === selectedCity ? null : city);
  };

  const handleNext = async () => {
    if (selectedCity) {
      await preferencesService.updatePreferences({
        preferredLocation: selectedCity,
      });
    }
    navigation.navigate('OnboardingDistance');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingDistance');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderCityItem = ({ item }: { item: City }) => {
    const isSelected = selectedCity === item.city;
    return (
      <TouchableOpacity
        style={[styles.cityItem, isSelected && styles.cityItemSelected]}
        onPress={() => handleSelectCity(item.city)}
        activeOpacity={0.7}
      >
        <View style={styles.cityInfo}>
          <Icon
            name="map-marker"
            size={20}
            color={isSelected ? '#FF385C' : '#9CA3AF'}
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
        <Text style={styles.subtitle}>We'll show activities near you</Text>
      </View>

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

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF385C" />
        </View>
      ) : (
        <FlatList
          data={filteredCities}
          renderItem={renderCityItem}
          keyExtractor={(item) => `${item.city}-${item.state}`}
          style={styles.cityList}
          contentContainerStyle={styles.cityListContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="map-marker-off" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No cities found</Text>
            </View>
          }
        />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.nextButton, !selectedCity && styles.nextButtonDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {selectedCity ? "Let's Go!" : 'Skip for now'}
          </Text>
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
    backgroundColor: '#FF385C',
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
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 24,
    marginBottom: 16,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityList: {
    flex: 1,
  },
  cityListContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
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
    borderColor: '#FF385C',
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
    color: '#FF385C',
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
    backgroundColor: '#FF385C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  nextButton: {
    backgroundColor: '#FF385C',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF385C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingLocationScreen;
