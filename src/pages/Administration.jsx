
import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/entities/User';
import { UserRole } from '@/entities/UserRole';
import { UserInvitation } from '@/entities/UserInvitation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useForm, Controller } from 'react-hook-form';
import {
  Users, UserPlus, Trash2, Edit, Save, PlusCircle, CheckCircle, XCircle, Clock, Send, MoreVertical, Copy, AlertTriangle, Merge
} from 'lucide-react';
import { useAppSettings } from '../components/shared/AppSettingsContext';
import { add } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogContent, // Ensure this is imported for AlertDialog component
} from "@/components/ui/alert-dialog";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BackButton from '../components/shared/BackButton';
import DataTools from '../components/admin/DataTools';
import { useUserData } from '../components/shared/UserDataContext';
import { isAdminUser } from '@/lib/permissions';
import { getAppUrl } from '@/utils';
import { IS_LOCAL_MODE, ALL_PERMISSIONS } from '@/api/config';
import { Mail, Link as LinkIcon, ShieldAlert } from 'lucide-react';

// Main Administration Component
export default function Administration() {
  const { appSettings } = useAppSettings();
  const { currentUser } = useUserData();
  const [activeTab, setActiveTab] = useState("users"); // State for active tab

  // Only administrators may manage users, roles and data.
  if (!isAdminUser(currentUser)) {
    return (
      <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <BackButton className="mb-4" />
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              This page is only available to administrators. Ask an administrator if you need something changed here.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // currentUser state and its useEffect are removed as they were only used by DepartmentManagement

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Administration
          </h1>
          <p className="text-base lg:text-lg text-primary font-medium">
            {appSettings.administrationSubtitle || 'Manage users, roles, and system permissions'}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto mb-6">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="system" className="whitespace-normal">Data &amp; Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="grid grid-cols-1 gap-8">
              <UserManagement />
              <InvitationManagement />
            </div>
          </TabsContent>

          <TabsContent value="roles">
            <RoleManagement />
          </TabsContent>

          <TabsContent value="system">
            <DataTools />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// User Management Component
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        User.list(),
        UserRole.list()
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = async (userId, roleId) => {
    try {
      await User.update(userId, { 
        role_id: roleId,
        role_assigned_at: new Date().toISOString()
      });
      loadData();
    } catch (error) {
      console.error("Error updating user role:", error);
      alert(error?.message || 'The role could not be changed.');
    }
  };

  const handleStatusChange = async (userId, status) => {
     try {
      await User.update(userId, {
        account_status: status,
        // Re-activating also restarts the clock on time-limited roles;
        // otherwise an expired account would expire again straight away.
        ...(status === 'active' ? { role_assigned_at: new Date().toISOString() } : {}),
      });
      loadData();
    } catch (error) {
      console.error("Error updating user status:", error);
      alert(error?.message || 'The account status could not be changed.');
    }
  };

  const getRoleName = (roleId) => {
    return roles.find(r => r.id === roleId)?.name || 'Unknown Role';
  };

  // "Set a new password" (for someone who has forgotten theirs)
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSavedFor, setPasswordSavedFor] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const openPasswordDialog = (user) => {
    setPasswordUser(user);
    setNewPassword('');
    setPasswordError('');
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError('Please choose a password with at least 6 characters.');
      return;
    }
    setIsSavingPassword(true);
    setPasswordError('');
    try {
      await User.setPassword(passwordUser.id, newPassword);
      setPasswordSavedFor(passwordUser.full_name || passwordUser.email);
      setPasswordUser(null);
      setTimeout(() => setPasswordSavedFor(''), 6000);
    } catch (error) {
      console.error("Error setting password:", error);
      setPasswordError(error?.message || 'The password could not be changed.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const statusColors = {
    active: 'bg-success/15 text-success-focus border-success/30 hover:bg-success/15',
    expired: 'bg-warning/20 text-warning-content border-warning/40 hover:bg-warning/20',
    disabled: 'bg-error/15 text-error-focus border-error/30 hover:bg-error/15',
  };

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
      <CardHeader>
        <CardTitle>User Accounts</CardTitle>
        <CardDescription>Manage user roles and account status.</CardDescription>
      </CardHeader>
      <CardContent>
        {passwordSavedFor && (
          <Alert className="mb-4 border-success/40 bg-success/10">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-base-content">
              The password for {passwordSavedFor} has been changed. Let them know the new one.
            </AlertDescription>
          </Alert>
        )}
        <Dialog open={!!passwordUser} onOpenChange={(open) => { if (!open) setPasswordUser(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set a new password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <p className="text-sm text-base-content/70">
                Choose a new password for <strong>{passwordUser?.full_name || passwordUser?.email}</strong> and pass it
                on to them. Their old password stops working straight away.
              </p>
              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="new_user_password">New password</Label>
                <Input
                  id="new_user_password"
                  type="text"
                  autoComplete="off"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-base-content/60 mt-1">At least 6 characters.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setPasswordUser(null)}>Cancel</Button>
                <Button type="submit" disabled={isSavingPassword} className="bg-primary hover:bg-primary-focus text-primary-content">
                  <Save className="w-4 h-4 mr-2" /> Save Password
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-base-300">
                    <td className="p-4"><Skeleton className="h-5 w-48 bg-base-300" /></td>
                    <td className="p-4"><Skeleton className="h-8 w-32 bg-base-300" /></td>
                    <td className="p-4"><Skeleton className="h-6 w-20 rounded-full bg-base-300" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-8 w-8 rounded-full bg-base-300 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-base-300 last:border-b-0">
                    <td className="p-4">
                      <div className="font-medium text-base-content">{user.full_name}</div>
                      <div className="text-sm text-base-content/70">{user.email}</div>
                    </td>
                    <td className="p-4">
                      <Select value={user.role_id} onValueChange={(roleId) => handleRoleChange(user.id, roleId)}>
                        <SelectTrigger className="w-48 bg-base-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.filter(r => r.is_active).map(role => (
                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                      <Badge className={`capitalize ${statusColors[user.account_status]}`}>{user.account_status}</Badge>
                    </td>
                    <td className="p-4 text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {user.account_status !== 'active' && <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')}>Activate Account</DropdownMenuItem>}
                          {user.account_status === 'active' && <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'disabled')}>Disable Account</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => openPasswordDialog(user)}>Set a New Password…</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Invitation Management Component
//
// An invitation lets one email address create an account. Nothing is emailed
// automatically: after creating the invitation, send the person the link
// (the "Email" button opens your own mail program with it filled in).
const inviteLink = (email) => `${getAppUrl('')}?invite=${encodeURIComponent(email)}`;

const inviteMailto = (invite, appName) => {
  const subject = `You're invited to ${appName}`;
  const body =
    `Hello,\n\nYou have been invited to ${appName}` +
    `${invite.role_name ? ` as ${invite.role_name}` : ''}.\n\n` +
    `Open this link and create your account using this email address (${invite.email}):\n` +
    `${inviteLink(invite.email)}\n\n` +
    `${invite.expires_at ? `The invitation expires on ${new Date(invite.expires_at).toLocaleDateString()}.\n\n` : ''}` +
    `Thank you!`;
  return `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

function InvitationManagement() {
  const { appSettings } = useAppSettings();
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteError, setInviteError] = useState('');
  const [createdInvite, setCreatedInvite] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm();
  
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invitationsData, rolesData] = await Promise.all([
        UserInvitation.list(),
        UserRole.list()
      ]);
      setInvitations(invitationsData);
      setRoles(rolesData.filter(r => r.is_active));
    } catch (error) {
      console.error("Error loading invitation data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const onInviteSubmit = async (data) => {
    setInviteError('');
    try {
      const me = await User.me();
      const email = data.email.trim().toLowerCase();
      const expires_at = add(new Date(), { days: parseInt(data.expires_in_days) });

      const existingUsers = await User.list();
      if (existingUsers.some(u => (u.email || '').toLowerCase() === email)) {
        setInviteError('Someone with this email already has an account.');
        return;
      }

      const invite = await UserInvitation.create({
        email,
        role_id: data.role_id,
        role_name: roles.find(r => r.id === data.role_id)?.name,
        invited_by: me.email,
        expires_at: expires_at.toISOString(),
      });
      setShowInviteDialog(false);
      reset({ email: '', role_id: '', expires_in_days: '7' });
      setCreatedInvite(invite);
      loadData();
    } catch (error) {
      console.error("Error sending invitation:", error);
      setInviteError(error?.message || 'The invitation could not be created.');
    }
  };

  const handleDeleteInvitation = async (invitationId) => {
    if (confirm("Are you sure you want to delete this invitation?")) {
      try {
        await UserInvitation.delete(invitationId);
        if (createdInvite?.id === invitationId) setCreatedInvite(null);
        loadData();
      } catch (error) {
        console.error("Error deleting invitation:", error);
      }
    }
  };

  const handleCopyLink = async (invite) => {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.email));
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(current => (current === invite.id ? null : current)), 2000);
    } catch (error) {
      window.prompt('Copy this invitation link:', inviteLink(invite.email));
    }
  };

  // A pending invitation whose date has passed can no longer be used.
  const effectiveStatus = (invite) =>
    invite.status === 'pending' && invite.expires_at && new Date(invite.expires_at) < new Date()
      ? 'expired'
      : (invite.status || 'pending');

  const statusInfo = {
    pending: { icon: Clock, color: 'text-warning-content' },
    accepted: { icon: CheckCircle, color: 'text-success' },
    expired: { icon: XCircle, color: 'text-error' },
  };

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle>User Invitations</CardTitle>
          <CardDescription>
            Invite new users to your workspace. Only invited email addresses can create an account.
            {IS_LOCAL_MODE && ' This copy keeps its data on this device, so invited people create their account on this same device.'}
          </CardDescription>
        </div>
        <Dialog open={showInviteDialog} onOpenChange={(open) => { setShowInviteDialog(open); if (!open) setInviteError(''); }}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send a New Invitation</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
              {inviteError && (
                <Alert variant="destructive">
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register('email', { required: 'Email is required' })} />
                {errors.email && <p className="text-sm text-error mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="role_id">Assign Role</Label>
                <Controller
                  name="role_id"
                  control={control}
                  rules={{ required: 'Role is required' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="role_id"><SelectValue placeholder="Select a role..." /></SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.role_id && <p className="text-sm text-error mt-1">{errors.role_id.message}</p>}
              </div>
              <div>
                <Label htmlFor="expires_in_days">Invitation Expires In</Label>
                <Controller
                  name="expires_in_days"
                  control={control}
                  defaultValue="7"
                  render={({ field }) => (
                     <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="expires_in_days"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Day</SelectItem>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => {setShowInviteDialog(false); setInviteError(''); reset();}}>Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary-focus text-primary-content">
                  <Send className="w-4 h-4 mr-2" /> Create Invitation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {createdInvite && (
          <Alert className="mb-4 border-success/40 bg-success/10">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-base-content space-y-3">
              <p>
                <strong>{createdInvite.email}</strong> can now create an account. Send them this link:
              </p>
              <code className="block rounded bg-base-100 p-2 text-xs break-all border border-base-300">
                {inviteLink(createdInvite.email)}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCopyLink(createdInvite)}>
                  <Copy className="w-4 h-4 mr-2" />
                  {copiedId === createdInvite.id ? 'Copied!' : 'Copy link'}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={inviteMailto(createdInvite, appSettings.appName)}>
                    <Mail className="w-4 h-4 mr-2" /> Email the invitation
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatedInvite(null)}>Done</Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <ul className="space-y-3">
          {isLoading ? (
            Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-base-300" />)
          ) : invitations.length === 0 ? (
            <li className="text-sm text-base-content/60 p-3">No invitations yet.</li>
          ) : (
            invitations.map(invite => {
              const status = effectiveStatus(invite);
              const StatusIcon = statusInfo[status]?.icon || Clock;
              const statusColor = statusInfo[status]?.color || 'text-base-content/70';
              return (
                <li key={invite.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-base-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`w-5 h-5 ${statusColor} flex-shrink-0`} />
                    <div>
                      <div className="font-medium text-base-content break-all">{invite.email}</div>
                      <div className="text-sm text-base-content/70">Role: {invite.role_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                    <div className="text-left sm:text-right">
                      <div className="text-sm capitalize text-base-content/80 flex items-center gap-1">
                        <StatusIcon className={`w-3 h-3 ${statusColor}`} /> {status}
                      </div>
                      {status === 'pending' && invite.expires_at && (
                        <div className="text-xs text-base-content/60">Expires: {new Date(invite.expires_at).toLocaleDateString()}</div>
                      )}
                    </div>
                    <div className="flex items-center">
                      {status === 'pending' && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleCopyLink(invite)} aria-label={`Copy invitation link for ${invite.email}`} title="Copy invitation link">
                            {copiedId === invite.id ? <CheckCircle className="w-4 h-4 text-success" /> : <LinkIcon className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Email the invitation">
                            <a href={inviteMailto(invite, appSettings.appName)} aria-label={`Email invitation to ${invite.email}`}>
                              <Mail className="w-4 h-4" />
                            </a>
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteInvitation(invite.id)} aria-label={`Delete invitation for ${invite.email}`}>
                        <Trash2 className="w-4 h-4 text-error" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// Role Management Component
function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRole, setEditingRole] = useState(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [isProcessingDuplicates, setIsProcessingDuplicates] = useState(false);
  const [showRemovalDialog, setShowRemovalDialog] = useState(false);
  const [rolesToRemove, setRolesToRemove] = useState([]);
  const [currentRole, setCurrentRole] = useState(null); // Added state
  const [selectedPermissions, setSelectedPermissions] = useState({}); // Added state
  
  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm();

  const permissionsList = ALL_PERMISSIONS;

  // Roles to be removed from system management
  const rolesToRemoveFromSystem = [
    'stage manager',
    'costume designer', 
    'props master',
    'lighting designer',
    'scenic carpenter',
    'makeup artist',
    'department head',
    'student/intern'
  ];

  const findDuplicateRoles = (rolesData) => {
    const roleGroups = {};
    
    // Group roles by normalized name
    rolesData.forEach(role => {
      const normalized = role.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (!roleGroups[normalized]) {
        roleGroups[normalized] = [];
      }
      roleGroups[normalized].push(role);
    });
    
    // Return groups with more than one role
    return Object.values(roleGroups).filter(group => group.length > 1);
  };

  const findRolesToRemove = (rolesData) => {
    return rolesData.filter(role => 
      rolesToRemoveFromSystem.some(removeName => 
        role.name.toLowerCase().trim() === removeName.toLowerCase()
      )
    );
  };

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      let rolesData = await UserRole.list();

      // Strip permissions left over from features the app no longer has
      // (voice channels, messages, front of house, box office and so on).
      const staleRoles = rolesData.filter(role =>
        (role.permissions || []).some(p => !ALL_PERMISSIONS.includes(p))
      );
      if (staleRoles.length > 0) {
        await Promise.all(staleRoles.map(role =>
          UserRole.update(role.id, {
            permissions: role.permissions.filter(p => ALL_PERMISSIONS.includes(p)),
          })
        ));
        rolesData = await UserRole.list();
      }

      setRoles(rolesData);
      
      // Check for specific roles to remove
      const foundRolesToRemove = findRolesToRemove(rolesData);
      if (foundRolesToRemove.length > 0) {
        setRolesToRemove(foundRolesToRemove);
        setShowRemovalDialog(true);
      } else {
        // Check for duplicates only if no roles need removal
        const duplicateGroups = findDuplicateRoles(rolesData);
        if (duplicateGroups.length > 0) {
          setDuplicates(duplicateGroups);
          setShowDuplicatesDialog(true);
        }
      }
    } catch (error) {
      console.error("Error loading roles:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRemoveSpecificRoles = async () => {
    try {
      // Get all users to check for role assignments
      const allUsers = await User.list();
      
      for (const roleToRemove of rolesToRemove) {
        // Find users assigned to this role
        const usersWithThisRole = allUsers.filter(user => user.role_id === roleToRemove.id);
        
        // If there are users with this role, we need to reassign them
        if (usersWithThisRole.length > 0) {
          // Find a suitable replacement role (first non-system role or create a basic user role)
          const remainingRoles = roles.filter(r => 
            !rolesToRemoveFromSystem.some(removeName => 
              r.name.toLowerCase().trim() === removeName.toLowerCase()
            )
          );
          
          let targetRole = remainingRoles.find(r => r.name.toLowerCase().includes('user'));
          
          // If no user role exists, create one
          if (!targetRole) {
            targetRole = await UserRole.create({
              name: 'User',
              description: 'Basic user role with standard permissions',
              permissions: ['view_items', 'create_items', 'edit_items'],
              is_system_role: true // Consider if this should be system or not
            });
            // Reload roles to include the newly created role
            await loadRoles();
          }
          
          // Reassign users to the target role
          for (const user of usersWithThisRole) {
            await User.update(user.id, { 
              role_id: targetRole.id,
              role_assigned_at: new Date().toISOString()
            });
          }
        }
        
        // Delete the role
        await UserRole.delete(roleToRemove.id);
      }
      
      setShowRemovalDialog(false);
      setRolesToRemove([]);
      loadRoles();
    } catch (error) {
      console.error("Error removing specific roles:", error);
    }
  };

  const handleMergeDuplicates = async () => {
    setIsProcessingDuplicates(true);
    try {
      for (const duplicateGroup of duplicates) {
        // Keep the first role (usually oldest) and merge permissions
        const [keepRole, ...duplicatesToRemove] = duplicateGroup;
        
        // Merge all permissions
        const allPermissions = new Set(keepRole.permissions || []);
        duplicatesToRemove.forEach(role => {
          (role.permissions || []).forEach(perm => allPermissions.add(perm));
        });
        
        // Update the kept role with merged permissions
        await UserRole.update(keepRole.id, {
          ...keepRole,
          permissions: Array.from(allPermissions),
          description: keepRole.description || `Merged role containing permissions from ${duplicateGroup.map(r => r.name).join(', ')}`
        });
        
        // Update any users assigned to the duplicate roles
        const allUsers = await User.list();
        for (const roleToDelete of duplicatesToRemove) {
          const usersWithThisRole = allUsers.filter(user => user.role_id === roleToDelete.id);
          for (const user of usersWithThisRole) {
            await User.update(user.id, { role_id: keepRole.id });
          }
        }
        
        // Delete duplicate roles
        for (const roleToDelete of duplicatesToRemove) {
          await UserRole.delete(roleToDelete.id);
        }
      }
      
      setShowDuplicatesDialog(false);
      setDuplicates([]);
      loadRoles();
    } catch (error) {
      console.error("Error merging duplicate roles:", error);
    } finally {
      setIsProcessingDuplicates(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // New useEffect to handle currentRole and populate selectedPermissions
  useEffect(() => {
    if (currentRole) {
      setSelectedPermissions((currentRole.permissions || []).reduce((acc, p) => ({ ...acc, [p]: true }), {}));
    } else {
      setSelectedPermissions({});
    }
  }, [currentRole]);

  const handleEditRole = (role) => {
    setEditingRole(role);
    setCurrentRole(role); // Set currentRole for the new useEffect
    reset({
      name: role.name,
      description: role.description,
      permissions: role.permissions || [], 
      duration_days: role.duration_days || 0
    });
    setShowRoleDialog(true);
  };
  
  const handleNewRole = () => {
    setEditingRole(null);
    setCurrentRole(null); // Clear currentRole for new role creation
    reset({ name: '', description: '', permissions: [], duration_days: 0 });
    setShowRoleDialog(true);
  };

  const handleCopyRole = (role) => {
    setEditingRole(null);
    // A copy is saved as a new role, but starts with the same permissions ticked.
    setCurrentRole({ permissions: role.permissions || [] });
    reset({
      name: `Copy of ${role.name}`,
      description: role.description,
      permissions: role.permissions || [],
      duration_days: role.duration_days || 0,
    });
    setShowRoleDialog(true);
  };
  
  const onRoleSubmit = async (data) => {
    try {
      const roleData = { ...data, duration_days: Number(data.duration_days) || 0 };
      if (editingRole) {
        await UserRole.update(editingRole.id, roleData);
      } else {
        await UserRole.create(roleData);
      }
      setShowRoleDialog(false);
      loadRoles();
    } catch (error) {
      console.error("Error saving role:", error);
    }
  };

  const handleDeleteRole = async (roleId) => {
    // This is handled by AlertDialog, no direct call
    try {
      await UserRole.delete(roleId);
      loadRoles();
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Define roles and their permissions. Click a role to edit it.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {duplicates.length > 0 && (
            <Button variant="outline" onClick={() => setShowDuplicatesDialog(true)}>
              <AlertTriangle className="w-4 h-4 mr-2 text-warning" />
              {duplicates.length} Duplicate{duplicates.length > 1 ? 's' : ''}
            </Button>
          )}
          {rolesToRemove.length > 0 && (
            <Button variant="outline" onClick={() => setShowRemovalDialog(true)}>
              <AlertTriangle className="w-4 h-4 mr-2 text-error" />
              {rolesToRemove.length} System Role{rolesToRemove.length > 1 ? 's' : ''} to Remove
            </Button>
          )}
          <Button onClick={handleNewRole}>
            <PlusCircle className="w-4 h-4 mr-2"/>New Role
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
             Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-base-300" />)
          ) : (
            roles.map(role => (
              <div 
                key={role.id} 
                className={`p-4 bg-base-100 rounded-lg flex justify-between items-start transition-all duration-200 ${
                  !role.is_system_role 
                    ? 'cursor-pointer hover:bg-base-200/80 hover:shadow-lg border-2 border-transparent hover:border-primary/20' 
                    : 'opacity-75'
                }`}
                onClick={() => {
                  if (!role.is_system_role) {
                    handleEditRole(role);
                  }
                }}
              >
                <div className="flex-grow">
                  <h4 className="font-bold text-base-content text-lg flex items-center gap-2">
                    {role.name}
                    {role.is_system_role && <Badge variant="secondary">System</Badge>}
                    {!role.is_system_role && <span className="text-xs text-base-content/50">(Click to edit)</span>}
                  </h4>
                  <p className="text-sm text-base-content/70 mt-1">{role.description}</p>
                  {role.duration_days > 0 && <p className="text-sm text-primary mt-1">Expires after {role.duration_days} days</p>}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {role.permissions?.map(p => <Badge key={p} variant="outline" className="text-xs">{p.replace(/_/g, ' ')}</Badge>)}
                  </div>
                </div>
                {!role.is_system_role && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleEditRole(role)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyRole(role)}>
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Copy as New</span>
                        </DropdownMenuItem>
                        <AlertDialog>
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-error focus:bg-error/10 focus:text-error">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deleting the "{role.name}" role cannot be undone. Users with this role will need to be reassigned.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteRole(role.id)} className="bg-error hover:bg-error-focus text-error-content">
                                Delete Role
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Duplicate Roles Detected</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Found {duplicates.length} group(s) of duplicate roles. This can cause confusion and should be resolved.
              </AlertDescription>
            </Alert>
            
            {duplicates.map((group, index) => (
              <div key={index} className="border rounded-lg p-3">
                <h4 className="font-semibold mb-2 text-sm">Duplicate Group {index + 1}:</h4>
                <div className="space-y-2">
                  {group.map(role => (
                    <div key={role.id} className="flex justify-between items-center bg-base-200 p-2 rounded text-sm">
                      <span className="font-medium">{role.name}</span>
                      <Badge variant="outline" className="text-xs">{role.permissions?.length || 0} permissions</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDuplicatesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMergeDuplicates} disabled={isProcessingDuplicates} className="bg-primary hover:bg-primary-focus text-primary-content">
              <Merge className="w-4 h-4 mr-2" />
              {isProcessingDuplicates ? 'Merging...' : 'Merge Duplicates'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Removal Dialog */}
      <Dialog open={showRemovalDialog} onOpenChange={setShowRemovalDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>System Roles Cleanup</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Found {rolesToRemove.length} system role{rolesToRemove.length > 1 ? 's' : ''} that should be removed from system management. These roles are better managed at the production level.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Roles to be removed:</h4>
              {rolesToRemove.map(role => (
                <div key={role.id} className="flex justify-between items-center bg-base-200 p-2 rounded">
                  <span className="font-medium">{role.name}</span>
                  <Badge variant="outline" className="text-xs">{role.permissions?.length || 0} permissions</Badge>
                </div>
              ))}
            </div>
            
            <Alert>
              <AlertDescription>
                Users assigned to these roles will be automatically reassigned to a basic "User" role.
              </AlertDescription>
            </Alert>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowRemovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRemoveSpecificRoles} className="bg-error hover:bg-error-focus text-error-content">
              <Trash2 className="w-4 h-4 mr-2" />
              Remove System Roles
            </Button>
          </div>
        </DialogContent>
      </Dialog>

       <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onRoleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="roleName">Role Name</Label>
                <Input id="roleName" {...register('name', { required: true })} />
              </div>
               <div>
                <Label htmlFor="duration_days">Access Duration (in days)</Label>
                <Input id="duration_days" type="number" {...register('duration_days')} placeholder="0 for unlimited"/>
                <p className="text-xs text-base-content/60 mt-1">Set to 0 for unlimited access duration.</p>
              </div>
            </div>
            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea id="roleDescription" {...register('description')} />
            </div>
            <div>
              <Label>Permissions</Label>
              <Controller
                name="permissions"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border border-base-300 rounded-lg bg-base-100 max-h-60 overflow-y-auto">
                    {permissionsList.map(permission => (
                      <label key={permission} className="flex items-center gap-2 p-2 hover:bg-base-200 rounded transition-colors">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary"
                          // Use selectedPermissions for checked state
                          checked={!!selectedPermissions[permission]}
                          onChange={(e) => {
                            const newPermissions = { ...selectedPermissions, [permission]: e.target.checked };
                            setSelectedPermissions(newPermissions);
                            // Update react-hook-form's field value based on the new selectedPermissions object
                            const updatedPermissionArray = Object.keys(newPermissions).filter(p => newPermissions[p]);
                            field.onChange(updatedPermissionArray);
                          }}
                        />
                        <span className="text-sm capitalize">{permission.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary-focus text-primary-content">
                <Save className="w-4 h-4 mr-2"/>Save Role
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
