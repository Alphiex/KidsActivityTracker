import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  locationService,
  RADIUS_OPTIONS,
  RadiusOption,
  LocationPermissionStatus
} from '../../services/locationService';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { EnhancedAddress } from '../../types/preferences';
import childPreferencesService from '../../services/childPreferencesService';
import { useAppSelector, useAppDispatch } from '../../store';
import { selectAllChildren, selectSelectedChildIds, fetchChildren } from '../../store/slices/childrenSlice';
import { ChildAvatar } from '../../components/children';

type RouteParams = {
  DistancePreferences: {
    childId?: string;
  };
};

const DistancePreferencesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'DistancePreferences'>>();
  const { colors } = useTheme();
  const dispatch = useAppDispatch();

  // Get children from Redux
  const children = useAppSelector(selectAllChildren);
  const selectedChildIds = useAppSelector(selectSelectedChildIds);

  // Ensure children are loaded into Redux on mount
  useEffect(() => {
    dispatch(fetchChildren());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use route param childId, or first selected child, or first child
  const initialChildId = route.params?.childId || selectedChildIds[0] || children[0]?.id;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(initialChildId || null);

  const selectedChild = children.find(c => c.id === selectedChildId);

  // Preferences state
  const [distanceEnabled, setDistanceEnabled] = useState(true);
  const [selectedRadius, setSelectedRadius] = useState<RadiusOption>(25);
  const [locationSource, setLocationSource] = useState<'gps' | 'saved_address'>('saved_address');
  const [selectedAddress, setSelectedAddress] = useState<EnhancedAddress | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus>('unavailable');
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load child preferences when child changes
  useEffect(() => {
    if (selectedChildId) {
      loadChildPreferences();
    }
  }, [selectedChildId]);

  useEffect(() => {
    checkLocationStatus();
  }, []);

  const loadChildPreferences = async () => {
    if (!selectedChildId) return;

    setLoading(true);
    try {
      const prefs = await childPreferencesService.getChildPreferences(selectedChildId);
      if (prefs) {
        setSelectedRadius((prefs.distanceRadiusKm as RadiusOption) || 25);
        if (prefs.savedAddress) {
          setSelectedAddress(prefs.savedAddress);
          setLocationSource('saved_address');
        }
      }
    } catch (error) {
      console.error('[DistancePreferences] Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkLocationStatus = async () => {
    setCheckingLocation(true);
    try {
      const status = await locationService.checkPermission();
      setLocationStatus(status);
    } catch (error) {
      console.error('[DistancePreferences] Error checking location:', error);
    } finally {
      setCheckingLocation(false);
    }
  };

  const handleRequestPermission = async () => {
    setCheckingLocation(true);
    try {
      const status = await locationService.requestPermission();
      setLocationStatus(status);
      if (status === 'blocked') {
        locationService.showPermissionBlockedAlert();
      } else if (status === 'granted') {
        setLocationSource('gps');
      }
    } catch (error) {
      console.error('[DistancePreferences] Error requesting permission:', error);
    } finally {
      setCheckingLocation(false);
    }
  };

  const handleAddressSelect = async (address: EnhancedAddress | null) => {
    setSelectedAddress(address);
    if (address) {
      setLocationSource('saved_address');
    }
  };

  const handleSave = async () => {
    if (!selectedChildId) return;

    setSaving(true);
    try {
      await childPreferencesService.updateLocationPreferences(
        selectedChildId,
        'saved_address',
        selectedAddress || undefined,
        selectedRadius
      );
      navigation.goBack();
    } catch (error) {
      console.error('[DistancePreferences] Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  const canUseGPS = locationStatus === 'granted';
  const hasSavedAddress = !!selectedAddress;

  if (children.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Distance Settings
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Icon name="account-child" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Add a child first to set distance preferences
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Distance Settings
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.saveButton, { color: colors.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Child Selector */}
        {children.length > 1 && (
          <View style={styles.childSelector}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Select Child
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.childChips}>
                {children.map((child) => {
                  const isSelected = child.id === selectedChildId;
                  return (
                    <TouchableOpacity
                      key={child.id}
                      style={[
                        styles.childChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedChildId(child.id)}
                    >
                      <ChildAvatar child={child} size={28} />
                      <Text
                        style={[
                          styles.childChipText,
                          { color: isSelected ? '#fff' : colors.text },
                        ]}
                      >
                        {child.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Set the search radius for {selectedChild?.name || 'this child'}. Activities within this
              distance from their saved address will appear in search results.
            </Text>

            {/* Radius Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Search Radius
              </Text>
              <View style={styles.radiusContainer}>
                {RADIUS_OPTIONS.map((radius) => {
                  const isSelected = selectedRadius === radius;
                  return (
                    <TouchableOpacity
                      key={radius}
                      style={[
                        styles.radiusButton,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedRadius(radius)}
                    >
                      <Text
                        style={[
                          styles.radiusButtonText,
                          { color: isSelected ? '#fff' : colors.text },
                        ]}
                      >
                        {radius} km
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location/Address */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Home Address
              </Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                This address is used to calculate distances to activities
              </Text>

              <View style={[styles.addressContainer, { borderColor: colors.border }]}>
                <AddressAutocomplete
                  value={selectedAddress}
                  onAddressSelect={handleAddressSelect}
                  label="Address"
                  placeholder="Search for address..."
                  country={['ca', 'us']}
                  showFallbackOption={true}
                />
                {selectedAddress?.city && (
                  <View style={styles.addressDetailsRow}>
                    <Icon name="map-marker" size={16} color={colors.textSecondary} />
                    <Text style={[styles.addressDetailsText, { color: colors.textSecondary }]}>
                      {[selectedAddress.city, selectedAddress.state, selectedAddress.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  childSelector: {
    marginBottom: 24,
  },
  childChips: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 8,
  },
  childChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 12,
  },
  radiusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  radiusButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
  },
  radiusButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressContainer: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  addressDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  addressDetailsText: {
    fontSize: 13,
  },
});

export default DistancePreferencesScreen;
