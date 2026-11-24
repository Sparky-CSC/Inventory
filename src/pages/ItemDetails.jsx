
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


import {
  ArrowLeft, Edit, Trash2, Package, Archive, DollarSign, Tag, Info, AlertTriangle,
  QrCode, Sparkles, Printer, Heart
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPageUrl, getAppUrl } from '@/utils';
import { useData } from '../components/shared/DataManager';
import QRCodeGenerator from '../components/shared/QRCodeGenerator';
import AddToRentalButton from '../components/inventory/AddToRentalButton';
import ItemQRScanner from '../components/inventory/ItemQRScanner'; // New import


import { useUserData } from '../components/shared/UserDataContext';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // New import for Tabs
import BackButton from '../components/shared/BackButton';
import ActivityTimeline from '../components/shared/ActivityTimeline';

export default function ItemDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const itemId = params.get('id');

  const { currentUser, reloadUserData } = useUserData();
  const { containers: allContainers = [] } = useData();

  const [item, setItem] = useState(location.state?.item || null);
  const [itemLocation, setItemLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(!location.state?.item);
  const [error, setError] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false); // New state

  const statusConfig = {
    available: { label: 'Available', icon: Package, className: 'border-success/50 bg-success/10 text-success' },
    in_use: { label: 'In Use', icon: Tag, className: 'border-info/50 bg-info/10 text-info-content' },
    rented: { label: 'Rented', icon: DollarSign, className: 'border-secondary/50 bg-secondary/10 text-secondary-content' },
    retired: { label: 'Retired', icon: Archive, className: 'border-warning/50 bg-warning/10 text-warning-content' },
    maintenance: { label: 'Maintenance', icon: AlertTriangle, className: 'border-error/50 bg-error/10 text-error' },
    default: { label: 'Unknown', icon: Info, className: 'border-base-300 bg-base-200 text-base-content/80' },
  };

  const conditionConfig = {
    excellent: { label: 'Excellent', icon: Sparkles, className: 'border-success/50 bg-success/10 text-success' },
    good: { label: 'Good', icon: Package, className: 'border-success/50 bg-success/10 text-success' },
    fair: { label: 'Fair', icon: AlertTriangle, className: 'border-warning/50 bg-warning/10 text-warning-content' },
    poor: { label: 'Poor', icon: Trash2, className: 'border-error/50 bg-error/10 text-error' },
    default: { label: 'Unknown', icon: Info, className: 'border-base-300 bg-base-200 text-base-content/80' },
  };

  const conditionClasses = Object.entries(conditionConfig).reduce((acc, [key, value]) => {
      acc[key] = value.className;
      return acc;
  }, {});

  useEffect(() => {
    if (!itemId) {
      setError("No item ID provided.");
      setIsLoading(false);
      return;
    }

    const params = new URLSearchParams(location.search);
    const uidFromUrl = params.get('uid');
    
    const initialItem = location.state?.item;
    if (initialItem && initialItem.id === itemId) {
      setItem(initialItem);
      loadRelatedData(initialItem);
      if (currentUser) {
        import('@/entities/FavoriteItem').then(({ FavoriteItem }) => {
          FavoriteItem.filter({ user_id: currentUser.id, inventory_item_id: initialItem.id })
            .then(favs => setIsFavorited(favs.length > 0))
            .catch(err => console.error("Error checking favorite status:", err));
        });
      }
    } else {
      loadItemDetails(uidFromUrl);
    }
  }, [itemId, location.search, location.state?.item, currentUser]);

  const loadRelatedData = async (itemData) => {
    try {
      let locationData = null;
      if (itemData.location) {
          const { Location } = await import('@/entities/Location');
          const results = await Location.filter({ name: itemData.location }).catch(() => []);
          if(results.length > 0) locationData = results[0];
      }
      setItemLocation(locationData);
    } catch (err) {
      console.error('Error loading related data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const loadItemDetails = async (uid = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const { InventoryItem } = await import('@/entities/InventoryItem'); // Dynamic import
      const itemData = await InventoryItem.get(itemId);
      if (!itemData) {
        setError('Item not found.');
        setItem(null);
        setIsLoading(false);
        return;
      }

      if (uid && itemData.uid && itemData.uid !== uid) {
        setError('Item UID mismatch. This may be an outdated QR code.');
      }

      setItem(itemData);
      if (currentUser) {
        const { FavoriteItem } = await import('@/entities/FavoriteItem'); // Dynamic import
        const favorited = await FavoriteItem.filter({
          user_id: currentUser.id,
          inventory_item_id: itemData.id,
        });
        setIsFavorited(favorited.length > 0);
      }
      await loadRelatedData(itemData);
    } catch (err) {
      console.error('Error loading item details:', err);
      setError('Failed to load item details.');
      setIsLoading(false);
    }
  };

  const handleUpdateItem = async (formData) => {
    try {
      const { InventoryItem } = await import('@/entities/InventoryItem'); // Dynamic import
      await InventoryItem.update(item.id, formData);
      loadItemDetails();
    } catch (err) {
      console.error("Error updating item:", err);
      setError("Failed to update item.");
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentUser || isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      const { FavoriteItem } = await import('@/entities/FavoriteItem'); // Dynamic import
      if (isFavorited) {
        const favorites = await FavoriteItem.filter({
          user_id: currentUser.id,
          inventory_item_id: item.id,
        });
        if (favorites.length > 0) {
          await FavoriteItem.delete(favorites[0].id);
        }
      } else {
        await FavoriteItem.create({
          user_id: currentUser.id,
          inventory_item_id: item.id,
          item_name: item.name,
          item_category: item.category || (item.categories && item.categories[0])
        });
      }
      await reloadUserData();
      setIsFavorited(!isFavorited);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { InventoryItem } = await import('@/entities/InventoryItem'); // Dynamic import
      await InventoryItem.delete(item.id);
      navigate(createPageUrl('Inventory'));
    }
    catch (err) {
      setError("Failed to delete item.");
    }
  };

  const handlePrintHangTag = () => {
    navigate(createPageUrl('PrintHangTags'), { state: { items: [item] } });
  };

  const handleQRCodeUpdate = async (newQRCode) => { // New function
    try {
      const { InventoryItem } = await import('@/entities/InventoryItem'); // Dynamic import
      await InventoryItem.update(item.id, { qr_code: newQRCode });
      setItem(prev => ({ ...prev, qr_code: newQRCode }));
      setShowQRScanner(false);
    } catch (error) {
      console.error("Failed to update QR code:", error);
      setError("Failed to update QR code.");
    }
  };

  const categoryLabel = (cat) => cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '';

  const renderKeyValue = (label, value) => {
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null;
      return (
          <div>
              <p className="text-xs font-semibold text-base-content/60">{label}</p>
              {typeof value === 'string' || typeof value === 'number' ?
                  <p className="text-base-content break-words">{value}</p> :
                  value // If value is already JSX
              }
          </div>
      );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-4 bg-gray-200" />
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full bg-gray-200" />
              <Skeleton className="h-48 w-full bg-gray-200" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-32 w-full bg-gray-200" />
              <Skeleton className="h-32 w-full bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Button onClick={() => navigate(createPageUrl('Inventory'))} className="bg-blue-600 hover:bg-blue-700 text-white">
            Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600 text-lg mb-4">Item data is not available.</p>
          <Button onClick={() => navigate(createPageUrl('Inventory'))} className="bg-blue-600 hover:bg-blue-700 text-white">
            Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

  const {
      name, description, categories, subcategory, condition, status, size, color, material,
      time_period, style, value, rental_rate, acquisition_date, last_cleaned, notes,
      quantity, model_number, serial_number, uid, qr_code,
      photos, variants, parts, dimensions, measurements, production_history // Added these for new structure
  } = item;

  const isCostume = (categories && categories.includes('costume')) || subcategory === 'costume';

  const container = allContainers ? allContainers.find(c => c.id === item.container_id) : null;
  const containerName = container ? `${container.name} (${container.location})` : 'N/A';

  const itemUrl = qr_code || getAppUrl(`ItemDetails?id=${item.id}${uid ? `&uid=${uid}` : ''}`);
  
  const renderContent = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {/* Main Details Card */}
        <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
          <CardHeader>
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-2xl font-bold text-base-content">{item.name}</h2>
                <p className="text-base-content/70 whitespace-pre-wrap mt-2">{item.description}</p>
              </div>
              {item.qr_code && (
                <div className="flex-shrink-0">
                  <QRCodeGenerator data={item.qr_code} size={80} />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {renderKeyValue('UID', uid && <code className="text-xs bg-base-300 p-1 rounded">{uid}</code>)}
              {renderKeyValue('Quantity', quantity)}
              {renderKeyValue('Categories', 
                <div className="flex flex-wrap gap-2">
                  {(categories || []).map(cat => <Badge key={cat} variant="secondary">{categoryLabel(cat)}</Badge>)}
                </div>
              )}
              {renderKeyValue('Subcategory', subcategory)}
              {renderKeyValue('Condition', condition && <Badge variant="outline" className={conditionClasses[condition]}>{condition}</Badge>)}
              {renderKeyValue('Status', status && <Badge variant="outline">{status}</Badge>)}
              {renderKeyValue('Location', itemLocation?.name || 'N/A')}
              {renderKeyValue('Container', containerName)}
            </div>
          </CardContent>
        </Card>
        
        {/* Tabs for more details */}
        <Tabs defaultValue="photos" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="photos">Photos ({(photos || []).length})</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="variants">Variants ({(variants || []).length})</TabsTrigger>
            <TabsTrigger value="parts">Parts ({(parts || []).length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos" className="mt-4">
            <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
              <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
              <CardContent>
                {(photos || []).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(photos || []).map((photo, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img src={photo.url} alt={photo.caption || `Item photo ${index + 1}`} className="w-full h-full object-cover rounded-lg"/>
                        {photo.is_primary && <Badge className="absolute top-2 left-2">Primary</Badge>}
                        {photo.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 rounded-b-lg truncate">{photo.caption}</div>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-base-content/70">No photos available for this item.</p>}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Details Tab */}
          <TabsContent value="details" className="mt-4">
            <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
              <CardHeader><CardTitle>Physical & Historical Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {renderKeyValue('Color', color)}
                {renderKeyValue('Material', material)}
                {renderKeyValue('Size', size)}
                {renderKeyValue('Dimensions', dimensions)}
                {isCostume && renderKeyValue('Measurements', 
                  <ul className="list-disc list-inside">
                    {Object.entries(measurements || {}).map(([key, value]) => value && <li key={`${key}-${value}`}><span className="font-semibold capitalize">{key}:</span> {value}</li>)}
                  </ul>
                )}
                {renderKeyValue('Time Period', time_period)}
                {renderKeyValue('Style', style)}
                {renderKeyValue('Model Number', model_number)}
                {renderKeyValue('Serial Number', serial_number)}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Variants Tab */}
          <TabsContent value="variants" className="mt-4">
            <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
              <CardHeader><CardTitle>Item Variants</CardTitle></CardHeader>
              <CardContent>
                {(variants || []).length > 0 ? (
                  <div className="space-y-4">
                    {(variants || []).map((variant, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-base-100/50">
                        <h4 className="font-semibold text-base-content">{variant.size || `Variant ${index+1}`}</h4>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          {renderKeyValue('SKU', variant.sku)}
                          {renderKeyValue('Quantity', variant.quantity)}
                          {renderKeyValue('Condition', variant.condition)}
                          {renderKeyValue('Status', variant.status)}
                          {renderKeyValue('Location', variant.location)}
                          {renderKeyValue('Container', (allContainers || []).find(c => c.id === variant.container_id)?.name)}
                        </div>
                        {variant.description && <p className="mt-2 text-sm text-base-content/70">{variant.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-base-content/70">This item has no defined variants.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Parts Tab */}
          <TabsContent value="parts" className="mt-4">
            <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
              <CardHeader><CardTitle>Component Parts</CardTitle></CardHeader>
              <CardContent>
                {(parts || []).length > 0 ? (
                  <div className="space-y-4">
                    {(parts || []).map((part, index) => (
                      <div key={index} className="p-3 border rounded-lg bg-base-100/50">
                        <h4 className="font-semibold text-base-content">{part.name}</h4>
                        <p className="text-sm text-base-content/70">{part.description}</p>
                        <p className="text-sm mt-1">Condition: <Badge variant="outline">{part.condition}</Badge></p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-base-content/70">This item has no listed component parts.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <Card className="bg-base-200/50 backdrop-blur-sm border-base-300">
              <CardHeader><CardTitle>Usage History</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-6">
                  <h4 className="font-semibold text-base-content mb-2">Acquisition</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    {renderKeyValue('Acquired On', acquisition_date && format(new Date(acquisition_date), 'PPP'))}
                    {renderKeyValue('Estimated Value', value ? `$${Number(value).toFixed(2)}` : 'N/A')}
                    {renderKeyValue('Rental Rate', rental_rate ? `$${Number(rental_rate).toFixed(2)} / day` : 'N/A')}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-base-content mb-2">Production History</h4>
                  {(production_history || []).length > 0 ? (
                    <div className="space-y-3">
                      {(production_history || []).map((entry, index) => (
                        <div key={index} className="p-3 border rounded-lg bg-base-100/50 text-sm">
                          <p className="font-semibold">{entry.production_name}</p>
                          <p>As: {entry.role_character}</p>
                          <p>Dates: {entry.start_date} to {entry.end_date}</p>
                          {entry.notes && <p className="text-xs mt-1 text-base-content/70">Notes: {entry.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-base-content/70 text-sm">No production history recorded for this item.</p>}
                </div>
                <div className="mt-6">
                  <h4 className="font-semibold text-base-content mb-2">Activity</h4>
                  {(item.last_audited_at || item.current_rental) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                      {item.last_audited_at && renderKeyValue('Last counted', `${format(new Date(item.last_audited_at), 'PPP')}${item.last_audited_location ? ` in ${item.last_audited_location}` : ''}`)}
                      {item.current_rental && renderKeyValue('Out on rental', `${item.current_rental.renter_name || 'Renter'}${item.current_rental.due_date ? `, due ${format(new Date(item.current_rental.due_date), 'PP')}` : ''}`)}
                    </div>
                  )}
                  <ActivityTimeline recordId={item.id} emptyText="No activity recorded yet. Moves, status changes, rentals and counts will appear here." />
                </div>
                <div className="mt-6">
                   <h4 className="font-semibold text-base-content mb-2">Notes</h4>
                   <p className="text-sm text-base-content/70 whitespace-pre-wrap">{notes || 'No additional notes.'}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Column for Actions & Item Identification */}
      <div className="lg:col-span-1 space-y-6">
        {/* Actions Card */}
        <div className="bg-base-200/50 backdrop-blur-sm rounded-2xl p-4 shadow-md border border-base-300">
            <h3 className="text-lg font-semibold text-base-content mb-3">Actions</h3>
            <div className="grid grid-cols-1 gap-3">
                <AddToRentalButton item={item} className="w-full" />

                <Button variant="outline" onClick={handleToggleFavorite} disabled={isTogglingFavorite}>
                  <Heart className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-current text-error' : ''}`} />
                  {isFavorited ? 'Favorited' : 'Favorite'}
                </Button>

                <Button variant="outline" onClick={handlePrintHangTag}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Hang Tag
                </Button>

                <Button variant="outline" onClick={() => setShowQRScanner(true)}>
                  <QrCode className="w-4 h-4 mr-2" />
                  Update QR Code
                </Button>

                <Button variant="outline" onClick={() => navigate(createPageUrl('AddItem'), { state: { editItem: item } })}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Item
                </Button>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Are you sure?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. This will permanently delete the item "{name}".
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2">
                      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      <Button variant="destructive" onClick={handleDelete}>Confirm Delete</Button>
                    </div>
                  </DialogContent>
                </Dialog>
            </div>
        </div>

        {/* Item Identification (QR Code) Card */}
        <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    <span>Item Identification</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="max-w-full">
                    <Label className="text-xs text-base-content/70">Unique ID (UID)</Label>
                    <p className="font-mono text-lg font-semibold text-base-content break-all">{uid || "Not Assigned"}</p>
                </div>
                <div className="max-w-full">
                    <Label className="text-xs text-base-content/70">Database ID</Label>
                    <p className="font-mono text-sm text-base-content break-all">{item.id}</p>
                </div>
                {qr_code ? (
                    <QRCodeGenerator data={qr_code} title={name} size={150} />
                ) : (
                    <div className="space-y-2">
                        <p className="text-base-content/70">No specific QR Code data provided for this item.</p>
                        <QRCodeGenerator data={itemUrl} title={`Item ID: ${item.id}`} size={150} className="opacity-50" />
                        <p className="text-xs text-base-content/60">This QR links directly to this item's details page.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>

        {renderContent()}
      </div>

      {/* QR Scanner Dialog */}
      <ItemQRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onQRCodeAssigned={handleQRCodeUpdate}
        currentQRCode={item.qr_code}
      />
    </div>
  );
}
