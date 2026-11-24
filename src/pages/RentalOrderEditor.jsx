
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RentalOrder } from '@/entities/RentalOrder';
import { Renter } from '@/entities/Renter';
import { InventoryItem } from '@/entities/InventoryItem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Save, Plus, ArrowLeft, Loader2, FileText, UserPlus, X } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const PENDING_RENTAL_ITEMS_KEY = 'rental-items';

function readPendingRentalItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(PENDING_RENTAL_ITEMS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function clearPendingRentalItems() {
  try {
    localStorage.removeItem(PENDING_RENTAL_ITEMS_KEY);
  } catch {
    /* ignore */
  }
}

export default function RentalOrderEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('id');

  const [order, setOrder] = useState(null);
  const [renters, setRenters] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [showAddRenterDialog, setShowAddRenterDialog] = useState(false);
  const [newRenterData, setNewRenterData] = useState({ name: '', email: '', phone: '', contact_person: '', address: '' });
  const [isSavingRenter, setIsSavingRenter] = useState(false);
  
  const [itemSearch, setItemSearch] = useState('');
  const [isItemPopoverOpen, setIsItemPopoverOpen] = useState(false);

  const rentalDays = useMemo(() => {
    if (!order?.rental_start_date || !order?.rental_end_date) return 0;
    const start = startOfDay(new Date(order.rental_start_date));
    const end = startOfDay(new Date(order.rental_end_date));
    const days = differenceInDays(end, start);
    return days >= 0 ? days + 1 : 1;
  }, [order?.rental_start_date, order?.rental_end_date]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rentersData, itemsData] = await Promise.all([
        Renter.list('-created_date'),
        InventoryItem.filter({ status: 'available' })
      ]);
      setRenters(rentersData);
      setInventoryItems(itemsData);

      let initialOrderData = {
        renter_id: '',
        renter_name: '',
        renter_email: '',
        renter_phone: '', // Added for phone number
        rental_start_date: new Date(),
        rental_end_date: new Date(),
        status: 'quote',
        line_items: [],
        notes: '',
        subtotal: 0,
        damage_waiver_fee: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 0,
        security_deposit: 0,
      };

      if (orderId) {
        const existingOrder = await RentalOrder.get(orderId);
        initialOrderData = {
          ...existingOrder,
          rental_start_date: new Date(existingOrder.rental_start_date),
          rental_end_date: new Date(existingOrder.rental_end_date),
        };
        // Ensure renter contact info is set from the renter record if missing
        if ((!initialOrderData.renter_email || !initialOrderData.renter_phone) && existingOrder.renter_id) {
          const renter = rentersData.find(r => r.id === existingOrder.renter_id);
          if (renter) {
            initialOrderData.renter_email = initialOrderData.renter_email || renter.email || '';
            initialOrderData.renter_phone = initialOrderData.renter_phone || renter.phone || '';
          }
        }
      } else if (location.state?.selectedItems) {
          const newItems = location.state.selectedItems.map(item => ({
            inventory_item_id: item.id,
            item_name: item.name,
            quantity: 1,
            daily_rate: item.rental_rate || 0,
            total_days: 1,
            line_total: (item.rental_rate || 0) * 1,
            notes: ''
          }));
          initialOrderData.line_items = newItems;
      } else {
        // Items picked with the "+ Rental" buttons around the app wait here
        // until the order they belong to is saved.
        initialOrderData.line_items = readPendingRentalItems();
      }
      setOrder(initialOrderData);

    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load necessary data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, location.state?.selectedItems]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const updateOrderField = (field, value) => {
    setOrder(prev => ({ ...prev, [field]: value }));
  };
  
  const handleDateChange = (field, date) => {
    updateOrderField(field, date);
  };
  
  const handleRenterChange = (renterId) => {
      const renter = renters.find(r => r.id === renterId);
      setOrder(prev => ({
          ...prev,
          renter_id: renterId,
          renter_name: renter ? renter.name : '',
          renter_email: renter ? renter.email : '',
          renter_phone: renter ? renter.phone : '' // Also set renter's phone
      }));
  };

  const addLineItem = (item) => {
    const newLineItem = {
      inventory_item_id: item.id,
      item_name: item.name,
      quantity: 1,
      daily_rate: item.rental_rate || 0,
      notes: ''
    };
    setOrder(prev => ({ ...prev, line_items: [...prev.line_items, newLineItem] }));
    setItemSearch('');
    setIsItemPopoverOpen(false);
  };

  const removeLineItem = (index) => {
    setOrder(prev => {
      const line_items = prev.line_items.filter((_, i) => i !== index);
      if (!orderId) {
        // Keep the waiting list of "+ Rental" picks in step with a new order.
        try {
          localStorage.setItem(PENDING_RENTAL_ITEMS_KEY, JSON.stringify(
            readPendingRentalItems().filter(p => line_items.some(li => li.inventory_item_id === p.inventory_item_id))
          ));
        } catch { /* ignore */ }
      }
      return { ...prev, line_items };
    });
  };

  const updateLineItem = (index, field, value) => {
    setOrder(prev => {
      const updatedItems = [...prev.line_items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...prev, line_items: updatedItems };
    });
  };

  // Everything the totals depend on, as one value. The totals are worked out
  // again only when one of these actually changes.
  const totalsKey = order
    ? JSON.stringify([
        order.line_items.map(item => [item.quantity, item.daily_rate]),
        order.tax_rate,
        order.damage_waiver_fee,
        rentalDays,
      ])
    : '';

  useEffect(() => {
    if (!totalsKey) return;
    setOrder(prev => {
      if (!prev) return prev;
      const updatedLineItems = prev.line_items.map(item => ({
        ...item,
        total_days: rentalDays,
        line_total: (Number(item.quantity) || 0) * (Number(item.daily_rate) || 0) * rentalDays
      }));

      const subtotal = updatedLineItems.reduce((sum, item) => sum + item.line_total, 0);
      const tax_amount = subtotal * ((Number(prev.tax_rate) || 0) / 100);
      const total_amount = subtotal + tax_amount + (Number(prev.damage_waiver_fee) || 0);

      return {
        ...prev,
        line_items: updatedLineItems,
        subtotal,
        tax_amount,
        total_amount
      };
    });
  }, [totalsKey, rentalDays]);

  const handleSaveOrder = async () => {
    if (!order.renter_id) {
      alert('Please select a renter.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (orderId) {
        await RentalOrder.update(orderId, order);
      } else {
        await RentalOrder.create(order);
        clearPendingRentalItems();
      }
      navigate(createPageUrl('RentalsDashboard'));
    } catch (err) {
      console.error('Failed to save order:', err);
      setError('Failed to save the order. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewRenter = async (e) => {
      e.preventDefault();
      setIsSavingRenter(true);
      try {
          const newRenter = await Renter.create(newRenterData);
          setRenters(prev => [...prev, newRenter]);
          // Fill the order from the renter we just saved (the list above has
          // not refreshed yet, so it cannot be looked up there).
          setOrder(prev => ({
              ...prev,
              renter_id: newRenter.id,
              renter_name: newRenter.name || '',
              renter_email: newRenter.email || '',
              renter_phone: newRenter.phone || ''
          }));
          setShowAddRenterDialog(false);
          setNewRenterData({ name: '', email: '', phone: '', contact_person: '', address: '' });
      } catch (err) {
          console.error("Failed to add new renter", err);
      } finally {
          setIsSavingRenter(false);
      }
  };
  
  const availableItems = useMemo(() => {
      if(!order) return inventoryItems;
      const selectedIds = new Set(order.line_items.map(li => li.inventory_item_id));
      return inventoryItems.filter(item => !selectedIds.has(item.id));
  }, [inventoryItems, order]);

  if (isLoading || !order) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-1/4 mb-4" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-4 sm:p-6 lg:p-8"> {/* Removed min-h-screen bg-base-100 for better mobile scrolling */}
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
        
        {error && (
            <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-base-content">{orderId ? `Edit ${order.status === 'quote' ? 'Quote' : 'Order'}` : 'Create New Quote'}</CardTitle>
            <CardDescription>Fill out the details below to create or update a rental document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Renter and Dates Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Renter</Label>
                <div className="flex gap-2">
                    <Select value={order.renter_id} onValueChange={handleRenterChange}>
                        <SelectTrigger><SelectValue placeholder="Select a renter..." /></SelectTrigger>
                        <SelectContent>
                            {renters.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Dialog open={showAddRenterDialog} onOpenChange={setShowAddRenterDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon"><UserPlus className="w-4 h-4"/></Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add New Renter</DialogTitle></DialogHeader>
                            <form onSubmit={handleAddNewRenter} className="space-y-4">
                                <div><Label>Name</Label><Input value={newRenterData.name} onChange={e => setNewRenterData({...newRenterData, name: e.target.value})} required/></div>
                                <div><Label>Contact Person</Label><Input value={newRenterData.contact_person} onChange={e => setNewRenterData({...newRenterData, contact_person: e.target.value})}/></div>
                                <div><Label>Email</Label><Input type="email" value={newRenterData.email} onChange={e => setNewRenterData({...newRenterData, email: e.target.value})} required/></div>
                                <div><Label>Phone</Label><Input value={newRenterData.phone} onChange={e => setNewRenterData({...newRenterData, phone: e.target.value})}/></div>
                                <div><Label>Address</Label><Input value={newRenterData.address} onChange={e => setNewRenterData({...newRenterData, address: e.target.value})}/></div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={()=>setShowAddRenterDialog(false)}>Cancel</Button>
                                    <Button type="submit" disabled={isSavingRenter}>
                                        {isSavingRenter ? <Loader2 className="w-4 h-4 animate-spin"/> : "Save Renter"}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
              </div>
              <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={order.status} onValueChange={(val) => updateOrderField('status', val)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="quote">Quote</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="rented_out">Rented Out</SelectItem>
                          <SelectItem value="partially_returned">Partially Returned</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label>Renter Email for Reminders</Label>
                  <Input type="email" value={order.renter_email || ''} onChange={(e) => updateOrderField('renter_email', e.target.value)} placeholder="Enter renter's email"/>
              </div>
              <div className="space-y-2">
                  <Label>Renter Phone</Label>
                  <Input type="tel" value={order.renter_phone || ''} onChange={(e) => updateOrderField('renter_phone', e.target.value)} placeholder="Enter renter's phone number"/>
              </div>
              <div className="space-y-2">
                <Label>Rental Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {order.rental_start_date ? format(order.rental_start_date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={order.rental_start_date} onSelect={(d) => handleDateChange('rental_start_date', d)} initialFocus /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Rental End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {order.rental_end_date ? format(order.rental_end_date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={order.rental_end_date} onSelect={(d) => handleDateChange('rental_end_date', d)} initialFocus /></PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Line Items Section */}
            <div>
                <CardTitle className="text-xl mb-4">Items</CardTitle>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-32">Rate/Day</TableHead>
                            <TableHead className="w-24">Days</TableHead>
                            <TableHead className="w-32 text-right">Total</TableHead>
                            <TableHead className="w-16"> </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.line_items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell><Input type="number" value={item.quantity} onChange={(e) => updateLineItem(index, 'quantity', Number(e.target.value))} className="w-20" min="1" /></TableCell>
                                <TableCell><Input type="number" value={item.daily_rate} onChange={(e) => updateLineItem(index, 'daily_rate', Number(e.target.value))} className="w-28" min="0" step="0.01" /></TableCell>
                                <TableCell>{rentalDays}</TableCell>
                                <TableCell className="text-right">${item.line_total?.toFixed(2)}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => removeLineItem(index)}><X className="w-4 h-4 text-red-500" /></Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Popover open={isItemPopoverOpen} onOpenChange={setIsItemPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="mt-4"><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[300px]">
                        <Command>
                            <CommandInput placeholder="Search for an item..." value={itemSearch} onValueChange={setItemSearch} />
                            <CommandList>
                                <CommandEmpty>No available items found.</CommandEmpty>
                                <CommandGroup>
                                    {availableItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map(item => (
                                        <CommandItem key={item.id} onSelect={() => addLineItem(item)}>
                                            {item.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            
            {/* Totals Section */}
            <div className="flex justify-end">
                <div className="w-full md:w-1/2 space-y-4">
                    <div className="flex justify-between items-center"><Label>Subtotal</Label><span>${order.subtotal?.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center"><Label>Damage Waiver</Label><Input type="number" value={order.damage_waiver_fee} onChange={(e) => updateOrderField('damage_waiver_fee', Number(e.target.value))} className="w-32" /></div>
                    <div className="flex justify-between items-center"><Label>Tax Rate (%)</Label><Input type="number" value={order.tax_rate} onChange={(e) => updateOrderField('tax_rate', Number(e.target.value))} className="w-32" /></div>
                    <div className="flex justify-between items-center"><Label>Tax Amount</Label><span>${order.tax_amount?.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center text-lg font-bold"><Label>Total</Label><span>${order.total_amount?.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center"><Label>Security Deposit</Label><Input type="number" value={order.security_deposit} onChange={(e) => updateOrderField('security_deposit', Number(e.target.value))} className="w-32" /></div>
                </div>
            </div>
            
            {/* Notes Section */}
            <div>
                <Label>Notes</Label>
                <Textarea value={order.notes} onChange={(e) => updateOrderField('notes', e.target.value)} />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button onClick={handleSaveOrder} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                Save {order.status === 'quote' ? 'Quote' : 'Order'}
              </Button>
              <Button variant="secondary" disabled>
                <FileText className="w-4 h-4 mr-2" />
                Generate Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
