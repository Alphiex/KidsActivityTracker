import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { Filter } from '../types/activity';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/Ionicons';
import ActivityService from '../services/activityService';
import { formatPrice } from '../utils/formatters';

type Props = StackScreenProps<RootStackParamList, 'Filter'>;

interface AgeGroup {
  code: string;
  label: string;
  minAge: number;
  maxAge: number;
}

export default function FilterScreen({ navigation, route }: Props) {
  const currentFilter = route.params?.currentFilter || {};
  
  const [ageRange, setAgeRange] = useState(currentFilter.ageRange || { min: 0, max: 18 });
  const [selectedGender, setSelectedGender] = useState<string | null>(currentFilter.gender || null);
  const [maxCost, setMaxCost] = useState(currentFilter.maxCost || 500);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    currentFilter.activityTypes || []
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    currentFilter.locations || []
  );
  const [showFreeOnly, setShowFreeOnly] = useState(currentFilter.maxCost === 0);
  
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);

  useEffect(() => {
    loadFilterData();
  }, []);

  const loadFilterData = async () => {
    try {
      const activityService = ActivityService.getInstance();
      const [categoriesData, locationsData, ageGroupsData] = await Promise.all([
        activityService.getCategories(),
        activityService.getLocations(),
        activityService.getAgeGroups(),
      ]);

      setCategories(categoriesData);
      setLocations(locationsData);
      setAgeGroups(ageGroupsData);
    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  const handleApplyFilters = () => {
    const filter: Filter = {
      ageRange,
      gender: selectedGender || undefined,
      maxCost: showFreeOnly ? 0 : maxCost,
      activityTypes: selectedCategories.length > 0 ? selectedCategories : undefined,
      locations: selectedLocations.length > 0 ? selectedLocations : undefined,
    };

    navigation.navigate('Home', { filter });
  };

  const handleResetFilters = () => {
    setAgeRange({ min: 0, max: 18 });
    setSelectedGender(null);
    setMaxCost(500);
    setSelectedCategories([]);
    setSelectedLocations([]);
    setShowFreeOnly(false);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleLocation = (locationName: string) => {
    setSelectedLocations(prev =>
      prev.includes(locationName)
        ? prev.filter(l => l !== locationName)
        : [...prev, locationName]
    );
  };

  const selectAgeGroup = (group: AgeGroup) => {
    setAgeRange({ min: group.minAge, max: group.maxAge });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Age Range</Text>
        <View style={styles.ageGroupButtons}>
          {ageGroups.map((group) => (
            <TouchableOpacity
              key={group.code}
              style={[
                styles.ageGroupButton,
                ageRange.min === group.minAge && ageRange.max === group.maxAge && styles.ageGroupButtonActive,
              ]}
              onPress={() => selectAgeGroup(group)}
            >
              <Text
                style={[
                  styles.ageGroupButtonText,
                  ageRange.min === group.minAge && ageRange.max === group.maxAge && styles.ageGroupButtonTextActive,
                ]}
              >
                {group.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Min Age: {ageRange.min}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={18}
            step={1}
            value={ageRange.min}
            onValueChange={(value) => setAgeRange({ ...ageRange, min: value })}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#d1d5db"
          />
        </View>
        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Max Age: {ageRange.max}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={18}
            step={1}
            value={ageRange.max}
            onValueChange={(value) => setAgeRange({ ...ageRange, max: value })}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#d1d5db"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gender</Text>
        <Text style={styles.genderHint}>Filter activities by gender (e.g., Girls Softball, Boys Basketball)</Text>
        <View style={styles.genderButtons}>
          <TouchableOpacity
            style={[
              styles.genderButton,
              selectedGender === null && styles.genderButtonActive,
            ]}
            onPress={() => setSelectedGender(null)}
          >
            <Icon name="people-outline" size={20} color={selectedGender === null ? 'white' : '#666'} />
            <Text style={[styles.genderButtonText, selectedGender === null && styles.genderButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderButton,
              selectedGender === 'male' && styles.genderButtonActive,
            ]}
            onPress={() => setSelectedGender('male')}
          >
            <Icon name="male-outline" size={20} color={selectedGender === 'male' ? 'white' : '#007AFF'} />
            <Text style={[styles.genderButtonText, selectedGender === 'male' && styles.genderButtonTextActive]}>
              Boys
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderButton,
              selectedGender === 'female' && styles.genderButtonActive,
            ]}
            onPress={() => setSelectedGender('female')}
          >
            <Icon name="female-outline" size={20} color={selectedGender === 'female' ? 'white' : '#FF69B4'} />
            <Text style={[styles.genderButtonText, selectedGender === 'female' && styles.genderButtonTextActive]}>
              Girls
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cost</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Free activities only</Text>
          <Switch
            value={showFreeOnly}
            onValueChange={setShowFreeOnly}
            trackColor={{ false: '#d1d5db', true: '#007AFF' }}
          />
        </View>
        {!showFreeOnly && (
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Max Cost: ${formatPrice(maxCost)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1000}
              step={10}
              value={maxCost}
              onValueChange={setMaxCost}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#d1d5db"
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.chipContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.chip,
                selectedCategories.includes(category) && styles.chipActive,
              ]}
              onPress={() => toggleCategory(category)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategories.includes(category) && styles.chipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Locations</Text>
        <View style={styles.locationList}>
          {locations.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={styles.locationItem}
              onPress={() => toggleLocation(location.name)}
            >
              <View style={styles.locationCheckbox}>
                {selectedLocations.includes(location.name) && (
                  <Icon name="checkmark" size={18} color="#007AFF" />
                )}
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{location.name}</Text>
                {location._count?.activities > 0 && (
                  <Text style={styles.locationCount}>
                    {location._count.activities} activities
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleResetFilters}
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.applyButton]}
          onPress={handleApplyFilters}
        >
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  ageGroupButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  ageGroupButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  ageGroupButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  ageGroupButtonText: {
    fontSize: 14,
    color: '#666',
  },
  ageGroupButtonTextActive: {
    color: 'white',
  },
  genderHint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    gap: 6,
  },
  genderButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  genderButtonTextActive: {
    color: 'white',
  },
  sliderContainer: {
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  slider: {
    height: 40,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
  },
  chipTextActive: {
    color: 'white',
  },
  locationList: {
    gap: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  locationCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
  },
  locationCount: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#e5e7eb',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#007AFF',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});