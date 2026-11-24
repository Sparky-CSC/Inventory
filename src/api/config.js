// Where the app keeps its data.
//
//  - "local"    : everything lives in this browser (IndexedDB). No accounts on
//                 any outside service are needed. This is the default.
//  - "supabase" : a shared database, sign-in and photo storage hosted by a free
//                 Supabase project. Turned on by setting the two values below
//                 (see README.md → "Shared mode").
//
// The values are read at build time from environment variables. On GitHub they
// come from repository *variables* (Settings → Secrets and variables → Actions
// → Variables); on your own computer they come from a `.env.local` file.

const env = import.meta.env || {};

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').trim();
// The project's public key: the "publishable" key (sb_publishable_…) or, on
// older projects, the "anon public" key. Either name works below.
export const SUPABASE_ANON_KEY = (
  env.VITE_SUPABASE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const BACKEND_MODE = SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'local';
export const IS_LOCAL_MODE = BACKEND_MODE === 'local';

// Name of the storage bucket used for photos and logos in shared mode.
export const STORAGE_BUCKET = 'uploads';

// Every data type the app stores (matches the files in ./schemas).
export const ENTITY_NAMES = [
  'ActivityLog',
  'AppSettings',
  'BorrowedItem',
  'Category',
  'Container',
  'Department',
  'ExpendableItem',
  'FavoriteItem',
  'InventoryAudit',
  'InventoryItem',
  'Invoice',
  'Location',
  'ReminderSchedule',
  'ReminderSettings',
  'RentalOrder',
  'Renter',
  'StockAlert',
  'Subcategory',
  'UserDashboard',
  'UserInvitation',
  'UserNotification',
  'UserRole',
];

// Fields the system manages itself on every record.
export const SYSTEM_FIELDS = ['id', 'created_date', 'updated_date', 'created_by'];

// Every permission a role can have. These match the features the app has.
export const ALL_PERMISSIONS = [
  'manage_users',
  'manage_settings',
  'create_items',
  'edit_items',
  'delete_items',
  'view_items',
  'manage_categories',
  'manage_locations',
  'manage_containers',
  'manage_borrowed_items',
  'print_labels',
  'manage_expendables',
  'manage_rentals',
  'delete_rentals',
];

// Built-in roles created the first time the app runs.

export const ADMIN_ROLE_ID = 'role_admin';
export const USER_ROLE_ID = 'role_user';

export const DEFAULT_ROLES = [
  {
    id: ADMIN_ROLE_ID,
    name: 'Admin',
    description: 'Full access to everything, including users, roles and settings.',
    permissions: ALL_PERMISSIONS,
    is_system_role: true,
    is_active: true,
    duration_days: 0,
  },
  {
    id: USER_ROLE_ID,
    name: 'User',
    description: 'Basic user role with standard permissions',
    permissions: ['view_items', 'create_items', 'edit_items', 'print_labels'],
    is_system_role: true,
    is_active: true,
    duration_days: 0,
  },
];
