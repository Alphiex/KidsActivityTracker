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

const categories = [
  { id: 'sports', name: 'Sports', icon: 'basketball' },
  { id: 'arts', name: 'Arts & Crafts', icon: 'palette' },
  { id: 'music', name: 'Music', icon: 'music' },
  { id: 'dance', name: 'Dance', icon: 'dance-ballroom' },
  { id: 'science', name: 'Science', icon: 'flask' },
  { id: 'technology', name: 'Technology', icon: 'laptop' },
  { id: 'outdoor', name: 'Outdoor', icon: 'tree' },
  { id: 'educational', name: 'Educational', icon: 'school' },
  { id: 'camps', name: 'Camps', icon: 'tent' },
  { id: 'swimming', name: 'Swimming', icon: 'swim' },
  { id: 'martial-arts', name: 'Martial Arts', icon: 'karate' },
  { id: 'theater', name: 'Theater', icon: 'drama-masks' },
];

const CategoryPreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    currentPreferences.preferredCategories
  );

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      preferredCategories: selectedCategories,
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
          Category Preferences
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Select the categories you're interested in. Activities matching these categories 
          will be prioritized in your feed.
        </Text>

        <View style={styles.grid}>
          {categories.map(category => {
            const isSelected = selectedCategories.includes(category.id);
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  { 
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => toggleCategory(category.id)}
              >
                <Icon
                  name={category.icon}
                  size={32}
                  color={isSelected ? '#FFFFFF' : colors.text}
                />
                <Text
                  style={[
                    styles.categoryName,
                    { color: isSelected ? '#FFFFFF' : colors.text }
                  ]}
                >
                  {category.name}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Icon name="check-circle" size={20} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  categoryCard: {
    width: '30%',
    aspectRatio: 1,
    margin: '1.66%',
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});

export default CategoryPreferencesScreen;