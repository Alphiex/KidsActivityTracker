import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import childrenService from '../services/childrenService';

// Airbnb-style colors
const ModernColors = {
  primary: '#FF385C',
  secondary: '#00A699',
  text: '#222222',
  textLight: '#717171',
  background: '#FFFFFF',
  backgroundLight: '#F7F7F7',
  border: '#DDDDDD',
  borderLight: '#EBEBEB',
  success: '#008A05',
  warning: '#FFA500',
  error: '#C13515',
  info: '#428BCA',
};

interface SharedUser {
  id: string;
  email: string;
  name: string;
  sharedAt: string;
  permissionLevel: 'view' | 'full';
}

const ShareChildScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as { childId?: string; childName?: string } | undefined;
  const childId = params?.childId ?? '';
  const childName = params?.childName ?? 'Child';

  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);

  // Validate required params
  useEffect(() => {
    if (!childId) {
      console.warn('ShareChildScreen: Missing required childId param');
      navigation.goBack();
    }
  }, [childId, navigation]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<'view' | 'full'>('view');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadSharedUsers();
  }, [childId]);

  const loadSharedUsers = async () => {
    setLoading(true);
    try {
      const users = await childrenService.getSharedUsers(childId);
      setSharedUsers(users);
    } catch (error) {
      console.error('Error loading shared users:', error);
      // Show error state - no mock data
      setSharedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShareWithUser = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setSending(true);
    try {
      await childrenService.shareChildWithUser(childId, email, permissionLevel);
      Alert.alert(
        'Success',
        `Invitation sent to ${email}. They will receive an email with instructions to view ${childName}'s activities.`,
        [{ text: 'OK', onPress: () => setShowAddModal(false) }]
      );
      setEmail('');
      setPermissionLevel('view');
      await loadSharedUsers();
    } catch (error) {
      console.error('Error sharing child:', error);
      Alert.alert('Error', 'Failed to send invitation. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleRevokeAccess = (userId: string, userName: string) => {
    Alert.alert(
      'Revoke Access',
      `Are you sure you want to revoke ${userName}'s access to ${childName}'s activities?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await childrenService.revokeChildAccess(childId, userId);
              await loadSharedUsers();
            } catch (error) {
              console.error('Error revoking access:', error);
              Alert.alert('Error', 'Failed to revoke access. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderSharedUser = (user: SharedUser) => (
    <View key={user.id} style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.userIcon}>
          <Icon name="account" size={24} color={ModernColors.textLight} />
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.permissionBadge}>
            <Icon
              name={user.permissionLevel === 'full' ? 'eye-plus' : 'eye'}
              size={14}
              color={ModernColors.textLight}
            />
            <Text style={styles.permissionText}>
              {user.permissionLevel === 'full' ? 'Full Access' : 'View Only'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={styles.revokeButton}
        onPress={() => handleRevokeAccess(user.id, user.name)}
      >
        <Icon name="close" size={20} color={ModernColors.error} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share {childName}'s Activities</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ModernColors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Info Section */}
          <View style={styles.infoSection}>
            <Icon name="information-outline" size={20} color={ModernColors.info} />
            <Text style={styles.infoText}>
              Share {childName}'s activities with family and friends. They'll be able to view
              upcoming activities and milestones.
            </Text>
          </View>

          {/* Shared Users */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shared With</Text>
            {sharedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="account-group-outline" size={48} color={ModernColors.borderLight} />
                <Text style={styles.emptyTitle}>Not shared yet</Text>
                <Text style={styles.emptySubtitle}>
                  Share {childName}'s activities with family and friends
                </Text>
              </View>
            ) : (
              sharedUsers.map(renderSharedUser)
            )}
          </View>

          {/* Add Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.8}
          >
            <Icon name="plus" size={20} color={ModernColors.background} />
            <Text style={styles.addButtonText}>Share with Someone</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Add Share Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share with Family or Friend</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Icon name="close" size={24} color={ModernColors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email address"
                placeholderTextColor={ModernColors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Permission Level</Text>
              <View style={styles.permissionOptions}>
                <TouchableOpacity
                  style={[
                    styles.permissionOption,
                    permissionLevel === 'view' && styles.permissionOptionActive,
                  ]}
                  onPress={() => setPermissionLevel('view')}
                >
                  <Icon
                    name="eye"
                    size={20}
                    color={permissionLevel === 'view' ? ModernColors.primary : ModernColors.textLight}
                  />
                  <Text
                    style={[
                      styles.permissionOptionText,
                      permissionLevel === 'view' && styles.permissionOptionTextActive,
                    ]}
                  >
                    View Only
                  </Text>
                  <Text style={styles.permissionDescription}>Can view activities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.permissionOption,
                    permissionLevel === 'full' && styles.permissionOptionActive,
                  ]}
                  onPress={() => setPermissionLevel('full')}
                >
                  <Icon
                    name="eye-plus"
                    size={20}
                    color={permissionLevel === 'full' ? ModernColors.primary : ModernColors.textLight}
                  />
                  <Text
                    style={[
                      styles.permissionOptionText,
                      permissionLevel === 'full' && styles.permissionOptionTextActive,
                    ]}
                  >
                    Full Access
                  </Text>
                  <Text style={styles.permissionDescription}>Can view and manage activities</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                onPress={handleShareWithUser}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={ModernColors.background} />
                ) : (
                  <>
                    <Icon name="send" size={20} color={ModernColors.background} />
                    <Text style={styles.sendButtonText}>Send Invitation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
    marginLeft: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#E8F4FD',
    margin: 20,
    padding: 15,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    color: ModernColors.text,
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginTop: 5,
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: ModernColors.backgroundLight,
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ModernColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
  },
  userEmail: {
    fontSize: 14,
    color: ModernColors.textLight,
    marginTop: 2,
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  permissionText: {
    fontSize: 12,
    color: ModernColors.textLight,
    marginLeft: 4,
  },
  revokeButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: ModernColors.primary,
    marginHorizontal: 20,
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: ModernColors.background,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ModernColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ModernColors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: ModernColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: ModernColors.text,
    marginBottom: 20,
  },
  permissionOptions: {
    marginBottom: 20,
  },
  permissionOption: {
    borderWidth: 1,
    borderColor: ModernColors.border,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  permissionOptionActive: {
    borderColor: ModernColors.primary,
    backgroundColor: '#FFF5F7',
  },
  permissionOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: ModernColors.text,
    marginTop: 8,
  },
  permissionOptionTextActive: {
    color: ModernColors.primary,
  },
  permissionDescription: {
    fontSize: 13,
    color: ModernColors.textLight,
    marginTop: 4,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: ModernColors.primary,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: ModernColors.background,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ShareChildScreen;