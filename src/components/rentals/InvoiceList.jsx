import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function InvoiceList({ invoices, isLoading }) {
  const navigate = useNavigate();
  
  const getStatusVariant = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'void': return 'bg-gray-500 text-white';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
        <CardDescription>A list of the most recently generated invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Renter ID</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices && invoices.length > 0 ? (
              invoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell><Badge className={getStatusVariant(invoice.status)}>{invoice.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.renter_id}</TableCell>
                  <TableCell>{format(new Date(invoice.issue_date), 'P')}</TableCell>
                  <TableCell>{format(new Date(invoice.due_date), 'P')}</TableCell>
                  <TableCell className="text-right">${invoice.balance_due?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`InvoiceDetails?id=${invoice.id}`))}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan="7" className="text-center">No invoices found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}