
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BorrowedItem } from '@/entities/BorrowedItem';
import { User } from '@/entities/User'; // Added User entity import
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert'; // Added Alert and AlertDescription import
import {
  Plus, Clock, CheckCircle, AlertTriangle, Package,
  ArrowRightLeft // Added ArrowRightLeft import
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
// Fixed the parsing error here
import { Skeleton } from '@/components/ui/skeleton';
import BorrowedItemForm from '../components/borrowed/BorrowedItemForm';
import BorrowedItemCard from '../components/borrowed/BorrowedItemCard';
import BackButton from '../components/shared/BackButton';
import { useOffline } from '../components/shared/OfflineManager'; // Added useOffline import

export default function BorrowedItems() {
  const [borrowedItems, setBorrowedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false); // Renamed from showAddDialog
  const [editingItem, setEditingItem] = useState(null);
  const [filter, setFilter] = useState('all'); // all, borrowed, overdue, returned
  const [error, setError] = useState(null); // Added for displaying errors
  const location = useLocation();
  const navigate = useNavigate();
  const { isOnline, getCachedData, cacheData } = useOffline(); // Destructure useOffline hook

  useEffect(() => {
    loadItems(); // Renamed from loadBorrowedItems
  }, []);

  // New useEffect to handle deep linking to edit dialog
  useEffect(() => {
    if (borrowedItems.length > 0) {
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit');
      if (editId) {
        const itemToEdit = borrowedItems.find(item => item.id === editId);
        if (itemToEdit) {
          handleEdit(itemToEdit);
          // Open the editor once, then drop "?edit=…" from the address so it
          // does not reopen after saving.
          navigate(location.pathname, { replace: true });
        }
      }
    }
  }, [borrowedItems, location.search]);

  const loadItems = async () => { // Renamed from loadBorrowedItems
    setIsLoading(true);
    setError(null); // Clear previous errors
    let loadedFromCacheSuccessfully = false;

    // Try to load cached data first
    try {
      const cachedItems = await getCachedData('borrowedItems');
      if (cachedItems && cachedItems.length > 0) {
        const updatedItems = cachedItems.map(item => {
          if (item.status === 'borrowed' && item.due_date) {
            const dueDate = new Date(item.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set hours to 0 to compare dates only
            if (today > dueDate) {
              return { ...item, status: 'overdue' };
            }
          }
          return item;
        });
        setBorrowedItems(updatedItems);
        setIsLoading(false); // Update UI quickly with cached data
        loadedFromCacheSuccessfully = true;
      }
    } catch (cacheError) {
      console.warn('Error loading cached borrowed items:', cacheError);
    }

    // If offline, stop here
    if (!isOnline) {
      if (!loadedFromCacheSuccessfully) {
        setError('You are offline and no cached data is available.');
      } else {
        setError('You are offline. Displaying cached data, which may be outdated.');
      }
      setIsLoading(false); // Ensure loading state is off
      return;
    }

    // Try to fetch fresh data if online
    try {
      const items = await BorrowedItem.list('-borrowed_date');
      const updatedItems = items.map(item => {
        if (item.status === 'borrowed' && item.due_date) {
          const dueDate = new Date(item.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (today > dueDate) {
            return { ...item, status: 'overdue' };
          }
        }
        return item;
      });
      setBorrowedItems(updatedItems);

      // Cache fresh data
      await cacheData('borrowedItems', updatedItems);
    } catch (error) {
      console.error('Error loading borrowed items:', error);
      if (error.message && error.message.includes('429')) {
        setError('Server is busy. Please wait a moment and try again. ' + (loadedFromCacheSuccessfully ? 'Displaying cached data.' : ''));
      } else if (!loadedFromCacheSuccessfully) { // If no items at all (neither cache nor fresh)
        setError('Failed to load borrowed items.');
      } else { // If items were loaded from cache, but online fetch failed
        setError('Failed to refresh data. Displaying cached data.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateItem = async (formData) => {
    setError(null);
    try {
      await BorrowedItem.create(formData);
      setShowForm(false); // Changed from setShowAddDialog
      loadItems(); // Changed from loadBorrowedItems
    } catch (error) {
      console.error('Error creating borrowed item:', error);
      setError('Failed to create borrowed item.');
    }
  };

  const handleUpdateItem = async (formData) => {
    setError(null);
    try {
      await BorrowedItem.update(editingItem.id, formData);
      setEditingItem(null);
      setShowForm(false); // Changed from setShowAddDialog
      loadItems(); // Changed from loadBorrowedItems
    } catch (error) {
      console.error('Error updating borrowed item:', error);
      setError('Failed to update borrowed item.');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (confirm('Are you sure you want to delete this borrowed item record?')) {
      setError(null);
      try {
        await BorrowedItem.delete(itemId);
        loadItems(); // Changed from loadBorrowedItems
      } catch (error) {
        console.error('Error deleting borrowed item:', error);
        setError('Failed to delete borrowed item.');
      }
    }
  };

  // New functions from outline
  const handleMarkReturned = async (itemToReturn) => {
    setError(null);
    try {
      const user = await User.me();
      const returnedByName = user.full_name || user.email;

      await BorrowedItem.update(itemToReturn.id, {
        status: 'returned',
        returned_date: new Date().toISOString().split('T')[0],
        returned_by: returnedByName,
      });
      await loadItems(); // Changed from loadBorrowedItems
    } catch (error) {
      console.error('Error marking item as returned:', error);
      setError('Failed to mark item as returned.');
    }
  };

  const handleUndoReturn = async (itemToUndo) => {
    setError(null);
    try {
      await BorrowedItem.update(itemToUndo.id, {
        status: 'borrowed',
        returned_date: null,
        returned_by: null,
      });
      await loadItems(); // Changed from loadBorrowedItems
    } catch (error) {
      console.error('Error undoing return:', error);
      setError('Failed to undo return.');
    }
  };

  // Modified handleToggleReturnStatus to use the new functions
  const handleToggleReturnStatus = async (item) => {
    if (item.status === 'returned') {
      await handleUndoReturn(item);
    } else {
      await handleMarkReturned(item);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true); // Changed from setShowAddDialog
  };

  const resetForm = () => {
    setEditingItem(null);
    setShowForm(false); // Changed from setShowAddDialog
    setError(null); // Clear errors when form is reset
  };

  const filteredItems = borrowedItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'borrowed') return item.status === 'borrowed';
    if (filter === 'overdue') return item.status === 'overdue';
    if (filter === 'returned') return item.status === 'returned';
    return false;
  });

  const getStatusStats = () => {
    const borrowed = borrowedItems.filter(item => item.status === 'borrowed').length;
    const overdue = borrowedItems.filter(item => item.status === 'overdue').length;
    const returned = borrowedItems.filter(item => item.status === 'returned').length;
    return { borrowed, overdue, returned, total: borrowedItems.length };
  };

  const stats = getStatusStats();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton className="mb-4" />

        {/* Show error alert if there's an error */}
        {error && (
          <Alert className="mb-4 bg-warning/10 border-warning/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"> {/* Changed classes */}
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3"> {/* Changed classes */}
              <ArrowRightLeft className="w-8 h-8 text-primary" /> {/* Added icon */}
              Borrowed Items
            </h1>
            <p className="text-base lg:text-lg text-primary font-medium"> {/* Changed classes and text */}
              Track items borrowed from other organizations or individuals.
            </p>
          </div>

          <Dialog open={showForm} onOpenChange={(isOpen) => { // Changed from showAddDialog
            if (!isOpen) resetForm();
            setShowForm(isOpen); // Changed from setShowAddDialog
          }}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setEditingItem(null)} // Keep this to clear form for adding
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-content)',
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Borrowed Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Edit Borrowed Item' : 'Add Borrowed Item'}
                </DialogTitle>
              </DialogHeader>
              <BorrowedItemForm
                item={editingItem}
                onSave={editingItem ? handleUpdateItem : handleCreateItem}
                onCancel={resetForm}
                isEditing={!!editingItem}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-base-200/50 backdrop-blur-sm theater-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-[var(--color-info)]" />
                <div>
                  <p className="text-sm font-medium text-base-content/70">Currently Borrowed</p>
                  <p className="text-2xl font-bold text-[var(--color-info)]">{stats.borrowed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-base-200/50 backdrop-blur-sm theater-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-[var(--color-error)]" />
                <div>
                  <p className="text-sm font-medium text-base-content/70">Overdue</p>
                  <p className="text-2xl font-bold text-[var(--color-error)]">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-base-200/50 backdrop-blur-sm theater-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-[var(--color-success)]" />
                <div>
                  <p className="text-sm font-medium text-base-content/70">Returned</p>
                  <p className="text-2xl font-bold text-[var(--color-success)]">{stats.returned}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'borrowed', 'overdue', 'returned'].map(status => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              style={filter === status ? {
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-content)',
              } : {
                borderColor: 'var(--base-300)',
                color: 'var(--base-content)',
              }}
            >
              {status === 'all' ? 'All Items' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-2xl bg-base-300" />
            ))
          ) : filteredItems.length > 0 ? (
            <AnimatePresence>
              {filteredItems.map(item => (
                <BorrowedItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDeleteItem}
                  onToggleReturn={handleToggleReturnStatus}
                />
              ))}
            </AnimatePresence>
          ) : (
            <div className="col-span-full text-center py-20">
              <Package className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-base-content mb-2">
                {filter === 'all' ? 'No borrowed items yet' : `No ${filter} items`}
              </h3>
              <p className="text-base-content/70">
                {filter === 'all'
                  ? 'Start tracking items you borrow from others.'
                  : `There are no items with the '${filter}' status.`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
