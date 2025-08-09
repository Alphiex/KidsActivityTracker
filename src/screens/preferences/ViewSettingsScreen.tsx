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

const viewTypes = [
  {
    id: 'grid',
    name: 'Grid View',
    description: 'Compact grid layout with images',
    icon: 'view-grid',
  },
  {
    id: 'list',
    name: 'List View',
    description: 'Detailed list with more information',
    icon: 'view-list',
  },
  {
    id: 'card',
    name: 'Card View',
    description: 'Large cards with full details',
    icon: 'card-outline',
  },
];

const ViewSettingsScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  const [selectedViewType, setSelectedViewType] = useState(currentPreferences.viewType);

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      viewType: selectedViewType,
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
          View Settings
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Choose how you'd like to see activities displayed in the app.
        </Text>

        {viewTypes.map(viewType => {
          const isSelected = selectedViewType === viewType.id;
          return (
            <TouchableOpacity
              key={viewType.id}
              style={[
                styles.viewTypeItem,
                {
                  backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                }
              ]}
              onPress={() => setSelectedViewType(viewType.id)}
            >
              <View style={styles.viewTypeContent}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isSelected ? colors.primary : colors.background }
                  ]}
                >
                  <Icon
                    name={viewType.icon}
                    size={28}
                    color={isSelected ? '#FFFFFF' : colors.text}
                  />
                </View>
                <View style={styles.viewTypeText}>
                  <Text
                    style={[
                      styles.viewTypeName,
                      { color: isSelected ? colors.primary : colors.text }
                    ]}
                  >
                    {viewType.name}
                  </Text>
                  <Text
                    style={[
                      styles.viewTypeDescription,
                      { color: colors.textSecondary }
                    ]}
                  >
                    {viewType.description}
                  </Text>
                </View>
              </View>
              <Icon
                name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                size={24}
                color={isSelected ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}

        <View style={[styles.previewSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            Preview
          </Text>
          <Text style={[styles.previewDescription, { color: colors.textSecondary }]}>
            Your selected view type will be applied to all activity listings throughout the app.
          </Text>
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
  viewTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  viewTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewTypeText: {
    marginLeft: 16,
    flex: 1,
  },
  viewTypeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  viewTypeDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  previewSection: {
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ViewSettingsScreen;