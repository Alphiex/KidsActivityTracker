import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  selectAllChildren,
  updateChildPreferences,
  fetchChildPreferences,
} from '../../store/slices/childrenSlice';
import {
  ChildLocationStep,
  ChildActivitiesStep,
  ChildLocationData,
  ChildActivitiesData,
} from '../../components/childSetup';
import { EnhancedAddress } from '../../types/preferences';

type RouteParams = {
  ChildPreferencesSettings: {
    childId: string;
  };
};

type PreferencesSection = 'location' | 'activities';

const SECTIONS: { key: PreferencesSection; title: string; icon: string }[] = [
  { key: 'location', title: 'Location & Distance', icon: 'map-marker' },
  { key: 'activities', title: 'Activity Types', icon: 'run' },
];

/**
 * Screen for editing a child's activity preferences post-onboarding.
 * Shows location and activity type preferences in expandable sections.
 */
const ChildPreferencesSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'ChildPreferencesSettings'>>();
  const dispatch = useAppDispatch();
  const scrollViewRef = useRef<ScrollView>(null);

  const childId = route.params?.childId;
  const children = useAppSelector(selectAllChildren);
  const child = children.find(c => c.id === childId);

  const [expandedSection, setExpandedSection] = useState<PreferencesSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Location data
  const [locationData, setLocationData] = useState<ChildLocationData>(() => {
    if (child?.preferences) {
      return {
        locationSource: child.preferences.locationSource as 'gps' | 'saved_address',
        savedAddress: child.preferences.savedAddress as EnhancedAddress | null,
        distanceRadiusKm: child.preferences.distanceRadiusKm ?? 25,
      };
    }
    return {
      locationSource: 'gps',
      savedAddress: null,
      distanceRadiusKm: 25,
    };
  });

  // Activities data
  const [activitiesData, setActivitiesData] = useState<ChildActivitiesData>(() => {
    if (child?.preferences) {
      return {
        preferredActivityTypes: child.preferences.preferredActivityTypes ?? [],
      };
    }
    return {
      preferredActivityTypes: [],
    };
  });

  // Track if data has changed
  const [hasChanges, setHasChanges] = useState(false);

  // Siblings for copy feature
  const siblings = children
    .filter(c => c.id !== childId)
    .map(c => ({
      id: c.id,
      name: c.name,
      preferredActivityTypes: c.preferences?.preferredActivityTypes ?? [],
    }));

  const handleLocationChange = useCallback((data: ChildLocationData) => {
    setLocationData(data);
    setHasChanges(true);
  }, []);

  const handleActivitiesChange = useCallback((data: ChildActivitiesData) => {
    setActivitiesData(data);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!childId) return;

    setIsSaving(true);
    try {
      await dispatch(updateChildPreferences({
        childId,
        updates: {
          locationSource: locationData.locationSource,
          savedAddress: locationData.savedAddress ?? undefined,
          distanceRadiusKm: locationData.distanceRadiusKm,
          distanceFilterEnabled: locationData.locationSource === 'gps' || !!locationData.savedAddress,
          preferredActivityTypes: activitiesData.preferredActivityTypes,
        },
      })).unwrap();

      Alert.alert('Success', 'Preferences saved successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('[ChildPreferencesSettings] Save error:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (section: PreferencesSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleScrollToAddress = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 150, animated: true });
    }, 100);
  };

  if (!child) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Child not found</Text>
      </SafeAreaView>
    );
  }

  const getLocationSummary = (): string => {
    if (locationData.locationSource === 'gps') {
      return `Using GPS location (${locationData.distanceRadiusKm} km radius)`;
    }
    if (locationData.savedAddress) {
      return `${locationData.savedAddress.city || 'Custom address'} (${locationData.distanceRadiusKm} km radius)`;
    }
    return 'Not set';
  };

  const getActivitiesSummary = (): string => {
    const count = activitiesData.preferredActivityTypes.length;
    if (count === 0) return 'All activity types';
    return `${count} activity type${count !== 1 ? 's' : ''} selected`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{child.name}'s Preferences</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Description */}
          <Text style={styles.description}>
            Customize activity search preferences for {child.name}. These settings affect which activities are shown in search results.
          </Text>

          {/* Sections */}
          {SECTIONS.map((section) => (
            <View key={section.key} style={styles.sectionContainer}>
              {/* Section Header (always visible) */}
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.key)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.iconContainer}>
                    <Icon name={section.icon} size={22} color="#E8638B" />
                  </View>
                  <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionSummary}>
                      {section.key === 'location' ? getLocationSummary() : getActivitiesSummary()}
                    </Text>
                  </View>
                </View>
                <Icon
                  name={expandedSection === section.key ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color="#9CA3AF"
                />
              </TouchableOpacity>

              {/* Section Content (expandable) */}
              {expandedSection === section.key && (
                <View style={styles.sectionContent}>
                  {section.key === 'location' && (
                    <ChildLocationStep
                      childName={child.name}
                      data={locationData}
                      onChange={handleLocationChange}
                      onScrollToAddress={handleScrollToAddress}
                    />
                  )}

                  {section.key === 'activities' && (
                    <ChildActivitiesStep
                      childName={child.name}
                      data={activitiesData}
                      onChange={handleActivitiesChange}
                      siblings={siblings}
                    />
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Save Button */}
        {hasChanges && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.saveButtonContainer}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <LinearGradient
                colors={isSaving ? ['#9CA3AF', '#6B7280'] : ['#E8638B', '#D53F8C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="content-save" size={20} color="#FFFFFF" style={styles.saveIcon} />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionSummary: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButton: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E8638B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 100,
  },
});

export default ChildPreferencesSettingsScreen;
