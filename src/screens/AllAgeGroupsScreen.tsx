import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenBackground from '../components/ScreenBackground';

type NavigationProp = StackNavigationProp<any>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Header illustration - children of different ages
const AgeGroupsHeaderImage = require('../assets/images/browse-age-groups-header.png');

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

const ModernColors = {
  primary: '#E8638B',
  text: '#222222',
  textLight: '#717171',
  background: '#FFFFFF',
  border: '#EEEEEE',
};

// Extracted ListHeader to avoid nested component warning
const ListHeader: React.FC = () => (
  <View style={styles.listHeaderContainer}>
    {/* Hero Image Section */}
    <View style={styles.heroSection}>
      <Image
        source={AgeGroupsHeaderImage}
        style={styles.heroImage}
        resizeMode="contain"
      />
    </View>

    {/* Title Section */}
    <View style={styles.titleSection}>
      <Text style={styles.mainTitle}>Find by Age</Text>
      <Text style={styles.subtitle}>
        Discover the perfect activities for your child's age and stage
      </Text>
    </View>
  </View>
);

const AllAgeGroupsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

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
        <View style={styles.imageContainer}>
          <Image source={item.image} style={styles.groupImage} />
          <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
            <Icon name={item.icon} size={20} color={ModernColors.text} />
          </View>
        </View>
        <View style={styles.groupContent}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription}>{item.description}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenBackground>
        {/* Sticky Header */}
        <View style={styles.stickyHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={ModernColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Browse by Age Group</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Age Groups List */}
        <FlatList
          data={ageGroups}
          renderItem={renderAgeGroup}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<ListHeader />}
          showsVerticalScrollIndicator={false}
        />
      </ScreenBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  listHeaderContainer: {
    paddingBottom: 16,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  heroImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.5,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: ModernColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: ModernColors.textLight,
    lineHeight: 22,
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
  imageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8F8F8',
    position: 'relative',
  },
  groupImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  iconBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  groupContent: {
    padding: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 13,
    color: ModernColors.textLight,
  },
});

export default AllAgeGroupsScreen;
