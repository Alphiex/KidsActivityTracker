import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenBackground from '../components/ScreenBackground';

const { height } = Dimensions.get('window');
const HeaderImage = require('../assets/images/browse-age-groups-header.png');

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
      <ImageBackground
        source={HeaderImage}
        style={styles.heroSection}
        imageStyle={styles.heroImageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
          style={styles.heroGradient}
        >
          <SafeAreaView edges={['top']} style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backButtonHero} onPress={() => navigation.goBack()}>
              <View style={styles.backButtonInner}>
                <Icon name="arrow-left" size={22} color="#333" />
              </View>
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Age Groups</Text>
          </View>
          <View style={styles.countBadgeRow}>
            <View style={styles.countBadge}>
              <Text style={styles.countNumber}>{ageGroups.length}</Text>
              <Text style={styles.countLabel}>GROUPS</Text>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
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
  heroSection: {
    height: height * 0.22,
    width: '100%',
  },
  heroImageStyle: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroGradient: {
    flex: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonHero: {},
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  countBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E8638B',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
