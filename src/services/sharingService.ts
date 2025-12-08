import AsyncStorage from '@react-native-async-storage/async-storage';
import { SharedChild, SharingInvitation } from '../types/sharing';
import { Child } from '../store/slices/childrenSlice';
import { Alert } from 'react-native';
import { store } from '../store';
import apiClient from './apiClient';

// Helper to get current user from Redux store
const getCurrentUser = () => {
  const state = store.getState();
  return state.auth?.user || null;
};

const STORAGE_KEYS = {
  SHARED_CHILDREN: '@shared_children',
  SHARING_INVITATIONS: '@sharing_invitations',
  RECEIVED_INVITATIONS: '@received_invitations',
};

class SharingService {
  private static instance: SharingService;
  private sharedChildren: SharedChild[] = [];
  private sentInvitations: SharingInvitation[] = [];
  private receivedInvitations: SharingInvitation[] = [];
  private initialized = false;

  private constructor() {
    this.initialize();
  }

  static getInstance(): SharingService {
    if (!SharingService.instance) {
      SharingService.instance = new SharingService();
    }
    return SharingService.instance;
  }

  private async initialize() {
    try {
      await this.loadData();
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing sharing service:', error);
    }
  }

  private async waitForInit() {
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async loadData() {
    try {
      const [sharedChildrenData, sentInvitationsData, receivedInvitationsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SHARED_CHILDREN),
        AsyncStorage.getItem(STORAGE_KEYS.SHARING_INVITATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.RECEIVED_INVITATIONS),
      ]);

      if (sharedChildrenData) {
        this.sharedChildren = JSON.parse(sharedChildrenData);
      }
      if (sentInvitationsData) {
        this.sentInvitations = JSON.parse(sentInvitationsData);
      }
      if (receivedInvitationsData) {
        this.receivedInvitations = JSON.parse(receivedInvitationsData);
      }
    } catch (error) {
      console.error('Error loading sharing data:', error);
    }
  }

  private async saveData() {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.SHARED_CHILDREN, JSON.stringify(this.sharedChildren)),
        AsyncStorage.setItem(STORAGE_KEYS.SHARING_INVITATIONS, JSON.stringify(this.sentInvitations)),
        AsyncStorage.setItem(STORAGE_KEYS.RECEIVED_INVITATIONS, JSON.stringify(this.receivedInvitations)),
      ]);
    } catch (error) {
      console.error('Error saving sharing data:', error);
    }
  }

  async shareChild(child: Child, email: string, permissions: SharedChild['permissions']): Promise<SharingInvitation> {
    await this.waitForInit();

    // Check if already shared with this email
    const existingShare = this.sharedChildren.find(
      sc => sc.childId === child.id && sc.sharedWithEmail === email
    );

    if (existingShare && existingShare.status === 'accepted') {
      throw new Error('Child already shared with this email');
    }

    // Get current user from auth context
    const user = getCurrentUser();
    const userId = user?.id || 'unknown';
    const userName = user?.name || user?.email || 'Unknown User';

    // Create invitation
    const invitation: SharingInvitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromUserId: userId,
      fromUserName: userName,
      toEmail: email,
      childId: child.id,
      childName: child.name,
      permissions,
      status: 'pending',
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    this.sentInvitations.push(invitation);

    // Create shared child record
    const sharedChild: SharedChild = {
      id: `sc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      childId: child.id,
      sharedByUserId: userId,
      sharedWithEmail: email,
      permissions,
      status: 'pending',
      sharedAt: new Date(),
      expiresAt: invitation.expiresAt,
    };

    this.sharedChildren.push(sharedChild);
    await this.saveData();

    // TODO: Send actual email invitation
    Alert.alert(
      'Invitation Sent',
      `An invitation to view ${child.name}'s activities has been sent to ${email}. They have 7 days to accept.`
    );

    return invitation;
  }

  async acceptInvitation(invitationId: string): Promise<void> {
    await this.waitForInit();

    const invitation = this.receivedInvitations.find(inv => inv.id === invitationId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer valid');
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      invitation.status = 'expired';
      await this.saveData();
      throw new Error('Invitation has expired');
    }

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();

    await this.saveData();
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await this.waitForInit();

    const invitation = this.receivedInvitations.find(inv => inv.id === invitationId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    invitation.status = 'declined';
    invitation.declinedAt = new Date();

    await this.saveData();
  }

  async revokeShare(sharedChildId: string): Promise<void> {
    await this.waitForInit();

    const sharedChild = this.sharedChildren.find(sc => sc.id === sharedChildId);
    if (!sharedChild) {
      throw new Error('Shared child not found');
    }

    sharedChild.status = 'revoked';
    await this.saveData();
  }

  async getSharedChildren(): Promise<SharedChild[]> {
    await this.waitForInit();
    return this.sharedChildren.filter(sc => sc.status === 'accepted');
  }

  async getPendingShares(): Promise<SharedChild[]> {
    await this.waitForInit();
    return this.sharedChildren.filter(sc => sc.status === 'pending');
  }

  async getSentInvitations(): Promise<SharingInvitation[]> {
    await this.waitForInit();
    return this.sentInvitations;
  }

  async getReceivedInvitations(): Promise<SharingInvitation[]> {
    await this.waitForInit();
    return this.receivedInvitations.filter(
      inv => inv.status === 'pending' && new Date() < new Date(inv.expiresAt)
    );
  }

  async getChildrenSharedWithMe(): Promise<{ child: Child; sharedBy: string; permissions: SharedChild['permissions'] }[]> {
    await this.waitForInit();

    try {
      // Call the backend API to get children shared with the current user
      const response = await apiClient.get<{
        success: boolean;
        sharedChildren: Array<{
          child: Child;
          sharedBy: string;
          permissions: SharedChild['permissions'];
        }>;
      }>('/api/sharing/shared-with-me');

      if (response.success && response.sharedChildren) {
        return response.sharedChildren;
      }
      return [];
    } catch (error) {
      console.error('Error fetching shared children:', error);
      // Return empty array on error - no mock data
      return [];
    }
  }

  async getSharedWithMe(): Promise<Array<{
    childId: string;
    childName: string;
    sharedByName?: string;
    sharedByEmail?: string;
    sharedAt?: Date;
    activities?: any[];
  }>> {
    await this.waitForInit();

    try {
      // Call the backend API to get sharing data
      const response = await apiClient.get<{
        success: boolean;
        data: Array<{
          childId: string;
          childName: string;
          sharedByName?: string;
          sharedByEmail?: string;
          sharedAt?: string;
          activities?: any[];
        }>;
      }>('/api/sharing/shared-with-me');

      if (response.success && response.data) {
        return response.data.map(item => ({
          ...item,
          sharedAt: item.sharedAt ? new Date(item.sharedAt) : undefined,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching shared with me data:', error);
      return [];
    }
  }
}

export default SharingService.getInstance();