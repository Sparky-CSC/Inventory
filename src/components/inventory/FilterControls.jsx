
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, ChevronDown, RotateCcw, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useData } from '../shared/DataManager';

export default function FilterControls({ filters, onFiltersChange, showOfflineNote }) {
  // Use centralized data instead of making separate API calls
  const { categories, locations } = useData();
  
  // Local state for search input to enable debouncing
  const [localSearchQuery, setLocalSearchQuery] = useState(filters.query || '');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);

  // Debounce the search query - search immediately when empty, or after typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Always update the query, no minimum character requirement
      if (localSearchQuery !== filters.query && onFiltersChange) {
        onFiltersChange({ ...filters, query: localSearchQuery });
      }
    }, 300); // Reduced delay since we're not waiting for 3+ characters

    return () => clearTimeout(timeoutId);
  }, [localSearchQuery, filters, onFiltersChange]);

  // Update local search when filters change from parent (e.g., on reset)
  useEffect(() => {
    setLocalSearchQuery(filters.query || '');
  }, [filters.query]);

  const handleFilterChange = (key, value) => {
    if (onFiltersChange) {
      onFiltersChange({ ...filters, [key]: value });
    }
  };

  const handleCategoryToggle = (categoryName) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(categoryName)
      ? currentCategories.filter(cat => cat !== categoryName)
      : [...currentCategories, categoryName];
    
    handleFilterChange('categories', newCategories);
  };

  const handleLocationToggle = (locationName) => {
    const currentLocations = filters.locations || [];
    const newLocations = currentLocations.includes(locationName)
      ? currentLocations.filter(loc => loc !== locationName)
      : [...currentLocations, locationName];
    
    handleFilterChange('locations', newLocations);
  };

  const clearAllFilters = () => {
    if (!onFiltersChange) return;
    
    setLocalSearchQuery('');
    onFiltersChange({
      query: '',
      categories: [],
      status: 'all',
      condition: 'all',
      locations: [],
      container: 'all'
    });
  };

  const hasActiveFilters = filters.query || 
                           (filters.categories && filters.categories.length > 0) ||
                           filters.status !== 'all' || 
                           filters.condition !== 'all' ||
                           (filters.locations && filters.locations.length > 0) ||
                           filters.container !== 'all';

  const selectedCategories = filters.categories || [];
  const selectedLocations = filters.locations || [];

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Search Input - Now optional */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <Input
              placeholder="Search items by name, description, or ID..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="pl-10 bg-base-100"
            />
            {localSearchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Categories - Multi-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-base-content">Categories</Label>
              <Popover open={categoryDropdownOpen} onOpenChange={setCategoryDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryDropdownOpen}
                    className="w-full justify-between bg-base-100"
                  >
                    {selectedCategories.length === 0
                      ? "All Categories"
                      : `${selectedCategories.length} selected`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search categories..." />
                    <CommandEmpty>No categories found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {categories.map((category) => (
                          <CommandItem
                            key={category.id}
                            onSelect={() => handleCategoryToggle(category.name)}
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedCategories.includes(category.name)}
                                onCheckedChange={() => handleCategoryToggle(category.name)}
                              />
                              <span>{category.name}</span>
                            </div>
                            {selectedCategories.includes(category.name) && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {/* Selected Categories Display */}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedCategories.map((category) => (
                    <Badge
                      key={category}
                      variant="secondary"
                      className="text-xs"
                    >
                      {category}
                      <button
                        onClick={() => handleCategoryToggle(category)}
                        className="ml-1 hover:bg-base-300 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-base-content">Status</Label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="bg-base-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="in_use">In Use</SelectItem>
                  <SelectItem value="rented">Rented</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Condition Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-base-content">Condition</Label>
              <Select value={filters.condition || 'all'} onValueChange={(value) => handleFilterChange('condition', value)}>
                <SelectTrigger className="bg-base-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conditions</SelectItem>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="needs_repair">Needs Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Locations - Multi-select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-base-content">Locations</Label>
              <Popover open={locationDropdownOpen} onOpenChange={setLocationDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={locationDropdownOpen}
                    className="w-full justify-between bg-base-100"
                  >
                    {selectedLocations.length === 0
                      ? "All Locations"
                      : `${selectedLocations.length} selected`}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search locations..." />
                    <CommandEmpty>No locations found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {locations.map((location) => (
                          <CommandItem
                            key={location.id}
                            onSelect={() => handleLocationToggle(location.name)}
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={selectedLocations.includes(location.name)}
                                onCheckedChange={() => handleLocationToggle(location.name)}
                              />
                              <span>{location.name}</span>
                            </div>
                            {selectedLocations.includes(location.name) && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {/* Selected Locations Display */}
              {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedLocations.map((location) => (
                    <Badge
                      key={location}
                      variant="secondary"
                      className="text-xs"
                    >
                      {location}
                      <button
                        onClick={() => handleLocationToggle(location)}
                        className="ml-1 hover:bg-base-300 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="flex justify-end pt-4">
              <Button variant="outline" size="sm" onClick={clearAllFilters} className="bg-base-100">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}

          {/* Offline Note */}
          {showOfflineNote && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-warning-content">
                You're currently offline. Filtering is limited to cached data.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
