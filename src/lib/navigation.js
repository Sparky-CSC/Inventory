// The main links in the sidebar, in their default order. Used by the sidebar
// itself and by Settings → "Customize Sidebar Order".

import {
  LayoutDashboard, Package, List, Home, Search as SearchIcon, Truck, ArrowRightLeft, Bell,
} from 'lucide-react';

export const MAIN_NAV_LINKS = [
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
  { name: 'Inventory', page: 'Inventory', icon: Package },
  { name: 'Inventory List', page: 'InventoryList', icon: List },
  { name: 'Manage Locations', page: 'ManageLocations', icon: Home },
  { name: 'Search', page: 'Search', icon: SearchIcon },
  { name: 'Rentals', page: 'RentalsDashboard', icon: Truck },
  { name: 'Borrowed Items', page: 'BorrowedItems', icon: ArrowRightLeft },
  { name: 'Reminders', page: 'RemindersManager', icon: Bell },
];

// Pages that can be chosen as the first page after signing in.
export const DEFAULT_PAGE_OPTIONS = [
  { value: 'Dashboard', label: 'Dashboard' },
  { value: 'Inventory', label: 'Inventory' },
  { value: 'InventoryList', label: 'Inventory List' },
  { value: 'Search', label: 'Search Inventory' },
  { value: 'RentalsDashboard', label: 'Rentals' },
  { value: 'BorrowedItems', label: 'Borrowed Items' },
];
