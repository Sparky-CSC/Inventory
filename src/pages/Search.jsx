
import React, { useState, useEffect } from 'react';
import { InventoryItem } from '@/entities/InventoryItem';
import { Container } from '@/entities/Container';
import { Location } from '@/entities/Location';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Search as SearchIcon, Filter, Check, RotateCcw,
  Calendar, MapPin, Package, Eye, Clock,
  Shirt, Drama, Hammer, Lightbulb, Star, Frown, Printer, Armchair
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import ItemCard from '../components/inventory/ItemCard';
import { Skeleton } from '@/components/ui/skeleton';
import { createPageUrl } from '@/utils';
import { useAppSettings } from '../components/shared/AppSettingsContext';
import BackButton from '../components/shared/BackButton';
import { useUserData } from '../components/shared/UserDataContext';
import { useData } from '../components/shared/DataManager';

const categoryOptions = [
  { value: "costume", label: "Costume", icon: Shirt },
  { value: "prop", label: "Prop", icon: Drama },
  { value: "scenery", label: "Scenery", icon: Package },
  { value: "equipment", label: "Equipment", icon: Hammer },
  { value: "lighting", label: "Lighting", icon: Lightbulb },
  { value: "sound", label: "Sound", icon: Package },
  { value: "fabric", label: "Fabric", icon: Shirt },
  { value: "accessory", label: "Accessory", icon: Star },
  { value: "furniture", label: "Furniture", icon: Armchair }
];

const statusOptions = [
  { value: "available", label: "Available", icon: Eye },
  { value: "in_use", label: "In Use", icon: Clock },
  { value: "rented", label: "Rented", icon: Clock },
  { value: "maintenance", label: "Maintenance", icon: Package },
  { value: "retired", label: "Retired", icon: Package }
];

const conditionOptions = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "needs_repair", label: "Needs Repair" }
];

const timePeriodOptions = [
  "Ancient", "Medieval (500-1500)", "Renaissance (1400-1600)", "Baroque (1600-1750)",
  "Colonial (1600-1800)", "Georgian (1714-1830)", "Victorian (1837-1901)", "Edwardian (1901-1910)",
  "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s",
  "Contemporary", "Futuristic", "Fantasy", "Timeless"
];

const styleOptions = [
  "Classical", "Gothic", "Renaissance", "Baroque", "Rococo", "Neoclassical", "Romantic",
  "Art Nouveau", "Art Deco", "Modernist", "Minimalist", "Contemporary", "Avant-garde",
  "Folk", "Ethnic", "Military", "Religious", "Ceremonial", "Casual", "Formal",
  "Fantasy", "Steampunk", "Post-apocalyptic"
];

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const { borrowedItems: allBorrowed = [] } = useData();
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { appSettings } = useAppSettings();
  const { favoriteItems } = useUserData();

  // "Search?favorites=true" (from the dashboard) limits results to your favorites.
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Search filters
  const [filters, setFilters] = useState({
    query: '',
    categories: [],
    status: [],
    condition: [],
    timePeriods: [],
    styles: [],
    locations: [],
    containers: [],
    showProduction: '',
    size: '',
    material: '',
    color: '',
    hasPhotos: false,
    isRented: false,
    needsRepair: false,
    dateAcquiredFrom: '',
    dateAcquiredTo: ''
  });

  // Local state for search input to enable debouncing
  const [localSearchQuery, setLocalSearchQuery] = useState(filters.query || '');

  // Popover states
  const [openPopovers, setOpenPopovers] = useState({
    categories: false,
    status: false,
    condition: false,
    timePeriods: false,
    styles: false,
    locations: false,
    containers: false
  });

  const areFiltersActive = (currentFilters) => {
    return (
      currentFilters.query !== '' ||
      currentFilters.categories.length > 0 ||
      currentFilters.status.length > 0 ||
      currentFilters.condition.length > 0 ||
      currentFilters.timePeriods.length > 0 ||
      currentFilters.styles.length > 0 ||
      currentFilters.locations.length > 0 ||
      currentFilters.containers.length > 0 ||
      currentFilters.showProduction !== '' ||
      currentFilters.size !== '' ||
      currentFilters.material !== '' ||
      currentFilters.color !== '' ||
      currentFilters.hasPhotos ||
      currentFilters.isRented ||
      currentFilters.needsRepair ||
      currentFilters.dateAcquiredFrom !== '' ||
      currentFilters.dateAcquiredTo !== ''
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  // Links into this page can carry a search: "Search?query=…" is where a
  // scanned QR code or barcode lands, "Search?favorites=true" comes from the
  // dashboard's favorites card.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryFromUrl = params.get('query') || params.get('search') || '';
    if (queryFromUrl) {
      setLocalSearchQuery(queryFromUrl);
      setFilters(prev => ({ ...prev, query: queryFromUrl }));
    }
    setFavoritesOnly(params.get('favorites') === 'true');
  }, [location.search]);

  // Debounce the main search query - only search after 3+ characters or when empty
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only trigger search if query is empty (to clear) or has 3+ characters
      if (localSearchQuery === '' || localSearchQuery.length >= 3) {
        if (localSearchQuery !== filters.query) {
          setFilters(prev => ({ ...prev, query: localSearchQuery }));
        }
      }
    }, 500); // Increased to 500ms delay

    return () => clearTimeout(timeoutId);
  }, [localSearchQuery, filters.query]);

  // Update local search when filters change from URL or reset
  useEffect(() => {
    setLocalSearchQuery(filters.query || '');
  }, [filters.query]);

  useEffect(() => {
    const activeFilters = areFiltersActive(filters) || favoritesOnly;
    if (activeFilters && !hasSearched) {
      setHasSearched(true);
    }
    
    if (hasSearched || activeFilters) {
      performSearch();
    } else {
      setFilteredItems([]);
    }
  }, [filters, items, hasSearched, favoritesOnly, favoriteItems]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemsData, containersData, locationsData] = await Promise.all([
        InventoryItem.list('-created_date', 10000), // Load all items
        Container.list(),
        Location.list()
      ]);
      setItems(itemsData || []);
      setContainers(containersData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Error loading search data:', error);
    }
    setIsLoading(false);
  };

  const performSearch = () => {
    setIsSearching(true);

    let results = [...(items || [])];

    if (favoritesOnly) {
      const favoriteIds = new Set((favoriteItems || []).map(f => f.inventory_item_id));
      results = results.filter(item => favoriteIds.has(item.id));
    }

    // Enhanced text search - search through ALL relevant fields
    if (filters.query) {
      const query = filters.query.toLowerCase();
      results = results.filter(item => {
        // Search in basic fields
        const basicFields = [
          item.name,
          item.description,
          item.subcategory,
          item.material,
          item.color,
          item.show_production,
          item.notes,
          item.uid,
          item.qr_code,
          item.size,
          item.time_period,
          item.style,
          item.location,
          item.model_number,
          item.serial_number,
          item.dimensions
        ].filter(Boolean).join(' ').toLowerCase();

        // Search in categories array
        const categoriesText = item.categories && Array.isArray(item.categories) 
          ? item.categories.join(' ') 
          : (item.category || '');

        // Search in production history
        const productionHistory = item.production_history && Array.isArray(item.production_history)
          ? item.production_history.map(p => `${p.production_name || ''} ${p.role_character || ''} ${p.notes || ''}`).join(' ')
          : '';

        // Search in parts
        const partsText = item.parts && Array.isArray(item.parts)
          ? item.parts.map(p => `${p.name || ''} ${p.description || ''}`).join(' ')
          : '';

        // Search in variants
        const variantsText = item.variants && Array.isArray(item.variants)
          ? item.variants.map(v => `${v.size || ''} ${v.description || ''} ${v.location || ''}`).join(' ')
          : '';

        // Search in measurements (for costumes)
        const measurementsText = item.measurements && typeof item.measurements === 'object'
          ? Object.values(item.measurements).filter(Boolean).join(' ')
          : '';

        // Combine all searchable text
        const allText = [
          basicFields,
          categoriesText,
          productionHistory,
          partsText,
          variantsText,
          measurementsText
        ].join(' ').toLowerCase();

        return allText.includes(query);
      });
    }

    // Category filter
    if (filters.categories.length > 0) {
      results = results.filter(item => {
        const itemCategories = item.categories && Array.isArray(item.categories) ? item.categories : (item.category ? [item.category] : []);
        return itemCategories.some(cat => filters.categories.includes(cat));
      });
    }

    // Status filter
    if (filters.status.length > 0) {
      results = results.filter(item => filters.status.includes(item.status));
    }

    // Condition filter
    if (filters.condition.length > 0) {
      results = results.filter(item => filters.condition.includes(item.condition));
    }

    // Time period filter
    if (filters.timePeriods.length > 0) {
      results = results.filter(item => item.time_period && filters.timePeriods.includes(item.time_period));
    }

    // Style filter
    if (filters.styles.length > 0) {
      results = results.filter(item => filters.styles.includes(item.style));
    }

    // Location filter
    if (filters.locations.length > 0) {
      results = results.filter(item => {
        // Check direct location
        if (item.location && filters.locations.includes(item.location)) {
          return true;
        }
        // Check container location
        if (item.container_id) {
          const container = containers.find(c => c.id === item.container_id);
          return container && filters.locations.includes(container.location);
        }
        return false;
      });
    }

    // Container filter
    if (filters.containers.length > 0) {
      results = results.filter(item => filters.containers.includes(item.container_id));
    }
    
    // Show/Production filter - enhanced search
    if (filters.showProduction) {
      const show = filters.showProduction.toLowerCase();
      results = results.filter(item => {
        const showProductionMatch = item.show_production?.toLowerCase().includes(show);
        const productionHistoryMatch = item.production_history && Array.isArray(item.production_history) && 
         item.production_history.some(prod => 
           prod.production_name?.toLowerCase().includes(show) ||
           prod.role_character?.toLowerCase().includes(show)
         );
        return showProductionMatch || productionHistoryMatch;
      });
    }

    // Size filter - enhanced to search in variants too
    if (filters.size) {
      const size = filters.size.toLowerCase();
      results = results.filter(item => {
        const mainSizeMatch = item.size?.toLowerCase().includes(size);
        const variantSizeMatch = item.variants && Array.isArray(item.variants) &&
          item.variants.some(variant => variant.size?.toLowerCase().includes(size));
        return mainSizeMatch || variantSizeMatch;
      });
    }

    // Material filter
    if (filters.material) {
      const material = filters.material.toLowerCase();
      results = results.filter(item =>
        item.material?.toLowerCase().includes(material)
      );
    }

    // Color filter
    if (filters.color) {
      const color = filters.color.toLowerCase();
      results = results.filter(item =>
        item.color?.toLowerCase().includes(color)
      );
    }

    // Has photos filter
    if (filters.hasPhotos) {
      results = results.filter(item =>
        item.photos && Array.isArray(item.photos) && item.photos.length > 0
      );
    }

    // Is rented filter
    if (filters.isRented) {
      results = results.filter(item =>
        item.status === 'rented' || item.current_rental
      );
    }

    // Needs repair filter
    if (filters.needsRepair) {
      results = results.filter(item =>
        item.condition === 'needs_repair' || item.condition === 'poor'
      );
    }

    // Date range filter
    if (filters.dateAcquiredFrom) {
      results = results.filter(item =>
        item.acquisition_date && item.acquisition_date >= filters.dateAcquiredFrom
      );
    }

    if (filters.dateAcquiredTo) {
      results = results.filter(item =>
        item.acquisition_date && item.acquisition_date <= filters.dateAcquiredTo
      );
    }

    setFilteredItems(results);
    setIsSearching(false);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelectToggle = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const togglePopover = (popoverName, isOpen) => {
    setOpenPopovers(prev => ({ ...prev, [popoverName]: isOpen }));
  };

  const resetFilters = () => {
    setFilters({
      query: '',
      categories: [],
      status: [],
      condition: [],
      timePeriods: [],
      styles: [],
      locations: [],
      containers: [],
      showProduction: '',
      size: '',
      material: '',
      color: '',
      hasPhotos: false,
      isRented: false,
      needsRepair: false,
      dateAcquiredFrom: '',
      dateAcquiredTo: ''
    });
    setHasSearched(false);
    if (favoritesOnly) navigate(createPageUrl('Search'), { replace: true });
  };

  const getContainerName = (containerId) => {
    const container = containers.find(c => c.id === containerId);
    return container ? container.name : 'N/A';
  };

  // Plain render helpers (not components), so typing in a filter or ticking
  // an option does not rebuild the whole filter panel and lose your place.
  const renderMultiSelect = ({ field, options, label, icon: Icon }) => (
    <Popover
      open={openPopovers[field]}
      onOpenChange={(isOpen) => togglePopover(field, isOpen)}
    >
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="justify-start font-normal w-full"
        >
          <Icon className="mr-2 h-4 w-4" />
          {filters[field].length > 0 ? `${label} (${filters[field].length})` : `Select ${label.toLowerCase()}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const value = typeof option === 'string' ? option : option.value;
                const displayLabel = typeof option === 'string' ? option : option.label;
                const isSelected = filters[field].includes(value);

                return (
                  <CommandItem
                    key={value}
                    onSelect={() => handleMultiSelectToggle(field, value)}
                  >
                    <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'}`}>
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{displayLabel}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const renderFilterContent = () => (
    <CardContent className="space-y-6">
      {/* Text Search */}
      {/* Moved prominent search to a dedicated card above */}

      <Separator className="lg:hidden" /> {/* Hide for desktop filter card */}

      {/* Multi-select filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categories</Label>
          {renderMultiSelect({ field: 'categories', options: categoryOptions, label: 'Categories', icon: Package })}
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          {renderMultiSelect({ field: 'status', options: statusOptions, label: 'Status', icon: Eye })}
        </div>

        <div className="space-y-2">
          <Label>Condition</Label>
          {renderMultiSelect({ field: 'condition', options: conditionOptions, label: 'Condition', icon: Package })}
        </div>

        <div className="space-y-2">
          <Label>Time Periods</Label>
          {renderMultiSelect({ field: 'timePeriods', options: timePeriodOptions, label: 'Time Periods', icon: Calendar })}
        </div>

        <div className="space-y-2">
          <Label>Styles</Label>
          {renderMultiSelect({ field: 'styles', options: styleOptions, label: 'Styles', icon: Star })}
        </div>

        <div className="space-y-2">
          <Label>Locations</Label>
          {renderMultiSelect({ field: 'locations', options: locations.map(loc => ({ value: loc.name, label: loc.name })), label: 'Locations', icon: MapPin })}
        </div>

        <div className="space-y-2">
          <Label>Containers</Label>
          {renderMultiSelect({ field: 'containers', options: containers.map(cont => ({ value: cont.id, label: cont.name })), label: 'Containers', icon: Package })}
        </div>
      </div>

      <Separator />

      {/* Text filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Show/Production</Label>
          <Input
            placeholder="Production name"
            value={filters.showProduction}
            onChange={(e) => handleFilterChange('showProduction', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Size</Label>
          <Input
            placeholder="e.g., M, L, XL"
            value={filters.size}
            onChange={(e) => handleFilterChange('size', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Material</Label>
          <Input
            placeholder="e.g., silk, cotton"
            value={filters.material}
            onChange={(e) => handleFilterChange('material', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <Input
            placeholder="e.g., red, blue"
            value={filters.color}
            onChange={(e) => handleFilterChange('color', e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Date range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Acquired From</Label>
          <Input
            type="date"
            value={filters.dateAcquiredFrom}
            onChange={(e) => handleFilterChange('dateAcquiredFrom', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Acquired To</Label>
          <Input
            type="date"
            value={filters.dateAcquiredTo}
            onChange={(e) => handleFilterChange('dateAcquiredTo', e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Boolean filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={filters.hasPhotos}
            onChange={(e) => handleFilterChange('hasPhotos', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Has Photos</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={filters.isRented}
            onChange={(e) => handleFilterChange('isRented', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Currently Rented</span>
        </label>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={filters.needsRepair}
            onChange={(e) => handleFilterChange('needsRepair', e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Needs Repair</span>
        </label>
      </div>
    </CardContent>
  );

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
              <SearchIcon className="w-8 h-8 text-primary" />
              Advanced Search
            </h1>
            <p className="text-base lg:text-lg text-primary font-medium">
              {appSettings.searchSubtitle || 'Find exactly what you need with advanced search'}
            </p>
            {favoritesOnly && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Star className="w-4 h-4" /> Showing your favorites only
              </p>
            )}
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <Button
              onClick={() => navigate(createPageUrl('PrintHangTags'), { state: { items: filteredItems } })}
              variant="default"
              disabled={filteredItems.length === 0}
              className="flex-grow sm:flex-grow-0"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Tags ({filteredItems.length})
            </Button>
            {/* Mobile Filter Button */}
            <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="default" 
                  className="lg:hidden flex-grow sm:flex-grow-0"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Filter className="w-5 h-5 text-primary" />
                      Search Filters
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  {renderFilterContent()}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Prominent Search Bar */}
        <Card className="mb-8 bg-base-200/50 backdrop-blur-sm border-base-300 shadow-md">
          <CardContent className="p-6">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-base-content/40" />
              <Input
                placeholder="Type 3+ characters to search inventory..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="pl-14 pr-4 py-4 text-lg bg-base-100 border-2 border-base-300 focus:border-primary"
              />
              {localSearchQuery.length > 0 && localSearchQuery.length < 3 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-base-content/50">
                  {3 - localSearchQuery.length} more characters...
                </div>
              )}
            </div>
            {localSearchQuery && localSearchQuery.length >= 3 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-base-content/70">
                  {filteredItems.length} items found for "{localSearchQuery}"
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocalSearchQuery('')}
                >
                  Clear search
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Desktop Search Filters Card */}
        <Card className="hidden lg:block bg-base-200/50 backdrop-blur-sm border-base-300 shadow-md mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Search Filters
              </span>
              <Button
                size="sm"
                onClick={resetFilters}
                variant="outline"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All
              </Button>
            </CardTitle>
          </CardHeader>
          {renderFilterContent()}
        </Card>

        {/* Borrowed items that match (they are not part of our inventory) */}
        {(() => {
          const term = (filters.query || '').trim().toLowerCase();
          if (term.length < 3) return null;
          const matches = allBorrowed.filter((b) =>
            [b.name, b.tag_number, b.lender_name, b.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
          ).slice(0, 6);
          if (!matches.length) return null;
          return (
            <div className="mt-6 rounded-xl border border-warning/50 bg-warning/10 p-4">
              <p className="font-semibold text-sm mb-2">Borrowed items (not theatre property) matching “{filters.query}”</p>
              <div className="flex flex-wrap gap-2">
                {matches.map((b) => (
                  <Button key={b.id} size="sm" variant="outline" onClick={() => navigate(createPageUrl(`BorrowedItemDetails?id=${b.id}`))}>
                    <span className="font-mono mr-2">{b.tag_number || 'No tag'}</span>{b.name}
                    {b.status === 'returned' ? ' (returned)' : ''}
                  </Button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Results */}
        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(8).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-96 w-full rounded-2xl bg-base-300" />
              ))}
            </div>
          ) : !hasSearched ? (
             <div className="text-center py-20 bg-base-200/50 rounded-2xl border border-base-300 shadow-lg">
              <SearchIcon className="w-16 h-16 text-primary/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-base-content">Start Your Search</h3>
              <p className="text-base-content/70 mt-2">
                Use the comprehensive filters above to find exactly what you need in the inventory.
              </p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence>
                {filteredItems.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    containerName={item.container_id ? getContainerName(item.container_id) : null}
                    showEditButton={false}
                    showPullListButton={true}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-20 bg-base-200/50 rounded-2xl border border-base-300 shadow-lg">
              <Frown className="w-16 h-16 text-primary/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-base-content">No Items Found</h3>
              <p className="text-base-content/70 mt-2">
                Try adjusting your search criteria or reset filters to see all items.
              </p>
              <Button
                onClick={resetFilters}
                className="mt-4"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
