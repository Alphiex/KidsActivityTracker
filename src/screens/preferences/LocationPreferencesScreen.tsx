import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../../services/preferencesService';
import ActivityService from '../../services/activityService';
import { useTheme } from '../../contexts/ThemeContext';

interface Location {
  id: string;
  name: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  activityCount?: number;
}

const LocationPreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  
  const [selectedLocations, setSelectedLocations] = useState<string[]>(currentPreferences.locations);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      const locs = await activityService.getLocations();
      
      // Group locations by city
      const grouped = locs.reduce((acc: any, loc: Location) => {
        const city = loc.city || 'Other';
        if (!acc[city]) {
          acc[city] = [];
        }
        acc[city].push(loc);
        return acc;
      }, {});

      // Convert to sections format
      const sectionData = Object.keys(grouped)
        .sort()
        .map(city => ({
          title: city,
          data: grouped[city].sort((a: Location, b: Location) => a.name.localeCompare(b.name))
        }));

      setSections(sectionData);
      setLocations(locs);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLocation = (locationId: string, locationName: string) => {
    setSelectedLocations(prev => {
      if (prev.includes(locationId)) {
        return prev.filter(id => id !== locationId);
      } else {
        return [...prev, locationId];
      }
    });
  };

  const toggleCity = (city: string) => {
    const cityLocations = sections.find(s => s.title === city)?.data || [];
    const cityLocationIds = cityLocations.map((loc: Location) => loc.id);
    const allSelected = cityLocationIds.every((id: string) => selectedLocations.includes(id));

    if (allSelected) {
      // Deselect all locations in this city
      setSelectedLocations(prev => prev.filter((id: string) => !cityLocationIds.includes(id)));
    } else {
      // Select all locations in this city
      setSelectedLocations(prev => {
        const newSelection = [...prev];
        cityLocationIds.forEach((id: string) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedLocations.length === locations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(locations.map(loc => loc.id));
    }
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      locations: selectedLocations,
    });
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Location Preferences
          </Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading locations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderSectionHeader = ({ section }: any) => {
    const cityLocations = section.data;
    const cityLocationIds = cityLocations.map((loc: Location) => loc.id);
    const selectedCount = cityLocationIds.filter((id: string) => selectedLocations.includes(id)).length;
    const allSelected = selectedCount === cityLocationIds.length && cityLocationIds.length > 0;

    return (
      <TouchableOpacity
        style={[styles.sectionHeader, { backgroundColor: colors.surface }]}
        onPress={() => toggleCity(section.title)}
      >
        <View style={styles.sectionHeaderContent}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {section.title}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
            {selectedCount}/{cityLocationIds.length} selected
          </Text>
        </View>
        <Icon
          name={allSelected ? 'checkbox-marked' : selectedCount > 0 ? 'checkbox-intermediate' : 'checkbox-blank-outline'}
          size={24}
          color={allSelected || selectedCount > 0 ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: Location }) => {
    const isSelected = selectedLocations.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.locationItem,
          { 
            backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          }
        ]}
        onPress={() => toggleLocation(item.id, item.name)}
      >
        <View style={styles.locationContent}>
          <Icon
            name="map-marker"
            size={20}
            color={isSelected ? colors.primary : colors.text}
          />
          <View style={styles.locationInfo}>
            <Text style={[styles.locationName, { color: colors.text }]}>
              {item.name}
            </Text>
            {item.address && (
              <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
                {item.address}
              </Text>
            )}
            {item.activityCount !== undefined && item.activityCount > 0 && (
              <Text style={[styles.activityCount, { color: colors.primary }]}>
                {item.activityCount} activities
              </Text>
            )}
          </View>
        </View>
        <Icon
          name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={24}
          color={isSelected ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Location Preferences
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.selectionBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.selectionText, { color: colors.text }]}>
          {selectedLocations.length} of {locations.length} locations selected
        </Text>
        <TouchableOpacity onPress={handleSelectAll}>
          <Text style={[styles.selectAllButton, { color: colors.primary }]}>
            {selectedLocations.length === locations.length ? 'Deselect All' : 'Select All'}
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectionText: {
    fontSize: 14,
  },
  selectAllButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: 12,
    marginTop: 2,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  activityCount: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default LocationPreferencesScreen;