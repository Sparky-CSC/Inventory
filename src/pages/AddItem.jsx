import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ItemForm from '../components/inventory/ItemForm';
import { InventoryItem } from '@/entities/InventoryItem';
import { useOffline } from '../components/shared/OfflineManager';
import BackButton from '../components/shared/BackButton';
import { generateItemUid } from '@/lib/itemCodes';

export default function AddItem() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline, addOfflineChange } = useOffline();
  
  const { editItem } = location.state || {};
  const pageTitle = editItem ? "Edit Item" : "Add Item";

  const handleSubmit = async (formData) => {
    // Every item needs its own UID: it is what the printed label points at.
    const itemData = {
      ...formData,
      uid: (formData.uid || '').trim() || generateItemUid(formData.categories?.[0] || formData.category),
    };

    if (!isOnline) {
      await addOfflineChange(
        'items',
        editItem ? 'update' : 'create',
        editItem ? { ...itemData, id: editItem.id } : itemData
      );
      navigate('/Inventory');
      return;
    }

    try {
      // No two items may share a UID, or scanning one label would open the other.
      const sameUid = (await InventoryItem.filter({ uid: itemData.uid })).filter((other) => other.id !== editItem?.id);
      if (sameUid.length) {
        if (editItem && editItem.uid === itemData.uid) {
          // An older duplicate: leave it; the ID check in Administration sorts these out.
        } else if (editItem) {
          alert(`The UID ${itemData.uid} already belongs to “${sameUid[0].name}”. Choose a different UID.`);
          return;
        } else {
          itemData.uid = generateItemUid(itemData.categories?.[0] || itemData.category);
        }
      }
      if (editItem) {
        await InventoryItem.update(editItem.id, itemData);
      } else {
        await InventoryItem.create(itemData);
      }
      navigate('/Inventory');
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Error saving item. Please try again.');
    }
  };
  
  const handleCancel = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton />
        <div className="my-6">
          <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2">
            {pageTitle}
          </h1>
          <p className="text-base lg:text-lg text-primary font-medium">
            {editItem 
              ? `Editing details for ${editItem.name}` 
              : 'Fill in the details to add a new item to the inventory.'}
          </p>
        </div>
        
        <ItemForm
          item={editItem}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
        
        {!isOnline && (
          <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
            You are offline. Changes will be saved locally and synced when you reconnect.
          </div>
        )}
      </div>
    </div>
  );
}