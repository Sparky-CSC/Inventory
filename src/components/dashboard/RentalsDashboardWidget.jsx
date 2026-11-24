
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  Truck, AlertTriangle, Calendar, DollarSign, Eye
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = {
  quote: "bg-gray-100 text-gray-800 border-gray-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  rented_out: "bg-green-100 text-green-800 border-green-200",
  partially_returned: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-gray-100 text-gray-800 border-gray-200",
  cancelled: "bg-red-100 text-red-800 border-red-200"
};

export default function RentalsDashboardWidget({ rentalOrders, stats, isLoading }) {
  const navigate = useNavigate();

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
      <CardHeader className="border-b border-base-300">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-base-content flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Recent Rentals
          </CardTitle>
          <Link to={createPageUrl('RentalsDashboard')}>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </Link>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-base-content/70">Active: {stats?.activeRentals || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-base-content/70">Overdue: {stats?.overdueRentals || 0}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-base-300">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-6 flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl bg-base-300" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2 bg-base-300" />
                  <Skeleton className="h-3 w-48 bg-base-300" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full bg-base-300" />
              </div>
            ))
          ) : rentalOrders.length > 0 ? (
            rentalOrders.map((order) => {
              const isOverdue = (order.status === 'rented_out' || order.status === 'partially_returned') 
                && new Date(order.rental_end_date) < new Date();
              
              return (
                <div 
                  key={order.id} 
                  className="p-6 hover:bg-base-300/50 transition-colors duration-200 cursor-pointer group"
                  onClick={() => {
                    // Scroll to top before navigating
                    window.scrollTo(0, 0);
                    navigate(createPageUrl(`RentalOrderEditor?id=${order.id}`));
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                      <Truck className="w-6 h-6 text-primary-content" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base-content truncate">
                          {order.quote_number || order.order_number || `Order #${order.id.slice(-6)}`}
                        </h3>
                        {isOverdue && <AlertTriangle className="w-4 h-4 text-error" />}
                      </div>
                      <p className="text-sm text-base-content/70 mb-2">
                        {order.renter_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-base-content/60">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(order.rental_start_date), 'MMM d')} - {format(new Date(order.rental_end_date), 'MMM d')}</span>
                        {order.total_amount && (
                          <>
                            <span>•</span>
                            <DollarSign className="w-3 h-3" />
                            <span>${order.total_amount.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge className={`${statusColors[order.status]} border font-medium`}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <Truck className="w-12 h-12 text-base-content/20 mx-auto mb-4" />
              <h3 className="font-medium text-base-content/70 mb-2">No rental orders yet</h3>
              <p className="text-sm text-base-content/50">Create your first rental quote to get started</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
