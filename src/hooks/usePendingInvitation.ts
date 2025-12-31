import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { deepLinkService } from '../services/deepLinkService';
import { API_CONFIG } from '../config/api';

interface UsePendingInvitationOptions {
  isAuthenticated: boolean;
  authToken: string | null;
  /** Message variant for the success alert */
  variant: 'login' | 'register';
}

/**
 * Hook to process pending invitation tokens after authentication
 * Eliminates duplication between Login and Register screens
 */
export function usePendingInvitation({
  isAuthenticated,
  authToken,
  variant,
}: UsePendingInvitationOptions): void {
  // Track if we've already processed to prevent duplicate calls
  const hasProcessed = useRef(false);

  useEffect(() => {
    const processPendingInvitation = async () => {
      // Only process once when authenticated with valid token
      if (!isAuthenticated || !authToken || hasProcessed.current) {
        return;
      }

      const pendingToken = await deepLinkService.getPendingInvitation();
      if (!pendingToken) {
        return;
      }

      hasProcessed.current = true;

      if (__DEV__) {
        console.log(`[${variant}] Processing pending invitation`);
      }

      try {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/api/invitations/accept`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ token: pendingToken }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          const title = variant === 'register' ? 'Welcome!' : 'Invitation Accepted!';
          const message = variant === 'register'
            ? 'Your account has been created and the invitation has been accepted. You can now view shared activities.'
            : 'You can now view the shared activities.';

          Alert.alert(title, message, [{ text: 'OK' }]);
        } else if (__DEV__) {
          console.log(`[${variant}] Failed to auto-accept invitation:`, data.error);
        }
      } catch (error) {
        if (__DEV__) {
          console.error(`[${variant}] Error auto-accepting invitation:`, error);
        }
        // Don't show error to user - the invitation can still be accepted manually
      }
    };

    processPendingInvitation();
  }, [isAuthenticated, authToken, variant]);
}

export default usePendingInvitation;
