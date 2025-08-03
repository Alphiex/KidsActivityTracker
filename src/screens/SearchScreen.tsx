import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import ActivityCard from '../components/ActivityCard';
import ActivityService from '../services/activityService';
import PreferencesService from '../services/preferencesService';
import { Activity } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

const SearchScreen = () => {
  const navigation = useNavigation();
  const preferencesService = PreferencesService.getInstance();
  const preferences = preferencesService.getPreferences();
  const { colors, isDark } = useTheme();
  
  const [searchText, setSearchText] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Swimming lessons',
    'Art classes',
    'Soccer',
    'Dance',
  ]);

  // Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState({ min: 0, max: 18 });
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [anyPrice, setAnyPrice] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState({
    morning: false,
    afternoon: false,
    evening: false,
  });

  const categories = [
    { name: 'Team Sports', icon: 'basketball', color: '#FF6B6B' },
    { name: 'Martial Arts', icon: 'karate', color: '#4ECDC4' },
    { name: 'Racquet Sports', icon: 'tennis', color: '#A8E6CF' },
    { name: 'Aquatic Leadership', icon: 'pool', color: '#FFD93D' },
    { name: 'Swimming', icon: 'swim', color: '#00C9FF' },
    { name: 'Camps', icon: 'tent', color: '#C06EFF' },
    { name: 'Dance', icon: 'dance-ballroom', color: '#4B9BFF' },
    { name: 'Other', icon: 'star', color: '#95E1D3' },
  ];

  const popularFilters = [
    { id: 'weekend', label: 'Weekend Only', icon: 'calendar-weekend' },
    { id: 'free', label: 'Free Activities', icon: 'gift' },
    { id: 'nearme', label: 'Near Me', icon: 'map-marker-radius' },
    { id: 'starting-soon', label: 'Starting Soon', icon: 'clock-fast' },
  ];

  useEffect(() => {
    loadAllActivities();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchText, selectedCategories, selectedLocations, ageRange, priceRange, selectedDays, selectedTimes]);

  const loadAllActivities = async () => {
    setIsLoading(true);
    try {
      const activityService = ActivityService.getInstance();
      const fetchedActivities = await activityService.searchActivities({});
      setActivities(fetchedActivities);
      setFilteredActivities(fetchedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Text search
    if (searchText) {
      filtered = filtered.filter(
        (activity) =>
          activity.name.toLowerCase().includes(searchText.toLowerCase()) ||
          activity.description?.toLowerCase().includes(searchText.toLowerCase()) ||
          activity.provider.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((activity) =>
        selectedCategories.some(cat => 
          activity.category === cat || 
          (activity.activityType && activity.activityType.includes(cat))
        )
      );
    }

    // Location filter
    if (selectedLocations.length > 0) {
      filtered = filtered.filter((activity) =>
        selectedLocations.some((loc) => activity.location.includes(loc))
      );
    }

    // Age filter
    filtered = filtered.filter(
      (activity) =>
        activity.ageRange.min <= ageRange.max &&
        activity.ageRange.max >= ageRange.min
    );

    // Price filter
    filtered = filtered.filter(
      (activity) => activity.cost >= priceRange.min && activity.cost <= priceRange.max
    );

    // Day filter
    if (selectedDays.length > 0) {
      filtered = filtered.filter((activity) => {
        // TODO: Check if activity is available on selected days
        return true; // Placeholder
      });
    }

    setFilteredActivities(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (text && !recentSearches.includes(text)) {
      setRecentSearches([text, ...recentSearches.slice(0, 4)]);
    }
  };

  const handleQuickFilter = (filterId: string) => {
    switch (filterId) {
      case 'weekend':
        setSelectedDays(['Saturday', 'Sunday']);
        break;
      case 'free':
        setPriceRange({ min: 0, max: 0 });
        break;
      case 'nearme':
        // TODO: Implement location-based filtering
        break;
      case 'starting-soon':
        // TODO: Filter by start date
        break;
    }
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedLocations([]);
    setAgeRange({ min: 0, max: 18 });
    setPriceRange({ min: 0, max: 1000 });
    setSelectedDays([]);
    setSelectedTimes({ morning: false, afternoon: false, evening: false });
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Categories */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Categories</Text>
              <View style={styles.categoriesGrid}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.name}
                    style={[
                      styles.categoryChip,
                      selectedCategories.includes(category.name) && {
                        backgroundColor: category.color,
                      },
                    ]}
                    onPress={() => {
                      setSelectedCategories((prev) =>
                        prev.includes(category.name)
                          ? prev.filter((c) => c !== category.name)
                          : [...prev, category.name]
                      );
                    }}
                  >
                    <Icon
                      name={category.icon}
                      size={20}
                      color={
                        selectedCategories.includes(category.name) ? '#fff' : category.color
                      }
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategories.includes(category.name) && styles.categoryChipTextSelected,
                      ]}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Age Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Age Range</Text>
              <View style={styles.rangeContainer}>
                <Text style={styles.rangeText}>{ageRange.min} - {ageRange.max} years</Text>
                
                <Text style={styles.sliderLabel}>Minimum Age: {ageRange.min}</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderValue}>0</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={18}
                    value={ageRange.min}
                    onValueChange={(value) => setAgeRange({ ...ageRange, min: Math.round(value) })}
                    minimumTrackTintColor="#667eea"
                    maximumTrackTintColor="#ddd"
                  />
                  <Text style={styles.sliderValue}>18</Text>
                </View>
                
                <Text style={styles.sliderLabel}>Maximum Age: {ageRange.max}</Text>
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderValue}>0</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={18}
                    value={ageRange.max}
                    onValueChange={(value) => setAgeRange({ ...ageRange, max: Math.round(value) })}
                    minimumTrackTintColor="#667eea"
                    maximumTrackTintColor="#ddd"
                  />
                  <Text style={styles.sliderValue}>18</Text>
                </View>
              </View>
            </View>

            {/* Price Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Price Range</Text>
              <TouchableOpacity 
                style={[styles.anyOptionButton, anyPrice && styles.anyOptionButtonActive]}
                onPress={() => setAnyPrice(!anyPrice)}
              >
                <Icon 
                  name={anyPrice ? "checkbox-marked" : "checkbox-blank-outline"} 
                  size={20} 
                  color={anyPrice ? "#667eea" : "#666"} 
                />
                <Text style={[styles.anyOptionText, anyPrice && styles.anyOptionTextActive]}>
                  Any Price
                </Text>
              </TouchableOpacity>
              
              {!anyPrice && (
                <View style={styles.rangeContainer}>
                  <Text style={styles.rangeText}>${priceRange.min} - ${priceRange.max}</Text>
                  
                  <Text style={styles.sliderLabel}>Minimum Price: ${priceRange.min}</Text>
                  <View style={styles.sliderRow}>
                    <Text style={styles.sliderValue}>$0</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={1000}
                      step={25}
                      value={priceRange.min}
                      onValueChange={(value) => setPriceRange({ ...priceRange, min: value })}
                      minimumTrackTintColor="#667eea"
                      maximumTrackTintColor="#ddd"
                    />
                    <Text style={styles.sliderValue}>$1k</Text>
                  </View>
                  
                  <Text style={styles.sliderLabel}>Maximum Price: ${priceRange.max}</Text>
                  <View style={styles.sliderRow}>
                    <Text style={styles.sliderValue}>$0</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={1000}
                      step={25}
                      value={priceRange.max}
                      onValueChange={(value) => setPriceRange({ ...priceRange, max: value })}
                      minimumTrackTintColor="#667eea"
                      maximumTrackTintColor="#ddd"
                    />
                    <Text style={styles.sliderValue}>$1k</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Days of Week */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Days of Week</Text>
              <View style={styles.daysGrid}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                  const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayChip,
                        selectedDays.includes(fullDay) && styles.dayChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedDays((prev) =>
                          prev.includes(fullDay)
                            ? prev.filter((d) => d !== fullDay)
                            : [...prev, fullDay]
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          selectedDays.includes(fullDay) && styles.dayChipTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={() => setShowFilters(false)}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      onPress={() => {
        const serializedActivity = {
          ...item,
          dateRange: item.dateRange ? {
            start: item.dateRange.start.toISOString(),
            end: item.dateRange.end.toISOString(),
          } : null,
          scrapedAt: item.scrapedAt ? item.scrapedAt.toISOString() : null,
        };
        navigation.navigate('ActivityDetail', { activity: serializedActivity });
      }}
    >
      <ActivityCard activity={item} />
    </TouchableOpacity>
  );

  const activeFiltersCount = 
    selectedCategories.length + 
    selectedLocations.length + 
    (ageRange.min !== 0 || ageRange.max !== 18 ? 1 : 0) +
    (priceRange.min !== 0 || priceRange.max !== 1000 ? 1 : 0) +
    selectedDays.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.header}
      >
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.inputBackground }]}>
            <Icon name="magnify" size={24} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search activities, providers..."
              placeholderTextColor={colors.textSecondary}
              value={searchText}
              onChangeText={handleSearch}
            />
            {searchText !== '' && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Icon name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Icon name="filter-variant" size={24} color="#fff" />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickFilters}
        >
          {popularFilters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={styles.quickFilterChip}
              onPress={() => handleQuickFilter(filter.id)}
            >
              <Icon name={filter.icon} size={16} color="#fff" />
              <Text style={styles.quickFilterText}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {searchText === '' && recentSearches.length > 0 ? (
        <View style={[styles.recentSearches, { backgroundColor: colors.background }]}>
          <Text style={[styles.recentSearchesTitle, { color: colors.text }]}>Recent Searches</Text>
          {recentSearches.map((search, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.recentSearchItem, { borderBottomColor: colors.border }]}
              onPress={() => setSearchText(search)}
            >
              <Icon name="history" size={20} color={colors.textSecondary} />
              <Text style={[styles.recentSearchText, { color: colors.textSecondary }]}>{search}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="magnify-close" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No activities found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try adjusting your search or filters
              </Text>
            </View>
          }
        />
      )}

      {renderFilterModal()}
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
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  filterButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B6B',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickFilters: {
    marginTop: 5,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  quickFilterText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  recentSearches: {
    flex: 1,
    padding: 20,
  },
  recentSearchesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentSearchText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 15,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  rangeContainer: {
    alignItems: 'center',
  },
  rangeText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '500',
    marginBottom: 10,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 12,
    color: '#999',
    minWidth: 20,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayChip: {
    width: (width - 100) / 7,
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
    marginBottom: 5,
  },
  dayChipSelected: {
    backgroundColor: '#667eea',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  dayChipTextSelected: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    marginRight: 10,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
  },
  applyButtonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  anyOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  anyOptionButtonActive: {
    backgroundColor: '#667eea10',
    borderColor: '#667eea',
  },
  anyOptionText: {
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  anyOptionTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
});

export default SearchScreen;