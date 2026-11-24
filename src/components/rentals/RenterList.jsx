import React, { useState } from 'react';
import { Renter } from '@/entities/Renter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export default function RenterList({ renters, isLoading, onRenterUpdated }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRenter, setEditingRenter] = useState(null);
  const [renterForm, setRenterForm] = useState({ name: '', email: '', phone: '', contact_person: '', address: '' });

  const handleEdit = (renter) => {
    setEditingRenter(renter);
    setRenterForm(renter);
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditingRenter(null);
    setRenterForm({ name: '', email: '', phone: '', contact_person: '', address: '' });
    setShowDialog(true);
  };
  
  const handleSave = async (e) => {
    e.preventDefault();
    try {
        if (editingRenter) {
            await Renter.update(editingRenter.id, renterForm);
        } else {
            await Renter.create(renterForm);
        }
        setShowDialog(false);
        if(onRenterUpdated) {
          onRenterUpdated();
        }
    } catch (error) {
        console.error("Failed to save renter", error);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle>Renters</CardTitle>
          <CardDescription>Manage your list of renters.</CardDescription>
        </div>
        <Button onClick={handleNew}><Plus className="w-4 h-4 mr-2" /> Add Renter</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renters && renters.length > 0 ? (
              renters.map(renter => (
                <TableRow key={renter.id}>
                  <TableCell className="font-medium">{renter.name}</TableCell>
                  <TableCell>{renter.contact_person}</TableCell>
                  <TableCell>{renter.email}</TableCell>
                  <TableCell>{renter.phone}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(renter)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan="5" className="text-center">No renters found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingRenter ? 'Edit Renter' : 'Add New Renter'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
                <div><Label>Name</Label><Input value={renterForm.name} onChange={e => setRenterForm({...renterForm, name: e.target.value})} required/></div>
                <div><Label>Contact Person</Label><Input value={renterForm.contact_person} onChange={e => setRenterForm({...renterForm, contact_person: e.target.value})}/></div>
                <div><Label>Email</Label><Input type="email" value={renterForm.email} onChange={e => setRenterForm({...renterForm, email: e.target.value})} required/></div>
                <div><Label>Phone</Label><Input value={renterForm.phone} onChange={e => setRenterForm({...renterForm, phone: e.target.value})}/></div>
                <div><Label>Address</Label><Input value={renterForm.address} onChange={e => setRenterForm({...renterForm, address: e.target.value})}/></div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setShowDialog(false)}>Cancel</Button><Button type="submit">Save</Button></div>
            </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}