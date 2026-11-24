import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { 
  Shirt, Drama, Hammer, Lightbulb, Palette, Package, Star, Headphones, Armchair
} from "lucide-react";

const categoryConfig = {
  costume: { color: "#8B5CF6", icon: Shirt, label: "Costumes" },
  prop: { color: "#06B6D4", icon: Drama, label: "Props" },
  scenery: { color: "#10B981", icon: Palette, label: "Scenery" },
  equipment: { color: "#F59E0B", icon: Hammer, label: "Equipment" },
  lighting: { color: "#EF4444", icon: Lightbulb, label: "Lighting" },
  sound: { color: "#8B5A2B", icon: Headphones, label: "Sound" },
  fabric: { color: "#EC4899", icon: Shirt, label: "Fabric" },
  accessory: { color: "#6366F1", icon: Star, label: "Accessories" },
  furniture: { color: "#D97706", icon: Armchair, label: "Furniture" }
};

export default function CategoryBreakdown({ stats, isLoading }) {
  // Get the category stats from the stats object
  const categoryStats = stats?.byCategory || {};
  
  const chartData = Object.entries(categoryStats).map(([category, count]) => ({
    name: categoryConfig[category]?.label || category,
    value: count,
    color: categoryConfig[category]?.color || "#6B7280"
  }));

  const total = Object.values(categoryStats).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300">
      <CardHeader className="border-b border-base-300">
        <CardTitle className="text-xl font-bold text-base-content">
          Category Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {total > 0 ? (
          <>
            <div className="h-48 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} items`, name]}
                    contentStyle={{
                      backgroundColor: 'var(--base-200)',
                      border: '1px solid var(--base-300)',
                      borderRadius: '8px',
                      color: 'var(--base-content)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {Object.entries(categoryStats).map(([category, count]) => {
                const config = categoryConfig[category];
                const IconComponent = config?.icon || Package;
                const percentage = ((count / total) * 100).toFixed(1);
                
                return (
                  <Link to={createPageUrl(`Inventory?category=${category}`)} key={category}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-base-100 hover:bg-base-300/50 hover:shadow-inner transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${config?.color}20` }}
                        >
                          <IconComponent 
                            className="w-4 h-4" 
                            style={{ color: config?.color }}
                          />
                        </div>
                        <span className="font-medium text-base-content">
                          {config?.label || category}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-base-content">{count}</div>
                        <div className="text-xs text-base-content/70">{percentage}%</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-base-content/20 mx-auto mb-3" />
            <p className="text-base-content/70">No categories to display</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}