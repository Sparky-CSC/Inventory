import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useAppSettings } from '../components/shared/AppSettingsContext';

export default function PrintInvoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSettings } = useAppSettings();
  const { invoice, rentalOrder, renter } = location.state || {};

  useEffect(() => {
    window.focus();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!invoice) {
    return (
      <div className="p-8 bg-base-100 min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-base-content mb-4">No Invoice Data</h1>
          <p className="text-base-content/70 mb-6">Unable to load the invoice information for printing.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-container bg-white min-h-screen">
      <style>{`
        @media screen {
          body { 
            background-color: var(--color-base-100, #FFFFFF) !important; 
            color: var(--color-base-content, #1F2937) !important;
          }
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: 8.5in 11in;
            margin: 0.5in;
          }
          body { 
            background-color: white !important; 
            color: black !important;
            font-family: Arial, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.3 !important;
          }
          .no-print { 
            display: none !important; 
          }
          .print-container { 
            padding: 0 !important; 
            background-color: white !important;
            width: 7.5in !important;
            max-width: 7.5in !important;
            margin: 0 auto !important;
          }
          .print-header {
            border-bottom: 2px solid #333 !important;
            padding-bottom: 12px !important;
            margin-bottom: 20px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
          }
          .header-left {
            flex: 1 !important;
          }
          .header-right {
            text-align: right !important;
            flex: 1 !important;
          }
          .company-logo {
            height: 40px !important;
            max-height: 40px !important;
            margin-bottom: 8px !important;
          }
          .company-name {
            font-size: 16px !important;
            font-weight: bold !important;
            margin: 0 0 4px 0 !important;
            color: black !important;
          }
          .company-subtitle {
            font-size: 11px !important;
            color: #666 !important;
            margin: 0 !important;
          }
          .invoice-title {
            font-size: 24px !important;
            font-weight: bold !important;
            color: #dc2626 !important;
            margin: 0 0 8px 0 !important;
          }
          .invoice-details {
            font-size: 10px !important;
            line-height: 1.4 !important;
          }
          .invoice-details p {
            margin: 2px 0 !important;
          }
          .section-header {
            font-size: 12px !important;
            font-weight: bold !important;
            margin: 16px 0 6px 0 !important;
            color: black !important;
          }
          .info-box {
            background-color: #f8f9fa !important;
            padding: 8px !important;
            border-radius: 4px !important;
            margin-bottom: 12px !important;
            font-size: 10px !important;
            line-height: 1.4 !important;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin: 8px 0 !important;
            font-size: 10px !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #333 !important;
            padding: 4px 6px !important;
            text-align: left !important;
            vertical-align: top !important;
          }
          .print-table th {
            background-color: #f1f3f4 !important;
            font-weight: bold !important;
            font-size: 10px !important;
          }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .print-totals {
            margin-top: 12px !important;
            float: right !important;
            clear: both !important;
          }
          .print-totals table {
            border-collapse: collapse !important;
            font-size: 10px !important;
          }
          .print-totals td {
            padding: 3px 8px !important;
            border: 1px solid #333 !important;
          }
          .total-row {
            font-weight: bold !important;
            background-color: #f1f3f4 !important;
          }
          .paid-stamp {
            color: #059669 !important;
            font-weight: bold !important;
            font-size: 18px !important;
            transform: rotate(-15deg) !important;
            border: 2px solid #059669 !important;
            padding: 6px 12px !important;
            position: absolute !important;
            top: 120px !important;
            right: 80px !important;
            background-color: white !important;
          }
          .footer {
            margin-top: 20px !important;
            padding-top: 12px !important;
            border-top: 1px solid #ccc !important;
            font-size: 9px !important;
            text-align: center !important;
            color: #666 !important;
            clear: both !important;
          }
          .payment-due {
            color: #dc2626 !important;
            font-weight: bold !important;
          }
        }
      `}</style>
      
      <div className="no-print sticky top-0 bg-white shadow-md p-4 mb-8 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Print Invoice</h1>
            <p className="text-gray-500">Invoice {invoice.invoice_number} for {renter?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          </div>
        </div>
      </div>
      
      <div className="print-container relative">
        {/* Paid Stamp */}
        {invoice.status === 'paid' && (
          <div className="paid-stamp">PAID</div>
        )}

        {/* Header */}
        <div className="print-header">
          <div className="header-left">
            {appSettings?.logoUrl && (
              <img src={appSettings.logoUrl} alt="Logo" className="company-logo" />
            )}
            <h1 className="company-name">Culver-Stockton College Theatre Department</h1>
            <p className="company-subtitle">Theatre Rentals</p>
          </div>
          <div className="header-right">
            <h2 className="invoice-title">INVOICE</h2>
            <div className="invoice-details">
              <p><strong>Invoice #:</strong> {invoice.invoice_number}</p>
              <p><strong>Issue Date:</strong> {format(new Date(invoice.issue_date), 'MM/dd/yyyy')}</p>
              <p><strong>Due Date:</strong> {format(new Date(invoice.due_date), 'MM/dd/yyyy')}</p>
              <p><strong>Status:</strong> {invoice.status.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div>
          <h3 className="section-header">Bill To:</h3>
          <div className="info-box">
            <p><strong>{renter?.name}</strong></p>
            {renter?.contact_person && <p>Attn: {renter.contact_person}</p>}
            {renter?.email && <p>Email: {renter.email}</p>}
            {renter?.phone && <p>Phone: {renter.phone}</p>}
            {renter?.address && <p>Address: {renter.address}</p>}
          </div>
        </div>

        {/* Rental Details */}
        {rentalOrder && (
          <div>
            <h3 className="section-header">Rental Period:</h3>
            <div className="info-box">
              <p><strong>Start:</strong> {format(new Date(rentalOrder.rental_start_date), 'EEEE, MMMM d, yyyy')}</p>
              <p><strong>End:</strong> {format(new Date(rentalOrder.rental_end_date), 'EEEE, MMMM d, yyyy')}</p>
              <p><strong>Duration:</strong> {Math.ceil((new Date(rentalOrder.rental_end_date) - new Date(rentalOrder.rental_start_date)) / (1000 * 60 * 60 * 24)) + 1} days</p>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div>
          <h3 className="section-header">Items:</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{width: '40%'}}>Item Description</th>
                <th className="text-center" style={{width: '10%'}}>Qty</th>
                <th className="text-right" style={{width: '15%'}}>Rate/Day</th>
                <th className="text-center" style={{width: '10%'}}>Days</th>
                <th className="text-right" style={{width: '15%'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items?.map((item, index) => (
                <tr key={index}>
                  <td>{item.item_name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">${(item.daily_rate || 0).toFixed(2)}</td>
                  <td className="text-center">{item.total_days || 1}</td>
                  <td className="text-right">${(item.line_total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="print-totals">
          <table>
            <tbody>
            <tr>
              <td>Subtotal:</td>
              <td className="text-right">${(invoice.subtotal || 0).toFixed(2)}</td>
            </tr>
            {invoice.damage_waiver_fee > 0 && (
              <tr>
                <td>Damage Waiver:</td>
                <td className="text-right">${(invoice.damage_waiver_fee || 0).toFixed(2)}</td>
              </tr>
            )}
            {invoice.tax_amount > 0 && (
              <tr>
                <td>Tax:</td>
                <td className="text-right">${(invoice.tax_amount || 0).toFixed(2)}</td>
              </tr>
            )}
            <tr className="total-row">
              <td><strong>Total Amount:</strong></td>
              <td className="text-right"><strong>${(invoice.total_amount || 0).toFixed(2)}</strong></td>
            </tr>
            <tr style={{backgroundColor: '#e6ffe6'}}>
              <td>Amount Paid:</td>
              <td className="text-right">${(invoice.amount_paid || 0).toFixed(2)}</td>
            </tr>
            <tr className="total-row" style={{backgroundColor: '#ffe6e6'}}>
              <td><strong>Balance Due:</strong></td>
              <td className="text-right"><strong>${(invoice.balance_due || 0).toFixed(2)}</strong></td>
            </tr>
            </tbody>
          </table>
        </div>

        <div style={{clear: 'both'}}></div>

        {/* Payment History */}
        {invoice.payment_history && invoice.payment_history.length > 0 && (
          <div style={{marginTop: '20px'}}>
            <h3 className="section-header">Payment History:</h3>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payment_history.map((payment, index) => (
                  <tr key={index}>
                    <td>{format(new Date(payment.payment_date), 'MM/dd/yyyy')}</td>
                    <td>{payment.payment_method}</td>
                    <td className="text-right">${payment.amount.toFixed(2)}</td>
                    <td>{payment.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div style={{marginTop: '16px'}}>
            <h3 className="section-header">Notes:</h3>
            <div className="info-box">
              <p>{invoice.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <p>Thank you for your business!</p>
          {invoice.balance_due > 0 && (
            <p className="payment-due">
              Payment of ${invoice.balance_due.toFixed(2)} is due by {format(new Date(invoice.due_date), 'MMMM d, yyyy')}
            </p>
          )}
          <p style={{marginTop: '8px'}}>
            Culver-Stockton College Theatre Department | Theatre Rentals
          </p>
        </div>
      </div>
    </div>
  );
}