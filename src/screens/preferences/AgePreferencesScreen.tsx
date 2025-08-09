import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../../services/preferencesService';
import { useTheme } from '../../contexts/ThemeContext';

const ageRanges = [
  { min: 0, max: 2, label: 'Infant (0-2)' },
  { min: 3, max: 5, label: 'Toddler (3-5)' },
  { min: 6, max: 8, label: 'Early Elementary (6-8)' },
  { min: 9, max: 11, label: 'Late Elementary (9-11)' },
  { min: 12, max: 14, label: 'Middle School (12-14)' },
  { min: 15, max: 18, label: 'High School (15-18)' },
];

const AgePreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  const [selectedRanges, setSelectedRanges] = useState(
    currentPreferences.ageRanges
  );

  const toggleAgeRange = (range: { min: number; max: number }) => {
    setSelectedRanges(prev => {
      const exists = prev.some(r => r.min === range.min && r.max === range.max);
      if (exists) {
        return prev.filter(r => !(r.min === range.min && r.max === range.max));
      } else {
        return [...prev, range];
      }
    });
  };

  const isSelected = (range: { min: number; max: number }) => {
    return selectedRanges.some(r => r.min === range.min && r.max === range.max);
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      ageRanges: selectedRanges,
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
          Age Preferences
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Select the age groups you're looking for. Activities suitable for these ages 
          will be shown in your results.
        </Text>

        {ageRanges.map((range, index) => {
          const selected = isSelected(range);
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.ageRangeItem,
                { 
                  backgroundColor: selected ? colors.primary + '10' : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                }
              ]}
              onPress={() => toggleAgeRange({ min: range.min, max: range.max })}
            >
              <View style={styles.ageRangeContent}>
                <Icon
                  name="human-child"
                  size={24}
                  color={selected ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.ageRangeLabel,
                    { color: selected ? colors.primary : colors.text }
                  ]}
                >
                  {range.label}
                </Text>
              </View>
              <Icon
                name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={selected ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
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
  ageRangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  ageRangeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ageRangeLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
});

export default AgePreferencesScreen;