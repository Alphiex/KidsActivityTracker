import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  selectAllChildren,
  updateChildPreferences,
  copyChildPreferences,
  fetchChildPreferences,
  initializeChildPreferences,
  ChildWithPreferences,
} from '../store/slices/childrenSlice';
import { selectSubscription } from '../store/slices/subscriptionSlice';
import { preferencesService } from '../services/preferencesService';
import DayTimeGridSelector, {
  DayTimeSlots,
  createDefaultDayTimeSlots,
  DAYS_OF_WEEK,
} from '../components/DayTimeGridSelector';
import { ChildActivitiesStep, ChildActivitiesData } from '../components/childSetup';
import { ChildAvatar } from '../components/children';
import { getChildColor } from '../theme/childColors';
import { ModernColors } from '../theme/modernTheme';
import TopTabNavigation from '../components/TopTabNavigation';
import ScreenBackground from '../components/ScreenBackground';

type PreferencesSection = 'activities' | 'environment' | 'distance' | 'cost' | 'when';

const SECTIONS: { key: PreferencesSection; title: string; icon: string }[] = [
  { key: 'activities', title: 'Activity Types', icon: 'run' },
  { key: 'environment', title: 'Indoor / Outdoor', icon: 'weather-sunny' },
  { key: 'distance', title: 'Distance', icon: 'map-marker-distance' },
  { key: 'cost', title: 'Cost', icon: 'currency-usd' },
  { key: 'when', title: 'When', icon: 'calendar-clock' },
];

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100];
const ENVIRONMENT_OPTIONS: { value: 'all' | 'indoor' | 'outdoor'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'checkbox-marked-circle-outline' },
  { value: 'indoor', label: 'Indoor', icon: 'home' },
  { value: 'outdoor', label: 'Outdoor', icon: 'tree' },
];

/**
 * ChildPreferencesScreen - Main screen for managing per-child activity preferences
 *
 * Features:
 * - Global "Hide closed/full" toggle at the top
 * - Child selector to switch between children
 * - Copy preferences from one child to another
 * - Expandable sections for each preference type
 */
const ChildPreferencesScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const children = useAppSelector(selectAllChildren);
  const subscription = useAppSelector(selectSubscription);
  const isPremium = subscription?.currentPlan?.code === 'premium';

  // Selected child for editing
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<PreferencesSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Global preferences
  const [hideClosedOrFull, setHideClosedOrFull] = useState(false);

  // Local state for current child's preferences
  const [activitiesData, setActivitiesData] = useState<ChildActivitiesData>({ preferredActivityTypes: [] });
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | 'indoor' | 'outdoor'>('all');
  const [distanceRadiusKm, setDistanceRadiusKm] = useState(25);
  const [priceRangeMin, setPriceRangeMin] = useState(0);
  const [priceRangeMax, setPriceRangeMax] = useState(500);
  const [dayTimeSlots, setDayTimeSlots] = useState<DayTimeSlots>(createDefaultDayTimeSlots());

  // Get selected child
  const selectedChild = useMemo(
    () => children.find(c => c.id === selectedChildId),
    [children, selectedChildId]
  );

  // Siblings for copy feature
  const siblings = useMemo(
    () => children.filter(c => c.id !== selectedChildId).map(c => ({
      id: c.id,
      name: c.name,
      preferredActivityTypes: c.preferences?.preferredActivityTypes ?? [],
    })),
    [children, selectedChildId]
  );

  // Load global preferences on mount
  useEffect(() => {
    const loadGlobalPrefs = async () => {
      const prefs = await preferencesService.getPreferences();
      setHideClosedOrFull(prefs?.hideClosedOrFull ?? false);
    };
    loadGlobalPrefs();
  }, []);

  // Select first child if none selected
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // Load child preferences when selected child changes
  useEffect(() => {
    if (!selectedChildId) return;

    const loadChildPrefs = async () => {
      try {
        await dispatch(fetchChildPreferences(selectedChildId)).unwrap();
      } catch (error) {
        console.log('[ChildPreferences] No existing preferences, initializing from user preferences');
        // Initialize preferences from user's global preferences
        try {
          await dispatch(initializeChildPreferences(selectedChildId)).unwrap();
        } catch (initError) {
          console.log('[ChildPreferences] Could not initialize, using defaults');
        }
      }
    };
    loadChildPrefs();
  }, [selectedChildId, dispatch]);

  // Sync local state with Redux state when child preferences change
  useEffect(() => {
    if (!selectedChild?.preferences) {
      // Reset to defaults if no preferences
      setActivitiesData({ preferredActivityTypes: [] });
      setEnvironmentFilter('all');
      setDistanceRadiusKm(25);
      setPriceRangeMin(0);
      setPriceRangeMax(500);
      setDayTimeSlots(createDefaultDayTimeSlots());
      return;
    }

    const prefs = selectedChild.preferences;
    setActivitiesData({ preferredActivityTypes: prefs.preferredActivityTypes ?? [] });
    setEnvironmentFilter(prefs.environmentFilter ?? 'all');
    setDistanceRadiusKm(prefs.distanceRadiusKm ?? 25);
    setPriceRangeMin(prefs.priceRangeMin ?? 0);
    setPriceRangeMax(prefs.priceRangeMax ?? 500);

    // Load dayTimeSlots or create from legacy daysOfWeek/timePreferences
    if (prefs.dayTimeSlots) {
      setDayTimeSlots(prefs.dayTimeSlots);
    } else {
      // Create dayTimeSlots from legacy data
      const slots: DayTimeSlots = {};
      const enabledDays = prefs.daysOfWeek ?? DAYS_OF_WEEK;
      const timePrefs = prefs.timePreferences ?? { morning: true, afternoon: true, evening: true };

      DAYS_OF_WEEK.forEach(day => {
        const isDayEnabled = enabledDays.includes(day);
        slots[day] = {
          morning: isDayEnabled && timePrefs.morning,
          afternoon: isDayEnabled && timePrefs.afternoon,
          evening: isDayEnabled && timePrefs.evening,
        };
      });
      setDayTimeSlots(slots);
    }

    setHasChanges(false);
  }, [selectedChild?.preferences]);

  // Handle global toggle change
  const handleHideClosedOrFullChange = async (value: boolean) => {
    if (!isPremium) {
      Alert.alert(
        'Premium Feature',
        'Upgrade to Premium to hide closed or full activities.',
        [{ text: 'OK' }]
      );
      return;
    }

    setHideClosedOrFull(value);
    try {
      await preferencesService.updatePreferences({ hideClosedOrFull: value });
    } catch (error) {
      console.error('[ChildPreferences] Error updating global preference:', error);
    }
  };

  // Handle section toggle
  const toggleSection = (section: PreferencesSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle preference changes
  const handleActivitiesChange = useCallback((data: ChildActivitiesData) => {
    setActivitiesData(data);
    setHasChanges(true);
  }, []);

  const handleEnvironmentChange = useCallback((value: 'all' | 'indoor' | 'outdoor') => {
    setEnvironmentFilter(value);
    setHasChanges(true);
  }, []);

  const handleDistanceChange = useCallback((value: number) => {
    setDistanceRadiusKm(value);
    setHasChanges(true);
  }, []);

  const handlePriceMinChange = useCallback((value: number) => {
    setPriceRangeMin(Math.min(value, priceRangeMax - 10));
    setHasChanges(true);
  }, [priceRangeMax]);

  const handlePriceMaxChange = useCallback((value: number) => {
    setPriceRangeMax(Math.max(value, priceRangeMin + 10));
    setHasChanges(true);
  }, [priceRangeMin]);

  const handleDayTimeSlotsChange = useCallback((slots: DayTimeSlots) => {
    setDayTimeSlots(slots);
    setHasChanges(true);
  }, []);

  // Handle copy preferences
  const handleCopyPreferences = () => {
    if (siblings.length === 0) {
      Alert.alert('No Siblings', 'Add another child to copy preferences from.');
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...siblings.map(s => `Copy from ${s.name}`)],
          cancelButtonIndex: 0,
          title: 'Copy Preferences From',
        },
        async (buttonIndex) => {
          if (buttonIndex > 0 && selectedChildId) {
            const sibling = siblings[buttonIndex - 1];
            try {
              await dispatch(copyChildPreferences({
                sourceChildId: sibling.id,
                targetChildId: selectedChildId,
              })).unwrap();
              Alert.alert('Success', `Preferences copied from ${sibling.name}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to copy preferences');
            }
          }
        }
      );
    } else {
      // Android - show simple alert with buttons
      Alert.alert(
        'Copy Preferences From',
        'Select a child to copy preferences from:',
        [
          { text: 'Cancel', style: 'cancel' },
          ...siblings.map(s => ({
            text: s.name,
            onPress: async () => {
              if (selectedChildId) {
                try {
                  await dispatch(copyChildPreferences({
                    sourceChildId: s.id,
                    targetChildId: selectedChildId,
                  })).unwrap();
                  Alert.alert('Success', `Preferences copied from ${s.name}`);
                } catch (error) {
                  Alert.alert('Error', 'Failed to copy preferences');
                }
              }
            },
          })),
        ]
      );
    }
  };

  // Save preferences
  const handleSave = async () => {
    if (!selectedChildId) return;

    setIsSaving(true);
    try {
      // Convert dayTimeSlots to legacy format for backward compatibility
      const enabledDays = DAYS_OF_WEEK.filter(day =>
        dayTimeSlots[day]?.morning || dayTimeSlots[day]?.afternoon || dayTimeSlots[day]?.evening
      );

      const timePrefs = {
        morning: DAYS_OF_WEEK.some(day => dayTimeSlots[day]?.morning),
        afternoon: DAYS_OF_WEEK.some(day => dayTimeSlots[day]?.afternoon),
        evening: DAYS_OF_WEEK.some(day => dayTimeSlots[day]?.evening),
      };

      await dispatch(updateChildPreferences({
        childId: selectedChildId,
        updates: {
          preferredActivityTypes: activitiesData.preferredActivityTypes,
          environmentFilter,
          distanceRadiusKm,
          priceRangeMin,
          priceRangeMax,
          daysOfWeek: enabledDays,
          timePreferences: timePrefs,
          dayTimeSlots,
        },
      })).unwrap();

      setHasChanges(false);
      Alert.alert('Success', 'Preferences saved successfully');
    } catch (error) {
      console.error('[ChildPreferences] Save error:', error);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  // Get section summaries
  const getSectionSummary = (section: PreferencesSection): string => {
    switch (section) {
      case 'activities':
        const count = activitiesData.preferredActivityTypes.length;
        return count === 0 ? 'All activity types' : `${count} type${count !== 1 ? 's' : ''} selected`;
      case 'environment':
        return environmentFilter === 'all' ? 'Indoor & Outdoor' :
               environmentFilter === 'indoor' ? 'Indoor only' : 'Outdoor only';
      case 'distance':
        return `Within ${distanceRadiusKm} km`;
      case 'cost':
        return priceRangeMax >= 500 ? 'Any price' : `$${priceRangeMin} - $${priceRangeMax}`;
      case 'when':
        const enabledSlots = DAYS_OF_WEEK.reduce((total, day) => {
          const slots = dayTimeSlots[day];
          return total + (slots?.morning ? 1 : 0) + (slots?.afternoon ? 1 : 0) + (slots?.evening ? 1 : 0);
        }, 0);
        return enabledSlots === 21 ? 'Any time' : `${enabledSlots} time slots`;
      default:
        return '';
    }
  };

  // Calculate child age
  const calculateAge = (dateOfBirth: string): number => {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  if (children.length === 0) {
    return (
      <ScreenBackground style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <TopTabNavigation />
          <View style={styles.emptyState}>
            <Icon name="account-child-outline" size={64} color={ModernColors.textSecondary} />
            <Text style={styles.emptyTitle}>No Children Added</Text>
            <Text style={styles.emptyText}>
              Add a child in the Friends & Family tab to set up preferences.
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <TopTabNavigation />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Child Preferences</Text>
          <Text style={styles.headerSubtitle}>
            Customize activity filters for each child
          </Text>
        </View>

        {/* Global Toggle */}
        <View style={styles.globalToggleContainer}>
          <View style={styles.globalToggleContent}>
            <Icon name="filter-remove-outline" size={24} color={ModernColors.primary} />
            <View style={styles.globalToggleText}>
              <Text style={styles.globalToggleLabel}>Hide Closed/Full Activities</Text>
              <Text style={styles.globalToggleDescription}>
                Only show activities open for registration
              </Text>
            </View>
          </View>
          <Switch
            value={hideClosedOrFull}
            onValueChange={handleHideClosedOrFullChange}
            trackColor={{ false: '#E5E7EB', true: ModernColors.primary + '80' }}
            thumbColor={hideClosedOrFull ? ModernColors.primary : '#FFFFFF'}
          />
          {!isPremium && (
            <View style={styles.premiumBadge}>
              <Icon name="crown" size={12} color="#F59E0B" />
            </View>
          )}
        </View>

        {/* Child Selector */}
        <View style={styles.childSelectorContainer}>
          <View style={styles.childSelectorHeader}>
            <Text style={styles.childSelectorLabel}>Editing preferences for:</Text>
            {siblings.length > 0 && (
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyPreferences}
                activeOpacity={0.7}
              >
                <Icon name="content-copy" size={16} color={ModernColors.primary} />
                <Text style={styles.copyButtonText}>Copy from...</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.childChipsScroll}
            contentContainerStyle={styles.childChipsContent}
          >
            {children.map((child) => {
              const isSelected = child.id === selectedChildId;
              const age = child.dateOfBirth ? calculateAge(child.dateOfBirth) : null;
              const childColor = getChildColor(child.colorId);
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childChip,
                    isSelected && [styles.childChipSelected, { borderColor: childColor.hex, backgroundColor: childColor.hex + '15' }],
                  ]}
                  onPress={() => {
                    if (!isSelected) {
                      if (hasChanges) {
                        Alert.alert(
                          'Unsaved Changes',
                          'You have unsaved changes. Save them before switching?',
                          [
                            { text: 'Discard', style: 'destructive', onPress: () => setSelectedChildId(child.id) },
                            { text: 'Save', onPress: async () => {
                              await handleSave();
                              setSelectedChildId(child.id);
                            }},
                          ]
                        );
                      } else {
                        setSelectedChildId(child.id);
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <ChildAvatar
                    child={child}
                    size={40}
                    showBorder={isSelected}
                    borderWidth={2}
                  />
                  <View style={styles.childChipInfo}>
                    <Text style={[
                      styles.childChipName,
                      isSelected && { color: getChildColor(child.colorId).hex },
                    ]}>
                      {child.name}
                    </Text>
                    {age !== null && (
                      <Text style={[
                        styles.childChipAge,
                        isSelected && { color: getChildColor(child.colorId).hex },
                      ]}>
                        {age} years
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <Icon name="check-circle" size={20} color={getChildColor(child.colorId).hex} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Preference Sections */}
        {selectedChild && (
          <View style={styles.sectionsContainer}>
            {SECTIONS.map((section) => (
              <View key={section.key} style={styles.sectionContainer}>
                {/* Section Header */}
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <View style={styles.sectionIconContainer}>
                      <Icon name={section.icon} size={22} color={ModernColors.primary} />
                    </View>
                    <View style={styles.sectionTitleContainer}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionSummary}>
                        {getSectionSummary(section.key)}
                      </Text>
                    </View>
                  </View>
                  <Icon
                    name={expandedSection === section.key ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>

                {/* Section Content */}
                {expandedSection === section.key && (
                  <View style={styles.sectionContent}>
                    {section.key === 'activities' && (
                      <ChildActivitiesStep
                        childName={selectedChild.name}
                        data={activitiesData}
                        onChange={handleActivitiesChange}
                        siblings={siblings}
                      />
                    )}

                    {section.key === 'environment' && (
                      <View style={styles.environmentContainer}>
                        {ENVIRONMENT_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.environmentOption,
                              environmentFilter === option.value && styles.environmentOptionSelected,
                            ]}
                            onPress={() => handleEnvironmentChange(option.value)}
                            activeOpacity={0.7}
                          >
                            <Icon
                              name={option.icon}
                              size={24}
                              color={environmentFilter === option.value ? ModernColors.primary : ModernColors.textSecondary}
                            />
                            <Text style={[
                              styles.environmentLabel,
                              environmentFilter === option.value && styles.environmentLabelSelected,
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {section.key === 'distance' && (
                      <View style={styles.distanceContainer}>
                        <View style={styles.distanceChips}>
                          {DISTANCE_OPTIONS.map((distance) => (
                            <TouchableOpacity
                              key={distance}
                              style={[
                                styles.distanceChip,
                                distanceRadiusKm === distance && styles.distanceChipSelected,
                              ]}
                              onPress={() => handleDistanceChange(distance)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.distanceChipText,
                                distanceRadiusKm === distance && styles.distanceChipTextSelected,
                              ]}>
                                {distance} km
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={styles.distanceNote}>
                          Activities within {distanceRadiusKm} km of your location
                        </Text>
                      </View>
                    )}

                    {section.key === 'cost' && (
                      <View style={styles.costContainer}>
                        <View style={styles.costRange}>
                          <Text style={styles.costLabel}>Min: ${priceRangeMin}</Text>
                          <Text style={styles.costLabel}>Max: ${priceRangeMax >= 500 ? 'Any' : priceRangeMax}</Text>
                        </View>
                        <View style={styles.sliderContainer}>
                          <Text style={styles.sliderLabel}>Minimum</Text>
                          <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={490}
                            step={10}
                            value={priceRangeMin}
                            onValueChange={handlePriceMinChange}
                            minimumTrackTintColor={ModernColors.primary}
                            maximumTrackTintColor="#E5E7EB"
                            thumbTintColor={ModernColors.primary}
                          />
                        </View>
                        <View style={styles.sliderContainer}>
                          <Text style={styles.sliderLabel}>Maximum</Text>
                          <Slider
                            style={styles.slider}
                            minimumValue={10}
                            maximumValue={500}
                            step={10}
                            value={priceRangeMax}
                            onValueChange={handlePriceMaxChange}
                            minimumTrackTintColor={ModernColors.primary}
                            maximumTrackTintColor="#E5E7EB"
                            thumbTintColor={ModernColors.primary}
                          />
                        </View>
                      </View>
                    )}

                    {section.key === 'when' && (
                      <View style={styles.whenContainer}>
                        <Text style={styles.whenDescription}>
                          Select the days and times when {selectedChild.name} is available for activities
                        </Text>
                        <DayTimeGridSelector
                          selectedSlots={dayTimeSlots}
                          onChange={handleDayTimeSlotsChange}
                          accentColor={ModernColors.primary}
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <LinearGradient
              colors={isSaving ? ['#9CA3AF', '#6B7280'] : [ModernColors.primary, '#D53F8C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
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
      </SafeAreaView>
    </ScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 250,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 15,
    color: ModernColors.textSecondary,
    marginTop: 4,
  },
  globalToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  globalToggleContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  globalToggleText: {
    marginLeft: 12,
    flex: 1,
  },
  globalToggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  globalToggleDescription: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 4,
  },
  childSelectorContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  childSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  childSelectorLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: ModernColors.primary + '15',
    borderRadius: 16,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: ModernColors.primary,
    marginLeft: 4,
  },
  childChipsScroll: {
    marginHorizontal: -16,
  },
  childChipsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  childChipSelected: {
    borderColor: ModernColors.primary,
    backgroundColor: ModernColors.primary + '08',
  },
  childChipAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  childChipAvatarSelected: {
    backgroundColor: ModernColors.primary + '20',
  },
  childChipInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
  },
  childChipInitialSelected: {
    color: ModernColors.primary,
  },
  childChipInfo: {
    marginRight: 8,
  },
  childChipName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  childChipNameSelected: {
    color: ModernColors.primary,
  },
  childChipAge: {
    fontSize: 12,
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  childChipAgeSelected: {
    color: ModernColors.primary,
  },
  sectionsContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 100,
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
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ModernColors.primary + '15',
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
    color: ModernColors.textSecondary,
    marginTop: 2,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  environmentContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  environmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  environmentOptionSelected: {
    backgroundColor: ModernColors.primary + '10',
    borderColor: ModernColors.primary,
  },
  environmentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: ModernColors.textSecondary,
    marginTop: 8,
  },
  environmentLabelSelected: {
    color: ModernColors.primary,
  },
  distanceContainer: {
    gap: 12,
  },
  distanceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  distanceChipSelected: {
    backgroundColor: ModernColors.primary,
    borderColor: ModernColors.primary,
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  distanceChipTextSelected: {
    color: '#FFFFFF',
  },
  distanceNote: {
    fontSize: 13,
    color: ModernColors.textSecondary,
    textAlign: 'center',
  },
  costContainer: {
    gap: 16,
  },
  costRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sliderContainer: {
    gap: 4,
  },
  sliderLabel: {
    fontSize: 13,
    color: ModernColors.textSecondary,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  whenContainer: {
    gap: 12,
  },
  whenDescription: {
    fontSize: 14,
    color: ModernColors.textSecondary,
    marginBottom: 4,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ModernColors.primary,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: ModernColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});

export default ChildPreferencesScreen;
