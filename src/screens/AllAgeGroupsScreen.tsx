import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenBackground from '../components/ScreenBackground';

type NavigationProp = StackNavigationProp<any>;

interface AgeGroup {
  id: number;
  name: string;
  range: string;
  ageMin: number;
  ageMax: number;
  description: string;
  image: any;
  icon: string;
  color: string;
}

const ageGroups: AgeGroup[] = [
  {
    id: 1,
    name: '0-2 years',
    range: '0-2',
    ageMin: 0,
    ageMax: 2,
    description: 'Infant & Toddler programs',
    image: require('../assets/images/activities/early_development/toddler_play.jpg'),
    icon: 'baby-face-outline',
    color: '#FFB5C5',
  },
  {
    id: 2,
    name: '3-5 years',
    range: '3-5',
    ageMin: 3,
    ageMax: 5,
    description: 'Preschool activities',
    image: require('../assets/images/activities/early_development/preschool.jpg'),
    icon: 'human-child',
    color: '#B5D8FF',
  },
  {
    id: 3,
    name: '6-8 years',
    range: '6-8',
    ageMin: 6,
    ageMax: 8,
    description: 'Early elementary programs',
    image: require('../assets/images/activities/early_development/kids_activities.jpg'),
    icon: 'account-school-outline',
    color: '#C5FFB5',
  },
  {
    id: 4,
    name: '9-12 years',
    range: '9-12',
    ageMin: 9,
    ageMax: 12,
    description: 'Pre-teen activities',
    image: require('../assets/images/activities/other/youth_activities.jpg'),
    icon: 'account-group-outline',
    color: '#FFE5B5',
  },
  {
    id: 5,
    name: '13+ years',
    range: '13+',
    ageMin: 13,
    ageMax: 18,
    description: 'Teen programs',
    image: require('../assets/images/activities/life_skills/leadership.jpg'),
    icon: 'account-star-outline',
    color: '#E5B5FF',
  },
  {
    id: 6,
    name: 'All Ages',
    range: 'all',
    ageMin: 0,
    ageMax: 18,
    description: 'Family-friendly activities',
    image: require('../assets/images/activities/other/family_fun.jpg'),
    icon: 'home-heart',
    color: '#B5FFE5',
  },
];

const AllAgeGroupsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const navigateToAgeGroup = (group: AgeGroup) => {
    navigation.navigate('UnifiedResults', {
      type: 'ageGroup',
      ageMin: group.ageMin,
      ageMax: group.ageMax,
      ageGroupName: group.name,
      title: group.name,
      subtitle: group.description,
    });
  };

  const renderAgeGroup = ({ item }: { item: AgeGroup }) => {
    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => navigateToAgeGroup(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardImageContainer}>
          <Image source={item.image} style={styles.groupImage} />
        </View>
        <View style={styles.groupContent}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription}>{item.description}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={['#E8638B', '#D53F8C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.countBadge}>
            <Text style={styles.countNumber}>{ageGroups.length}</Text>
            <Text style={styles.countLabel}>groups</Text>
          </View>
        </SafeAreaView>
        <View style={styles.headerContent}>
          <Icon name="account-group" size={40} color="#FFF" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Age Groups</Text>
          <Text style={styles.headerSubtitle}>Find activities by age</Text>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <ScreenBackground>
      {renderHeader()}
      <FlatList
        data={ageGroups}
        renderItem={renderAgeGroup}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 16,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 16,
  },
  headerIcon: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  groupCard: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: '#F8F8F8',
  },
  groupImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  groupContent: {
    padding: 12,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 12,
    color: '#717171',
  },
});

export default AllAgeGroupsScreen;
