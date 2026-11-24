
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, FileText, Plus, Calendar, DollarSign, User,
  Clock, CheckCircle, AlertCircle, XCircle, Printer, Receipt, Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { RentalOrder } from '@/entities/RentalOrder';
import { Invoice } from '@/entities/Invoice';
import { useUserData } from '../shared/UserDataContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  quote: { color: 'bg-blue-100 text-blue-800', icon: FileText, label: 'Quote' },
  confirmed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Confirmed' },
  rented_out: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Rented Out' },
  partially_returned: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Partially Returned' },
  completed: { color: 'bg-gray-100 text-gray-800', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' }
};

export default function RentalOrderList({ orders, onOrderDeleted, onCreateNew, onInvoiceGenerated }) {
  const { currentUser } = useUserData();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState(null);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState({
    quoteOrder: true,
    renter: true,
    rentalPeriod: true,
    status: true,
    total: true,
    actions: true
  });

  // Check if user has permission to delete rentals
  const canDeleteRentals = currentUser?.role?.permissions?.includes('delete_rentals') || false;

  const handleDelete = async (orderId) => {
    if (!canDeleteRentals) {
      alert('You do not have permission to delete rental orders.');
      return;
    }

    setDeletingId(orderId);
    try {
      await RentalOrder.delete(orderId);
      onOrderDeleted(orderId);
    } catch (error) {
      console.error('Failed to delete rental order:', error);
      alert('Failed to delete rental order. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateInvoice = async (order) => {
    setGeneratingInvoiceId(order.id);
    try {
      const invoiceData = {
        rental_order_id: order.id,
        renter_id: order.renter_id,
        invoice_number: `INV-${Date.now()}`,
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        status: 'draft',
        line_items: order.line_items,
        subtotal: order.subtotal,
        damage_waiver_fee: order.damage_waiver_fee,
        tax_amount: order.tax_amount,
        total_amount: order.total_amount,
        balance_due: order.total_amount,
        payment_history: []
      };

      const newInvoice = await Invoice.create(invoiceData);

      // If the order was a quote, update its status to confirmed
      if (order.status === 'quote') {
        await RentalOrder.update(order.id, { status: 'confirmed' });
      }

      onInvoiceGenerated?.();
      navigate(createPageUrl(`InvoiceDetails?id=${newInvoice.id}`));
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  const handlePrintQuote = (order) => {
    navigate(createPageUrl('PrintQuote'), {
      state: { order }
    });
  };

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Quotes & Orders
            </span>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-base-content/20 mx-auto mb-4" />
            <h3 className="font-medium text-base-content/70 mb-2">No quotes or orders yet</h3>
            <p className="text-sm text-base-content/50 mb-4">Create your first rental quote to get started</p>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Quote
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Quotes & Orders ({orders.length})
          </span>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.quoteOrder}
                  onCheckedChange={() => toggleColumn('quoteOrder')}
                >
                  Quote/Order #
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.renter}
                  onCheckedChange={() => toggleColumn('renter')}
                >
                  Renter
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.rentalPeriod}
                  onCheckedChange={() => toggleColumn('rentalPeriod')}
                >
                  Rental Period
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.status}
                  onCheckedChange={() => toggleColumn('status')}
                >
                  Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.total}
                  onCheckedChange={() => toggleColumn('total')}
                >
                  Total
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.actions}
                  onCheckedChange={() => toggleColumn('actions')}
                >
                  Actions
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.quoteOrder && <TableHead>Quote/Order #</TableHead>}
                {visibleColumns.renter && <TableHead>Renter</TableHead>}
                {visibleColumns.rentalPeriod && <TableHead>Rental Period</TableHead>}
                {visibleColumns.status && <TableHead>Status</TableHead>}
                {visibleColumns.total && <TableHead className="text-right">Total</TableHead>}
                {visibleColumns.actions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.quote;
                const StatusIcon = statusInfo.icon;

                return (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-base-200/50 transition-colors"
                    onClick={() => navigate(createPageUrl(`RentalOrderEditor?id=${order.id}`))}
                  >
                    {visibleColumns.quoteOrder && (
                      <TableCell className="font-medium">
                        {order.quote_number || order.order_number || `#${order.id.slice(-6)}`}
                      </TableCell>
                    )}
                    {visibleColumns.renter && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-base-content/40" />
                          {order.renter_name || 'Unknown Renter'}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.rentalPeriod && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-base-content/40" />
                          <span className="text-sm">
                            {format(new Date(order.rental_start_date), 'MMM d')} - {format(new Date(order.rental_end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.status && (
                      <TableCell>
                        <Badge className={`${statusInfo.color} border`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.total && (
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-4 h-4 text-base-content/40" />
                          ${(order.total_amount || 0).toFixed(2)}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.actions && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Print Quote/Order */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrintQuote(order)}
                            title="Print Quote/Order"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>

                          {/* Generate Invoice (show for anything not completed or cancelled) */}
                          {!['completed', 'cancelled'].includes(order.status) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateInvoice(order)}
                              disabled={generatingInvoiceId === order.id}
                              title="Generate Invoice"
                            >
                              {generatingInvoiceId === order.id ? (
                                <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                              ) : (
                                <Receipt className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          {/* Edit */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(createPageUrl(`RentalOrderEditor?id=${order.id}`))}
                            title="Edit Order"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>

                          {/* Delete (if permissions allow) */}
                          {canDeleteRentals && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  disabled={deletingId === order.id}
                                  title="Delete Order"
                                >
                                  {deletingId === order.id ? (
                                    <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent style={{
                                backgroundColor: 'var(--color-base-100)',
                                borderColor: 'var(--color-base-300)',
                                color: 'var(--color-base-content)'
                              }}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Rental Order</AlertDialogTitle>
                                  <AlertDialogDescription style={{ color: 'var(--color-base-content)', opacity: 0.8 }}>
                                    Are you sure you want to delete this {order.status === 'quote' ? 'quote' : 'rental order'}?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel style={{
                                    borderColor: 'var(--color-base-300)',
                                    color: 'var(--color-base-content)'
                                  }}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(order.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
