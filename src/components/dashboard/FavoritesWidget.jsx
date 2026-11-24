
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
// import { InventoryItem } from "@/entities/InventoryItem"; // Removed static import
// import { FavoriteItem } from "@/entities/FavoriteItem"; // Removed static import
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Eye, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserData } from '../shared/UserDataContext';

const categoryColors = {
  costume: "bg-pink-100 text-pink-800 border-pink-200",
  prop: "bg-blue-100 text-blue-800 border-blue-200",
  scenery: "bg-green-100 text-green-800 border-green-200",
  equipment: "bg-gray-100 text-gray-800 border-gray-200",
  lighting: "bg-yellow-100 text-yellow-800 border-yellow-200",
  sound: "bg-purple-100 text-purple-800 border-purple-200",
  fabric: "bg-teal-100 text-teal-800 border-teal-200",
  accessory: "bg-indigo-100 text-indigo-800 border-indigo-200",
  furniture: "bg-amber-100 text-amber-800 border-amber-200"
};

export default function FavoritesWidget({ className }) {
  const { currentUser, favoriteItems, reloadUserData, isLoadingUserData } = useUserData();
  const [favoriteItemDetails, setFavoriteItemDetails] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    const loadItemDetails = async () => {
      if (favoriteItems.length > 0) {
        setIsLoadingDetails(true);
        const { InventoryItem } = await import('@/entities/InventoryItem'); // Dynamic import
        const itemIds = favoriteItems.map(fav => fav.inventory_item_id);
        const items = await Promise.all(
          itemIds.map(id => InventoryItem.get(id).catch(() => null))
        );
        setFavoriteItemDetails(items.filter(Boolean));
      } else {
        setFavoriteItemDetails([]);
      }
      setIsLoadingDetails(false);
    };

    if (!isLoadingUserData) {
      loadItemDetails();
    }
  }, [favoriteItems, isLoadingUserData]);

  const handleRemoveFavorite = async (item, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const favoriteRecord = favoriteItems.find(fav => fav.inventory_item_id === item.id);
    if (favoriteRecord) {
      try {
        const { FavoriteItem } = await import('@/entities/FavoriteItem'); // Dynamic import
        await FavoriteItem.delete(favoriteRecord.id);
        await reloadUserData();
      } catch (error) {
        console.error("Error removing favorite:", error);
      }
    }
  };

  const isLoading = isLoadingUserData || isLoadingDetails;

  if (isLoading) {
    return (
      <Card className={`bg-base-200/50 backdrop-blur-sm shadow-md border border-base-300 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            My Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-12 h-12 rounded bg-base-300" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2 bg-base-300" />
                  <Skeleton className="h-3 w-20 bg-base-300" />
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
            <Heart className="w-5 h-5 text-primary" />
            My Favorites ({favoriteItemDetails.length})
          </span>
          {favoriteItemDetails.length > 0 && (
            <Link to={createPageUrl('Search?favorites=true')}>
              <Button 
                variant="default" 
                size="sm"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-content)',
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                View All
              </Button>
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {favoriteItemDetails.length > 0 ? (
          <div className="space-y-3">
            {favoriteItemDetails.slice(0, 5).map((item) => {
              const favorite = favoriteItems.find(fav => fav.inventory_item_id === item.id);
              const primaryPhoto = item.photos?.find(p => p.is_primary)?.url || item.photos?.[0]?.url;
              
              return (
                <Link 
                  key={item.id} 
                  to={createPageUrl(`ItemDetails?id=${item.id}`)}
                  className="block group"
                >
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-base-100 hover:bg-base-300/50 transition-colors">
                    <div className="flex-shrink-0">
                      {primaryPhoto ? (
                        <img 
                          src={primaryPhoto} 
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-base-300 rounded border flex items-center justify-center">
                          <Package className="w-6 h-6 text-base-content/40" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base-content group-hover:text-primary transition-colors truncate">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {item.category && (
                          <Badge className={`text-xs ${categoryColors[item.category] || 'bg-gray-100 text-gray-800'}`}>
                            {item.category}
                          </Badge>
                        )}
                        {item.location && (
                          <span className="text-xs text-base-content/70">{item.location}</span>
                        )}
                      </div>
                      {favorite?.notes && (
                        <p className="text-xs text-base-content/60 mt-1 truncate">{favorite.notes}</p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleRemoveFavorite(item, e)}
                      className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </Button>
                  </div>
                </Link>
              );
            })}
            
            {favoriteItemDetails.length > 5 && (
              <div className="pt-3 border-t border-base-300">
                <Link to={createPageUrl('Search?favorites=true')}>
                  <Button 
                    variant="default" 
                    className="w-full"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-content)',
                    }}
                  >
                    View All {favoriteItemDetails.length} Favorites
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Heart className="w-12 h-12 text-base-content/20 mx-auto mb-3" />
            <h3 className="font-medium text-base-content/70 mb-2">No favorites yet</h3>
            <p className="text-sm text-base-content/50 mb-4">
              Click the heart icon on an item to see it here.
            </p>
            <Link to={createPageUrl('Inventory')}>
              <Button 
                variant="default" 
                size="sm"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-content)',
                }}
              >
                <Package className="w-4 h-4 mr-2" />
                Browse Inventory
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
