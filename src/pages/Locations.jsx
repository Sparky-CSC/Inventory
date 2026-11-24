
import React, { useState, useEffect } from "react";
import { Location } from "@/entities/Location";
import { Container } from "@/entities/Container";
import { InventoryItem } from "@/entities/InventoryItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, MapPin,
  Building, Home, Layers, Package, ChevronRight, ChevronDown, PlusCircle, Boxes
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import QRCodeGenerator from '../components/shared/QRCodeGenerator';
import { useNavigate } from "react-router-dom"; // Assuming react-router-dom for navigation
import { createPageUrl, getAppBaseUrl } from '@/utils';
import BackButton from '../components/shared/BackButton';

const locationTypeConfig = {
  building: { icon: Building, label: "Building", color: "bg-purple-500", description: "Main building or facility" },
  room: { icon: Home, label: "Room", color: "bg-blue-500", description: "Room or major area within a building" },
  rack: { icon: Layers, label: "Rack/Row", color: "bg-green-500", description: "Rack, shelf, or row within a room" },
};

const containerTypes = [
  { value: "box", label: "Box" },
  { value: "rack", label: "Rack" },
  { value: "garment_bag", label: "Garment Bag" },
  { value: "drawer", label: "Drawer" },
  { value: "shelf", label: "Shelf" },
  { value: "cabinet", label: "Cabinet" }
];

export default function Locations() {
  const navigate = useNavigate(); // For programmatic navigation
  const [locations, setLocations] = useState([]);
  const [containers, setContainers] = useState([]);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Location Dialog
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationFormData, setLocationFormData] = useState({
    name: "", description: "", location_type: "room", parent_location_id: "", capacity: "", notes: "", qr_code: ""
  });

  // Container Dialog
  const [showContainerDialog, setShowContainerDialog] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [containerFormData, setContainerFormData] = useState({
    name: "", description: "", location: "", container_type: "box", capacity: "", notes: "", qr_code: ""
  });
  
  // General State
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("hierarchy"); // This state is not currently used in the provided JSX for Tabs, but kept from original.
  const [expandedLocations, setExpandedLocations] = useState(new Set()); // Corrected initialization for Set

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [locationsData, itemsData, containersData] = await Promise.all([
        Location.list(),
        InventoryItem.list(),
        Container.list()
      ]);
      setLocations(locationsData || []);
      setItems(itemsData || []);
      setContainers(containersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError("Failed to load data");
    }
    setIsLoading(false);
  };
  
  const getLocationItems = (locationName) => items.filter(item => item.location === locationName);
  const getContainerItems = (containerId) => items.filter(item => item.container_id === containerId);

  // --- Location Handlers ---

  const resetLocationForm = () => {
    setEditingLocation(null);
    setLocationFormData({
      name: "", description: "", location_type: "room", parent_location_id: "", capacity: "", notes: "", qr_code: ""
    });
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setLocationFormData({
      name: location.name || "",
      description: location.description || "",
      location_type: location.location_type || "room",
      parent_location_id: location.parent_location_id || "",
      capacity: location.capacity?.toString() || "",
      notes: location.notes || "",
      qr_code: location.qr_code || ""
    });
    setShowLocationDialog(true);
  };
  
  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Generate a dynamic QR code URL for locations
      const baseUrl = `${getAppBaseUrl()}#`;
      // Ensure the name is URL-encoded for safety
      const locationUrl = `${baseUrl}${createPageUrl(`Inventory?location=${encodeURIComponent(locationFormData.name)}`)}`;

      const data = {
        ...locationFormData,
        capacity: locationFormData.capacity ? parseInt(locationFormData.capacity) : null,
        // If qr_code is empty, use the generated URL. Otherwise, use what the user entered.
        qr_code: locationFormData.qr_code || locationUrl
      };
      
      if (editingLocation) {
        await Location.update(editingLocation.id, data);
      } else {
        await Location.create(data);
      }
      setShowLocationDialog(false);
      resetLocationForm();
      loadData();
    } catch (error) {
      setError("Failed to save location");
    }
  };

  const handleDeleteLocation = async (location) => {
    const itemsInLoc = getLocationItems(location.name);
    const childLocs = locations.filter(l => l.parent_location_id === location.id);
    const containersInLoc = containers.filter(c => c.location === location.name);
    
    if (itemsInLoc.length > 0 || childLocs.length > 0 || containersInLoc.length > 0) {
      if (!confirm(`This location has ${childLocs.length} sub-locations, ${containersInLoc.length} containers, and ${itemsInLoc.length} loose items. Deleting it will unlink all of them. Continue?`)) {
        return;
      }
      for (const item of itemsInLoc) await InventoryItem.update(item.id, { location: null });
      for (const child of childLocs) await Location.update(child.id, { parent_location_id: null });
      for (const container of containersInLoc) await Container.update(container.id, { location: null });
    }

    try {
      await Location.delete(location.id);
      loadData();
    } catch (error) {
      setError("Failed to delete location");
    }
  };


  // --- Container Handlers ---
  
  const resetContainerForm = () => {
    setEditingContainer(null);
    setContainerFormData({
      name: "", description: "", location: "", container_type: "box", capacity: "", notes: "", qr_code: ""
    });
  };

  const handleAddContainer = (parentLocationName) => {
    resetContainerForm();
    setContainerFormData(prev => ({ ...prev, location: parentLocationName }));
    setShowContainerDialog(true);
  };
  
  const handleEditContainer = (container) => {
    setEditingContainer(container);
    setContainerFormData({
      name: container.name || "",
      description: container.description || "",
      location: container.location || "",
      container_type: container.container_type || "box",
      capacity: container.capacity?.toString() || "",
      notes: container.notes || "",
      qr_code: container.qr_code || ""
    });
    setShowContainerDialog(true);
  };

  const handleContainerSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      // Generate a dynamic QR code URL for containers
      const baseUrl = `${getAppBaseUrl()}#`;
      // Ensure the name is URL-encoded for safety
      const containerUrl = `${baseUrl}${createPageUrl(`Inventory?container=${encodeURIComponent(containerFormData.name)}`)}`;

      const data = {
        ...containerFormData,
        capacity: containerFormData.capacity ? parseInt(containerFormData.capacity) : null,
        // If qr_code is empty, use the generated URL. Otherwise, use what the user entered.
        qr_code: containerFormData.qr_code || containerUrl
      };
      if (editingContainer) {
        await Container.update(editingContainer.id, data);
      } else {
        await Container.create(data);
      }
      setShowContainerDialog(false);
      resetContainerForm();
      loadData();
    } catch (error) {
      setError("Failed to save container");
    }
  };

  const handleDeleteContainer = async (container) => { // Changed from containerId to container object
    const itemsInContainer = getContainerItems(container.id);
    if (itemsInContainer.length > 0) {
      if (!confirm(`This container has ${itemsInContainer.length} items. Deleting it will remove the container reference from these items. Continue?`)) {
        return;
      }
      for (const item of itemsInContainer) await InventoryItem.update(item.id, { container_id: null });
    }
    try {
      await Container.delete(container.id); // Use container.id
      loadData();
    } catch (error) {
      setError("Failed to delete container");
    }
  };


  // --- Hierarchy Logic ---

  const buildLocationHierarchy = () => {
    const hierarchy = [];
    const locationMap = new Map(locations.map(loc => [loc.id, { ...loc, children: [] }]));
    locationMap.forEach(loc => {
      if (loc.parent_location_id && locationMap.has(loc.parent_location_id)) {
        locationMap.get(loc.parent_location_id).children.push(loc);
      } else {
        hierarchy.push(loc);
      }
    });
    hierarchy.forEach(parent => parent.children.sort((a, b) => a.name.localeCompare(b.name)));
    return hierarchy.sort((a, b) => a.name.localeCompare(b.name));
  };
  
  const getParentLocationOptions = (currentType) => {
    switch (currentType) {
      case 'room': return locations.filter(loc => loc.location_type === 'building');
      case 'rack': return locations.filter(loc => loc.location_type === 'building' || loc.location_type === 'room');
      default: return [];
    }
  };
  
  const getLocationPath = (location) => {
    const path = [location.name];
    let current = location;
    while (current.parent_location_id) {
      const parent = locations.find(loc => loc.id === current.parent_location_id);
      if (parent) {
        path.unshift(parent.name);
        current = parent;
      } else break;
    }
    return path.join(' > ');
  };
  
  const toggleLocationExpansion = (locationId) => {
    setExpandedLocations(prev => {
      // Ensure prev is always a Set, even if somehow undefined
      const currentSet = prev instanceof Set ? prev : new Set();
      const newSet = new Set(currentSet);
      if (newSet.has(locationId)) {
        newSet.delete(locationId);
      } else {
        newSet.add(locationId);
      }
      return newSet;
    });
  };

  const renderLocationHierarchy = (locationNodes, level = 0) => {
    return locationNodes.map(location => {
      const config = locationTypeConfig[location.location_type] || {};
      const locationItems = getLocationItems(location.name);
      const containersInLocation = containers.filter(c => c.location === location.name);
      const hasChildren = location.children && location.children.length > 0;
      
      // Safely check if location is expanded, with fallback
      const isExpanded = expandedLocations instanceof Set ? expandedLocations.has(location.id) : false;

      // Ensure location QR code contains a proper URL for scanning
      const baseUrl = `${getAppBaseUrl()}#`;
      const locationQRCode = location.qr_code?.startsWith('http') 
        ? location.qr_code 
        : `${baseUrl}${createPageUrl(`Inventory?location=${encodeURIComponent(location.name)}`)}`;

      return (
        <div key={location.id} className={`mb-4 ${level > 0 ? 'ml-6' : ''}`}>
          <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
            <CardHeader 
              className="pb-4 hover:bg-base-300/30 transition-colors cursor-pointer"
              onClick={() => navigate(createPageUrl(`Inventory?location=${encodeURIComponent(location.name)}`))}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {(hasChildren || containersInLocation.length > 0 || locationItems.length > 0) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); toggleLocationExpansion(location.id); }} 
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  )}
                  <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <config.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg text-base-content flex items-center gap-2 flex-wrap">
                      <span className="truncate">{location.name}</span>
                      <Badge variant="outline" className="text-xs">{config.label}</Badge>
                      {containersInLocation.length > 0 && <Badge variant="secondary" className="text-xs">{containersInLocation.length} containers</Badge>}
                      {locationItems.length > 0 && <Badge variant="secondary" className="text-xs">{locationItems.length} loose items</Badge>}
                      {hasChildren && <Badge variant="secondary" className="text-xs">{location.children.length} sub-locations</Badge>}
                    </CardTitle>
                    <p className="text-sm text-base-content/70 mt-1 truncate">{getLocationPath(location)}</p>
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <QRCodeGenerator 
                    data={locationQRCode} 
                    label={'Location: ' + location.name}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleEditLocation(location)} className="text-primary hover:bg-primary/10">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteLocation(location)} className="text-error hover:bg-error/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* Expanded content */}
            {isExpanded && (
              <CardContent className="pt-2 space-y-4">
                {location.description && <p className="text-sm text-base-content/70 mb-4">{location.description}</p>}
                
                <div className="flex justify-end">
                   <Button variant="outline" size="sm" onClick={() => handleAddContainer(location.name)} className="text-primary hover:bg-primary/10">
                     <PlusCircle className="w-3 h-3 mr-1"/>
                     Add Container to {location.name}
                   </Button>
                </div>
                
                {/* Containers Section */}
                {containersInLocation.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-base-content flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-primary"/>
                      Containers ({containersInLocation.length})
                    </h5>
                    <div className="space-y-2">
                      {containersInLocation.map(container => {
                        const containerItems = getContainerItems(container.id);
                        
                        // Simplify URL generation to avoid potential parsing errors with nested templates
                        const pageUrl = createPageUrl(`Inventory?container=${encodeURIComponent(container.id)}`);
                        const containerQRCode = container.qr_code && container.qr_code.startsWith('http') 
                          ? container.qr_code 
                          : `${baseUrl}${pageUrl}`;
                        
                        return (
                          <div 
                            key={container.id} 
                            className="p-3 rounded-lg bg-base-100/70 border border-base-300 hover:bg-base-300/50 hover:border-primary/20 transition-all cursor-pointer group"
                            onClick={() => navigate(pageUrl)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Package className="w-4 h-4 text-primary flex-shrink-0" />
                                  <h6 className="font-medium text-sm text-base-content truncate group-hover:text-primary transition-colors">
                                    {container.name}
                                  </h6>
                                  <Badge variant="outline" className="text-xs">
                                    {containerTypes.find(t => t.value === container.container_type)?.label || container.container_type}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {containerItems.length} items
                                  </Badge>
                                  {container.capacity && (
                                    <Badge variant="outline" className="text-xs">
                                      Capacity: {container.capacity}
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Preview of items in container */}
                                {container.description && (
                                  <p className="text-xs text-base-content/60 mb-2">{container.description}</p>
                                )}

                                {containerItems.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {containerItems.slice(0, 3).map(item => (
                                      <Badge key={item.id} variant="outline" className="text-xs bg-base-200/50">
                                        {item.name}
                                      </Badge>
                                    ))}
                                    {containerItems.length > 3 && (
                                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                                        +{containerItems.length - 3} more items
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                
                                {containerItems.length === 0 && (
                                  <p className="text-xs text-base-content/40 italic">Empty container</p>
                                )}
                              </div>
                              
                              <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                                <QRCodeGenerator 
                                  data={containerQRCode} 
                                  label={'Container: ' + container.name} 
                                />
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditContainer(container);
                                  }} 
                                  className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                                >
                                  <Edit className="w-3 h-3"/>
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteContainer(container);
                                  }} 
                                  className="h-7 w-7 p-0 text-error hover:bg-error/10"
                                >
                                  <Trash2 className="w-3 h-3"/>
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {containersInLocation.length === 0 && (
                  <div className="text-center py-4 border-t border-base-300/50">
                    <p className="text-sm text-base-content/60">No containers in this location.</p>
                  </div>
                )}

                {/* Loose Items Section - Retained from original logic but moved */}
                {locationItems.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-base-content flex items-center gap-2">
                      <Package className="w-4 h-4 text-secondary"/>
                      Loose Items ({locationItems.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {locationItems.slice(0, 8).map(item => (
                        <Badge 
                          key={item.id} 
                          variant="secondary" 
                          className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`ItemDetails?id=${item.id}`));
                          }}
                        >
                          {item.name}
                        </Badge>
                      ))}
                      {locationItems.length > 8 && (
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer hover:bg-primary/10" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(createPageUrl(`Inventory?location=${encodeURIComponent(location.name)}`));
                          }}
                        >
                          +{locationItems.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {containersInLocation.length === 0 && locationItems.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-base-content/60">No containers or loose items in this location.</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
          
          {/* Child locations */}
          {hasChildren && isExpanded && (
            <div className="mt-2">
              {renderLocationHierarchy(location.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content mb-2">Location Management</h1>
            <p className="text-primary font-medium">Organize items with hierarchical locations and QR codes</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
              <DialogTrigger asChild>
                <Button 
                  onClick={resetLocationForm}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-primary-content)',
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingLocation ? 'Edit Location' : 'Add New Location'}</DialogTitle></DialogHeader>
                <form onSubmit={handleLocationSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="loc-name">Location Name *</Label>
                      <Input id="loc-name" value={locationFormData.name} onChange={(e) => setLocationFormData({...locationFormData, name: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Location Type *</Label>
                      <Select value={locationFormData.location_type} onValueChange={(value) => setLocationFormData({...locationFormData, location_type: value})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(locationTypeConfig).map(([key, config]) => <SelectItem key={key} value={key}>{config.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {locationFormData.location_type !== 'building' && (
                    <div className="space-y-2">
                      <Label>Parent Location</Label>
                      <Select value={locationFormData.parent_location_id || "none"} onValueChange={(value) => setLocationFormData({...locationFormData, parent_location_id: value === "none" ? "" : value})}>
                        <SelectTrigger><SelectValue placeholder="Select parent location" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No parent</SelectItem>
                          {getParentLocationOptions(locationFormData.location_type).map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({locationTypeConfig[l.location_type]?.label})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="loc-capacity">Capacity</Label><Input id="loc-capacity" type="number" value={locationFormData.capacity} onChange={(e) => setLocationFormData({...locationFormData, capacity: e.target.value})}/></div>
                      <div className="space-y-2"><Label htmlFor="loc-qr">QR Code</Label><Input id="loc-qr" value={locationFormData.qr_code} onChange={(e) => setLocationFormData({...locationFormData, qr_code: e.target.value})} placeholder="Auto-generated if empty"/></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="loc-desc">Description</Label><Textarea id="loc-desc" value={locationFormData.description} onChange={(e) => setLocationFormData({...locationFormData, description: e.target.value})}/></div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowLocationDialog(false)}>Cancel</Button>
                    <Button 
                      type="submit" 
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-primary-content)',
                      }}
                    >
                      Save Location
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Container Form Dialog */}
        <Dialog open={showContainerDialog} onOpenChange={setShowContainerDialog}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{editingContainer ? 'Edit Container' : 'Add New Container'}</DialogTitle></DialogHeader>
                <form onSubmit={handleContainerSubmit} className="space-y-4">
                    <div className="space-y-2"><Label htmlFor="cont-name">Container Name *</Label><Input id="cont-name" value={containerFormData.name} onChange={(e) => setContainerFormData({...containerFormData, name: e.target.value})} required/></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Type</Label><Select value={containerFormData.container_type} onValueChange={(value) => setContainerFormData({...containerFormData, container_type: value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{containerTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="cont-capacity">Capacity</Label><Input id="cont-capacity" type="number" value={containerFormData.capacity} onChange={(e) => setContainerFormData({...containerFormData, capacity: e.target.value})}/></div>
                    </div>
                    <div className="space-y-2"><Label>Parent Location</Label><Select value={containerFormData.location || "none"} onValueChange={(v) => setContainerFormData({...containerFormData, location: v === 'none' ? '' : v})}><SelectTrigger><SelectValue placeholder="Select location"/></SelectTrigger><SelectContent><SelectItem value="none">No Location</SelectItem>{locations.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="cont-qr">QR Code</Label><Input id="cont-qr" value={containerFormData.qr_code} onChange={(e) => setContainerFormData({...containerFormData, qr_code: e.target.value})} placeholder="Auto-generated if empty"/></div>
                    <div className="space-y-2"><Label htmlFor="cont-desc">Description</Label><Textarea id="cont-desc" value={containerFormData.description} onChange={(e) => setContainerFormData({...containerFormData, description: e.target.value})}/></div>
                    <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setShowContainerDialog(false)}>Cancel</Button><Button type="submit" className="bg-primary hover:bg-primary-focus text-primary-content">Save Container</Button></div>
                </form>
            </DialogContent>
        </Dialog>

        {error && <Alert variant="destructive" className="mb-6"><AlertDescription>{error}</AlertDescription></Alert>}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-base-content/70 mt-2">Loading locations...</p>
          </div>
        ) : locations.length > 0 ? (
          <div className="space-y-4">{renderLocationHierarchy(buildLocationHierarchy())}</div>
        ) : (
          <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
            <CardContent className="text-center py-12">
              <MapPin className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-base-content mb-2">No Locations Yet</h3>
              <p className="text-base-content/70 mb-4">Create your first location to organize your inventory.</p>
              <Button onClick={() => {resetLocationForm(); setShowLocationDialog(true);}} className="bg-primary hover:bg-primary-focus text-primary-content"><Plus className="w-4 h-4 mr-2" /> Add First Location</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
