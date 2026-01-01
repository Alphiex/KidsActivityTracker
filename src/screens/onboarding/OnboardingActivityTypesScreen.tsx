import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import PreferencesService from '../../services/preferencesService';
import ActivityService from '../../services/activityService';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

const { width: screenWidth } = Dimensions.get('window');

type NavigationProp = StackNavigationProp<OnboardingStackParamList, 'OnboardingActivityTypes'>;

const OnboardingActivityTypesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const preferencesService = PreferencesService.getInstance();
  const activityService = ActivityService.getInstance();

  const [activityTypes, setActivityTypes] = useState<Array<{ code: string; name: string; iconName?: string; count?: number }>>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      // Pass false to disable global filters during onboarding - user hasn't set preferences yet
      const types = await activityService.getActivityTypesWithCounts(false);
      const sortedTypes = types.sort((a, b) => (b.activityCount || 0) - (a.activityCount || 0));
      setActivityTypes(sortedTypes);
    } catch (error) {
      console.error('Error loading activity types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleType = (typeName: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeName)
        ? prev.filter(t => t !== typeName)
        : [...prev, typeName]
    );
  };

  const handleNext = async () => {
    await preferencesService.updatePreferences({
      preferredActivityTypes: selectedTypes,
    });
    navigation.navigate('OnboardingAge');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingAge');
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
          <View style={styles.stepDot} />
        </View>
        <Text style={styles.title}>What activities interest you?</Text>
        <Text style={styles.subtitle}>Select the types of activities you'd like to see</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#14B8A6" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        >
          {activityTypes.map((type) => {
            const isSelected = selectedTypes.includes(type.name);
            return (
              <TouchableOpacity
                key={type.code}
                style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                onPress={() => toggleType(type.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                  <Icon
                    name={type.iconName || 'tag'}
                    size={24}
                    color={isSelected ? '#FFFFFF' : '#14B8A6'}
                  />
                </View>
                <Text style={[styles.typeName, isSelected && styles.typeNameSelected]} numberOfLines={2}>
                  {type.name}
                </Text>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Icon name="check" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.nextButtonContainer}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#14B8A6', '#0D9488']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>
              {selectedTypes.length > 0 ? `Continue (${selectedTypes.length} selected)` : 'Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#14B8A6',
    width: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  typeCard: {
    width: (screenWidth - 48) / 3,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#14B8A6',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainerSelected: {
    backgroundColor: '#14B8A6',
  },
  typeName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
    height: 32,
  },
  typeNameSelected: {
    color: '#14B8A6',
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  nextButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: '#9CA3AF',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default OnboardingActivityTypesScreen;
