// Who may do what. `user` is the object from useUserData() — it carries the
// person's role (with its list of permissions) once it has loaded.

/** Administrators: the first account, anyone given the Admin role, or any role with "manage users". */
export function isAdminUser(user) {
  if (!user) return false;
  if (user.is_admin || user.role === 'admin') return true;
  const permissions = user.role?.permissions;
  return Array.isArray(permissions) && permissions.includes('manage_users');
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const permissions = user.role?.permissions;
  return Array.isArray(permissions) && permissions.includes(permission);
}

export function canManageSettings(user) {
  return hasPermission(user, 'manage_settings');
}
