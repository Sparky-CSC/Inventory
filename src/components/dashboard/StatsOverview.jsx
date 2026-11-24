import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, Clock, CheckCircle, Truck, ArrowRightLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsOverview({ stats, isLoading }) {
  const statCardsData = [
    {
      title: "Items In Use",
      value: stats.inUseItems,
      icon: Clock,
      colorClass: "info",
      link: createPageUrl("Inventory?status=in_use"),
      description: "Currently being used"
    },
    {
      title: "Items Needing Repair",
      value: stats.needsRepair,
      icon: AlertTriangle,
      colorClass: "warning",
      link: createPageUrl("Inventory?condition=needs_repair"),
      description: "Require maintenance"
    },
    {
      title: "Available Items",
      value: stats.totalItems - stats.inUseItems,
      icon: CheckCircle,
      colorClass: "success",
      link: createPageUrl("Inventory?status=available"),
      description: "Ready for use"
    },
    {
      title: "Active Rentals",
      value: stats.activeRentals,
      icon: Truck,
      colorClass: "secondary",
      link: createPageUrl("RentalsDashboard"),
      description: "Currently rented out"
    },
    {
      title: "Borrowed Items",
      value: stats.activeBorrowedItems,
      icon: ArrowRightLeft,
      colorClass: "info",
      link: createPageUrl("BorrowedItems"),
      description: "Items we borrowed"
    },
    {
      title: "Recent Additions",
      value: stats.recentAdditions || 0,
      icon: Package,
      colorClass: "primary",
      link: createPageUrl("Inventory"),
      description: "Added this week"
    }
  ];

  const StatCard = ({ stat }) => (
    <Card className={`bg-base-200/50 backdrop-blur-sm border-0 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-base-content">
          {stat.title}
        </CardTitle>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
          style={{ backgroundColor: `var(--${stat.colorClass})`, color: `var(--${stat.colorClass}-content)` }}
        >
          <stat.icon className="w-5 h-5" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20 bg-base-300" />
        ) : (
          <div className={`text-3xl font-bold text-base-content mb-1`}>
            {stat.value}
          </div>
        )}
        <p className={`text-xs text-base-content/70`}>{stat.description}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {statCardsData.map((stat) => (
        stat.link ? (
          <Link to={stat.link} key={stat.title}>
            <StatCard stat={stat} />
          </Link>
        ) : (
          <StatCard key={stat.title} stat={stat} />
        )
      ))}
    </div>
  );
}