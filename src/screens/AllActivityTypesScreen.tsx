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

interface ActivityType {
  name: string;
  count: number;
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

  // Define activity type configurations
  const activityTypeConfig = {
    // Water sports
    'Swimming': { icon: 'swim', colors: ['#00BCD4', '#0097A7'] },
    'Swimming Lessons': { icon: 'swim', colors: ['#00BCD4', '#0097A7'] },
    'Private Lessons Swimming': { icon: 'swim', colors: ['#00ACC1', '#00838F'] },
    'Swimming - Aquatic Leadership': { icon: 'whistle', colors: ['#0288D1', '#01579B'] },
    'Aquatic': { icon: 'pool', colors: ['#03A9F4', '#0288D1'] },
    'Water Safety': { icon: 'lifebuoy', colors: ['#00ACC1', '#00838F'] },
    
    // Racquet sports
    'Tennis': { icon: 'tennis', colors: ['#8BC34A', '#689F38'] },
    'Badminton': { icon: 'badminton', colors: ['#CDDC39', '#AFB42B'] },
    'Squash': { icon: 'tennis-ball', colors: ['#FFC107', '#F57C00'] },
    'Table Tennis': { icon: 'table-tennis', colors: ['#FF9800', '#E65100'] },
    
    // Team sports
    'Basketball': { icon: 'basketball', colors: ['#FF5722', '#E64A19'] },
    'Soccer': { icon: 'soccer', colors: ['#4CAF50', '#388E3C'] },
    'Football': { icon: 'football', colors: ['#795548', '#5D4037'] },
    'Baseball': { icon: 'baseball', colors: ['#F44336', '#D32F2F'] },
    'Volleyball': { icon: 'volleyball', colors: ['#E91E63', '#C2185B'] },
    'Hockey': { icon: 'hockey-sticks', colors: ['#3F51B5', '#303F9F'] },
    
    // Martial Arts
    'Martial Arts': { icon: 'karate', colors: ['#F44336', '#D32F2F'] },
    'Karate': { icon: 'karate', colors: ['#FF5722', '#E64A19'] },
    'Taekwondo': { icon: 'karate', colors: ['#FF9800', '#F57C00'] },
    'Judo': { icon: 'karate', colors: ['#FFC107', '#FFA000'] },
    
    // Dance & Performance
    'Dance': { icon: 'dance-ballroom', colors: ['#E91E63', '#C2185B'] },
    'Ballet': { icon: 'dance-ballroom', colors: ['#F06292', '#E91E63'] },
    'Hip Hop': { icon: 'dance-ballroom', colors: ['#9C27B0', '#7B1FA2'] },
    'Drama': { icon: 'drama-masks', colors: ['#673AB7', '#512DA8'] },
    'Music': { icon: 'music-note', colors: ['#3F51B5', '#303F9F'] },
    
    // Fitness
    'Fitness': { icon: 'dumbbell', colors: ['#FF5722', '#E64A19'] },
    'Gymnastics': { icon: 'gymnastics', colors: ['#9C27B0', '#7B1FA2'] },
    'Yoga': { icon: 'yoga', colors: ['#00BCD4', '#0097A7'] },
    
    // Educational
    'STEM': { icon: 'flask', colors: ['#2196F3', '#1976D2'] },
    'Science': { icon: 'flask', colors: ['#03A9F4', '#0288D1'] },
    'Art': { icon: 'palette', colors: ['#FF5722', '#E64A19'] },
    'Cooking': { icon: 'chef-hat', colors: ['#FF9800', '#F57C00'] },
    'Languages': { icon: 'translate', colors: ['#607D8B', '#455A64'] },
    
    // Outdoor
    'Camps': { icon: 'tent', colors: ['#4CAF50', '#388E3C'] },
    'Day Camps': { icon: 'tent', colors: ['#8BC34A', '#689F38'] },
    'Outdoor Adventure': { icon: 'hiking', colors: ['#795548', '#5D4037'] },
    'Nature': { icon: 'leaf', colors: ['#4CAF50', '#388E3C'] },
    
    // Other activities
    'Skating': { icon: 'skate', colors: ['#00BCD4', '#0097A7'] },
    'Skate': { icon: 'skate', colors: ['#00BCD4', '#0097A7'] },  // Alternative name
    'Climbing': { icon: 'terrain', colors: ['#FF5722', '#E64A19'] },
    'Golf': { icon: 'golf', colors: ['#4CAF50', '#388E3C'] },
    'Chess': { icon: 'chess-knight', colors: ['#607D8B', '#455A64'] },
    'Board Games': { icon: 'dice-5', colors: ['#9C27B0', '#7B1FA2'] },
    
    // Additional activities from database
    'Private Lessons Music': { icon: 'piano', colors: ['#673AB7', '#512DA8'] },
    'General Programs': { icon: 'star', colors: ['#FF9800', '#F57C00'] },
    'Certifications & Leadership': { icon: 'certificate', colors: ['#795548', '#5D4037'] },
    'Part Day Camp': { icon: 'clock-time-three', colors: ['#4CAF50', '#388E3C'] },
    'Full Day Camp': { icon: 'clock-time-eight', colors: ['#2E7D32', '#1B5E20'] },
    'Learn & Play': { icon: 'puzzle', colors: ['#E91E63', '#C2185B'] },
    'Spin': { icon: 'bike', colors: ['#F44336', '#D32F2F'] },
    'Single Day': { icon: 'calendar-today', colors: ['#3F51B5', '#303F9F'] },
    'School Programs': { icon: 'school', colors: ['#00BCD4', '#0097A7'] },
  };

  // Default configuration for unknown activity types
  const defaultActivityTypeConfig = {
    icon: 'tag',
    colors: ['#9E9E9E', '#757575']
  };

  const loadActivityTypes = async () => {
    try {
      setError(null);
      const activityService = ActivityService.getInstance();
      const activityTypesData = await activityService.getActivityTypes();
      
      // Map activity types with their configurations
      const typesWithConfig = activityTypesData.map(type => {
        const config = activityTypeConfig[type.name] || defaultActivityTypeConfig;
        return {
          name: type.name,
          count: type.count,
          icon: config.icon,
          color: config.colors,
        };
      });
      
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

  const navigateToActivityType = (activityType: string) => {
    navigation.navigate('ActivityType', { 
      category: activityType,
      isActivityType: true 
    });
  };

  const renderActivityType = ({ item, index }: { item: ActivityType; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.activityTypeContainer}
        onPress={() => navigateToActivityType(item.name)}
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