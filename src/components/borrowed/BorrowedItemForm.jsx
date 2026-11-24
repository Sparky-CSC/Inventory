
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Save } from 'lucide-react';
import { User } from '@/entities/User'; // Added User import

const categories = ["costume", "prop", "scenery", "equipment", "fabric", "accessory", "lighting", "sound", "furniture"];
const conditions = ["excellent", "good", "fair", "poor", "needs_repair"];

export default function BorrowedItemForm({ item, onSave, onCancel }) { // Changed initialData to item, removed isEditing
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'prop',
    lender_name: '',
    lender_email: '', // Added lender_email
    lender_phone: '', // Added lender_phone
    lender_contact: '',
    borrowed_date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'borrowed',
    condition_borrowed: 'good',
    rental_fee: 0,
    deposit_amount: 0,
    deposit_returned: false,
    notes: '',
    show_production: '',
    received_by: '',
    returned_date: '',
    returned_by: '',
    condition_returned: 'good',
  });
  const [currentUserName, setCurrentUserName] = useState(''); // Added state for current user name

  useEffect(() => {
    if (item) { // Changed initialData to item
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || 'prop',
        lender_name: item.lender_name || '',
        lender_email: item.lender_email || '', // Added lender_email
        lender_phone: item.lender_phone || '', // Added lender_phone
        lender_contact: item.lender_contact || '',
        borrowed_date: item.borrowed_date ? new Date(item.borrowed_date).toISOString().split('T')[0] : '',
        due_date: item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : '',
        status: item.status || 'borrowed',
        condition_borrowed: item.condition_borrowed || 'good',
        rental_fee: item.rental_fee || 0,
        deposit_amount: item.deposit_amount || 0,
        deposit_returned: item.deposit_returned || false,
        notes: item.notes || '',
        show_production: item.show_production || '',
        received_by: item.received_by || '',
        returned_date: item.returned_date ? new Date(item.returned_date).toISOString().split('T')[0] : '',
        returned_by: item.returned_by || '',
        condition_returned: item.condition_returned || 'good',
      });
    }
  }, [item]); // Changed initialData to item

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await User.me();
        setCurrentUserName(user.full_name || user.email);
        if (!item) { // Pre-fill "Received By" for new items
          setFormData(prev => ({ ...prev, received_by: user.full_name || user.email }));
        }
      } catch (error) {
        console.warn("Could not fetch current user for form pre-fill:", error);
      }
    };
    fetchUser();
  }, [item]); // Dependency on item for pre-filling logic

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (name, checked) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm border-base-300 flex flex-col flex-1 min-h-0">
      {/* The form scrolls inside the dialog; the Save / Cancel bar below always stays in view. */}
      <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div>
          <form id="borrowed-item-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Item & Lender Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 p-4 border rounded-lg bg-base-100">
                <h3 className="font-semibold text-lg text-primary">Item Details</h3>
                <div>
                  <Label htmlFor="name">Item Name *</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" value={formData.category} onValueChange={(v) => handleSelectChange('category', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="show_production">For Production/Show</Label>
                  <Input id="show_production" name="show_production" value={formData.show_production} onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-base-100">
                <h3 className="font-semibold text-lg text-primary">Lender & Financials</h3>
                <div>
                  <Label htmlFor="lender_name">Lender Name *</Label>
                  <Input id="lender_name" name="lender_name" value={formData.lender_name} onChange={handleChange} required />
                </div>
                <div>
                  <Label htmlFor="lender_email">Lender Email for Reminders</Label>
                  {/* Ensure value is always a string to prevent React warnings */}
                  <Input id="lender_email" name="lender_email" type="email" value={formData.lender_email || ''} onChange={handleChange} placeholder="Lender's email address" />
                </div>
                <div>
                  <Label htmlFor="lender_phone">Lender Phone</Label>
                  <Input id="lender_phone" name="lender_phone" type="tel" value={formData.lender_phone || ''} onChange={handleChange} placeholder="Lender's phone number" />
                </div>
                <div>
                  <Label htmlFor="lender_contact">Lender Contact (Address, etc.)</Label>
                  <Input id="lender_contact" name="lender_contact" value={formData.lender_contact} onChange={handleChange} placeholder="Address, other contact info" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rental_fee">Rental Fee ($)</Label>
                    <Input id="rental_fee" name="rental_fee" type="number" value={formData.rental_fee} onChange={handleChange} />
                  </div>
                  <div>
                    <Label htmlFor="deposit_amount">Deposit ($)</Label>
                    <Input id="deposit_amount" name="deposit_amount" type="number" value={formData.deposit_amount} onChange={handleChange} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox id="deposit_returned" name="deposit_returned" checked={formData.deposit_returned} onCheckedChange={(c) => handleCheckboxChange('deposit_returned', c)} />
                  <Label htmlFor="deposit_returned">Deposit Returned</Label>
                </div>
              </div>
            </div>
            
            {/* Borrowing & Return Details */}
            <div className="space-y-4 p-4 border rounded-lg bg-base-100">
              <h3 className="font-semibold text-lg text-primary">Borrowing & Return Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="borrowed_date">Borrowed Date *</Label>
                    <Input id="borrowed_date" name="borrowed_date" type="date" value={formData.borrowed_date} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="received_by">Received By</Label>
                    <Input
                      id="received_by"
                      name="received_by"
                      value={formData.received_by}
                      onChange={handleChange}
                      placeholder="Name of person who received it"
                    />
                  </div>
                  <div>
                    <Label htmlFor="condition_borrowed">Condition When Borrowed</Label>
                    <Select name="condition_borrowed" value={formData.condition_borrowed} onValueChange={(v) => handleSelectChange('condition_borrowed', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{conditions.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      name="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={handleChange}
                    />
                  </div>
              </div>

              <hr className="my-4"/>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="returned_date">Returned Date</Label>
                    <Input id="returned_date" name="returned_date" type="date" value={formData.returned_date} onChange={handleChange} />
                  </div>
                  <div>
                    <Label htmlFor="returned_by">Returned By</Label>
                    <Input id="returned_by" name="returned_by" value={formData.returned_by} onChange={handleChange} />
                  </div>
                  <div>
                    <Label htmlFor="condition_returned">Condition When Returned</Label>
                    <Select name="condition_returned" value={formData.condition_returned} onValueChange={(v) => handleSelectChange('condition_returned', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{conditions.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={4} placeholder="Add any notes about the borrowing agreement, special care instructions, etc."/>
            </div>
          </form>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 bg-base-200/80 p-4 rounded-b-xl border-t border-base-300">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="borrowed-item-form"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-content)',
          }}
        >
          <Save className="w-4 h-4 mr-2" />
          {item ? 'Update Item' : 'Save Item'}
        </Button>
      </CardFooter>
    </Card>
  );
}
