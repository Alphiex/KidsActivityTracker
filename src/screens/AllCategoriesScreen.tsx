import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import ActivityService from '../services/activityService';
import { Colors } from '../theme';
import { useTheme } from '../contexts/ThemeContext';

type NavigationProp = StackNavigationProp<any>;

interface Category {
  name: string;
  count: number;
  icon: string;
  color: string[];
}

const AllCategoriesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define category configurations
  const categoryConfig = {
    'Sports': { icon: 'basketball', colors: ['#4CAF50', '#45a049'] },
    'Arts': { icon: 'palette', colors: ['#E91E63', '#C2185B'] },
    'Music': { icon: 'music-note', colors: ['#9C27B0', '#7B1FA2'] },
    'Science': { icon: 'flask', colors: ['#2196F3', '#1976D2'] },
    'Dance': { icon: 'dance-ballroom', colors: ['#FF5722', '#E64A19'] },
    'Education': { icon: 'school', colors: ['#607D8B', '#455A64'] },
    'Outdoor': { icon: 'tree', colors: ['#4CAF50', '#388E3C'] },
    'Indoor': { icon: 'home', colors: ['#795548', '#5D4037'] },
    'Swimming': { icon: 'swim', colors: ['#00BCD4', '#0097A7'] },
    'Martial Arts': { icon: 'karate', colors: ['#F44336', '#D32F2F'] },
    'Drama': { icon: 'drama-masks', colors: ['#FF9800', '#F57C00'] },
    'Technology': { icon: 'laptop', colors: ['#3F51B5', '#303F9F'] },
    'Camps': { icon: 'tent', colors: ['#8BC34A', '#689F38'] },
    'Fitness': { icon: 'dumbbell', colors: ['#FFC107', '#F57C00'] },
    'Cooking': { icon: 'chef-hat', colors: ['#FF5722', '#E64A19'] },
    'Languages': { icon: 'translate', colors: ['#673AB7', '#512DA8'] },
    'Games': { icon: 'gamepad-variant', colors: ['#9C27B0', '#7B1FA2'] },
    'Nature': { icon: 'leaf', colors: ['#4CAF50', '#388E3C'] },
    'Social': { icon: 'account-group', colors: ['#2196F3', '#1976D2'] },
    'Special Needs': { icon: 'human-wheelchair', colors: ['#00BCD4', '#0097A7'] },
  };

  // Default configuration for unknown categories
  const defaultCategoryConfig = {
    icon: 'tag',
    colors: ['#9E9E9E', '#757575']
  };

  const loadCategories = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      const categoriesData = await activityService.getCategories();
      
      // Map categories with their configurations
      const categoriesWithConfig = categoriesData.map(cat => {
        const config = categoryConfig[cat.name] || defaultCategoryConfig;
        return {
          name: cat.name,
          count: cat.count,
          icon: config.icon,
          color: config.colors,
        };
      });
      
      setCategories(categoriesWithConfig);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Failed to load categories. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'All Categories',
      headerStyle: {
        backgroundColor: colors.headerBackground,
      },
      headerTintColor: colors.headerText,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadCategories();
  }, [navigation, colors]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const navigateToCategory = (category: string) => {
    navigation.navigate('ActivityType', { category });
  };

  const renderCategory = ({ item, index }: { item: Category; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.categoryContainer}
        onPress={() => navigateToCategory(item.name)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={item.color}
          style={styles.categoryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name={item.icon} size={50} color="#fff" />
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryCount}>
              {item.count} {item.count === 1 ? 'activity' : 'activities'}
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="#fff" style={styles.chevron} />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading categories...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={60} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadCategories}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Browse Activities by Category
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {categories.length} categories available
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  categoryContainer: {
    marginHorizontal: 20,
    marginVertical: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 20,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  chevron: {
    marginLeft: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AllCategoriesScreen;