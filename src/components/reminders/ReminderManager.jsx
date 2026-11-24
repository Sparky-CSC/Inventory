
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReminderSchedule } from '@/entities/ReminderSchedule';
import { RentalOrder } from '@/entities/RentalOrder';
import { BorrowedItem } from '@/entities/BorrowedItem';
// This import seems unused in the provided logic, but kept as per original.
import { Bell, Clock, AlertTriangle, CheckCircle, XCircle, Info, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { generateDueReminders } from '@/lib/reminders';

// Value for a <input type="datetime-local"> in the person's own time zone.
const toLocalInputValue = (date) => format(date, "yyyy-MM-dd'T'HH:mm");

export default function ReminderManager() {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderFormData, setReminderFormData] = useState({});

  const [relatedEntities, setRelatedEntities] = useState({ rental_orders: [], borrowed_items: [] });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Prepare reminders for anything that has reached its reminder date.
      try {
        await generateDueReminders();
      } catch (generateError) {
        console.warn("Could not prepare automatic reminders:", generateError);
      }
      const [remindersData, rentalOrdersData, borrowedItemsData] = await Promise.all([
        ReminderSchedule.list('-scheduled_date'),
        RentalOrder.list(),
        BorrowedItem.list()
      ]);
      setReminders(remindersData);
      setRelatedEntities({
        rental_orders: rentalOrdersData.filter(o => o.status !== 'completed' && o.status !== 'cancelled'),
        borrowed_items: borrowedItemsData.filter(i => i.status !== 'returned'),
      });
    } catch (err) {
      console.error("Failed to load reminder data:", err);
      setError("Could not load reminders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const resetForm = () => {
    setEditingReminder(null);
    setReminderFormData({});
    setIsDialogOpen(false);
  };

  const handleNewReminderClick = () => {
    setEditingReminder(null);
    setReminderFormData({
      entity_type: 'rental_order',
      reminder_type: 'return_due', // This field is not used in the form or display, but kept as per original default.
      status: 'scheduled',
      scheduled_date: toLocalInputValue(new Date())
    });
    setIsDialogOpen(true);
  };

  const handleEditReminderClick = (reminder) => {
    setEditingReminder(reminder);
    setReminderFormData({
      ...reminder,
      scheduled_date: toLocalInputValue(new Date(reminder.scheduled_date)),
    });
    setIsDialogOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setReminderFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEntityTypeChange = (type) => {
    setReminderFormData(prev => ({
        ...prev,
        entity_type: type,
        entity_id: '',
        recipient_email: '',
        recipient_name: ''
    }));
  };

  const handleEntityChange = (id) => {
    const { entity_type } = reminderFormData;
    let entity;
    if (entity_type === 'rental_order') {
        entity = relatedEntities.rental_orders.find(e => e.id === id);
        if (entity) {
            setReminderFormData(prev => ({ ...prev, entity_id: id, recipient_email: entity.renter_email, recipient_name: entity.renter_name }));
        }
    } else { // entity_type === 'borrowed_item'
        entity = relatedEntities.borrowed_items.find(e => e.id === id);
        if (entity) {
            setReminderFormData(prev => ({ ...prev, entity_id: id, recipient_email: entity.lender_email, recipient_name: entity.lender_name }));
        }
    }
  };

  const handleSaveReminder = async (e) => {
    e.preventDefault();
    const dataToSave = {
        ...reminderFormData,
        scheduled_date: new Date(reminderFormData.scheduled_date).toISOString()
    };

    try {
      if (editingReminder) {
        await ReminderSchedule.update(editingReminder.id, dataToSave);
      } else {
        await ReminderSchedule.create(dataToSave);
      }
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save reminder:", err);
      setError("Failed to save reminder.");
    }
  };

  const handleDeleteReminder = async (id) => {
    if (window.confirm("Are you sure you want to delete this reminder?")) {
      try {
        await ReminderSchedule.delete(id);
        loadData();
      } catch (err) {
        console.error("Failed to delete reminder:", err);
        setError("Failed to delete reminder.");
      }
    }
  };

  // Reminders are sent from your own email program: this opens a new message
  // with the recipient, subject and text filled in, then marks it as sent.
  const handleSendReminder = async (reminder) => {
    const mailto = `mailto:${encodeURIComponent(reminder.recipient_email || '')}` +
      `?subject=${encodeURIComponent(reminder.message_subject || '')}` +
      `&body=${encodeURIComponent(reminder.message_body || '')}`;
    window.location.href = mailto;
    try {
      await ReminderSchedule.update(reminder.id, { status: 'sent', sent_date: new Date().toISOString() });
      loadData();
    } catch (err) {
      console.error("Failed to mark reminder as sent:", err);
      setError("The email was opened, but the reminder could not be marked as sent.");
    }
  };

  const statusMap = {
    scheduled: { icon: Clock, color: 'bg-blue-100 text-blue-800' },
    sent: { icon: CheckCircle, color: 'bg-green-100 text-green-800' },
    failed: { icon: XCircle, color: 'bg-red-100 text-red-800' },
    cancelled: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800' },
  };
  
  const getEntityName = (reminder) => {
    const { entity_type, entity_id } = reminder;
    if (entity_type === 'rental_order') {
        const order = relatedEntities.rental_orders.find(e => e.id === entity_id);
        return order ? `Order #${order.quote_number || order.id.slice(-4)}` : 'Unknown Order';
    } else { // entity_type === 'borrowed_item'
        const item = relatedEntities.borrowed_items.find(e => e.id === entity_id);
        return item ? item.name : 'Unknown Borrowed Item';
    }
  };

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Active & Upcoming Reminders</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewReminderClick}>
              <Bell className="w-4 h-4 mr-2" /> New Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Create New Reminder'}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1">
              <form onSubmit={handleSaveReminder} className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entity_type">Reminder For</Label>
                    <Select value={reminderFormData.entity_type} onValueChange={handleEntityTypeChange}>
                      <SelectTrigger id="entity_type"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rental_order">Rental Order</SelectItem>
                        <SelectItem value="borrowed_item">Borrowed Item</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="entity_id">Select Specific Item/Order</Label>
                    <Select value={reminderFormData.entity_id} onValueChange={handleEntityChange}>
                      <SelectTrigger id="entity_id"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {reminderFormData.entity_type === 'rental_order' ?
                          relatedEntities.rental_orders.map(o => <SelectItem key={o.id} value={o.id}>{o.renter_name} - {o.quote_number || o.id.slice(-4)}</SelectItem>) :
                          relatedEntities.borrowed_items.map(i => <SelectItem key={i.id} value={i.id}>{i.name} - {i.lender_name}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                      <Label htmlFor="recipient_name">Recipient Name</Label>
                      <Input id="recipient_name" name="recipient_name" value={reminderFormData.recipient_name || ''} onChange={handleFormChange} />
                  </div>
                  <div>
                      <Label htmlFor="recipient_email">Recipient Email</Label>
                      <Input id="recipient_email" name="recipient_email" type="email" value={reminderFormData.recipient_email || ''} onChange={handleFormChange} required/>
                  </div>
                </div>

                <div>
                  <Label htmlFor="message_subject">Subject</Label>
                  <Input id="message_subject" name="message_subject" value={reminderFormData.message_subject || ''} onChange={handleFormChange} required />
                </div>
                <div>
                  <Label htmlFor="message_body">Message</Label>
                  <Textarea id="message_body" name="message_body" value={reminderFormData.message_body || ''} onChange={handleFormChange} rows={6} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scheduled_date">Scheduled Send Date</Label>
                    <Input id="scheduled_date" name="scheduled_date" type="datetime-local" value={reminderFormData.scheduled_date || ''} onChange={handleFormChange} required />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" value={reminderFormData.status} onValueChange={(v) => handleFormChange({target: {name: 'status', value: v}})}>
                      <SelectTrigger id="status"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button type="submit">Save Reminder</Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-base-content/70 mb-4">
          Reminders are prepared automatically when a rental or borrowed item reaches the reminder date set under
          Reminder Settings. Press <strong>Send</strong> to open your email program with the message filled in.
        </p>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[150px]">Recipient</TableHead>
                <TableHead className="min-w-[150px]">Related To</TableHead>
                <TableHead className="min-w-[180px]">Scheduled For</TableHead>
                <TableHead className="min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full bg-base-300"/></TableCell></TableRow>
                ))
              ) : reminders.length > 0 ? (
                reminders.map(reminder => {
                  const StatusIcon = statusMap[reminder.status]?.icon || Info;
                  return (
                    <TableRow key={reminder.id} className="hover:bg-base-300/50 cursor-pointer" onClick={() => handleEditReminderClick(reminder)}>
                      <TableCell>
                        <Badge className={`${statusMap[reminder.status]?.color} capitalize`}>
                          <StatusIcon className="w-3 h-3 mr-1.5" />
                          {reminder.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{reminder.recipient_name}</div>
                        <div className="text-sm text-base-content/70">{reminder.recipient_email}</div>
                      </TableCell>
                      <TableCell>{getEntityName(reminder)}</TableCell>
                      <TableCell>{format(new Date(reminder.scheduled_date), 'MMM d, yyyy h:mm a')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {reminder.status !== 'cancelled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Opens your email program with this reminder filled in"
                              onClick={(e) => { e.stopPropagation(); handleSendReminder(reminder); }}
                            >
                              <Mail className="w-3 h-3 mr-1.5" />
                              {reminder.status === 'sent' ? 'Send again' : 'Send'}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteReminder(reminder.id); }}>Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Bell className="w-12 h-12 mx-auto text-base-content/20 mb-3" />
                    <p className="font-medium text-base-content/70">No reminders found.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
