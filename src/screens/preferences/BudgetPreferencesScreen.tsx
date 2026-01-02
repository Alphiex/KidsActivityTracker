import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Slider from '@react-native-community/slider';
import PreferencesService from '../../services/preferencesService';
import { useTheme } from '../../contexts/ThemeContext';
import { formatPrice } from '../../utils/formatters';

const BudgetPreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  const [minPrice, setMinPrice] = useState(currentPreferences.priceRange.min);
  const [maxPrice, setMaxPrice] = useState(currentPreferences.priceRange.max);

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      priceRange: { min: minPrice, max: maxPrice },
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
          Budget Preferences
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Set your budget range for activities. Only activities within this price range 
          will be shown in your results.
        </Text>

        <View style={[styles.budgetCard, { backgroundColor: colors.surface }]}>
          <View style={styles.priceDisplay}>
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                Minimum
              </Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                ${formatPrice(minPrice)}
              </Text>
            </View>
            <Icon name="arrow-right" size={24} color={colors.textSecondary} />
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                Maximum
              </Text>
              <Text style={[styles.priceValue, { color: colors.primary }]}>
                ${formatPrice(maxPrice)}
              </Text>
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderLabel, { color: colors.text }]}>
              Minimum Price
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={500}
              step={5}
              value={minPrice}
              onValueChange={setMinPrice}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <View style={styles.sliderRange}>
              <Text style={[styles.rangeText, { color: colors.textSecondary }]}>$0</Text>
              <Text style={[styles.rangeText, { color: colors.textSecondary }]}>$500</Text>
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={[styles.sliderLabel, { color: colors.text }]}>
              Maximum Price
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={500}
              step={5}
              value={maxPrice}
              onValueChange={setMaxPrice}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <View style={styles.sliderRange}>
              <Text style={[styles.rangeText, { color: colors.textSecondary }]}>$0</Text>
              <Text style={[styles.rangeText, { color: colors.textSecondary }]}>$500</Text>
            </View>
          </View>
        </View>

      </View>
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
  budgetCard: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  priceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  priceItem: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeText: {
    fontSize: 12,
  },
  presetContainer: {
    borderRadius: 12,
    padding: 20,
  },
  presetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  presetSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default BudgetPreferencesScreen;