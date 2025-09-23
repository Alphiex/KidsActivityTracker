import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ModernColors, ModernSpacing, ModernTypography, ModernBorderRadius, ModernShadows } from '../../theme/modernTheme';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: () => void;
  onFilter?: () => void;
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search for activities, locations, or age groups...',
  value = '',
  onChangeText,
  onSearch,
  onFilter,
  autoFocus = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedScale = React.useRef(new Animated.Value(1)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(animatedScale, {
      toValue: 1.02,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
  };

  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        { transform: [{ scale: animatedScale }] }
      ]}
    >
      <View style={styles.searchContainer}>
        <Icon 
          name="magnify" 
          size={24} 
          color={isFocused ? ModernColors.primary : ModernColors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={ModernColors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoFocus={autoFocus}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <Icon name="close-circle" size={20} color={ModernColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        {onSearch && (
          <TouchableOpacity
            style={[styles.searchButton, isFocused && styles.searchButtonFocused]}
            onPress={onSearch}
            activeOpacity={0.8}
          >
            <Icon name="magnify" size={22} color={ModernColors.textOnPrimary} />
          </TouchableOpacity>
        )}
        
        {onFilter && (
          <TouchableOpacity
            style={styles.filterButton}
            onPress={onFilter}
            activeOpacity={0.8}
          >
            <Icon name="filter-variant" size={22} color={ModernColors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ModernColors.background,
    borderRadius: ModernBorderRadius.lg,
    paddingHorizontal: ModernSpacing.xs,
    paddingVertical: ModernSpacing.xs,
    borderWidth: 1,
    borderColor: ModernColors.border,
  },
  containerFocused: {
    borderColor: ModernColors.primary + '60',
    backgroundColor: ModernColors.surface,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginLeft: ModernSpacing.sm,
  },
  input: {
    flex: 1,
    fontSize: ModernTypography.sizes.base,
    color: ModernColors.text,
    paddingVertical: Platform.OS === 'ios' ? ModernSpacing.md : ModernSpacing.sm,
    paddingHorizontal: ModernSpacing.sm,
    fontWeight: ModernTypography.weights.normal as any,
  },
  clearButton: {
    padding: ModernSpacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ModernSpacing.xs,
  },
  searchButton: {
    backgroundColor: ModernColors.primary,
    borderRadius: ModernBorderRadius.lg,
    paddingHorizontal: ModernSpacing.lg + ModernSpacing.sm,
    paddingVertical: ModernSpacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonFocused: {
    backgroundColor: ModernColors.primaryDark,
  },
  filterButton: {
    backgroundColor: ModernColors.surface,
    borderRadius: ModernBorderRadius.lg,
    paddingHorizontal: ModernSpacing.md,
    paddingVertical: ModernSpacing.sm + 2,
    borderWidth: 1,
    borderColor: ModernColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SearchBar;