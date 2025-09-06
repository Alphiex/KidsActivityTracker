export interface SharedChild {
  id: string;
  childId: string;
  sharedByUserId: string;
  sharedWithEmail: string;
  sharedWithUserId?: string; // Set when the recipient accepts
  permissions: {
    viewActivities: boolean;
    viewSchedule: boolean;
    viewDetails: boolean;
  };
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  sharedAt: Date;
  acceptedAt?: Date;
  expiresAt?: Date;
}

export interface SharingInvitation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toEmail: string;
  childId: string;
  childName: string;
  permissions: SharedChild['permissions'];
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  sentAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
}

export interface SharedActivity {
  activityId: string;
  childId: string;
  sharedByUserId: string;
  sharedWithEmails: string[];
}