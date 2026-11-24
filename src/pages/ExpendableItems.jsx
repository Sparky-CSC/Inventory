
import React, { useState, useEffect } from 'react';
import { ExpendableItem } from '@/entities/ExpendableItem';
import { StockAlert } from '@/entities/StockAlert';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, AlertTriangle, Plus, Edit, Trash2, Save, 
  TrendingDown, DollarSign, Bell
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import BackButton from '../components/shared/BackButton';

const categoryOptions = [
  'makeup', 'fabric', 'adhesives', 'paint', 'batteries', 'consumables', 
  'office_supplies', 'cleaning', 'hardware', 'other'
];

const unitOptions = [
  'pieces', 'yards', 'feet', 'ounces', 'pounds', 'gallons', 
  'liters', 'tubes', 'bottles', 'boxes', 'rolls'
];

export default function ExpendableItems() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other',
    current_quantity: 0,
    unit_of_measure: 'pieces',
    low_stock_threshold: 5,
    supplier: '',
    supplier_contact: '',
    cost_per_unit: 0,
    location: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (err) {
      console.error('Error loading user:', err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const itemsData = await ExpendableItem.list('-created_date');
      setItems(itemsData);

      // Bring the alerts in step with the current stock levels, then show them.
      await checkAndCreateAlerts(itemsData);
      setAlerts(await StockAlert.filter({ is_resolved: false }));
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load expendable items');
    }
    setIsLoading(false);
  };

  const checkAndCreateAlerts = async (itemsData) => {
    const allAlerts = await StockAlert.list();
    const itemIds = new Set(itemsData.map(item => item.id));

    // Alerts for items that have since been deleted are closed quietly.
    for (const alert of allAlerts) {
      if (!alert.is_resolved && !itemIds.has(alert.expendable_item_id)) {
        await StockAlert.update(alert.id, { is_resolved: true, resolved_date: new Date().toISOString() });
      }
    }

    for (const item of itemsData) {
      const itemAlerts = allAlerts.filter(alert => alert.expendable_item_id === item.id);
      const openAlerts = itemAlerts.filter(alert => !alert.is_resolved);
      const isLow = Number(item.current_quantity) <= Number(item.low_stock_threshold);

      if (!isLow) {
        // Restocked: any open alert for this item is no longer needed.
        for (const alert of openAlerts) {
          await StockAlert.update(alert.id, { is_resolved: true, resolved_date: new Date().toISOString() });
        }
        continue;
      }

      if (openAlerts.length > 0) continue;

      // An acknowledged alert stays quiet until the item's stock changes again.
      const itemChangedAt = new Date(item.updated_date || item.created_date || 0).getTime();
      const alreadyHandled = itemAlerts.some(alert =>
        alert.is_resolved && new Date(alert.created_date || 0).getTime() >= itemChangedAt
      );
      if (alreadyHandled) continue;

      try {
        await StockAlert.create({
          expendable_item_id: item.id,
          alert_type: Number(item.current_quantity) === 0 ? 'out_of_stock' : 'low_stock',
          message: `${item.name} is ${Number(item.current_quantity) === 0 ? 'out of stock' : 'running low'} (${item.current_quantity} ${item.unit_of_measure} remaining)`
        });
      } catch (err) {
        console.error('Error creating alert:', err);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'other',
      current_quantity: 0,
      unit_of_measure: 'pieces',
      low_stock_threshold: 5,
      supplier: '',
      supplier_contact: '',
      cost_per_unit: 0,
      location: '',
      notes: ''
    });
    setEditingItem(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingItem) {
        await ExpendableItem.update(editingItem.id, formData);
      } else {
        await ExpendableItem.create(formData);
      }
      setShowAddDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      setError('Failed to save item');
      console.error('Error saving item:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      category: item.category || 'other',
      current_quantity: item.current_quantity || 0,
      unit_of_measure: item.unit_of_measure || 'pieces',
      low_stock_threshold: item.low_stock_threshold || 5,
      supplier: item.supplier || '',
      supplier_contact: item.supplier_contact || '',
      cost_per_unit: item.cost_per_unit || 0,
      location: item.location || '',
      notes: item.notes || ''
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (itemId) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await ExpendableItem.delete(itemId);
      loadData();
    } catch (error) {
      setError('Failed to delete item');
      console.error('Error deleting item:', error);
    }
  };

  const updateQuantity = async (item, change) => {
    const newQuantity = Math.max(0, item.current_quantity + change);
    try {
      await ExpendableItem.update(item.id, { ...item, current_quantity: newQuantity });
      loadData();
    } catch (error) {
      setError('Failed to update quantity');
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await StockAlert.update(alertId, {
        acknowledged_by: currentUser?.email,
        acknowledged_date: new Date().toISOString(),
        is_resolved: true,
        resolved_date: new Date().toISOString()
      });
      loadData();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const getLowStockItems = () => items.filter(item => item.current_quantity <= item.low_stock_threshold);
  const getOutOfStockItems = () => items.filter(item => item.current_quantity === 0);

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content mb-2 flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              Expendable Items
            </h1>
            <p className="text-primary font-medium">
              Track consumable items and manage stock levels
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="items" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="items">All Items</TabsTrigger>
            <TabsTrigger value="alerts" className="relative">
              Alerts 
              {alerts.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                  {alerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* All Items Tab */}
          <TabsContent value="items" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{items.length}</div>
                  <div className="text-sm text-base-content/70">Total Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">{getLowStockItems().length}</div>
                  <div className="text-sm text-base-content/70">Low Stock</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-error">{getOutOfStockItems().length}</div>
                  <div className="text-sm text-base-content/70">Out of Stock</div>
                </div>
              </div>

              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingItem ? 'Edit Expendable Item' : 'Add New Expendable Item'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Item Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          placeholder="e.g., Stage Makeup"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map(cat => (
                              <SelectItem key={cat} value={cat} className="capitalize">
                                {cat.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Description of the item..."
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="current_quantity">Current Quantity *</Label>
                        <Input
                          id="current_quantity"
                          type="number"
                          min="0"
                          value={formData.current_quantity}
                          onChange={(e) => handleInputChange('current_quantity', parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit of Measure</Label>
                        <Select value={formData.unit_of_measure} onValueChange={(value) => handleInputChange('unit_of_measure', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {unitOptions.map(unit => (
                              <SelectItem key={unit} value={unit} className="capitalize">
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="low_stock_threshold">Low Stock Alert *</Label>
                        <Input
                          id="low_stock_threshold"
                          type="number"
                          min="0"
                          value={formData.low_stock_threshold}
                          onChange={(e) => handleInputChange('low_stock_threshold', parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="supplier">Supplier</Label>
                        <Input
                          id="supplier"
                          value={formData.supplier}
                          onChange={(e) => handleInputChange('supplier', e.target.value)}
                          placeholder="Supplier name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="supplier_contact">Supplier Contact</Label>
                        <Input
                          id="supplier_contact"
                          value={formData.supplier_contact}
                          onChange={(e) => handleInputChange('supplier_contact', e.target.value)}
                          placeholder="Phone, email, or website"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cost_per_unit">Cost per Unit ($)</Label>
                        <Input
                          id="cost_per_unit"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.cost_per_unit}
                          onChange={(e) => handleInputChange('cost_per_unit', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Storage Location</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          placeholder="Where is this stored?"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        placeholder="Additional notes..."
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                      <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-primary hover:bg-primary-focus text-primary-content">
                        <Save className="w-4 h-4 mr-2" />
                        {editingItem ? 'Save Changes' : 'Create Item'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
              ) : (
                items.map(item => (
                  <Card key={item.id} className="bg-base-200/50 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-base-content">{item.name}</h3>
                            <Badge variant="outline" className="capitalize">
                              {item.category.replace('_', ' ')}
                            </Badge>
                            {item.current_quantity <= item.low_stock_threshold && (
                              <Badge variant={item.current_quantity === 0 ? 'destructive' : 'secondary'}>
                                {item.current_quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-base-content/70 mb-2">{item.description}</p>
                          <div className="flex items-center gap-6 text-sm text-base-content/80">
                            <span><strong>Stock:</strong> {item.current_quantity} {item.unit_of_measure}</span>
                            <span><strong>Alert at:</strong> {item.low_stock_threshold} {item.unit_of_measure}</span>
                            {item.supplier && <span><strong>Supplier:</strong> {item.supplier}</span>}
                            {item.location && <span><strong>Location:</strong> {item.location}</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 mr-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item, -1)}
                              disabled={item.current_quantity === 0}
                            >
                              -
                            </Button>
                            <span className="font-mono font-semibold px-2">{item.current_quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item, 1)}
                            >
                              +
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-error hover:bg-error/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <Card className="bg-base-200/50">
                  <CardContent className="p-8 text-center">
                    <Bell className="w-12 h-12 text-base-content/30 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-base-content">No Active Alerts</h3>
                    <p className="text-base-content/70">All your expendable items are well-stocked!</p>
                  </CardContent>
                </Card>
              ) : (
                alerts.map(alert => (
                  <Card key={alert.id} className="bg-base-200/50 border-l-4 border-l-warning">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-warning" />
                          <div>
                            <p className="font-medium text-base-content">{alert.message}</p>
                            <p className="text-sm text-base-content/70">
                              Created {new Date(alert.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-base-200/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-warning" />
                    Low Stock Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getLowStockItems().slice(0, 5).map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="text-warning">{item.current_quantity} {item.unit_of_measure}</span>
                      </div>
                    ))}
                    {getLowStockItems().length === 0 && (
                      <p className="text-success">All items are well-stocked!</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-base-200/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Total Inventory Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    ${items.reduce((sum, item) => sum + (item.current_quantity * (item.cost_per_unit || 0)), 0).toFixed(2)}
                  </div>
                  <p className="text-sm text-base-content/70 mt-1">
                    Across {items.length} items
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-base-200/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-secondary" />
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(
                      items.reduce((acc, item) => {
                        acc[item.category] = (acc[item.category] || 0) + 1;
                        return acc;
                      }, {})
                    ).slice(0, 5).map(([category, count]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span className="capitalize">{category.replace('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
