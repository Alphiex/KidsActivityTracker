import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PreferencesService from '../../services/preferencesService';
import ActivityService from '../../services/activityService';
import { useTheme } from '../../contexts/ThemeContext';

const getActivityTypeIcon = (typeName: string) => {
  const iconMap: { [key: string]: string } = {
    'Team Sports': 'basketball',
    'Individual Sports': 'run',
    'Swimming & Aquatics': 'swim',
    'Dance': 'dance-ballroom',
    'Music': 'music',
    'Arts & Crafts': 'palette',
    'Martial Arts': 'karate',
    'Educational': 'school',
    'Camps': 'tent',
    'Science & Technology': 'flask',
    'Theatre & Drama': 'drama-masks',
    'Outdoor Activities': 'tree',
    'Fitness & Gym': 'dumbbell',
    'Special Needs': 'heart',
    'Parent & Child': 'account-child',
  };
  return iconMap[typeName] || 'tag';
};

const ActivityTypePreferencesScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();
  const currentPreferences = preferencesService.getPreferences();
  
  const [activityTypes, setActivityTypes] = useState<Array<{ code: string; name: string; count?: number }>>([]);
  const [selectedActivityTypes, setSelectedActivityTypes] = useState<string[]>(
    currentPreferences.preferredActivityTypes || []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const types = await activityService.getActivityTypesWithCounts();
      // Sort by count to show most popular first
      const sortedTypes = types.sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0));
      setActivityTypes(sortedTypes);
    } catch (error) {
      console.error('Error loading activity types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActivityType = (typeName: string) => {
    setSelectedActivityTypes(prev => {
      if (prev.includes(typeName)) {
        return prev.filter(name => name !== typeName);
      } else {
        return [...prev, typeName];
      }
    });
  };

  const handleSave = () => {
    preferencesService.updatePreferences({
      ...currentPreferences,
      preferredActivityTypes: selectedActivityTypes,
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
            Activity Type Preferences
          </Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading activity types...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Activity Type Preferences
        </Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Select the activity types you're interested in. These will be prioritized on your dashboard 
          and in recommendations.
        </Text>

        <View style={styles.grid}>
          {activityTypes.map(activityType => {
            const isSelected = selectedActivityTypes.includes(activityType.name);
            return (
              <TouchableOpacity
                key={activityType.code}
                style={[
                  styles.categoryCard,
                  { 
                    backgroundColor: colors.cardBackground,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                  isSelected && styles.selectedCard,
                ]}
                onPress={() => toggleActivityType(activityType.name)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: isSelected ? colors.primary + '20' : colors.surface }
                ]}>
                  <Icon 
                    name={getActivityTypeIcon(activityType.name)} 
                    size={28} 
                    color={isSelected ? colors.primary : colors.textSecondary} 
                  />
                </View>
                <Text style={[
                  styles.categoryName,
                  { color: isSelected ? colors.primary : colors.text }
                ]}>
                  {activityType.name}
                </Text>
                {activityType.activityCount !== undefined && (
                  <Text style={[styles.activityCount, { color: colors.textSecondary }]}>
                    {activityType.activityCount} activities
                  </Text>
                )}
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                    <Icon name="check" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedActivityTypes.length > 0 && (
          <View style={[styles.selectedInfo, { backgroundColor: colors.surface }]}>
            <Icon name="information" size={20} color={colors.primary} />
            <Text style={[styles.selectedInfoText, { color: colors.text }]}>
              {selectedActivityTypes.length} activity type{selectedActivityTypes.length !== 1 ? 's' : ''} selected
            </Text>
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
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  categoryCard: {
    width: '47%',
    margin: '1.5%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    position: 'relative',
  },
  selectedCard: {
    borderWidth: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  activityCount: {
    fontSize: 12,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  selectedInfoText: {
    fontSize: 14,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
});

export default ActivityTypePreferencesScreen;