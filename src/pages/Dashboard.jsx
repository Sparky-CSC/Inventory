import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PAGE_NAMES } from '@/lib/pages';
import { Loader2 } from "lucide-react";
import { createPageUrl } from '@/utils';

import StatsOverview from "../components/dashboard/StatsOverview";
import RecentActivity from "../components/dashboard/RecentActivity";
import CategoryBreakdown from "../components/dashboard/CategoryBreakdown";
import QuickActions from "../components/dashboard/QuickActions";
import FavoritesWidget from "../components/dashboard/FavoritesWidget";
import RentalsDashboardWidget from "../components/dashboard/RentalsDashboardWidget";
import BorrowedItemsWidget from "../components/dashboard/BorrowedItemsWidget";
import { useAppSettings } from '../components/shared/AppSettingsContext';
import { useUserData } from '../components/shared/UserDataContext';
import { useData } from '../components/shared/DataManager';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isLoadingUserData } = useUserData();
  const { appSettings } = useAppSettings();
  const { items, containers, rentalOrders, borrowedItems, isLoading, error } = useData();

  const [stats, setStats] = useState({ 
    totalItems: 0, 
    totalContainers: 0, 
    inUseItems: 0, 
    needsRepair: 0, 
    byCategory: {},
    totalValue: 0,
    activeRentals: 0,
    overdueRentals: 0,
    activeBorrowedItems: 0,
    overdueBorrowedItems: 0
  });

  // People can choose which page opens first (Settings → My Preferences).
  // That only applies when the app is opened at its front door ("/"); the
  // Dashboard link itself always shows the dashboard.
  const shouldRedirectToDefaultPage =
    location.pathname === '/' &&
    Boolean(currentUser?.default_page) &&
    currentUser.default_page !== 'Dashboard' &&
    PAGE_NAMES.includes(currentUser.default_page);

  useEffect(() => {
    if (!isLoadingUserData && shouldRedirectToDefaultPage) {
      navigate(createPageUrl(currentUser.default_page), { replace: true });
    }
  }, [currentUser, isLoadingUserData, navigate, shouldRedirectToDefaultPage]);

  useEffect(() => {
    // Recalculate stats when data changes
    const calculateStats = (itemsData = [], containersData = [], rentalData = [], borrowedData = []) => {
      const totalValue = itemsData.reduce((sum, item) => sum + (item.value || 0), 0);
      const byCategory = itemsData.reduce((acc, item) => {
          const cats = item.categories && Array.isArray(item.categories) ? item.categories : (item.category ? [item.category] : []);
          cats.forEach(cat => {
               acc[cat] = (acc[cat] || 0) + 1;
          });
          return acc;
      }, {});

      // Calculate rental stats
      const activeRentals = rentalData.filter(order => 
        ['confirmed', 'rented_out', 'partially_returned'].includes(order.status)
      ).length;

      const overdueRentals = rentalData.filter(order => {
        if (order.status === 'rented_out' || order.status === 'partially_returned') {
          return new Date(order.rental_end_date) < new Date();
        }
        return false;
      }).length;

      // Calculate borrowed items stats
      const activeBorrowedItems = borrowedData.filter(item => item.status === 'borrowed').length;
      const overdueBorrowedItems = borrowedData.filter(item => {
        if (item.status === 'borrowed' && item.due_date) {
          return new Date(item.due_date) < new Date();
        }
        return false;
      }).length;

      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentAdditions = itemsData.filter(
        item => item.created_date && new Date(item.created_date).getTime() >= oneWeekAgo
      ).length;

      return {
        recentAdditions,
        totalItems: itemsData.length,
        totalContainers: containersData.length,
        inUseItems: itemsData.filter(item => item.status === 'in_use').length,
        needsRepair: itemsData.filter(item => item.condition === 'needs_repair').length,
        byCategory,
        totalValue,
        activeRentals,
        overdueRentals,
        activeBorrowedItems,
        overdueBorrowedItems
      };
    };

    setStats(calculateStats(items, containers, rentalOrders, borrowedItems));
  }, [items, containers, rentalOrders, borrowedItems]);

  if (isLoadingUserData || shouldRedirectToDefaultPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-base-100">
        <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-base-content/70">Loading your space...</p>
        </div>
      </div>
    );
  }

  const welcomeMessage = `Welcome to ${appSettings.appName}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2">
              {welcomeMessage}
            </h1>
            <p className="text-base lg:text-lg text-primary font-medium">
              {appSettings.dashboardSubtitle || 'Your comprehensive inventory management dashboard'}
            </p>
          </div>
          <QuickActions />
        </div>

        {error && (
          <Alert className="mb-6 bg-warning/10 border-warning/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:col-span-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <StatsOverview stats={stats} isLoading={isLoading} />
                <RecentActivity items={items.slice(0, 5)} isLoading={isLoading} />
                <RentalsDashboardWidget 
                  rentalOrders={rentalOrders.slice(0, 5)} 
                  stats={{ activeRentals: stats.activeRentals, overdueRentals: stats.overdueRentals }}
                  isLoading={isLoading} 
                />
                <BorrowedItemsWidget 
                  borrowedItems={borrowedItems.slice(0, 5)} 
                  stats={{ activeBorrowedItems: stats.activeBorrowedItems, overdueBorrowedItems: stats.overdueBorrowedItems }}
                  isLoading={isLoading} 
                />
            </div>
            <div className="lg:col-span-1 space-y-6">
                <CategoryBreakdown stats={stats} isLoading={isLoading} />
                <FavoritesWidget />
            </div>
        </div>
      </div>
    </div>
  );
}