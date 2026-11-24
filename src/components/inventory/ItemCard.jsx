
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Edit, MapPin, Tag } from 'lucide-react';
import { createPageUrl } from '@/utils';
import AddToRentalButton from './AddToRentalButton';
import { useOffline } from '../shared/OfflineManager';

export default function ItemCard({ item, viewMode = 'grid', onDelete, containerName }) {
  const navigate = useNavigate();
  const { isOnline, getOfflinePhoto } = useOffline();
  const [photoUrl, setPhotoUrl] = useState(null);

  const primaryPhoto = item.photos?.find(p => p.is_primary) || item.photos?.[0];

  useEffect(() => {
    const loadPhoto = async () => {
      if (primaryPhoto?.url) {
        if (isOnline) {
          setPhotoUrl(primaryPhoto.url);
        } else {
          const offlineUrl = await getOfflinePhoto(primaryPhoto.url);
          setPhotoUrl(offlineUrl);
        }
      } else {
        setPhotoUrl(null);
      }
    };
    loadPhoto();
  }, [primaryPhoto?.url, isOnline, getOfflinePhoto]);

  const statusConfig = {
    available: { 
      label: 'Available', 
      className: 'bg-green-600 text-white border-green-700 font-semibold' 
    },
    in_use: { 
      label: 'In Use', 
      className: 'bg-red-600 text-white border-red-700 font-semibold' 
    },
    rented: { 
      label: 'Rented', 
      className: 'bg-blue-600 text-white border-blue-700 font-semibold' 
    },
    retired: { 
      label: 'Retired', 
      className: 'bg-gray-600 text-white border-gray-700 font-semibold' 
    },
    maintenance: { 
      label: 'Maintenance', 
      className: 'bg-orange-600 text-white border-orange-700 font-semibold' 
    },
    default: { 
      label: 'Unknown', 
      className: 'bg-gray-500 text-white border-gray-600 font-semibold' 
    },
  };

  const currentStatus = statusConfig[item.status] || statusConfig.default;
  const displayCategories = item.categories && item.categories.length > 0 ? item.categories : (item.category ? [item.category] : []);

  const handleCardClick = () => {
    window.scrollTo(0, 0);
    navigate(createPageUrl(`ItemDetails?id=${item.id}`), { state: { item } });
  };
  
  const handleEditClick = (e) => {
    e.stopPropagation();
    window.scrollTo(0, 0);
    navigate(createPageUrl(`AddItem?edit=${item.id}`), { state: { editItem: item }});
  };

  if (viewMode === 'list') {
    return (
      <Card 
        className="flex flex-col sm:flex-row w-full overflow-hidden transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-px bg-base-200/50 backdrop-blur-sm border-base-300 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex-shrink-0 w-full sm:w-32 h-48 sm:h-auto aspect-square sm:aspect-auto">
          {photoUrl ? (
            <img src={photoUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-base-300 flex items-center justify-center">
              <Package className="w-16 h-16 text-base-content/20" />
            </div>
          )}
        </div>
        <div className="flex-grow p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg font-bold leading-tight mb-2 text-base-content">{item.name}</CardTitle>
              <Badge variant="outline" className={`capitalize ${currentStatus.className} flex-shrink-0`}>{currentStatus.label}</Badge>
            </div>
            <p className="text-sm text-base-content/70 mb-2 truncate">{item.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/80">
              {item.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.location}</span>}
              {containerName && <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {containerName}</span>}
              <div className="flex flex-wrap gap-1">
                {displayCategories.map(cat => <Badge key={cat} variant="secondary" className="capitalize text-xs">{cat}</Badge>)}
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center gap-2 mt-4">
            <AddToRentalButton item={item} variant="outline" size="sm" />
            <Button variant="ghost" size="sm" onClick={handleEditClick}>
              <Edit className="w-4 h-4 mr-1"/> Edit
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Grid View (default)
  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out hover:shadow-2xl hover:-translate-y-1 theater-shadow bg-base-200/50 backdrop-blur-sm border-base-300">
      <CardHeader className="p-0 relative cursor-pointer" onClick={handleCardClick}>
        <div className="aspect-square w-full overflow-hidden">
          {photoUrl ? (
            <img src={photoUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full bg-base-300 flex items-center justify-center">
              <Package className="w-24 h-24 text-base-content/20" />
            </div>
          )}
        </div>
        <div className="absolute top-2 left-2">
            <Badge className={`capitalize ${currentStatus.className} shadow-lg`}>{currentStatus.label}</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow cursor-pointer" onClick={handleCardClick}>
        <CardTitle className="text-lg font-bold leading-tight mb-2 text-base-content">{item.name}</CardTitle>
        <div className="flex flex-wrap gap-1">
            {displayCategories.map(cat => <Badge key={cat} variant="secondary" className="capitalize text-xs">{cat}</Badge>)}
            {item.condition && <Badge variant="outline" className="capitalize text-xs">{item.condition.replace('_', ' ')}</Badge>}
        </div>
      </CardContent>

      <CardFooter className="p-3 border-t border-base-300 bg-base-200/30">
        <div className="w-full flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleEditClick} className="text-base-content/70 hover:text-primary flex-shrink-0">
            <Edit className="w-4 h-4 mr-1"/>
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <AddToRentalButton 
            item={item} 
            variant="ghost" 
            size="sm" 
            className="text-base-content/70 hover:text-primary flex-shrink-0"
          />
        </div>
      </CardFooter>
    </Card>
  );
}
