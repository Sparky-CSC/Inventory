
import { qrCodeDataUrl } from '@/lib/qr';
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { InventoryItem } from '@/entities/InventoryItem';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown, Search, Package, Trash2, MoreVertical, Settings, Eye, Printer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUserData } from '../shared/UserDataContext';

const statusMap = {
  available: { label: 'Available', class: 'bg-success/20 text-success border-success/30' },
  in_use: { label: 'In Use', class: 'bg-info/20 text-info-content border-info/30' },
  rented: { label: 'Rented', class: 'bg-secondary/20 text-secondary-content border-secondary/30' },
  maintenance: { label: 'Maintenance', class: 'bg-warning/20 text-warning-content border-warning/30' },
  retired: { label: 'Retired', class: 'bg-base-300 text-base-content/70 border-base-300' },
};

const conditionMap = {
  excellent: { label: 'Excellent', class: 'text-success' },
  good: { label: 'Good', class: 'text-info' },
  fair: { label: 'Fair', class: 'text-warning' },
  poor: { label: 'Poor', class: 'text-error' },
  needs_repair: { label: 'Needs Repair', class: 'text-error font-bold' },
};

// Define all available columns
const ALL_COLUMNS = [
  { key: 'id', label: 'ID', width: 'w-20', defaultVisible: true },
  { key: 'thumbnail', label: 'Image', width: 'w-20', defaultVisible: true },
  { key: 'name', label: 'Name', width: 'min-w-48', defaultVisible: true },
  { key: 'uid', label: 'UID', width: 'w-32', defaultVisible: true },
  { key: 'qr_code', label: 'QR Code', width: 'w-24', defaultVisible: false },
  { key: 'categories', label: 'Category', width: 'w-32', defaultVisible: true },
  { key: 'status', label: 'Status', width: 'w-28', defaultVisible: true },
  { key: 'condition', label: 'Condition', width: 'w-28', defaultVisible: true },
  { key: 'quantity', label: 'Qty', width: 'w-20', defaultVisible: true },
  { key: 'location', label: 'Location', width: 'w-32', defaultVisible: false },
  { key: 'container', label: 'Container', width: 'w-32', defaultVisible: false },
  { key: 'acquisition_date', label: 'Acquired', width: 'w-32', defaultVisible: false },
  { key: 'value', label: 'Value', width: 'w-24', defaultVisible: false },
];

// QR codes are drawn in the browser (see src/lib/qr.js).
const generateQRCodeUrl = (data) => qrCodeDataUrl(data);

export default function InventoryListTable({ items, containerMap, isLoading, onItemDeleted }) {
  const navigate = useNavigate();
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
  const [deletingItemId, setDeletingItemId] = useState(null);
  const { currentUser } = useUserData();
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaultVisible = {};
    ALL_COLUMNS.forEach(col => {
      defaultVisible[col.key] = col.defaultVisible;
    });
    return defaultVisible;
  });

  // Derived state for selected items is used directly in bulk actions, no separate memo needed here.

  // Check if user has permission to delete items
  const canDeleteItems = currentUser?.role?.permissions?.includes('delete_items') ||
                        currentUser?.role?.permissions?.includes('manage_items') ||
                        currentUser?.role?.name === 'Admin';

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  const resetColumns = () => {
    const defaultVisible = {};
    ALL_COLUMNS.forEach(col => {
      defaultVisible[col.key] = col.defaultVisible;
    });
    setVisibleColumns(defaultVisible);
  };

  const handleDeleteItem = async (item) => {
    if (!canDeleteItems) {
      alert('You do not have permission to delete items.');
      return;
    }

    // Additional safety checks
    if (item.pull_status?.is_pulled && !item.pull_status?.returned_date) {
      alert('Cannot delete item that is currently pulled for a production. Please return the item first.');
      return;
    }

    if (item.status === 'rented') {
      alert('Cannot delete item that is currently rented. Please complete the rental first.');
      return;
    }

    setDeletingItemId(item.id);
    try {
      await InventoryItem.delete(item.id);

      // Call the parent callback to refresh the list
      if (onItemDeleted) {
        onItemDeleted();
      }

      console.log(`Item "${item.name}" (ID: ${item.id}, UID: ${item.uid}) has been deleted successfully.`);
      setSelectedRowIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Please try again.');
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(sortedAndFilteredItems.map(item => item.id));
      setSelectedRowIds(allIds);
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleRowSelect = (rowId, checked) => {
    const newSelectedRowIds = new Set(selectedRowIds);
    if (checked) {
      newSelectedRowIds.add(rowId);
    } else {
      newSelectedRowIds.delete(rowId);
    }
    setSelectedRowIds(newSelectedRowIds);
  };


  const sortedAndFilteredItems = useMemo(() => {
    let sortableItems = [...items];

    // Filtering
    if (filterText) {
      const lowercasedFilter = filterText.toLowerCase();
      sortableItems = sortableItems.filter(item =>
        (item.name?.toLowerCase().includes(lowercasedFilter)) ||
        (item.description?.toLowerCase().includes(lowercasedFilter)) ||
        (item.uid?.toLowerCase().includes(lowercasedFilter)) ||
        (item.id?.toLowerCase().includes(lowercasedFilter)) ||
        (item.categories?.some(cat => cat.toLowerCase().includes(lowercasedFilter))) ||
        (item.category?.toLowerCase().includes(lowercasedFilter)) ||
        (item.location?.toLowerCase().includes(lowercasedFilter)) ||
        (item.status?.toLowerCase().includes(lowercasedFilter)) ||
        (item.condition?.toLowerCase().includes(lowercasedFilter))
      );
    }

    // Sorting
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle special cases
        if (sortConfig.key === 'categories') {
          aValue = (a.categories || [a.category]).join(', ');
          bValue = (b.categories || [b.category]).join(', ');
        } else if (sortConfig.key === 'container') {
          aValue = a.container_id ? containerMap.get(a.container_id) || 'Unknown' : '';
          bValue = b.container_id ? containerMap.get(b.container_id) || 'Unknown' : '';
        } else if (sortConfig.key === 'quantity') {
          // Handle variants quantity calculation
          aValue = a.variants?.length > 0
            ? a.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
            : (Number(a.quantity) || 0);
          bValue = b.variants?.length > 0
            ? b.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
            : (Number(b.quantity) || 0);
        } else if (sortConfig.key === 'value' || sortConfig.key === 'rental_rate') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        } else if (sortConfig.key === 'acquisition_date' || sortConfig.key === 'last_cleaned') {
          aValue = aValue ? new Date(aValue) : new Date(0);
          bValue = bValue ? new Date(bValue) : new Date(0);
        } else if (sortConfig.key === 'qr_code') {
          // Sort by presence of QR code
          aValue = a.qr_code ? 1 : 0;
          bValue = b.qr_code ? 1 : 0;
        } else if (sortConfig.key === 'thumbnail') {
          // Sort by presence of photos
          aValue = a.photos?.length > 0 ? 1 : 0;
          bValue = b.photos?.length > 0 ? 1 : 0;
        }

        // Default comparison
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [items, filterText, sortConfig, containerMap]);

  const getSortIcon = (columnName) => {
    if (sortConfig.key === columnName) {
      return sortConfig.direction === 'ascending' ? '↑' : '↓';
    }
    return '↕';
  };

  const SortableHeader = ({ children, sortKey, className = "" }) => (
    <TableHead
      className={`cursor-pointer hover:bg-base-200 transition-colors select-none ${className}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3 text-base-content/50" />
        <span className="text-xs">{getSortIcon(sortKey)}</span>
      </div>
    </TableHead>
  );

  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  if (isLoading) {
    return (
      <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-base-content">Loading Inventory...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(10).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-base-300" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
        <CardContent className="text-center py-12">
          <Package className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-base-content mb-2">No Items Found</h3>
          <p className="text-base-content/70">Your inventory is empty or no items match the current filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border-2 border-base-300">
      <CardHeader className="border-b border-base-300">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <CardTitle className="text-xl font-bold text-base-content">
            Full Inventory ({sortedAndFilteredItems.length} items)
          </CardTitle>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-grow lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/60" />
              <Input
                placeholder="Search items..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-10 bg-base-100 border-2 border-base-300 text-base-content placeholder:text-base-content/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Column Visibility Controls */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-base-100 border-2 border-base-300 text-base-content hover:bg-primary hover:text-primary-content hover:border-primary transition-all duration-200"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-base-100 border-2 border-base-300 shadow-xl" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-base-content">Show/Hide Columns</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetColumns}
                      className="text-base-content hover:bg-base-200 hover:text-base-content"
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {ALL_COLUMNS.map((col) => (
                      <div key={col.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`col-${col.key}`}
                          checked={visibleColumns[col.key]}
                          onCheckedChange={() => toggleColumn(col.key)}
                          className="border-2 border-base-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <label
                          htmlFor={`col-${col.key}`}
                          className="text-sm text-base-content cursor-pointer"
                        >
                          {col.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Bulk Actions */}
            {selectedRowIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const selectedItems = sortedAndFilteredItems.filter(item => selectedRowIds.has(item.id));
                    navigate(createPageUrl('PrintHangTags'), { state: { items: selectedItems } });
                  }}
                  className="bg-base-100 border-2 border-base-300 text-base-content hover:bg-secondary hover:text-secondary-content hover:border-secondary transition-all duration-200"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Tags ({selectedRowIds.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedRowIds(new Set())}
                  className="bg-base-100 border-2 border-base-300 text-base-content hover:bg-error hover:text-error-content hover:border-error transition-all duration-200"
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto border border-base-300 rounded-b-lg">
          <Table>
            <TableHeader className="bg-base-200">
              <TableRow className="border-b-2 border-base-300">
                <TableHead className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selectedRowIds.size > 0 && sortedAndFilteredItems.length > 0 && selectedRowIds.size === sortedAndFilteredItems.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                    className="border-2 border-base-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableHead>
                {/* Column Headers with High Contrast Styling */}
                {visibleColumns.id && (
                  <SortableHeader sortKey="id" className="w-20 text-base-content font-bold">
                    ID
                  </SortableHeader>
                )}
                {visibleColumns.thumbnail && (
                  <SortableHeader sortKey="thumbnail" className="w-20 text-base-content font-bold">
                    Image
                  </SortableHeader>
                )}
                {visibleColumns.name && (
                  <SortableHeader sortKey="name" className="min-w-48 text-base-content font-bold">
                    Name
                  </SortableHeader>
                )}
                {visibleColumns.uid && (
                  <SortableHeader sortKey="uid" className="w-32 text-base-content font-bold">
                    UID
                  </SortableHeader>
                )}
                {visibleColumns.qr_code && (
                  <SortableHeader sortKey="qr_code" className="w-24 text-base-content font-bold">
                    QR Code
                  </SortableHeader>
                )}
                {visibleColumns.categories && (
                  <SortableHeader sortKey="categories" className="w-32 text-base-content font-bold">
                    Category
                  </SortableHeader>
                )}
                {visibleColumns.status && (
                  <SortableHeader sortKey="status" className="w-28 text-base-content font-bold">
                    Status
                  </SortableHeader>
                )}
                {visibleColumns.condition && (
                  <SortableHeader sortKey="condition" className="w-28 text-base-content font-bold">
                    Condition
                  </SortableHeader>
                )}
                {visibleColumns.quantity && (
                  <SortableHeader sortKey="quantity" className="w-20 text-base-content font-bold">
                    Qty
                  </SortableHeader>
                )}
                {visibleColumns.location && (
                  <SortableHeader sortKey="location" className="w-32 text-base-content font-bold">
                    Location
                  </SortableHeader>
                )}
                {visibleColumns.container && (
                  <SortableHeader sortKey="container" className="w-32 text-base-content font-bold">
                    Container
                  </SortableHeader>
                )}
                {visibleColumns.acquisition_date && (
                  <SortableHeader sortKey="acquisition_date" className="w-32 text-base-content font-bold">
                    Acquired
                  </SortableHeader>
                )}
                {visibleColumns.value && (
                  <SortableHeader sortKey="value" className="w-24 text-base-content font-bold">
                    Value
                  </SortableHeader>
                )}
                <TableHead className="w-20 text-base-content font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="bg-base-100">
              {sortedAndFilteredItems.map((item) => {
                const totalQuantity = item.variants?.length > 0
                  ? item.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
                  : (Number(item.quantity) || 0);

                const categories = item.categories && item.categories.length > 0
                  ? item.categories
                  : (item.category ? [item.category] : []);

                const containerName = item.container_id ? containerMap.get(item.container_id) : null;

                const statusConfig = statusMap[item.status] || { label: 'Unknown', class: 'bg-base-300 text-base-content/70' };
                const conditionConfig = conditionMap[item.condition] || { label: 'Unknown', class: 'text-base-content/70' };

                const canDeleteThisItem = canDeleteItems &&
                  (!item.pull_status?.is_pulled || item.pull_status?.returned_date) &&
                  item.status !== 'rented';

                // Get the primary photo for thumbnail
                const primaryPhoto = item.photos?.find(p => p.is_primary) || item.photos?.[0];

                return (
                  <TableRow
                    key={item.id}
                    className={`border-b border-base-300 hover:bg-base-200/70 transition-colors ${
                      selectedRowIds.has(item.id) ? 'bg-primary/20 border-primary' :
                      (item.pull_status?.is_pulled && !item.pull_status?.returned_date ? 'bg-info/10 border-info/30' : '')
                    }`}
                  >
                    <TableCell className="px-4">
                      <Checkbox
                        checked={selectedRowIds.has(item.id)}
                        onCheckedChange={(checked) => handleRowSelect(item.id, checked)}
                        aria-label={`Select row ${item.id}`}
                        className="border-2 border-base-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    {visibleColumns.id && (
                      <TableCell className="font-mono text-xs text-base-content/80">
                        {item.id}
                      </TableCell>
                    )}
                    {visibleColumns.thumbnail && (
                      <TableCell className="p-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-base-200 flex items-center justify-center border border-base-300">
                          {primaryPhoto ? (
                            <img
                              src={primaryPhoto.url}
                              alt={primaryPhoto.caption || item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-base-content/30" />
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.name && (
                      <TableCell>
                        <Link
                          to={createPageUrl(`ItemDetails?id=${item.id}`)}
                          state={{ item }}
                          className="font-medium text-primary hover:text-primary-focus transition-colors"
                        >
                          {item.name}
                        </Link>
                        {item.description && (
                          <p className="text-sm text-base-content/60 mt-1 line-clamp-2">{item.description}</p>
                        )}

                        {/* Pull Status Information */}
                        {item.pull_status?.is_pulled && (
                            <div className="mt-2">
                                {item.pull_status.returned_date ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                                        Returned from {item.pull_status.production_name}
                                    </Badge>
                                ) : (
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                                        Pulled for {item.pull_status.production_name}
                                        {item.pull_status.character_role && ` (${item.pull_status.character_role})`}
                                    </Badge>
                                )}
                            </div>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.uid && (
                      <TableCell>
                        {item.uid ? (
                          <code className="text-xs bg-base-300 px-2 py-1 rounded font-mono text-base-content">
                            {item.uid}
                          </code>
                        ) : (
                          <span className="text-xs text-error">Missing UID</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.qr_code && (
                      <TableCell className="text-center">
                        {item.qr_code ? (
                          <div className="flex justify-center">
                            <img
                              src={generateQRCodeUrl(item.qr_code, 60)}
                              alt={`QR Code for ${item.name}`}
                              className="w-12 h-12 border border-base-300 rounded"
                              title={`QR Code for ${item.name} (UID: ${item.uid})`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-error">No QR Code</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.categories && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {categories.slice(0, 2).map(cat => (
                            <Badge key={cat} variant="secondary" className="text-xs capitalize">
                              {cat}
                            </Badge>
                          ))}
                          {categories.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{categories.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.status && (
                      <TableCell>
                        <Badge className={`text-xs ${statusConfig.class}`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.condition && (
                      <TableCell>
                        <span className={`text-sm font-medium ${conditionConfig.class}`}>
                          {conditionConfig.label}
                        </span>
                      </TableCell>
                    )}
                    {visibleColumns.quantity && (
                      <TableCell className="text-center font-medium">
                        {totalQuantity}
                      </TableCell>
                    )}
                    {visibleColumns.location && (
                      <TableCell className="text-sm">
                        {item.location || <span className="text-base-content/50">—</span>}
                      </TableCell>
                    )}
                    {visibleColumns.container && (
                      <TableCell className="text-sm">
                        {containerName || <span className="text-base-content/50">—</span>}
                      </TableCell>
                    )}
                    {visibleColumns.acquisition_date && (
                      <TableCell className="text-sm">
                        {item.acquisition_date ? format(new Date(item.acquisition_date), 'MMM d, yyyy') : <span className="text-base-content/50">—</span>}
                      </TableCell>
                    )}
                    {visibleColumns.value && (
                      <TableCell className="text-sm">
                        {item.value ? `$${Number(item.value).toFixed(2)}` : <span className="text-base-content/50">—</span>}
                      </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-base-content hover:bg-base-200 hover:text-base-content border border-transparent hover:border-base-300"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-base-100 border-2 border-base-300 shadow-xl"
                        >
                          <DropdownMenuItem
                            className="text-base-content hover:bg-primary hover:text-primary-content focus:bg-primary focus:text-primary-content cursor-pointer"
                            onClick={() => navigate(createPageUrl(`ItemDetails?id=${item.id}`), { state: { item } })}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-base-content hover:bg-primary hover:text-primary-content focus:bg-primary focus:text-primary-content cursor-pointer"
                            onClick={() => navigate(createPageUrl('PrintHangTags'), { state: { items: [item] } })}
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Print Tag
                          </DropdownMenuItem>
                          {canDeleteThisItem && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-error hover:bg-error hover:text-error-content focus:bg-error focus:text-error-content cursor-pointer"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Item
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-base-100 border-2 border-base-300">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-base-content">Confirm Deletion</AlertDialogTitle>
                                  <AlertDialogDescription className="text-base-content/80">
                                    Are you sure you want to delete "{item.name}"? This action cannot be undone.
                                    {item.uid && (
                                      <div className="mt-2 p-2 bg-base-200 rounded border">
                                        <strong>Item Details:</strong><br />
                                        UID: {item.uid}<br />
                                        ID: {item.id}
                                      </div>
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-base-200 border-2 border-base-300 text-base-content hover:bg-base-300">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteItem(item)}
                                    disabled={deletingItemId === item.id}
                                    className="bg-error hover:bg-error/80 text-error-content border-2 border-error"
                                  >
                                    {deletingItemId === item.id ? 'Deleting...' : 'Delete Item'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
