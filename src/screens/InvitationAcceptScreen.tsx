import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppSelector } from '../store';
import { API_CONFIG } from '../config/api';
import { deepLinkService } from '../services/deepLinkService';
import { Colors } from '../theme';

interface InvitationPreview {
  id: string;
  sender: {
    name: string;
    email: string;
    children?: Array<{
      name: string;
      age: number;
      interests: string[];
    }>;
  };
  status: string;
  message?: string;
  expiresAt: string;
  createdAt: string;
}

const InvitationAcceptScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { token: routeToken } = (route.params as { token?: string }) || {};
  
  const { isAuthenticated, token: authToken } = useAppSelector((state) => state.auth);
  
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitationToken = routeToken;

  useEffect(() => {
    if (invitationToken) {
      loadInvitation();
    } else {
      setError('No invitation token provided');
      setLoading(false);
    }
  }, [invitationToken]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/invitations/preview/${invitationToken}`
      );
      const data = await response.json();

      if (data.success && data.invitation) {
        setInvitation(data.invitation);
        
        // Check if already expired or not pending
        if (data.invitation.status === 'expired') {
          setError('This invitation has expired');
        } else if (data.invitation.status !== 'pending') {
          setError(`This invitation has already been ${data.invitation.status}`);
        }
      } else {
        setError(data.error || 'Invitation not found');
      }
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Store the token and redirect to login
      await deepLinkService.storePendingInvitation(invitationToken!);
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to accept this invitation.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Sign In', 
            onPress: () => (navigation as any).navigate('Auth', { screen: 'Login' })
          },
        ]
      );
      return;
    }

    try {
      setAccepting(true);
      
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/invitations/accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token: invitationToken }),
        }
      );
      
      const data = await response.json();

      if (data.success) {
        Alert.alert(
          'Invitation Accepted!',
          `You can now view ${invitation?.sender.name}'s children's activities.`,
          [
            {
              text: 'View Shared Activities',
              onPress: () => (navigation as any).navigate('SharedActivities'),
            },
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!isAuthenticated) {
      navigation.goBack();
      return;
    }

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
              setDeclining(true);
              
              const response = await fetch(
                `${API_CONFIG.BASE_URL}/api/invitations/decline`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ token: invitationToken }),
                }
              );
              
              const data = await response.json();

              if (data.success) {
                Alert.alert('Invitation Declined', '', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Error', data.error || 'Failed to decline invitation');
              }
            } catch (err: any) {
              Alert.alert('Error', 'Failed to decline invitation');
            } finally {
              setDeclining(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getExpiryText = () => {
    if (!invitation) return '';
    const expiryDate = new Date(invitation.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return 'Expired';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading invitation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Icon name="close" size={24} color="#222" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Share Invitation</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Invitation Card */}
        <View style={styles.invitationCard}>
          {/* Sender Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Icon name="account" size={40} color="#FFF" />
            </View>
          </View>

          {/* Sender Info */}
          <Text style={styles.senderName}>{invitation?.sender.name}</Text>
          <Text style={styles.senderEmail}>{invitation?.sender.email}</Text>

          {/* Invitation Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>wants to share their children's activities with you</Text>
            
            {invitation?.message && (
              <View style={styles.personalMessage}>
                <Icon name="format-quote-open" size={20} color={Colors.primary} />
                <Text style={styles.personalMessageText}>{invitation.message}</Text>
              </View>
            )}
          </View>

          {/* Children Preview */}
          {invitation?.sender.children && invitation.sender.children.length > 0 && (
            <View style={styles.childrenSection}>
              <Text style={styles.sectionTitle}>Children</Text>
              {invitation.sender.children.map((child, index) => (
                <View key={index} style={styles.childCard}>
                  <View style={styles.childAvatar}>
                    <Icon name="account-child" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childAge}>{child.age} years old</Text>
                    {child.interests && child.interests.length > 0 && (
                      <Text style={styles.childInterests}>
                        Interests: {child.interests.slice(0, 3).join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* What You'll Get */}
          <View style={styles.benefitsSection}>
            <Text style={styles.sectionTitle}>By accepting, you'll be able to:</Text>
            <View style={styles.benefitItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={styles.benefitText}>View their children's activity schedules</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={styles.benefitText}>See upcoming activities and registrations</Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="check-circle" size={20} color={Colors.success} />
              <Text style={styles.benefitText}>Coordinate family activities together</Text>
            </View>
          </View>

          {/* Expiry Notice */}
          <View style={styles.expiryNotice}>
            <Icon name="clock-outline" size={16} color="#6B7280" />
            <Text style={styles.expiryText}>{getExpiryText()}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.acceptButton, accepting && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={accepting || declining}
          >
            {accepting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Icon name="check" size={20} color="#FFF" />
                <Text style={styles.acceptButtonText}>Accept Invitation</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.declineButton, declining && styles.buttonDisabled]}
            onPress={handleDecline}
            disabled={accepting || declining}
          >
            {declining ? (
              <ActivityIndicator color={Colors.error} />
            ) : (
              <Text style={styles.declineButtonText}>Decline</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Not Logged In Notice */}
        {!isAuthenticated && (
          <View style={styles.authNotice}>
            <Icon name="information-outline" size={20} color="#6B7280" />
            <Text style={styles.authNoticeText}>
              You'll need to sign in or create an account to accept this invitation
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222222',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222222',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  invitationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222222',
    textAlign: 'center',
  },
  senderEmail: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  messageContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  messageLabel: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  personalMessage: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    width: '100%',
  },
  personalMessageText: {
    fontSize: 15,
    color: '#374151',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 22,
  },
  childrenSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  childAge: {
    fontSize: 13,
    color: '#6B7280',
  },
  childInterests: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  benefitsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
    flex: 1,
  },
  expiryNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expiryText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  actionButtons: {
    marginTop: 24,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  declineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  declineButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  authNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  authNoticeText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
});

export default InvitationAcceptScreen;
