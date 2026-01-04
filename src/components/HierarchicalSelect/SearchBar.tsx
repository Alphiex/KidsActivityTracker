import React from 'react';
import { View, TextInput, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SearchBarProps } from './types';
import { styles, COLORS } from './styles';
import { useTheme } from '../../contexts/ThemeContext';

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search locations...',
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.searchContainer}>
      <Icon
        name="magnify"
        size={20}
        color={COLORS.textSecondary}
        style={styles.searchIcon}
      />
      <TextInput
        key="hier-search-light"
        style={[
          styles.searchInput,
          { color: colors.text },
          Platform.OS === 'ios' && { color: colors.text },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        keyboardAppearance="light"
        selectionColor={colors.primary}
      />
      {value.length > 0 && (
        <TouchableOpacity
          style={styles.searchClearButton}
          onPress={() => onChangeText('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close-circle" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default React.memo(SearchBar);
