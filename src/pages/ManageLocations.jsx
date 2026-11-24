
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, Plus, Edit, Trash2, QrCode, Package, Save, Building, Scan, Search, Container as ContainerIcon
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import BackButton from "../components/shared/BackButton";

const containerTypes = [
  { value: "box", label: "Box" },
  { value: "rack", label: "Rack" },
  { value: "garment_bag", label: "Garment Bag" },
  { value: "drawer", label: "Drawer" },
  { value: "shelf", label: "Shelf" },
  { value: "cabinet", label: "Cabinet" }
];

export default function ManageLocations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [containers, setContainers] = useState([]);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("locations");
  
  // Location state
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showLocationScanDialog, setShowLocationScanDialog] = useState(false);
  const [locationScannedCode, setLocationScannedCode] = useState("");
  const [locationScanResult, setLocationScanResult] = useState(null);
  const [isCheckingLocationCode, setIsCheckingLocationCode] = useState(false);
  
  // Container state
  const [showAddContainerDialog, setShowAddContainerDialog] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [showContainerScanDialog, setShowContainerScanDialog] = useState(false);
  const [containerScannedCode, setContainerScannedCode] = useState("");
  const [containerScanResult, setContainerScanResult] = useState(null);
  const [isCheckingContainerCode, setIsCheckingContainerCode] = useState(false);
  
  const [error, setError] = useState("");
  
  const [locationFormData, setLocationFormData] = useState({
    name: "",
    description: "",
    building: "",
    room: "",
    section: "",
    notes: "",
    qr_code: ""
  });

  const [containerFormData, setContainerFormData] = useState({
    name: "",
    description: "",
    location: "",
    container_type: "box",
    capacity: "",
    notes: "",
    qr_code: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [locationsData, containersData, itemsData] = await Promise.all([
        Location.list(),
        Container.list(),
        InventoryItem.list()
      ]);
      setLocations(locationsData);
      setContainers(containersData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError("Failed to load data");
    }
    setIsLoading(false);
  };

  // Location functions
  const handleLocationInputChange = (field, value) => {
    setLocationFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetLocationForm = () => {
    setLocationFormData({
      name: "",
      description: "",
      building: "",
      room: "",
      section: "",
      notes: "",
      qr_code: ""
    });
    setEditingLocation(null);
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const locationData = {
        ...locationFormData,
        qr_code: locationFormData.qr_code || `LOC-${locationFormData.name.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`
      };

      if (editingLocation) {
        await Location.update(editingLocation.id, locationData);
        
        // Update all items that reference this location
        const itemsToUpdate = items.filter(item => item.location === editingLocation.name);
        for (const item of itemsToUpdate) {
          await InventoryItem.update(item.id, { location: locationData.name });
        }
      } else {
        await Location.create(locationData);
      }

      setShowAddLocationDialog(false);
      resetLocationForm();
      loadData();
    } catch (error) {
      setError("Failed to save location");
      console.error('Error saving location:', error);
    }
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setLocationFormData({
      name: location.name || "",
      description: location.description || "",
      building: location.building || "",
      room: location.room || "",
      section: location.section || "",
      notes: location.notes || "",
      qr_code: location.qr_code || ""
    });
    setShowAddLocationDialog(true);
  };

  const handleDeleteLocation = async (locationId, locationName) => {
    if (!confirm(`Are you sure you want to delete this location? This will remove the location reference from ${getItemCountByLocation(locationName)} items.`)) {
      return;
    }

    try {
      // Update all items that reference this location
      const itemsToUpdate = items.filter(item => item.location === locationName);
      for (const item of itemsToUpdate) {
        await InventoryItem.update(item.id, { location: null });
      }

      await Location.delete(locationId);
      loadData();
    } catch (error) {
      setError("Failed to delete location");
      console.error('Error deleting location:', error);
    }
  };

  // Container functions
  const handleContainerInputChange = (field, value) => {
    setContainerFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetContainerForm = () => {
    setContainerFormData({
      name: "",
      description: "",
      location: "",
      container_type: "box",
      capacity: "",
      notes: "",
      qr_code: ""
    });
    setEditingContainer(null);
  };

  const handleContainerSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const containerData = {
        ...containerFormData,
        capacity: containerFormData.capacity ? parseInt(containerFormData.capacity) : null,
        qr_code: containerFormData.qr_code || `CONT-${containerFormData.name.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`
      };

      if (editingContainer) {
        await Container.update(editingContainer.id, containerData);
      } else {
        await Container.create(containerData);
      }

      setShowAddContainerDialog(false);
      resetContainerForm();
      loadData();
    } catch (error) {
      setError("Failed to save container");
      console.error('Error saving container:', error);
    }
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
    setShowAddContainerDialog(true);
  };

  const handleDeleteContainer = async (containerId, containerName) => {
    const itemsInContainer = getContainerItems(containerId);
    if (itemsInContainer.length > 0) {
      if (!confirm(`This container has ${itemsInContainer.length} items. Deleting it will remove the container reference from these items. Continue?`)) {
        return;
      }
      
      // Update all items in this container
      for (const item of itemsInContainer) {
        await InventoryItem.update(item.id, { container_id: null });
      }
    }

    try {
      await Container.delete(containerId);
      loadData();
    } catch (error) {
      setError("Failed to delete container");
      console.error('Error deleting container:', error);
    }
  };

  // Utility functions
  const getItemCountByLocation = (locationName) => {
    return items.filter(item => item.location === locationName).length;
  };

  const getContainerItems = (containerId) => {
    return items.filter(item => item.container_id === containerId);
  };

  const generateQRCode = async (item, type) => {
    try {
      alert(`QR Code Data: ${item.qr_code}\n\nThis would generate a scannable QR code for ${type} assignment.`);
    } catch (error) {
      setError(`Failed to generate QR code for ${type}`);
    }
  };

  // Scan functions for locations
  const resetLocationScanDialog = () => {
    setLocationScannedCode("");
    setLocationScanResult(null);
    setIsCheckingLocationCode(false);
  };

  const handleCheckLocationCode = async () => {
    if (!locationScannedCode) return;
    setIsCheckingLocationCode(true);
    try {
      const result = await Location.filter({ qr_code: locationScannedCode });
      if (result.length > 0) {
        setLocationScanResult(result[0]);
      } else {
        setLocationScanResult('not_found');
      }
    } catch (err) {
      setError("Error checking QR code.");
      console.error("Error checking QR code:", err);
    }
    setIsCheckingLocationCode(false);
  };

  const handleCreateLocationFromScan = () => {
    setShowLocationScanDialog(false);
    resetLocationForm();
    setLocationFormData(prev => ({
      ...prev,
      qr_code: locationScannedCode,
      name: `Location ${locationScannedCode.slice(-6)}`
    }));
    setEditingLocation(null);
    setShowAddLocationDialog(true);
  };

  // Scan functions for containers
  const resetContainerScanDialog = () => {
    setContainerScannedCode("");
    setContainerScanResult(null);
    setIsCheckingContainerCode(false);
  };

  const handleCheckContainerCode = async () => {
    if (!containerScannedCode) return;
    setIsCheckingContainerCode(true);
    setContainerScanResult(null);
    setError("");
    try {
      const result = await Container.filter({ qr_code: containerScannedCode });
      if (result.length > 0) {
        setContainerScanResult(result[0]);
      } else {
        setContainerScanResult('not_found');
      }
    } catch (err) {
      setError("Error checking QR code.");
      setContainerScanResult(null);
      console.error("Error checking QR code:", err);
    } finally {
      setIsCheckingContainerCode(false);
    }
  };

  const handleCreateContainerFromScan = () => {
    setShowContainerScanDialog(false);
    resetContainerForm();
    setContainerFormData(prev => ({
      ...prev,
      qr_code: containerScannedCode,
      name: `Container ${containerScannedCode.toUpperCase().slice(-6)}`
    }));
    setEditingContainer(null);
    setShowAddContainerDialog(true);
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <BackButton className="mb-4" />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-base-content mb-2">Storage Management</h1>
          <p className="text-primary font-medium">Organize your storage areas, rooms, and containers</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Locations ({locations.length})
            </TabsTrigger>
            <TabsTrigger value="containers" className="flex items-center gap-2">
              <ContainerIcon className="w-4 h-4" />
              Containers ({containers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-base-content">Locations</h2>
                <p className="text-base-content/70">Manage your storage locations and rooms</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Dialog open={showLocationScanDialog} onOpenChange={(isOpen) => { setShowLocationScanDialog(isOpen); if (!isOpen) resetLocationScanDialog(); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Scan className="w-4 h-4 mr-2" />
                      Scan QR Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Scan or Enter Location QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-base-content/70">Enter a location QR code to find it or create a new one.</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter QR code..."
                          value={locationScannedCode}
                          onChange={(e) => setLocationScannedCode(e.target.value)}
                          disabled={isCheckingLocationCode}
                        />
                        <Button onClick={handleCheckLocationCode} disabled={isCheckingLocationCode || !locationScannedCode}>
                          {isCheckingLocationCode ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>

                      {locationScanResult === 'not_found' && (
                        <Alert>
                          <QrCode className="h-4 w-4" />
                          <AlertTitle>Code Not Found</AlertTitle>
                          <AlertDescription>
                            <p>No location exists with this QR code.</p>
                            <Button size="sm" className="mt-2" onClick={handleCreateLocationFromScan}>
                              <Plus className="w-4 h-4 mr-2" />
                              Create New Location
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {locationScanResult && locationScanResult !== 'not_found' && (
                         <Alert variant="default" className="bg-success/10 border-success/50">
                          <MapPin className="h-4 w-4 text-success" />
                          <AlertTitle className="text-success-content">Location Found</AlertTitle>
                          <AlertDescription className="text-success-content/80">
                            <p className="font-bold">{locationScanResult.name}</p>
                            <p>{locationScanResult.building} - {locationScanResult.room}</p>
                            <p>{getItemCountByLocation(locationScanResult.name)} items stored here.</p>
                            <Button size="sm" variant="outline" className="mt-2 border-success/30" onClick={() => { setShowLocationScanDialog(false); handleEditLocation(locationScanResult); }}>
                              <Edit className="w-4 h-4 mr-2" />
                              View/Edit Location
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showAddLocationDialog} onOpenChange={setShowAddLocationDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={resetLocationForm}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {editingLocation ? 'Edit Location' : 'Add New Location'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleLocationSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Location Name *</Label>
                        <Input
                          id="name"
                          value={locationFormData.name}
                          onChange={(e) => handleLocationInputChange('name', e.target.value)}
                          placeholder="e.g., Wardrobe Room A"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="building">Building</Label>
                        <Input
                          id="building"
                          value={locationFormData.building}
                          onChange={(e) => handleLocationInputChange('building', e.target.value)}
                          placeholder="e.g., Main Theater Building"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="room">Room</Label>
                          <Input
                            id="room"
                            value={locationFormData.room}
                            onChange={(e) => handleLocationInputChange('room', e.target.value)}
                            placeholder="e.g., Room 101"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="section">Section</Label>
                          <Input
                            id="section"
                            value={locationFormData.section}
                            onChange={(e) => handleLocationInputChange('section', e.target.value)}
                            placeholder="e.g., North Wall"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={locationFormData.description}
                          onChange={(e) => handleLocationInputChange('description', e.target.value)}
                          placeholder="Description of this location..."
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={locationFormData.notes}
                          onChange={(e) => handleLocationInputChange('notes', e.target.value)}
                          placeholder="Additional notes..."
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="qr_code">QR Code (Optional)</Label>
                        <Input
                          id="qr_code"
                          value={locationFormData.qr_code}
                          onChange={(e) => handleLocationInputChange('qr_code', e.target.value)}
                          placeholder="Leave blank to auto-generate"
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowAddLocationDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          <Save className="w-4 h-4 mr-2" />
                          {editingLocation ? 'Update' : 'Create'} Location
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-base-content/70 mt-2">Loading locations...</p>
                </div>
              ) : locations.length > 0 ? (
                locations.map((location) => (
                  <Card key={location.id} className="bg-base-200/50 backdrop-blur-sm shadow-md">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-primary-content" />
                          </div>
                          <div>
                            <CardTitle className="text-xl text-base-content">{location.name}</CardTitle>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {location.building && (
                                <Badge variant="outline" className="text-xs">
                                  <Building className="w-3 h-3 mr-1" />
                                  {location.building}
                                </Badge>
                              )}
                              {location.room && (
                                <Badge variant="outline" className="text-xs">
                                  Room: {location.room}
                                </Badge>
                              )}
                              {location.section && (
                                <Badge variant="outline" className="text-xs">
                                  {location.section}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => generateQRCode(location, 'location')}
                            className="text-info hover:text-info-focus"
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditLocation(location)}
                            className="text-primary hover:text-primary-focus"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteLocation(location.id, location.name)}
                            className="text-error hover:text-error-focus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          {location.description && (
                            <div className="mb-4">
                              <h4 className="font-medium text-base-content mb-1">Description</h4>
                              <p className="text-base-content/80 text-sm">{location.description}</p>
                            </div>
                          )}
                          
                          {location.notes && (
                            <div>
                              <h4 className="font-medium text-base-content mb-1">Notes</h4>
                              <p className="text-base-content/80 text-sm">{location.notes}</p>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-base-content/70" />
                            <span className="font-medium text-base-content">
                              {getItemCountByLocation(location.name)} items stored here
                            </span>
                          </div>
                          
                          {location.qr_code && (
                            <div className="text-xs text-base-content/70 font-mono bg-base-300 p-2 rounded">
                              QR: {location.qr_code}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
                  <CardContent className="text-center py-12">
                    <MapPin className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-base-content mb-2">No Locations Yet</h3>
                    <p className="text-base-content/70 mb-4">Start by creating your first storage location.</p>
                    <Button 
                      onClick={() => {resetLocationForm(); setShowAddLocationDialog(true);}}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Location
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="containers" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-base-content">Containers</h2>
                <p className="text-base-content/70">Manage your storage containers and boxes</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Dialog open={showContainerScanDialog} onOpenChange={(isOpen) => { setShowContainerScanDialog(isOpen); if (!isOpen) resetContainerScanDialog(); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Scan className="w-4 h-4 mr-2" />
                      Scan QR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Scan or Enter QR Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-base-content/70">Enter a container QR code to find it or create a new one.</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter QR code..."
                          value={containerScannedCode}
                          onChange={(e) => setContainerScannedCode(e.target.value)}
                          disabled={isCheckingContainerCode}
                        />
                        <Button onClick={handleCheckContainerCode} disabled={isCheckingContainerCode || !containerScannedCode}>
                          {isCheckingContainerCode ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-content"></div> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>

                      {containerScanResult === 'not_found' && (
                        <Alert>
                          <QrCode className="h-4 w-4" />
                          <AlertTitle>Code Not Found</AlertTitle>
                          <AlertDescription>
                            <p>No container exists with this QR code.</p>
                            <Button size="sm" className="mt-2" onClick={handleCreateContainerFromScan}>
                              <Plus className="w-4 h-4 mr-2" />
                              Create New Container
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                      {containerScanResult && containerScanResult !== 'not_found' && (
                        <Alert variant="success" className="bg-success/10 border-success/50">
                          <QrCode className="h-4 w-4 text-success" />
                          <AlertTitle className="text-success-content">Container Found</AlertTitle>
                          <AlertDescription className="text-success-content/80">
                            <p className="font-bold">{containerScanResult.name}</p>
                            <p>{containerScanResult.location}</p>
                            <p>{getContainerItems(containerScanResult.id).length} items inside.</p>
                            <Button size="sm" className="mt-2" onClick={() => handleEditContainer(containerScanResult)}>
                              <Edit className="w-4 h-4 mr-2" />
                              View/Edit Container
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={showAddContainerDialog} onOpenChange={setShowAddContainerDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={resetContainerForm}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Container
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>
                        {editingContainer ? 'Edit Container' : 'Add New Container'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleContainerSubmit} className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto pr-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Container Name *</Label>
                          <Input
                            id="name"
                            value={containerFormData.name}
                            onChange={(e) => handleContainerInputChange('name', e.target.value)}
                            placeholder="e.g., COSTUME-BOX-001"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="container_type">Type</Label>
                            <Select value={containerFormData.container_type} onValueChange={(value) => handleContainerInputChange('container_type', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {containerTypes.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="capacity">Capacity</Label>
                            <Input
                              id="capacity"
                              type="number"
                              value={containerFormData.capacity}
                              onChange={(e) => handleContainerInputChange('capacity', e.target.value)}
                              placeholder="Max items"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={containerFormData.location}
                            onChange={(e) => handleContainerInputChange('location', e.target.value)}
                            placeholder="e.g., Wardrobe Room A - Shelf 3"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="qr_code">QR Code (Optional)</Label>
                          <Input
                            id="qr_code"
                            value={containerFormData.qr_code}
                            onChange={(e) => handleContainerInputChange('qr_code', e.target.value)}
                            placeholder="e.g., CONT-BOX-XYZ-123"
                          />
                          <p className="text-xs text-base-content/70">If left empty, a code will be generated automatically.</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={containerFormData.description}
                            onChange={(e) => handleContainerInputChange('description', e.target.value)}
                            placeholder="Description of contents or purpose..."
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={containerFormData.notes}
                            onChange={(e) => handleContainerInputChange('notes', e.target.value)}
                            placeholder="Additional notes..."
                            rows={2}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowAddContainerDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          <Save className="w-4 h-4 mr-2" />
                          {editingContainer ? 'Update' : 'Create'} Container
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid gap-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-base-content/70 mt-2">Loading containers...</p>
                </div>
              ) : containers.length > 0 ? (
                containers.map((container) => {
                  const containerItems = getContainerItems(container.id);
                  const utilizationRate = container.capacity ? (containerItems.length / container.capacity) * 100 : 0;
                  
                  return (
                    <Card 
                      key={container.id} 
                      className="bg-base-200/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => navigate(createPageUrl(`Inventory?container=${encodeURIComponent(container.id)}`))}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                              <QrCode className="w-6 h-6 text-primary-content" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-xl text-base-content hover:text-primary transition-colors">
                                {container.name}
                              </CardTitle>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {container.container_type?.replace('_', ' ')}
                                </Badge>
                                {container.capacity && (
                                  <Badge variant="outline" className="text-xs">
                                    {containerItems.length}/{container.capacity} items
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  Click to view contents
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => generateQRCode(container, 'container')}
                              className="text-info hover:text-info-focus"
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEditContainer(container)}
                              className="text-primary hover:text-primary-focus"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleDeleteContainer(container.id, container.name)}
                              className="text-error hover:text-error-focus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <div className="space-y-3">
                              {container.location && (
                                <div>
                                  <h4 className="font-medium text-base-content">Location</h4>
                                  <p className="text-base-content/80 text-sm">{container.location}</p>
                                </div>
                              )}
                              
                              {container.description && (
                                <div>
                                  <h4 className="font-medium text-base-content">Description</h4>
                                  <p className="text-base-content/80 text-sm">{container.description}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Package className="w-4 h-4 text-base-content/70" />
                              <span className="font-medium text-base-content">
                                Contains {containerItems.length} items
                              </span>
                            </div>
                            
                            {container.capacity && (
                              <div className="mb-3">
                                <div className="flex justify-between text-sm text-base-content/80 mb-1">
                                  <span>Utilization</span>
                                  <span>{utilizationRate.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-base-300 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      utilizationRate > 90 ? 'bg-error' : 
                                      utilizationRate > 75 ? 'bg-warning' : 'bg-success'
                                    }`}
                                    style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            
                            {container.qr_code && (
                              <div className="text-xs text-base-content/70 font-mono bg-base-300 p-2 rounded">
                                QR: {container.qr_code}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {containerItems.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-base-content/10">
                            <h4 className="font-medium text-base-content mb-2">Items in this container:</h4>
                            <div className="flex flex-wrap gap-1">
                              {containerItems.slice(0, 5).map(item => (
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
                              {containerItems.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{containerItems.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {containerItems.length === 0 && (
                          <div className="mt-4 pt-4 border-t border-base-content/10">
                            <p className="text-base-content/60 text-center py-4">
                              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              This container is empty
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
                  <CardContent className="text-center py-12">
                    <QrCode className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-base-content mb-2">No Containers Yet</h3>
                    <p className="text-base-content/70 mb-4">Create your first container to organize your inventory.</p>
                    <Button 
                      onClick={() => {resetContainerForm(); setShowAddContainerDialog(true);}}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Container
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
