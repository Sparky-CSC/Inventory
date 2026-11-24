
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useAppSettings } from '../components/shared/AppSettingsContext';

export default function PrintQuote() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSettings } = useAppSettings();
  const { order } = location.state || {};

  useEffect(() => {
    // Auto-focus for better print experience
    window.focus();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (!order) {
    return (
      <div className="p-8 bg-base-100 min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-base-content mb-4">No Order Data</h1>
          <p className="text-base-content/70 mb-6">Unable to load the order information for printing.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const isQuote = order.status === 'quote';

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
          body { 
            background-color: white !important; 
            color: black !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          .no-print { display: none !important; }
          .print-container { 
            padding: 0.5in !important; 
            background-color: white !important;
          }
          .print-header {
            border-bottom: 2px solid #333 !important;
            padding-bottom: 20px !important;
            margin-bottom: 30px !important;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #333 !important;
            padding: 8px !important;
            text-align: left !important;
          }
          .print-table th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          .print-totals {
            margin-top: 20px !important;
            text-align: right !important;
          }
          .print-totals table {
            margin-left: auto !important;
            border-collapse: collapse !important;
          }
          .print-totals td {
            padding: 5px 10px !important;
            border: 1px solid #333 !important;
          }
          .total-row {
            font-weight: bold !important;
            background-color: #f5f5f5 !important;
          }
        }
      `}</style>
      
      <div className="no-print sticky top-0 bg-white shadow-md p-4 mb-8 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Print {isQuote ? 'Quote' : 'Order'}</h1>
            <p className="text-gray-500">
              {isQuote ? 'Quote' : 'Order'} for {order.renter_name}
            </p>
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
      
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="print-header flex justify-between items-start mb-8">
          <div>
            {appSettings?.logoUrl && (
              <img src={appSettings.logoUrl} alt="Logo" className="h-16 mb-4" />
            )}
            <h1 className="text-2xl font-bold">
              {appSettings?.appName || 'Culver-Stockton College Theatre Department'}
            </h1>
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-blue-600 mb-2">
              {isQuote ? 'QUOTE' : 'RENTAL ORDER'}
            </h2>
            <p><strong>{isQuote ? 'Quote' : 'Order'} #:</strong> {order.quote_number || order.order_number || `#${order.id.slice(-6)}`}</p>
            <p><strong>Date:</strong> {format(new Date(), 'MMMM d, yyyy')}</p>
            {order.status !== 'quote' && (
              <p><strong>Status:</strong> <span className="capitalize">{order.status.replace('_', ' ')}</span></p>
            )}
          </div>
        </div>

        {/* Customer Information */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Bill To:</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-semibold">{order.renter_name}</p>
            {/* Add more customer details here if available */}
          </div>
        </div>

        {/* Rental Details */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Rental Period:</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p><strong>Start Date:</strong> {format(new Date(order.rental_start_date), 'EEEE, MMMM d, yyyy')}</p>
            <p><strong>End Date:</strong> {format(new Date(order.rental_end_date), 'EEEE, MMMM d, yyyy')}</p>
            <p><strong>Duration:</strong> {Math.ceil((new Date(order.rental_end_date) - new Date(order.rental_start_date)) / (1000 * 60 * 60 * 24)) + 1} days</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Items:</h3>
          <table className="print-table w-full">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Rate/Day</th>
                <th className="text-center">Days</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.line_items?.map((item, index) => (
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
              <td className="text-right">${(order.subtotal || 0).toFixed(2)}</td>
            </tr>
            {order.damage_waiver_fee > 0 && (
              <tr>
                <td>Damage Waiver:</td>
                <td className="text-right">${(order.damage_waiver_fee || 0).toFixed(2)}</td>
              </tr>
            )}
            {order.tax_amount > 0 && (
              <tr>
                <td>Tax ({(order.tax_rate || 0)}%):</td>
                <td className="text-right">${(order.tax_amount || 0).toFixed(2)}</td>
              </tr>
            )}
            <tr className="total-row">
              <td><strong>Total:</strong></td>
              <td className="text-right"><strong>${(order.total_amount || 0).toFixed(2)}</strong></td>
            </tr>
            {order.security_deposit > 0 && (
              <tr>
                <td>Security Deposit:</td>
                <td className="text-right">${(order.security_deposit || 0).toFixed(2)}</td>
              </tr>
            )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3">Notes:</h3>
            <div className="bg-gray-50 p-4 rounded">
              <p className="whitespace-pre-wrap">{order.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t text-sm text-gray-600 text-center">
          {isQuote && <p className="mt-2"><em>This is a quote only. No charges will be made until the rental is confirmed.</em></p>}
        </div>
      </div>
    </div>
  );
}
