
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AddToRentalButton({ 
  item, 
  variant = "default", 
  size = "default",
  className = ""
}) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToRental = (e) => {
    e.stopPropagation();
    setIsLoading(true);
    
    // Add item to localStorage for rental order creation
    const currentItems = JSON.parse(localStorage.getItem('rental-items') || '[]');
    const existingItem = currentItems.find(existing => existing.inventory_item_id === item.id);
    
    if (!existingItem) {
      currentItems.push({
        inventory_item_id: item.id,
        item_name: item.name,
        quantity: 1,
        daily_rate: item.rental_rate || 0,
        notes: ''
      });
      localStorage.setItem('rental-items', JSON.stringify(currentItems));
    }
    
    setIsLoading(false);
    navigate(createPageUrl('RentalOrderEditor'));
  };

  if (variant === "ghost" && size === "sm") {
    return (
      <Button 
        variant={variant}
        size={size}
        onClick={handleAddToRental}
        disabled={isLoading}
        className={`${className} min-w-0`}
      >
        {isLoading ? (
          <RotateCw className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Rental</span>
          </>
        )}
      </Button>
    );
  }

  if (size === "icon") {
    return (
      <Button 
        variant={variant}
        size={size}
        onClick={handleAddToRental}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? (
          <RotateCw className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
      </Button>
    );
  }

  return (
    <Button 
      variant={variant}
      size={size}
      onClick={handleAddToRental}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Plus className="w-4 h-4 mr-2" />
      )}
      Add to Rental
    </Button>
  );
}
