import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InventoryItem } from '@/entities/InventoryItem';
import { Container } from '@/entities/Container';
import { Location } from '@/entities/Location';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ArrowLeft, Search, Package, ChevronDown, ChevronRight, MapPin,
  Shirt, Drama, Hammer, Lightbulb, Star, Boxes, Palette, Headphones, Armchair, Eye
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';

const categoryIcons = {
  costume: Shirt,
  prop: Drama,
  scenery: Palette,
  equipment: Hammer,
  lighting: Lightbulb,
  sound: Headphones,
  fabric: Shirt,
  accessory: Star,
  furniture: Armchair,
  unknown: Package
};

export default function LocationViewer() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const locationName = params.get('location');
  const qrCode = params.get('qr');

  const [locationData, setLocationData] = useState(null);
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  useEffect(() => {
    if (locationName || qrCode) {
      loadLocationData();
    } else {
      setError('No location specified');
      setIsLoading(false);
    }
  }, [locationName, qrCode]);

  const loadLocationData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let foundLocation = null;

      // Find location by QR code or name
      if (qrCode) {
        const locations = await Location.filter({ qr_code: qrCode });
        foundLocation = locations[0];
      } else if (locationName) {
        const locations = await Location.filter({ name: locationName });
        foundLocation = locations[0];
      }

      if (!foundLocation) {
        setError('Location not found');
        setIsLoading(false);
        return;
      }

      setLocationData(foundLocation);

      // Load items and containers for this location
      const [itemsData, containersData] = await Promise.all([
        InventoryItem.filter({ location: foundLocation.name }),
        Container.filter({ location: foundLocation.name })
      ]);

      // Also load items that are in containers at this location
      const containerItems = [];
      for (const container of containersData) {
        const containerItemsData = await InventoryItem.filter({ container_id: container.id });
        containerItems.push(...containerItemsData.map(item => ({ ...item, _container: container })));
      }

      // Combine and deduplicate items
      const allItems = [...itemsData, ...containerItems];
      const uniqueItems = allItems.filter((item, index, self) => 
        index === self.findIndex((t) => t.id === item.id)
      );

      setItems(uniqueItems);
      setContainers(containersData);
    } catch (err) {
      console.error('Error loading location data:', err);
      setError('Failed to load location data');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items based on search query
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.uid?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group items by category
  const itemsByCategory = filteredItems.reduce((acc, item) => {
    const categories = item.categories && Array.isArray(item.categories) 
      ? item.categories 
      : (item.category ? [item.category] : ['uncategorized']);
    
    categories.forEach(category => {
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
    });
    
    return acc;
  }, {});

  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAllCategories = () => {
    setExpandedCategories(new Set(Object.keys(itemsByCategory)));
  };

  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-6">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
          <p className="text-error text-lg mb-4">{error}</p>
          <Button 
            onClick={() => navigate(createPageUrl('Locations'))}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-content)',
            }}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Go to Locations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-base-content">{locationData?.name}</h1>
              <p className="text-base-content/70">{locationData?.description}</p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-base-200/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-base-content/70">Total Items</p>
                    <p className="text-2xl font-bold text-base-content">{items.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-base-200/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-base-content/70">Containers</p>
                    <p className="text-2xl font-bold text-base-content">{containers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-base-200/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-base-content/70">Categories</p>
                    <p className="text-2xl font-bold text-base-content">{Object.keys(itemsByCategory).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
              <Input
                placeholder="Search items in this location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-base-100"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={expandAllCategories}>
                Expand All
              </Button>
              <Button variant="outline" onClick={collapseAllCategories}>
                Collapse All
              </Button>
            </div>
          </div>
        </div>

        {/* Items by Category */}
        {Object.keys(itemsByCategory).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(itemsByCategory).map(([category, categoryItems]) => {
              const IconComponent = categoryIcons[category] || Package;
              const isExpanded = expandedCategories.has(category);

              return (
                <Card key={category} className="bg-base-200/50 backdrop-blur-sm border-base-300">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-base-300/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-6 h-6 text-primary" />
                            <CardTitle className="text-xl capitalize">
                              {category === 'uncategorized' ? 'Uncategorized' : category}
                            </CardTitle>
                            <Badge variant="secondary">{categoryItems.length} items</Badge>
                          </div>
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryItems.map((item) => (
                            <Card key={item.id} className="bg-base-100/70 hover:bg-base-300/50 transition-colors cursor-pointer">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-semibold text-base-content truncate">{item.name}</h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(createPageUrl(`ItemDetails?id=${item.id}`))}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-base-content/70 mb-2 line-clamp-2">{item.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {item.status && (
                                    <Badge variant="outline" className="capitalize">{item.status}</Badge>
                                  )}
                                  {item.condition && (
                                    <Badge variant="outline" className="capitalize">{item.condition}</Badge>
                                  )}
                                  {item._container && (
                                    <Badge variant="secondary">In: {item._container.name}</Badge>
                                  )}
                                  {item.uid && (
                                    <Badge variant="outline" className="font-mono text-xs">{item.uid}</Badge>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-base-content mb-2">No Items Found</h3>
              <p className="text-base-content/70">
                {searchQuery ? `No items match "${searchQuery}" in this location.` : 'This location has no items yet.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}