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
import { getActivityTypeIcon, getActivityTypeColors } from '../utils/activityTypeIcons';

type NavigationProp = StackNavigationProp<any>;

interface ActivityType {
  code: string;
  name: string;
  activityCount: number;
  icon: string;
  color: string[];
}

const AllActivityTypesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const loadActivityTypes = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      const activityTypesData = await activityService.getActivityTypesWithCounts();
      
      // Map activity types with their configurations
      const typesWithConfig = activityTypesData.map(type => {
        return {
          code: type.code,
          name: type.name,
          activityCount: type.activityCount,
          icon: getActivityTypeIcon(type.name),
          color: getActivityTypeColors(type.name),
        };
      });
      
      // Sort by count descending
      typesWithConfig.sort((a, b) => b.activityCount - a.activityCount);
      
      setActivityTypes(typesWithConfig);
    } catch (err: any) {
      console.error('Error loading activity types:', err);
      setError(err.message || 'Failed to load activity types. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'All Activity Types',
      headerStyle: {
        backgroundColor: colors.headerBackground,
      },
      headerTintColor: colors.headerText,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
    loadActivityTypes();
  }, [navigation, colors]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivityTypes();
  };

  const navigateToActivityType = (item: ActivityType) => {
    navigation.navigate('ActivityTypeDetail', { 
      typeCode: item.code,
      typeName: item.name
    });
  };

  const renderActivityType = ({ item, index }: { item: ActivityType; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.activityTypeContainer}
        onPress={() => navigateToActivityType(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={item.color}
          style={styles.activityTypeCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name={item.icon} size={50} color="#fff" />
          <View style={styles.activityTypeInfo}>
            <Text style={styles.activityTypeName}>{item.name}</Text>
            <Text style={styles.activityTypeCount}>
              {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
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
          Loading activity types...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={60} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadActivityTypes}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={activityTypes}
        renderItem={renderActivityType}
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
              Browse Activities by Type
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {activityTypes.length} activity types available
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
  activityTypeContainer: {
    marginHorizontal: 20,
    marginVertical: 8,
  },
  activityTypeCard: {
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
  activityTypeInfo: {
    flex: 1,
    marginLeft: 20,
  },
  activityTypeName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  activityTypeCount: {
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

export default AllActivityTypesScreen;