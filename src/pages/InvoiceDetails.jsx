import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Invoice } from '@/entities/Invoice';
import { RentalOrder } from '@/entities/RentalOrder';
import { Renter } from '@/entities/Renter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function InvoiceDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const invoiceId = params.get('id');

  const [invoice, setInvoice] = useState(null);
  const [rentalOrder, setRentalOrder] = useState(null);
  const [renter, setRenter] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_method: '',
    notes: ''
  });
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadInvoiceData();
    } else {
      setError('No invoice ID provided');
      setIsLoading(false);
    }
  }, [invoiceId]);

  const loadInvoiceData = async () => {
    try {
      const invoiceData = await Invoice.get(invoiceId);
      setInvoice(invoiceData);

      // Load related rental order and renter
      const [orderData, renterData] = await Promise.all([
        RentalOrder.get(invoiceData.rental_order_id),
        Renter.get(invoiceData.renter_id)
      ]);
      
      setRentalOrder(orderData);
      setRenter(renterData);
    } catch (err) {
      console.error('Failed to load invoice data:', err);
      setError('Failed to load invoice data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setIsSaving(true);
    try {
      await Invoice.update(invoiceId, { status: newStatus });
      setInvoice(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error('Failed to update invoice status:', err);
      alert('Failed to update invoice status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.amount || isNaN(newPayment.amount)) {
      alert('Please enter a valid payment amount');
      return;
    }

    setIsSaving(true);
    try {
      const payment = {
        payment_date: new Date().toISOString(),
        amount: parseFloat(newPayment.amount),
        payment_method: newPayment.payment_method,
        notes: newPayment.notes
      };

      const updatedPaymentHistory = [...(invoice.payment_history || []), payment];
      const totalPaid = updatedPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
      const newBalanceDue = invoice.total_amount - totalPaid;
      
      let newStatus = invoice.status;
      if (newBalanceDue <= 0) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
      }

      await Invoice.update(invoiceId, {
        payment_history: updatedPaymentHistory,
        amount_paid: totalPaid,
        balance_due: newBalanceDue,
        status: newStatus
      });

      setInvoice(prev => ({
        ...prev,
        payment_history: updatedPaymentHistory,
        amount_paid: totalPaid,
        balance_due: newBalanceDue,
        status: newStatus
      }));

      setNewPayment({ amount: '', payment_method: '', notes: '' });
      setShowPaymentForm(false);
    } catch (err) {
      console.error('Failed to add payment:', err);
      alert('Failed to add payment');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintInvoice = () => {
    navigate(createPageUrl('PrintInvoice'), { 
      state: { invoice, rentalOrder, renter }
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'void': return 'bg-gray-500 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-1/4 mb-4" />
        <Card>
          <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintInvoice}>
              <Printer className="w-4 h-4 mr-2" /> Print Invoice
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">Invoice {invoice.invoice_number}</CardTitle>
                <p className="text-base-content/70 mt-1">
                  For {renter?.name} • {format(new Date(invoice.issue_date), 'MMMM d, yyyy')}
                </p>
              </div>
              <Badge className={getStatusColor(invoice.status)}>
                {invoice.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Issue Date</Label>
                <p>{format(new Date(invoice.issue_date), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Due Date</Label>
                <p>{format(new Date(invoice.due_date), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={invoice.status} onValueChange={handleStatusChange} disabled={isSaving}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Rate/Day</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.line_items?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">${(item.daily_rate || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-center">{item.total_days}</TableCell>
                      <TableCell className="text-right">${(item.line_total || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full md:w-1/2 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                {invoice.damage_waiver_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Damage Waiver:</span>
                    <span>${(invoice.damage_waiver_fee || 0).toFixed(2)}</span>
                  </div>
                )}
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${(invoice.tax_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>${(invoice.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Amount Paid:</span>
                  <span>${(invoice.amount_paid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-red-600">
                  <span>Balance Due:</span>
                  <span>${(invoice.balance_due || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">Payment History</h3>
                {!showPaymentForm && invoice.balance_due > 0 && (
                  <Button size="sm" onClick={() => setShowPaymentForm(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Payment
                  </Button>
                )}
              </div>

              {showPaymentForm && (
                <Card className="mb-4">
                  <CardContent className="pt-4">
                    <form onSubmit={handleAddPayment} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div>
                          <Label>Payment Method</Label>
                          <Input
                            value={newPayment.payment_method}
                            onChange={(e) => setNewPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                            placeholder="Cash, Check, Credit Card, etc."
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={newPayment.notes}
                          onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Payment notes..."
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                          {isSaving ? 'Adding...' : 'Add Payment'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {invoice.payment_history && invoice.payment_history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payment_history.map((payment, index) => (
                      <TableRow key={index}>
                        <TableCell>{format(new Date(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell className="text-right">${payment.amount.toFixed(2)}</TableCell>
                        <TableCell>{payment.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-base-content/60 text-center py-4">No payments recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}