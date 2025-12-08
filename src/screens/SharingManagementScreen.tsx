import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Switch,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { Child } from '../store/slices/childrenSlice';
import childrenService from '../services/childrenService';
import sharingService from '../services/sharingService';
import { SharingInvitation } from '../types/sharing';

const SharingManagementScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [children, setChildren] = useState<Child[]>([]);
  const [sentInvitations, setSentInvitations] = useState<SharingInvitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<SharingInvitation[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [permissions, setPermissions] = useState({
    viewActivities: true,
    viewSchedule: true,
    viewDetails: true,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedChildren, sent, received] = await Promise.all([
        childrenService.getChildren(),
        sharingService.getSentInvitations(),
        sharingService.getReceivedInvitations(),
      ]);

      setChildren(loadedChildren);
      setSentInvitations(sent);
      setReceivedInvitations(received);
    } catch (error) {
      console.error('Error loading sharing data:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const handleShareChild = async () => {
    if (!selectedChild || !shareEmail.trim()) {
      Alert.alert('Error', 'Please select a child and enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      await sharingService.shareChild(selectedChild, shareEmail.trim(), permissions);
      await loadData();
      resetShareModal();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share child');
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await sharingService.acceptInvitation(invitationId);
      Alert.alert('Success', 'Invitation accepted');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await sharingService.declineInvitation(invitationId);
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to decline invitation');
            }
          },
        },
      ]
    );
  };

  const handleRevokeShare = async (sharedChildId: string) => {
    Alert.alert(
      'Revoke Access',
      'Are you sure you want to revoke access? The recipient will no longer be able to view this child\'s activities.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await sharingService.revokeShare(sharedChildId);
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to revoke access');
            }
          },
        },
      ]
    );
  };

  const handleCancelInvitation = async (invitation: SharingInvitation) => {
    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel this invitation to ${invitation.toEmail}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              // For pending invitations, decline/remove them using the invitation ID
              await sharingService.declineInvitation(invitation.id);
              await loadData();
              Alert.alert('Success', 'Invitation cancelled');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel invitation');
            }
          },
        },
      ]
    );
  };

  const resetShareModal = () => {
    setShowShareModal(false);
    setSelectedChild(null);
    setShareEmail('');
    setPermissions({
      viewActivities: true,
      viewSchedule: true,
      viewDetails: true,
    });
  };

  const renderSentInvitation = ({ item }: { item: SharingInvitation }) => {
    const isExpired = new Date() > new Date(item.expiresAt);
    const statusColor = item.status === 'accepted' ? colors.success : 
                       item.status === 'declined' ? colors.error :
                       isExpired ? colors.textSecondary : colors.warning;

    return (
      <View style={[styles.invitationCard, { backgroundColor: colors.surface }]}>
        <View style={styles.invitationHeader}>
          <Text style={[styles.childName, { color: colors.text }]}>{item.childName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isExpired ? 'Expired' : item.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.emailText, { color: colors.textSecondary }]}>
          Shared with: {item.toEmail}
        </Text>
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          Sent: {new Date(item.sentAt).toLocaleDateString()}
        </Text>
        {item.status === 'pending' && !isExpired && (
          <TouchableOpacity
            style={[styles.revokeButton, { borderColor: colors.error }]}
            onPress={() => handleCancelInvitation(item)}
          >
            <Text style={[styles.revokeButtonText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderReceivedInvitation = ({ item }: { item: SharingInvitation }) => {
    return (
      <View style={[styles.invitationCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.fromText, { color: colors.textSecondary }]}>
          From: {item.fromUserName}
        </Text>
        <Text style={[styles.childName, { color: colors.text }]}>
          {item.childName}
        </Text>
        <View style={styles.permissionsContainer}>
          <Text style={[styles.permissionsTitle, { color: colors.textSecondary }]}>
            Permissions:
          </Text>
          {item.permissions.viewActivities && (
            <Text style={[styles.permissionItem, { color: colors.text }]}>• View activities</Text>
          )}
          {item.permissions.viewSchedule && (
            <Text style={[styles.permissionItem, { color: colors.text }]}>• View schedule</Text>
          )}
          {item.permissions.viewDetails && (
            <Text style={[styles.permissionItem, { color: colors.text }]}>• View details</Text>
          )}
        </View>
        <View style={styles.invitationActions}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: colors.error }]}
            onPress={() => handleDeclineInvitation(item.id)}
          >
            <Text style={[styles.declineButtonText, { color: colors.error }]}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={() => handleAcceptInvitation(item.id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderShareModal = () => (
    <Modal
      visible={showShareModal}
      animationType="slide"
      transparent={true}
      onRequestClose={resetShareModal}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Share Child Access</Text>
            <TouchableOpacity onPress={resetShareModal}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Child</Text>
            <View style={styles.childSelector}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childOption,
                    selectedChild?.id === child.id && styles.selectedChildOption,
                    { borderColor: selectedChild?.id === child.id ? colors.primary : colors.border }
                  ]}
                  onPress={() => setSelectedChild(child)}
                >
                  <Text style={[
                    styles.childOptionText,
                    { color: selectedChild?.id === child.id ? colors.primary : colors.text }
                  ]}>
                    {child.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recipient Email</Text>
            <TextInput
              style={[styles.emailInput, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
              placeholder="Enter email address"
              placeholderTextColor={colors.textSecondary}
              value={shareEmail}
              onChangeText={setShareEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Permissions</Text>
            <View style={styles.permissionsList}>
              <View style={styles.permissionRow}>
                <Text style={[styles.permissionLabel, { color: colors.text }]}>
                  View Activities
                </Text>
                <Switch
                  value={permissions.viewActivities}
                  onValueChange={(value) => setPermissions({ ...permissions, viewActivities: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              <View style={styles.permissionRow}>
                <Text style={[styles.permissionLabel, { color: colors.text }]}>
                  View Schedule
                </Text>
                <Switch
                  value={permissions.viewSchedule}
                  onValueChange={(value) => setPermissions({ ...permissions, viewSchedule: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              <View style={styles.permissionRow}>
                <Text style={[styles.permissionLabel, { color: colors.text }]}>
                  View Details
                </Text>
                <Switch
                  value={permissions.viewDetails}
                  onValueChange={(value) => setPermissions({ ...permissions, viewDetails: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={resetShareModal}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: colors.primary }]}
              onPress={handleShareChild}
            >
              <Text style={styles.shareButtonText}>Send Invitation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart || colors.primary, colors.gradientEnd || colors.primaryDark || colors.primary]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sharing & Permissions</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowShareModal(true)}
        >
          <Icon name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {receivedInvitations.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.text }]}>
              Pending Invitations
            </Text>
            <FlatList
              data={receivedInvitations}
              renderItem={renderReceivedInvitation}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>
            Shared Children
          </Text>
          {sentInvitations.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Icon name="share-variant" size={60} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No children shared yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Share your children's activities with family members
              </Text>
            </View>
          ) : (
            <FlatList
              data={sentInvitations}
              renderItem={renderSentInvitation}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {renderShareModal()}
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  invitationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  invitationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  childName: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
  },
  fromText: {
    fontSize: 14,
    marginBottom: 4,
  },
  permissionsContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  permissionsTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  permissionItem: {
    fontSize: 13,
    marginLeft: 8,
  },
  invitationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  declineButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  revokeButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  revokeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  childSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  childOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    margin: 5,
  },
  selectedChildOption: {
    borderWidth: 2,
  },
  childOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emailInput: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 20,
  },
  permissionsList: {
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionLabel: {
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SharingManagementScreen;