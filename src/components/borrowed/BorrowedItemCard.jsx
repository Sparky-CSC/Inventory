
import React from 'react';
import { Card, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import {
  Clock, CheckCircle, AlertTriangle, User, Calendar,
  Edit, Undo2, UserCheck, UserX
} from 'lucide-react';

const statusConfig = {
  borrowed: {
    label: 'Borrowed',
    color: 'bg-info/10 text-info', // original color for badge
    icon: Clock,
    borderColor: 'border-info',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
    badgeClass: 'bg-info/10 text-info',
  },
  overdue: {
    label: 'Overdue',
    color: 'bg-error/10 text-error', // original color for badge
    icon: AlertTriangle,
    borderColor: 'border-error',
    iconBg: 'bg-error/10',
    iconColor: 'text-error',
    badgeClass: 'bg-error/10 text-error',
  },
  returned: {
    label: 'Returned',
    color: 'bg-success/10 text-success', // original color for badge
    icon: CheckCircle,
    borderColor: 'border-success',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    badgeClass: 'bg-success/10 text-success',
  }
};

export default function BorrowedItemCard({ item, onEdit, onMarkReturned, onUndoReturn }) {
  // Determine if the item is currently overdue, even if its status is 'borrowed'
  const isOverdue = item.status === 'overdue' ||
    (item.status === 'borrowed' && item.due_date && new Date(item.due_date) < new Date());

  // Determine the effective status key for display (e.g., a borrowed item can be effectively 'overdue')
  const effectiveStatusKey = isOverdue && item.status !== 'returned' ? 'overdue' : item.status;
  const statusInfo = statusConfig[effectiveStatusKey] || statusConfig.borrowed;

  const formatReturnDate = (dateString) => dateString ? format(new Date(dateString), 'MMM d, yyyy') : 'N/A';

  return (
    <Card className={`overflow-hidden bg-base-200/50 theater-shadow border-base-300`}>
      <div className={`p-4 border-l-4 ${statusInfo.borderColor}`}>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-full ${statusInfo.iconBg}`}>
                {statusInfo.icon && <statusInfo.icon className={`w-5 h-5 ${statusInfo.iconColor}`} />}
              </span>
              <h3 className="text-lg font-bold text-base-content truncate">{item.name}</h3>
            </div>
            {item.category && (
              <Badge variant="secondary" className="mt-2 capitalize">{item.category?.replace('_', ' ')}</Badge>
            )}
          </div>
          <div className="flex-shrink-0 ml-2">
            <Badge variant="outline" className={`font-semibold ${statusInfo.badgeClass}`}>{statusInfo.label}</Badge>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm text-base-content/90">
          {/* Lender Information */}
          <div className="flex items-start">
            <User className="w-4 h-4 mr-3 mt-0.5 text-base-content/60 flex-shrink-0" />
            <div>
              <span className="text-base-content/80">From: </span>
              <span className="font-medium text-base-content">{item.lender_name}</span>
              {item.lender_phone && (
                <div className="text-xs text-base-content/60 mt-1">
                  Phone: {item.lender_phone}
                </div>
              )}
              {item.lender_email && (
                <div className="text-xs text-base-content/60">
                  Email: {item.lender_email}
                </div>
              )}
            </div>
          </div>

          {/* Borrowed Date */}
          <div className="flex items-start">
            <Calendar className="w-4 h-4 mr-3 mt-0.5 text-base-content/60 flex-shrink-0" />
            <div>
              <span className="text-base-content/80">Borrowed: </span>
              <span className="font-medium text-base-content">{format(new Date(item.borrowed_date), 'MMM d, yyyy')}</span>
            </div>
          </div>

          {/* Due Date (conditional on existence and overdue status) */}
          {item.due_date && (
            <div className={`flex items-start ${isOverdue ? 'text-error' : 'text-base-content'}`}>
              <Calendar className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-base-content/80">Due: </span>
                <span className="font-medium">{format(new Date(item.due_date), 'MMM d, yyyy')}</span>
                {isOverdue && <span className="text-xs font-medium ml-1">(OVERDUE)</span>}
              </div>
            </div>
          )}

          {/* Received by */}
          <div className="flex items-start">
            <UserCheck className="w-4 h-4 mr-3 mt-0.5 text-base-content/60" />
            <span className="font-medium">Received by: {item.received_by || "N/A"}</span>
          </div>

          {/* Returned by (conditional on item status being 'returned') */}
          {item.status === 'returned' && (
             <div className="flex items-start">
              <UserX className="w-4 h-4 mr-3 mt-0.5 text-base-content/60" />
              <span className="font-medium">Returned by: {item.returned_by || "N/A"} on {formatReturnDate(item.returned_date)}</span>
            </div>
          )}
        </div>
      </div>

      <CardFooter className="bg-base-200/80 p-2 flex justify-end gap-2">
        {/* Edit Button */}
        <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>

        {/* Action Button: Undo Return or Mark Returned */}
        {item.status === 'returned' ? (
          <Button variant="outline" size="sm" onClick={() => onUndoReturn(item)}>
            <Undo2 className="w-4 h-4 mr-2"/>
            Undo Return
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onMarkReturned(item)}
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-content)',
            }}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Returned
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
