
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { 
  Shirt, Drama, Hammer, Lightbulb, Palette, Clock,
  Package, Star
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom"; // Import useNavigate

// Dummy createPageUrl function for self-containment
// In a real application, this would likely be an imported utility from a router setup file.
const createPageUrl = (path) => path;

const categoryIcons = {
  costume: Shirt,
  prop: Drama,
  scenery: Palette,
  equipment: Hammer,
  lighting: Lightbulb,
  sound: Package,
  fabric: Shirt,
  accessory: Star,
  unknown: Package // Fallback for unknown categories
};

export default function RecentActivity({ items = [], isLoading }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-base-content flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl bg-base-300" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4 bg-base-300" />
                <Skeleton className="h-3 w-1/2 bg-base-300" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-base-content flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Activity
        </CardTitle>
        <CardDescription className="text-base-content/70">Recently added items to your inventory</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {safeItems.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No recent activity to display</p>
            </div>
          ) : (
            safeItems.map((item) => {
              const primaryCategory = item.categories && Array.isArray(item.categories) && item.categories.length > 0 
                ? item.categories[0] 
                : item.category || 'unknown';
              const IconComponent = categoryIcons[primaryCategory] || Package;
              
              return (
                <div 
                  key={item.id} 
                  className="p-6 hover:bg-base-300/50 transition-colors duration-200 cursor-pointer group"
                  onClick={() => {
                    // Scroll to top before navigating
                    window.scrollTo(0, 0);
                    navigate(createPageUrl(`ItemDetails?id=${item.id}`), { state: { item } });
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-base-200 rounded-xl overflow-hidden flex-shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                      {item.photos && Array.isArray(item.photos) && item.photos.length > 0 ? (
                        <img 
                          src={item.photos.find(p => p.is_primary)?.url || item.photos[0]?.url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary rounded-xl flex items-center justify-center">
                          <IconComponent className="w-6 h-6 text-primary-content" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-base-content group-hover:text-primary transition-colors truncate">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-base-content/70">
                        <span className="capitalize">{primaryCategory.replace(/_/g, ' ')}</span>
                        <span>•</span>
                        <span>Added {format(new Date(item.created_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    {/* Removed the hover-only button to make the whole row clickable */}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
