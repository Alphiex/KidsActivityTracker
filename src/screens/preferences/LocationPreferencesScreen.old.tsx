import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../../services/preferencesService';
import { useTheme } from '../../contexts/ThemeContext';

const LocationPreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  const [locations, setLocations] = useState<string[]>(currentPreferences.locations);
  const [newLocation, setNewLocation] = useState('');

  const addLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation.trim())) {
      setLocations([...locations, newLocation.trim()]);
      setNewLocation('');
    }
  };

  const removeLocation = (location: string) => {
    setLocations(locations.filter(l => l !== location));
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      locations,
    });
    navigation.goBack();
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Add locations where you'd like to find activities. You can add specific venues, 
          neighborhoods, or cities.
        </Text>

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Add a location..."
            placeholderTextColor={colors.textSecondary}
            value={newLocation}
            onChangeText={setNewLocation}
            onSubmitEditing={addLocation}
          />
          <TouchableOpacity onPress={addLocation}>
            <Icon name="plus-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {locations.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="map-marker-off" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No locations added yet
            </Text>
          </View>
        ) : (
          <View style={styles.locationsList}>
            {locations.map((location, index) => (
              <View
                key={index}
                style={[styles.locationItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.locationContent}>
                  <Icon name="map-marker" size={20} color={colors.primary} />
                  <Text style={[styles.locationText, { color: colors.text }]}>
                    {location}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeLocation(location)}>
                  <Icon name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  locationsList: {
    gap: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    marginLeft: 12,
  },
});

export default LocationPreferencesScreen;