
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { RentalOrder } from '@/entities/RentalOrder';
import { Invoice } from '@/entities/Invoice';
import { Renter } from '@/entities/Renter';
import RentalOrderList from '../components/rentals/RentalOrderList';
import RenterList from '../components/rentals/RenterList';
import InvoiceList from '../components/rentals/InvoiceList';
import BackButton from '../components/shared/BackButton';

export default function RentalsDashboard() {
  const navigate = useNavigate();

  const [rentalOrders, setRentalOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [renters, setRenters] = useState([]);
  const [stats, setStats] = useState({
    totalQuotes: 0,
    activeRentals: 0,
    overdueReturns: 0,
    monthlyRevenue: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [ordersData, invoicesData, rentersData] = await Promise.all([
        RentalOrder.list('-created_date'),
        Invoice.list('-created_date'),
        Renter.list('-created_date')
      ]);
      
      setRentalOrders(ordersData);
      setInvoices(invoicesData);
      setRenters(rentersData);
      
      // Calculate stats
      const newStats = {
        totalQuotes: ordersData.filter(order => order.status === 'quote').length,
        activeRentals: ordersData.filter(order => ['confirmed', 'rented_out', 'partially_returned'].includes(order.status)).length,
        overdueReturns: ordersData.filter(order => {
          if (order.status === 'rented_out' || order.status === 'partially_returned') {
            return new Date(order.rental_end_date) < new Date();
          }
          return false;
        }).length,
        monthlyRevenue: ordersData
          .filter(order => order.status !== 'cancelled')
          .reduce((sum, order) => sum + (order.total_amount || 0), 0)
      };
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load rental data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderDeleted = (deletedOrderId) => {
    setRentalOrders(prev => {
      const updatedOrders = prev.filter(order => order.id !== deletedOrderId);
      // Recalculate stats based on the new array
      const newStats = {
        totalQuotes: updatedOrders.filter(order => order.status === 'quote').length,
        activeRentals: updatedOrders.filter(order => ['confirmed', 'rented_out', 'partially_returned'].includes(order.status)).length,
        overdueReturns: updatedOrders.filter(order => {
          if (order.status === 'rented_out' || order.status === 'partially_returned') {
            return new Date(order.rental_end_date) < new Date();
          }
          return false;
        }).length,
        monthlyRevenue: updatedOrders
          .filter(order => order.status !== 'cancelled')
          .reduce((sum, order) => sum + (order.total_amount || 0), 0)
      };
      setStats(newStats);
      return updatedOrders;
    });
  };

  const handleInvoiceGenerated = () => {
    // Reload data when new invoice is generated
    loadAllData();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <h1 className="text-3xl font-bold text-base-content">Rentals Dashboard</h1>
          <Button 
            onClick={() => navigate(createPageUrl('RentalOrderEditor'))}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Quote / Order
          </Button>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto mb-6">
            <TabsTrigger value="orders">Quotes & Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="renters">Renters</TabsTrigger>
          </TabsList>
          
          <TabsContent value="orders" className="mt-6">
            <RentalOrderList 
              orders={rentalOrders} 
              onOrderDeleted={handleOrderDeleted}
              onCreateNew={() => navigate(createPageUrl('RentalOrderEditor'))}
              onInvoiceGenerated={handleInvoiceGenerated}
            />
          </TabsContent>
          <TabsContent value="invoices" className="mt-6">
            <InvoiceList invoices={invoices} isLoading={isLoading} onInvoiceUpdated={loadAllData} />
          </TabsContent>
          <TabsContent value="renters" className="mt-6">
            <RenterList renters={renters} isLoading={isLoading} onRenterUpdated={loadAllData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
