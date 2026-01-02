import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  selectAllChildren,
  deleteChild,
  fetchChildActivities,
  selectChildrenLoading,
} from '../../store/slices/childrenSlice';
import { ChildAvatar } from '../../components/children';
import ActivityCard from '../../components/ActivityCard';
import childrenService from '../../services/childrenService';
import { Activity } from '../../types';

type ChildrenStackParamList = {
  ChildrenList: undefined;
  AddEditChild: { childId?: string };
  ChildProfile: { childId: string };
  ChildActivityHistory: { childId: string; childName: string };
  ChildProgress: { child: { id: string; name: string; dateOfBirth: string } };
  ChildPreferencesSettings: { childId: string };
};

type NavigationProp = StackNavigationProp<ChildrenStackParamList, 'ChildProfile'>;
type RouteProps = RouteProp<ChildrenStackParamList, 'ChildProfile'>;

const ChildProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const dispatch = useAppDispatch();
  
  const children = useAppSelector(selectAllChildren);
  const loading = useAppSelector(selectChildrenLoading);
  const child = children.find(c => c.id === route.params.childId);
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recommendations, setRecommendations] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    loadChildActivities();
  }, [route.params.childId]);

  const loadChildActivities = async () => {
    if (!child) return;
    
    try {
      setLoadingActivities(true);
      const response = await childrenService.getChildActivities(child.id);
      setActivities(response.activities);
      setRecommendations(response.recommendations);
    } catch (error) {
      console.error('Failed to load child activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadChildActivities();
    setRefreshing(false);
  };

  const handleEdit = () => {
    navigation.navigate('AddEditChild', { childId: child?.id });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Child',
      `Are you sure you want to remove ${child?.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (child) {
              await dispatch(deleteChild(child.id));
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  if (!child) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Child not found</Text>
      </SafeAreaView>
    );
  }

  const age = childrenService.calculateAge(child.dateOfBirth);
  const ageGroup = childrenService.getAgeGroup(age);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
              <Icon name="edit" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <Icon name="delete" size={24} color="#ff5252" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <ChildAvatar name={child.name} avatarUrl={child.avatar} size={100} />
          <Text style={styles.childName}>{child.name}</Text>
          <Text style={styles.childAge}>
            {age} years old • {ageGroup}
          </Text>
        </View>

        {/* Info Cards */}
        <View style={styles.infoCards}>
          {/* Interests */}
          {child.interests && child.interests.length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="stars" size={20} color="#2196F3" />
                <Text style={styles.infoCardTitle}>Interests</Text>
              </View>
              <View style={styles.interestsContainer}>
                {child.interests.map((interest, index) => (
                  <View key={index} style={styles.interestBadge}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Allergies */}
          {child.allergies && child.allergies.length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="warning" size={20} color="#ff9800" />
                <Text style={styles.infoCardTitle}>Allergies</Text>
              </View>
              <Text style={styles.infoText}>
                {child.allergies.join(', ')}
              </Text>
            </View>
          )}

          {/* Medical Info */}
          {child.medicalInfo && (
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <Icon name="medical-services" size={20} color="#4caf50" />
                <Text style={styles.infoCardTitle}>Medical Information</Text>
              </View>
              <Text style={styles.infoText}>{child.medicalInfo}</Text>
            </View>
          )}
        </View>

        {/* Activity History & Skill Progress Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ChildActivityHistory', { 
              childId: child.id, 
              childName: child.name 
            })}
          >
            <Icon name="history" size={24} color="#2196F3" />
            <Text style={styles.actionButtonText}>View Activity History</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonProgress]}
            onPress={() => navigation.navigate('ChildProgress', {
              child: {
                id: child.id,
                name: child.name,
                dateOfBirth: typeof child.dateOfBirth === 'string' ? child.dateOfBirth : child.dateOfBirth.toISOString()
              }
            })}
          >
            <Icon name="chart-line" size={24} color="#8B5CF6" />
            <Text style={styles.actionButtonText}>View Skill Progress</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPreferences]}
            onPress={() => navigation.navigate('ChildPreferencesSettings', {
              childId: child.id
            })}
          >
            <Icon name="tune" size={24} color="#E8638B" />
            <Text style={styles.actionButtonText}>Activity Preferences</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Enrolled Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enrolled Activities</Text>
          {loadingActivities ? (
            <ActivityIndicator size="small" color="#2196F3" style={styles.loader} />
          ) : activities.length > 0 ? (
            activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onPress={() => {
                  // Navigate to activity details
                  // navigation.navigate('ActivityDetail', { activity });
                }}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="event-busy" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No enrolled activities yet</Text>
            </View>
          )}
        </View>

        {/* Recommended Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Activities</Text>
          {loadingActivities ? (
            <ActivityIndicator size="small" color="#2196F3" style={styles.loader} />
          ) : recommendations.length > 0 ? (
            recommendations.slice(0, 5).map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onPress={() => {
                  // Navigate to activity details
                  // navigation.navigate('ActivityDetail', { activity });
                }}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Icon name="lightbulb-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No recommendations available</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  childName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  childAge: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  infoCards: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestBadge: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#2196F3',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
  },
  quickActions: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  actionButtonProgress: {
    marginTop: 12,
  },
  actionButtonPreferences: {
    marginTop: 12,
  },
});

export default ChildProfileScreen;