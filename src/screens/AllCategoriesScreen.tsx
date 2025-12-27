import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

interface Category {
  id: string;
  name: string;
  description: string;
  ageMin: number | null;
  ageMax: number | null;
  requiresParent: boolean;
  activityCount: number;
}

const AllCategoriesScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      console.log('📋 Loading all categories...');
      
      const response = await fetch('http://localhost:3000/api/v1/categories');
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.categories);
        console.log(`✅ Loaded ${data.categories.length} categories`);
      } else {
        throw new Error(data.error || 'Failed to load categories');
      }
      
    } catch (err: any) {
      console.error('❌ Error loading categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleRefresh = () => {
    loadCategories(true);
  };

  const getCategoryIcon = (categoryName: string): string => {
    const categoryIcons: { [key: string]: string } = {
      'Early Years: Parent Participation': 'account-child',
      'Early Years: On My Own': 'baby-face',
      'School Age': 'school',
      'Youth': 'account-group',
      'All Ages & Family': 'family'
    };
    return categoryIcons[categoryName] || 'tag';
  };

  const formatAgeRange = (ageMin: number | null, ageMax: number | null): string => {
    if (ageMin === null && ageMax === null) return 'All Ages';
    if (ageMin === null) return `Up to ${ageMax} years`;
    if (ageMax === null) return `${ageMin}+ years`;
    if (ageMin === ageMax) return `${ageMin} years`;
    return `${ageMin}-${ageMax} years`;
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[styles.categoryCard, { backgroundColor: colors.cardBackground }]}
      onPress={() => navigation.navigate('CategoryDetail', { 
        categoryId: item.id, 
        categoryName: item.name 
      })}
      activeOpacity={0.7}
    >
      <View style={styles.categoryHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Icon name={getCategoryIcon(item.name)} size={24} color={colors.primary} />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.ageRange, { color: colors.textSecondary }]}>
            {formatAgeRange(item.ageMin, item.ageMax)}
          </Text>
        </View>
        <View style={styles.activityCount}>
          <Text style={[styles.countNumber, { color: colors.primary }]}>
            {item.activityCount}
          </Text>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            activities
          </Text>
        </View>
      </View>
      
      {item.description && (
        <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>
          {item.description}
        </Text>
      )}
      
      {item.requiresParent && (
        <View style={[styles.requiresParentBadge, { backgroundColor: colors.warning + '20' }]}>
          <Icon name="account-child" size={16} color={colors.warning} />
          <Text style={[styles.requiresParentText, { color: colors.warning }]}>
            Parent participation required
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="tag-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No categories found
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          There was an issue loading categories. Please try refreshing.
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => loadCategories(true)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading categories...
        </Text>
      </View>
    );
  }

  if (error && !refreshing && categories.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={64} color={colors.error} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Unable to load categories
        </Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => loadCategories(true)}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Browse by Category
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Find activities by age group
        </Text>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  categoryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  ageRange: {
    fontSize: 14,
  },
  activityCount: {
    alignItems: 'center',
  },
  countNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  countLabel: {
    fontSize: 12,
  },
  categoryDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  requiresParentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  requiresParentText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default AllCategoriesScreen;