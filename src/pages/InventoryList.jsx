import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  List, Printer, Search, Settings, SortAsc, SortDesc, Package, Edit, Eye
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { createPageUrl } from '@/utils';
import { useAppSettings } from '../components/shared/AppSettingsContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BackButton from '../components/shared/BackButton';
import { useData } from '../components/shared/DataManager';

const categoryOptions = [
  'all', 'costume', 'prop', 'scenery', 'equipment', 'fabric',
  'accessory', 'lighting', 'sound', 'furniture'
];

const statusOptions = [
  'all', 'available', 'in_use', 'rented', 'maintenance', 'retired'
];

const conditionOptions = [
  'all', 'excellent', 'good', 'fair', 'poor', 'needs_repair'
];

export default function InventoryList() {
  const navigate = useNavigate();
  const { appSettings } = useAppSettings();
  const { items, containers, isLoading, error } = useData();

  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());

  const [filters, setFilters] = useState({
    search: '',
    category: 'all',
    status: 'all',
    condition: 'all'
  });

  // Local state for search input to enable debouncing
  const [localSearchQuery, setLocalSearchQuery] = useState(filters.search || '');

  const [sortConfig, setSortConfig] = useState({
    field: 'name',
    direction: 'asc'
  });

  const [visibleColumns, setVisibleColumns] = useState({
    image: true,
    name: true,
    categories: true,
    status: true,
    condition: true,
    quantity: true,
    location: true,
    uid: true,
    actions: true
  });

  useEffect(() => {
    applyFiltersAndSort();
  }, [items, filters, sortConfig]);

  // Debounce the search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearchQuery !== filters.search) {
        setFilters(prev => ({ ...prev, search: localSearchQuery }));
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localSearchQuery, filters.search]);

  // Update local search when filters change
  useEffect(() => {
    setLocalSearchQuery(filters.search || '');
  }, [filters.search]);

  const applyFiltersAndSort = () => {
    // Start with ALL items
    let processedItems = [...(items || [])];
    
    console.log('Processing items:', processedItems.length);

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      processedItems = processedItems.filter(item =>
        (item.name?.toLowerCase().includes(searchLower)) ||
        (item.description?.toLowerCase().includes(searchLower)) ||
        (item.uid?.toLowerCase().includes(searchLower))
      );
    }

    if (filters.category !== 'all') {
      processedItems = processedItems.filter(item => {
        const itemCategories = item.categories && Array.isArray(item.categories) 
          ? item.categories 
          : (item.category ? [item.category] : []);
        return itemCategories.includes(filters.category);
      });
    }

    if (filters.status !== 'all') {
      processedItems = processedItems.filter(item => item.status === filters.status);
    }

    if (filters.condition !== 'all') {
      processedItems = processedItems.filter(item => item.condition === filters.condition);
    }

    processedItems.sort((a, b) => {
      const field = sortConfig.field;
      let aValue = a[field];
      let bValue = b[field];

      // Handle null/undefined values to prevent errors
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Special handling for categories array
      if (field === 'categories') {
        const aCats = Array.isArray(a.categories) ? a.categories : (a.category ? [a.category] : []);
        const bCats = Array.isArray(b.categories) ? b.categories : (b.category ? [b.category] : []);
        aValue = aCats.join(', ');
        bValue = bCats.join(', ');
      }

      const isNumeric = field === 'quantity';

      if (isNumeric) {
        // Numeric sort
        const numA = Number(aValue);
        const numB = Number(bValue);
        if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } else {
        // String sort
        const strA = String(aValue).toLowerCase();
        const strB = String(bValue).toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
    });

    console.log('Filtered items:', processedItems.length);
    setFilteredItems(processedItems);
  };
  
  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handlePrintSelected = () => {
    const itemsToPrint = filteredItems.filter(item => selectedItems.has(item.id));
    navigate(createPageUrl('PrintView'), { state: { items: itemsToPrint, containers } });
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const { InventoryItem } = await import('@/entities/InventoryItem');
      await InventoryItem.delete(itemId);
      // The shared item list refreshes itself after a change (see DataManager).
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <BackButton className="mb-4" />
          <div className="bg-error/10 border border-error/20 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-error mb-2">Unable to Load Data</h3>
            <p className="text-error/80 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
              <List className="w-8 h-8 text-primary" />
              Inventory List
            </h1>
            <p className="text-base lg:text-lg text-primary font-medium">
              Complete list of all {items.length} inventory items
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem checked={visibleColumns.image} onCheckedChange={() => toggleColumn('image')}>Image</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.name} onCheckedChange={() => toggleColumn('name')}>Name</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.categories} onCheckedChange={() => toggleColumn('categories')}>Categories</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.status} onCheckedChange={() => toggleColumn('status')}>Status</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.condition} onCheckedChange={() => toggleColumn('condition')}>Condition</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.quantity} onCheckedChange={() => toggleColumn('quantity')}>Quantity</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.location} onCheckedChange={() => toggleColumn('location')}>Location</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.uid} onCheckedChange={() => toggleColumn('uid')}>UID</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={visibleColumns.actions} onCheckedChange={() => toggleColumn('actions')}>Actions</DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handlePrintSelected} disabled={selectedItems.size === 0}>
              <Printer className="w-4 h-4 mr-2" />
              Print Selected ({selectedItems.size})
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-base-200/50 rounded-lg border border-base-300">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <Input
              placeholder="Search items..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="pl-10 bg-base-100"
            />
          </div>
          <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
            <SelectTrigger className="bg-base-100"><SelectValue /></SelectTrigger>
            <SelectContent>
              {categoryOptions.map(opt => <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger className="bg-base-100"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.condition} onValueChange={(value) => handleFilterChange('condition', value)}>
            <SelectTrigger className="bg-base-100"><SelectValue /></SelectTrigger>
            <SelectContent>
              {conditionOptions.map(opt => <SelectItem key={opt} value={opt} className="capitalize">{opt.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-base-content/70">
          Showing {filteredItems.length} of {items.length} items
        </div>

        {/* Table with full scrolling */}
        <div className="w-full overflow-auto bg-base-200/50 rounded-lg border border-base-300" style={{ maxHeight: '70vh' }}>
          <table className="w-full divide-y divide-base-300" style={{ minWidth: '1200px' }}>
            <thead className="bg-base-200 sticky top-0 z-10">
              <tr>
                <th scope="col" className="p-4 sticky left-0 bg-base-200 z-20">
                  <Checkbox
                    checked={
                      selectedItems.size > 0 && selectedItems.size === filteredItems.length
                        ? true
                        : selectedItems.size > 0
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                {visibleColumns.image && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider bg-base-200">Image</th>}
                {visibleColumns.name && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-2">Name {sortConfig.field === 'name' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.categories && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('categories')}>
                    <div className="flex items-center gap-2">Categories {sortConfig.field === 'categories' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.status && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">Status {sortConfig.field === 'status' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.condition && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('condition')}>
                    <div className="flex items-center gap-2">Condition {sortConfig.field === 'condition' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.quantity && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('quantity')}>
                    <div className="flex items-center gap-2">Qty {sortConfig.field === 'quantity' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.location && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('location')}>
                    <div className="flex items-center gap-2">Location {sortConfig.field === 'location' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.uid && (
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider cursor-pointer bg-base-200" onClick={() => handleSort('uid')}>
                    <div className="flex items-center gap-2">UID {sortConfig.field === 'uid' && (sortConfig.direction === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />)}</div>
                  </th>
                )}
                {visibleColumns.actions && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-base-content/80 uppercase tracking-wider bg-base-200">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {isLoading ? (
                Array(20).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="p-4">
                      <Skeleton className="h-12 w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="p-8 text-center text-base-content/60">
                    No items found matching your filters
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const primaryPhoto = item.photos?.find(p => p.is_primary) || item.photos?.[0];
                  const displayCategories = item.categories && item.categories.length > 0 ? item.categories : (item.category ? [item.category] : []);

                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-base-200 transition-colors cursor-pointer"
                      onClick={() => {
                        window.scrollTo(0, 0);
                        navigate(createPageUrl(`ItemDetails?id=${item.id}`), { state: { item } });
                      }}
                    >
                      <td className="p-4 sticky left-0 bg-inherit" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => handleSelectItem(item.id)} />
                      </td>
                      {visibleColumns.image && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {primaryPhoto ? (
                            <img src={primaryPhoto.url} alt={item.name} className="h-12 w-12 rounded-md object-cover" />
                          ) : (
                            <div className="h-12 w-12 rounded-md bg-base-300 flex items-center justify-center">
                              <Package className="h-6 w-6 text-base-content/30" />
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.name && <td className="px-6 py-4 whitespace-nowrap font-medium text-base-content">{item.name}</td>}
                      {visibleColumns.categories && (
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {displayCategories.map(cat => <Badge key={cat} variant="secondary" className="capitalize text-xs">{cat}</Badge>)}
                          </div>
                        </td>
                      )}
                      {visibleColumns.status && <td className="px-6 py-4 whitespace-nowrap"><Badge variant="outline" className="capitalize">{item.status}</Badge></td>}
                      {visibleColumns.condition && <td className="px-6 py-4 whitespace-nowrap"><Badge variant="outline" className="capitalize">{item.condition?.replace('_', ' ')}</Badge></td>}
                      {visibleColumns.quantity && <td className="px-6 py-4 whitespace-nowrap text-center">{item.quantity}</td>}
                      {visibleColumns.location && <td className="px-6 py-4 whitespace-nowrap">{item.location || 'N/A'}</td>}
                      {visibleColumns.uid && <td className="px-6 py-4 whitespace-nowrap"><code className="text-xs bg-base-300 p-1 rounded">{item.uid}</code></td>}
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('ItemDetails?id=' + item.id), { state: { item } })}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AddItem?edit=' + item.id), { state: { editItem: item } })}>
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}