import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type NavigationProp = StackNavigationProp<any>;

interface AgeGroup {
  id: number;
  name: string;
  range: string;
  ageMin: number;
  ageMax: number;
  description: string;
  image: any;
}

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
    },
    {
      id: 2,
      name: '3-5 years',
      range: '3-5',
      ageMin: 3,
      ageMax: 5,
      description: 'Preschool activities',
      image: require('../assets/images/activities/early_development/preschool.jpg'),
    },
    {
      id: 3,
      name: '6-8 years',
      range: '6-8',
      ageMin: 6,
      ageMax: 8,
      description: 'Early elementary programs',
      image: require('../assets/images/activities/early_development/kids_activities.jpg'),
    },
    {
      id: 4,
      name: '9-12 years',
      range: '9-12',
      ageMin: 9,
      ageMax: 12,
      description: 'Pre-teen activities',
      image: require('../assets/images/activities/other/youth_activities.jpg'),
    },
    {
      id: 5,
      name: '13+ years',
      range: '13+',
      ageMin: 13,
      ageMax: 18,
      description: 'Teen programs',
      image: require('../assets/images/activities/life_skills/leadership.jpg'),
    },
    {
      id: 6,
      name: 'All Ages',
      range: 'all',
      ageMin: 0,
      ageMax: 18,
      description: 'Family-friendly activities',
      image: require('../assets/images/activities/other/family_fun.jpg'),
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
        </View>
        <View style={styles.groupContent}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription}>{item.description}</Text>
        </View>
        <Icon name="chevron-right" size={24} color="#CCCCCC" style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#222222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Browse by Age Group</Text>
      </View>

      {/* Age Groups List */}
      <FlatList
        data={ageGroups}
        renderItem={renderAgeGroup}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.subtitle}>
              Find the perfect activities for your child's age
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222222',
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#717171',
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
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#F0F0F0',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 13,
    color: '#717171',
  },
  chevron: {
    position: 'absolute',
    right: 8,
    bottom: 8,
  },
});

export default AllAgeGroupsScreen;