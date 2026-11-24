
import React, { useState, useEffect } from "react";
import { UserNotification } from "@/entities/UserNotification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, CheckCircle, AlertTriangle, Info, XCircle, Clock,
  Eye, Trash2, MoreVertical
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const notificationIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  reminder: Clock
};

const notificationColors = {
  info: "bg-blue-100 text-blue-800 border-blue-200",
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  error: "bg-red-100 text-red-800 border-red-200",
  reminder: "bg-purple-100 text-purple-800 border-purple-200"
};

export default function NotificationsWidget({ currentUser, isLoading, className }) {
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
    }
  }, [currentUser]);

  const loadNotifications = async () => {
    if (!currentUser) return;

    setIsLoadingNotifications(true);
    try {
      const userNotifications = await UserNotification.filter(
        { user_id: currentUser.id },
        '-created_date',
        20
      );

      // Filter out expired notifications
      const activeNotifications = userNotifications.filter(notification => {
        if (!notification.expires_at) return true;
        return new Date(notification.expires_at) > new Date();
      });

      setNotifications(activeNotifications);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await UserNotification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });
      loadNotifications(); // Reload the list
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(notification =>
          UserNotification.update(notification.id, {
            is_read: true,
            read_at: new Date().toISOString()
          })
        )
      );
      loadNotifications();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await UserNotification.delete(notificationId);
      loadNotifications(); // Reload the list
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read when clicked
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate to the action URL if provided
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (isLoading || isLoadingNotifications) {
    return (
      <Card className={`bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <Skeleton className="w-6 h-6 rounded bg-base-300" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full mb-2 bg-base-300" />
                  <Skeleton className="h-3 w-3/4 bg-base-300" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs">
                {unreadCount}
              </Badge>
            )}
          </span>
          {notifications.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {unreadCount > 0 && (
                  <DropdownMenuItem onClick={handleMarkAllAsRead}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark all as read
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Eye className="w-4 h-4 mr-2" />
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.slice(0, 5).map((notification) => {
              const IconComponent = notificationIcons[notification.type] || Bell;
              const isUnread = !notification.is_read;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isUnread
                      ? 'bg-primary/5 border border-primary/20 hover:bg-primary/10'
                      : 'bg-base-100 hover:bg-base-300/50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    notificationColors[notification.type] || 'bg-gray-100'
                  }`}>
                    <IconComponent className="w-3 h-3" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-medium text-sm ${isUnread ? 'text-base-content' : 'text-base-content/80'} truncate`}>
                        {notification.title}
                      </h4>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isUnread && (
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(notification.id);
                          }}
                          className="w-6 h-6 text-base-content/40 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-base-content/70 mt-1 truncate">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {notification.type}
                      </Badge>
                      <span className="text-xs text-base-content/60">
                        {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {notifications.length > 5 && (
              <div className="pt-3 border-t border-base-300">
                <Button
                  variant="default"
                  className="w-full"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-primary-content)',
                  }}
                >
                  View All {notifications.length} Notifications
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-base-content/20 mx-auto mb-3" />
            <h3 className="font-medium text-base-content/70 mb-2">No notifications</h3>
            <p className="text-sm text-base-content/50">
              You're all caught up! New notifications will appear here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
