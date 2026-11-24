
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { isLoanOverdue } from "@/lib/itemCodes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { 
  ArrowRightLeft, AlertTriangle, Calendar, Eye
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = {
  borrowed: "bg-blue-100 text-blue-800 border-blue-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-green-100 text-green-800 border-green-200"
};

export default function BorrowedItemsWidget({ borrowedItems, stats, isLoading }) {
  const navigate = useNavigate();

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
      <CardHeader className="border-b border-base-300">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-base-content flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Borrowed Items
          </CardTitle>
          <Link to={createPageUrl('BorrowedItems')}>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </Link>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-base-content/70">Active: {stats?.activeBorrowedItems || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-base-content/70">Overdue: {stats?.overdueBorrowedItems || 0}</span>
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
          ) : borrowedItems.length > 0 ? (
            borrowedItems.map((item) => {
              const isOverdue = isLoanOverdue(item);
              const status = isOverdue ? 'overdue' : item.status;
              
              return (
                <div 
                  key={item.id} 
                  className="p-6 hover:bg-base-300/50 transition-colors duration-200 cursor-pointer group"
                  onClick={() => navigate(createPageUrl(`BorrowedItemDetails?id=${item.id}`))}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                      <ArrowRightLeft className="w-6 h-6 text-primary-content" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base-content truncate">
                          {item.name}
                        </h3>
                        {isOverdue && <AlertTriangle className="w-4 h-4 text-error" />}
                      </div>
                      <p className="text-sm text-base-content/70 mb-2">
                        From: {item.lender_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-base-content/60">
                        <Calendar className="w-3 h-3" />
                        <span>Borrowed {format(new Date(item.borrowed_date), 'MMM d, yyyy')}</span>
                        {item.due_date && (
                          <>
                            <span>•</span>
                            <span>Due {format(new Date(item.due_date), 'MMM d')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge className={`${statusColors[status]} border font-medium`}>
                        {status === 'overdue' ? 'Overdue' : status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <ArrowRightLeft className="w-12 h-12 text-base-content/20 mx-auto mb-4" />
              <h3 className="font-medium text-base-content/70 mb-2">No borrowed items</h3>
              <p className="text-sm text-base-content/50">Track items you borrow from others</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
