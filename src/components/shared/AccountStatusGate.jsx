import React, { useEffect } from 'react';
import { useUserData } from './UserDataContext';
import { User } from '@/entities/User';
import { Loader2, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

function BlockedScreen({ title, children }) {
  const { logout } = useAuth();
  return (
    <div className="flex h-screen w-full items-center justify-center bg-base-100 p-4">
      <div className="max-w-lg w-full space-y-4">
        <Alert variant="destructive">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{children}</AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button variant="outline" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountStatusGate({ children }) {
  const { currentUser, isLoadingUserData, reloadUserData } = useUserData();

  useEffect(() => {
    const checkStatus = () => {
      // Only check for expiration if the role has an explicit duration > 0
      if (!currentUser.role || !currentUser.role.duration_days || currentUser.role.duration_days <= 0) {
        return; // This is a permanent role, no expiration check needed.
      }

      const roleAssignedDate = new Date(currentUser.role_assigned_at);
      // Clone the date to avoid mutation before adding days
      const roleExpiresDate = new Date(roleAssignedDate.getTime());
      roleExpiresDate.setDate(roleExpiresDate.getDate() + currentUser.role.duration_days);

      const needsUpdate = currentUser.account_status === 'active' && new Date() > roleExpiresDate;

      if (needsUpdate) {
        User.update(currentUser.id, { account_status: 'expired' })
          .then(() => {
            console.log("User account status updated to expired.");
            // Reload user data to reflect the change
            reloadUserData();
          })
          .catch(err => console.error("Failed to update user account status:", err));
      }
    };

    if (!isLoadingUserData && currentUser && currentUser.role && currentUser.role_assigned_at) {
      checkStatus();
    }
  }, [currentUser, isLoadingUserData, reloadUserData]);

  if (isLoadingUserData && !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-base-100">
        <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-base-content/70">Loading your space...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <BlockedScreen title="Access Restricted">
        Your account could not be loaded. You may not be registered to use this application — please contact an
        administrator to request access, or sign out and try again.
      </BlockedScreen>
    );
  }

  if (currentUser.account_status === 'expired') {
    return (
      <BlockedScreen title="Account Expired">
        Your access to the application has expired. Please contact an administrator to renew your access.
      </BlockedScreen>
    );
  }

  if (currentUser.account_status === 'disabled') {
    return (
      <BlockedScreen title="Account Disabled">
        Your account has been disabled. Please contact an administrator for assistance.
      </BlockedScreen>
    );
  }

  return children;
}
