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
  
  // Check if current preferences represent "all ages" (single range 0-18)
  const isAllAges = currentPreferences.ageRanges.length === 1 && 
    currentPreferences.ageRanges[0].min === 0 && 
    currentPreferences.ageRanges[0].max === 18;
  
  // If all ages, start with all ranges selected, otherwise use saved ranges
  const initialRanges = isAllAges 
    ? ageRanges.map(r => ({ min: r.min, max: r.max }))
    : currentPreferences.ageRanges;
    
  const [selectedRanges, setSelectedRanges] = useState(initialRanges);
  const [allAgesMode, setAllAgesMode] = useState(isAllAges);

  const toggleAgeRange = (range: { min: number; max: number }) => {
    if (allAgesMode) {
      // If in all ages mode, switching to specific selection
      setAllAgesMode(false);
      setSelectedRanges([range]);
    } else {
      setSelectedRanges(prev => {
        const exists = prev.some(r => r.min === range.min && r.max === range.max);
        if (exists) {
          return prev.filter(r => !(r.min === range.min && r.max === range.max));
        } else {
          return [...prev, range];
        }
      });
    }
  };

  const toggleAllAges = () => {
    if (!allAgesMode) {
      setAllAgesMode(true);
      setSelectedRanges(ageRanges.map(r => ({ min: r.min, max: r.max })));
    } else {
      setAllAgesMode(false);
      setSelectedRanges([]);
    }
  };

  const isSelected = (range: { min: number; max: number }) => {
    return allAgesMode || selectedRanges.some(r => r.min === range.min && r.max === range.max);
  };

  const handleSave = () => {
    // If all ages mode or all ranges selected, save as single 0-18 range
    const rangeToSave = allAgesMode || selectedRanges.length === ageRanges.length
      ? [{ min: 0, max: 18 }]
      : selectedRanges;
      
    preferencesService.updatePreferences({
      ...currentPreferences,
      ageRanges: rangeToSave,
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

        {/* All Ages Toggle */}
        <TouchableOpacity
          style={[
            styles.allAgesToggle,
            {
              backgroundColor: allAgesMode ? colors.primary + '20' : colors.surface,
              borderColor: allAgesMode ? colors.primary : colors.border,
            }
          ]}
          onPress={toggleAllAges}
        >
          <View style={styles.allAgesContent}>
            <Icon
              name="account-group"
              size={28}
              color={allAgesMode ? colors.primary : colors.text}
            />
            <View style={styles.allAgesTextContainer}>
              <Text
                style={[
                  styles.allAgesLabel,
                  { color: allAgesMode ? colors.primary : colors.text }
                ]}
              >
                All Ages
              </Text>
              <Text style={[styles.allAgesSubtitle, { color: colors.textSecondary }]}>
                Include activities for all age groups (0-18)
              </Text>
            </View>
          </View>
          <Icon
            name={allAgesMode ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={allAgesMode ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {allAgesMode ? 'All age groups selected' : 'Select specific age groups'}
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
  allAgesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  allAgesContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  allAgesTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  allAgesLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  allAgesSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default AgePreferencesScreen;