
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Grid, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { createPageUrl } from '@/utils';
import { useData } from '../components/shared/DataManager';

import ItemCard from '../components/inventory/ItemCard';
import FilterControls from '../components/inventory/FilterControls';
import BackButton from '../components/shared/BackButton';

export default function Inventory() {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, containers, isLoading, error } = useData();

  const [filteredItems, setFilteredItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid'); // Changed: setViewMode is now defined

  const ITEMS_PER_PAGE = 50;

  const initialFilters = {
    query: '',
    categories: [], // Changed from 'category: 'all'' to 'categories: []'
    status: 'all',
    condition: 'all',
    locations: [], // Changed from 'location: 'all'' to 'locations: []'
    container: 'all',
  };

  const [filters, setFilters] = useState(initialFilters);

  // Effect to synchronize filters from URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // Links elsewhere in the app use both "categories=" and "category=" (and the
    // same for locations), so accept either spelling.
    const categoriesFromUrl = [...params.getAll('categories'), ...params.getAll('category')];
    const locationsFromUrl = [...params.getAll('locations'), ...params.getAll('location')];
    setFilters({
      query: params.get('search') || params.get('query') || '',
      categories: categoriesFromUrl.length > 0 ? categoriesFromUrl : [], // Initialize with array
      status: params.get('status') || 'all',
      condition: params.get('condition') || 'all',
      locations: locationsFromUrl.length > 0 ? locationsFromUrl : [], // Initialize with array
      container: params.get('container') || 'all',
    });
  }, [location.search]);

  useEffect(() => {
    applyFilters();
  }, [filters, items, containers, currentPage]); // Added currentPage to dependencies to re-apply filters on page change

  const applyFilters = () => {
    let results = [...items];

    // Apply filters locally
    if (filters.query) {
      const lowerQuery = filters.query.toLowerCase();
      results = results.filter(item =>
        (item.name && item.name.toLowerCase().includes(lowerQuery)) ||
        (item.description && item.description.toLowerCase().includes(lowerQuery)) ||
        (item.uid && item.uid.toLowerCase().includes(lowerQuery))
      );
    }

    // Apply category filters (supports multiple)
    if (filters.categories && filters.categories.length > 0) {
      results = results.filter(item => {
        const itemCategories = item.categories || (item.category ? [item.category] : []); // Handle legacy single 'category' or new 'categories' array
        return filters.categories.some(filterCat => itemCategories.includes(filterCat)); // Check if any selected filter category matches item's categories
      });
    }

    if (filters.status !== 'all') {
      results = results.filter(item => item.status === filters.status);
    }

    if (filters.condition !== 'all') {
      results = results.filter(item => item.condition === filters.condition);
    }

    // Apply multiple location filters
    if (filters.locations && filters.locations.length > 0) {
      results = results.filter(item => {
        // Check if item's location matches any of the selected locations
        return filters.locations.includes(item.location);
      });
    }

    if (filters.container !== 'all') {
      // A container can be named in a link by its id, its name or its QR code.
      const wanted = String(filters.container);
      const match = containers.find(c => c.id === wanted || c.name === wanted || c.qr_code === wanted);
      const containerId = match ? match.id : wanted;
      results = results.filter(item => item.container_id === containerId);
    }

    // Paginate results
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = results.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    setFilteredItems(paginatedItems);
    setTotalItems(results.length);
  };

  const handleFilterChange = (newFilters) => {
    setCurrentPage(1);
    
    // Update URL parameters by navigating
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      // Special handling for 'categories' and 'locations' arrays
      if ((key === 'categories' || key === 'locations') && Array.isArray(value) && value.length > 0) {
        value.forEach(item => params.append(key, item));
      } else if (value && value !== 'all' && key !== 'categories' && key !== 'locations') { // For other filters, append if value exists and is not 'all'
        params.set(key, value);
      }
    });
    
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const handlePageChange = (page) => {
    // Scroll to top when changing pages
    window.scrollTo(0, 0);
    setCurrentPage(page);
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const { InventoryItem } = await import('@/entities/InventoryItem');
      await InventoryItem.delete(itemId);
      // The shared item list refreshes itself after a change (see DataManager).
    } catch (error) {
      console.error("Error deleting item:", error);
      // Optionally show a toast notification for error
    }
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Get container name for display
  const getContainerName = (containerId) => {
    const container = containers.find(
      c => c.id === containerId || c.name === containerId || c.qr_code === containerId
    );
    return container ? container.name : null;
  };

  const selectedContainer = filters.container !== 'all' ? getContainerName(filters.container) : null;
  
  const selectedLocationDisplay = filters.locations && filters.locations.length > 0
    ? (filters.locations.length === 1
        ? filters.locations[0]
        : `Multiple Locations (${filters.locations.length})`)
    : null;

  if (error) {
    return (
      <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <BackButton className="mb-4" />
          <Card className="bg-base-200/50 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold text-base-content mb-2">Unable to Load Inventory</h3>
              <p className="text-base-content/70 mb-4">
                {error}
              </p>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <BackButton className="mb-4" />
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2">
                {selectedContainer 
                  ? `Container: ${selectedContainer}` 
                  : selectedLocationDisplay
                  ? `Location: ${selectedLocationDisplay}`
                  : 'Inventory'}
              </h1>
              <p className="text-base lg:text-lg text-primary font-medium">
                {totalItems} items found
                {(selectedContainer || (filters.locations && filters.locations.length > 0)) && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      // Reset container and locations filters
                      handleFilterChange({ ...filters, container: 'all', locations: [] });
                    }}
                    className="ml-2 p-0 h-auto text-primary hover:text-primary-focus"
                  >
                    • Clear Filter
                  </Button>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              {/* Button to toggle view mode (grid/list) */}
              <Button
                variant="outline"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
              </Button>
              <Button onClick={() => navigate(createPageUrl('AddItem'))}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <FilterControls
            filters={filters}
            onFiltersChange={handleFilterChange}
            containers={containers}
          />

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(8).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 bg-base-200" />
              ))}
            </div>
          ) : filteredItems.length > 0 ? (
            <>
              <div className={`grid gap-6 ${
                viewMode === 'grid' 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                  : 'grid-cols-1'
              }`}>
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    viewMode={viewMode}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-base-content">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="bg-base-200/50 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <h3 className="text-lg font-semibold text-base-content mb-2">No items found</h3>
                <p className="text-base-content/70 mb-4">
                  {Object.values(filters).some(f => (Array.isArray(f) ? f.length > 0 : f && f !== 'all'))
                    ? 'Try adjusting your filters or search terms.'
                    : 'Start by adding your first inventory item.'}
                </p>
                <Button onClick={() => navigate(createPageUrl('AddItem'))}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
