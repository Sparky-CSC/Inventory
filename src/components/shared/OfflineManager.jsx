
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { IS_LOCAL_MODE } from '@/api/config';

const OfflineContext = createContext(null);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

class OfflineStorage {
  constructor() {
    this.dbName = 'StageVaultOfflineDB';
    this.version = 5; // Incremented to add user profile and favorites
    this.stores = [
      'items', 'containers', 'locations', 'categories',
      'rentalOrders', 'borrowedItems', 'pendingChanges',
      'renters', 'invoices', 'photos',
      'userProfile', 'favoriteItems' // Stores for user-specific data
    ];
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        this.stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            if (storeName === 'pendingChanges') {
              store.createIndex('timestamp', 'timestamp', { unique: false });
              store.createIndex('entity', 'entity', { unique: false });
            }
            if (storeName === 'photos') {
              store.createIndex('url', 'url', { unique: true });
            }
            // For userProfile and favoriteItems, default keyPath 'id' is used.
            // If userProfile is a singleton, you might use a fixed key like { keyPath: 'profileId' }
            // or even no keyPath if you store a single object, then use put(data, 'fixedKey').
            // For now, keyPath: 'id' is a general safe default.
          }
        });

        // Delete old stores if any for previous versions (optional, but good practice for cleanup)
        // This example only adds new stores, but if you removed any stores in previous versions,
        // you would handle their deletion here.
      };
    });
  }

  async saveData(storeName, data, { replaceAll = false } = {}) {
    const db = await this.initDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    // When a whole list is saved, remove what was there before so records
    // deleted since the last save do not linger in the offline copy.
    if (replaceAll) {
      store.clear();
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        // Ensure each item has an ID before storing
        if (item && (item.id !== undefined && item.id !== null)) { // Check for presence of id, including 0
          store.put(item);
        } else {
          console.warn(`Skipping item without valid ID in ${storeName}:`, item);
        }
      }
    } else {
      // Ensure single item has an ID before storing
      if (data && (data.id !== undefined && data.id !== null)) { // Check for presence of id, including 0
        store.put(data);
      } else {
        console.warn(`Skipping item without valid ID in ${storeName}:`, data);
      }
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getData(storeName, key = null) {
    const db = await this.initDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = key ? store.get(key) : store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addPendingChange(entity, operation, data) {
    const change = {
      id: Date.now().toString(),
      entity,
      operation, // 'create', 'update', 'delete'
      data,
      timestamp: new Date().toISOString()
    };

    await this.saveData('pendingChanges', change);
    return change;
  }

  async getPendingChanges() {
    return await this.getData('pendingChanges');
  }

  async removePendingChange(changeId) {
    const db = await this.initDB();
    const transaction = db.transaction(['pendingChanges'], 'readwrite');
    const store = transaction.objectStore('pendingChanges');

    return new Promise((resolve, reject) => {
      const request = store.delete(changeId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(transaction.error);
    });
  }

  async cachePhoto(url) {
    try {
      // Check if photo is already cached
      const cachedPhoto = await this.getPhotoByUrl(url);
      if (cachedPhoto) {
        return cachedPhoto.dataUrl;
      }

      // Fetch and convert to lower quality data URL
      const response = await fetch(url);
      const blob = await response.blob();

      // Convert to canvas for compression
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      return new Promise((resolve, reject) => {
        const cleanup = (objectUrl) => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
        };

        const handleSuccess = (dataUrl, objectUrl) => {
          cleanup(objectUrl);
          // Cache the compressed photo
          this.saveData('photos', {
            id: url,
            url: url,
            dataUrl: dataUrl,
            cached_date: new Date().toISOString()
          }).then(() => {
            resolve(dataUrl);
          }).catch(() => {
            resolve(dataUrl); // Still return the dataUrl even if caching fails
          });
        };

        const handleFailure = (objectUrl, fallbackUrl = url) => {
          cleanup(objectUrl);
          console.warn('Photo caching failed, using original URL as fallback for', url);
          // Cache the original URL as fallback
          this.saveData('photos', {
            id: url,
            url: url,
            dataUrl: fallbackUrl,
            cached_date: new Date().toISOString()
          }).then(() => {
            resolve(fallbackUrl);
          }).catch(() => {
            resolve(fallbackUrl);
          });
        };

        img.onload = function() {
          const objectUrl = this.getAttribute('data-object-url');
          try {
            // Resize to max 400px width for offline storage
            const maxWidth = 400;
            // Ensure ratio doesn't scale up small images. Ratio is calculated based on width OR height.
            // Corrected ratio calculation to consider both dimensions proportionally without scaling up.
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1); 
            
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Try to convert to compressed data URL
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            handleSuccess(dataUrl, objectUrl);
          } catch (canvasError) {
            console.warn('Canvas toDataURL failed due to CORS or other issues for', url, ':', canvasError);
            handleFailure(objectUrl);
          }
        };

        img.onerror = function() {
          const objectUrl = this.getAttribute('data-object-url');
          console.error('Image load error for URL:', url);
          handleFailure(objectUrl);
        };

        // Create object URL from blob to avoid direct CORS issues
        const objectUrl = URL.createObjectURL(blob);
        
        // Store object URL reference for cleanup
        img.setAttribute('data-object-url', objectUrl);
        
        // Set crossOrigin to try to avoid CORS issues if direct URL was used
        // With createObjectURL, this is less critical but still good practice
        // if the image itself could theoretically taint the canvas through other means.
        img.crossOrigin = 'anonymous'; 
        img.src = objectUrl;
      });
    } catch (error) {
      console.error('Error in cachePhoto processing for', url, ':', error);
      // Return original URL as final fallback
      try {
        await this.saveData('photos', {
          id: url,
          url: url,
          dataUrl: url,
          cached_date: new Date().toISOString()
        });
      } catch (cacheError) {
        console.warn('Failed to cache fallback photo reference for', url, ':', cacheError);
      }
      return url;
    }
  }

  async getPhotoByUrl(url) {
    const db = await this.initDB();
    const transaction = db.transaction(['photos'], 'readonly');
    const store = transaction.objectStore('photos');
    const index = store.index('url');

    return new Promise((resolve, reject) => {
      const request = index.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const OfflineProvider = ({ children }) => {
  // When the data lives in this browser (local mode) there is nothing to be
  // "offline" from, so the app always behaves as if it is connected.
  const [isOnline, setIsOnline] = useState(IS_LOCAL_MODE ? true : navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [offlineStorage] = useState(() => new OfflineStorage());
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('idle');
  const [downloadProgress, setDownloadProgress] = useState({ stage: 'idle', current: 0, total: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);

    const handleOffline = () => setIsOnline(false);

    // Load pending changes on initial app load
    loadPendingChanges();

    if (IS_LOCAL_MODE) return undefined;

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatically send saved-up changes once the connection is back.
  useEffect(() => {
    if (isOnline && pendingChanges.length > 0 && syncStatus === 'idle') {
      syncPendingChanges();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingChanges.length]);

  const loadPendingChanges = async () => {
    try {
      const changes = await offlineStorage.getPendingChanges();
      setPendingChanges(changes || []);
    } catch (error) {
      console.error('Error loading pending changes:', error);
    }
  };

  const cacheData = useCallback(async (entityType, data) => {
    try {
      // Filter out any items without valid IDs before caching
      const validData = Array.isArray(data)
        ? data.filter(item => item && (item.id !== undefined && item.id !== null))
        : (data && (data.id !== undefined && data.id !== null) ? data : null);

      if (Array.isArray(validData)) {
        await offlineStorage.saveData(entityType, validData, { replaceAll: true });
      } else if (validData) {
        await offlineStorage.saveData(entityType, validData);
      } else {
        console.warn(`No valid data to cache for ${entityType}`);
      }
    } catch (error) {
      console.error(`Error caching ${entityType}:`, error);
      // Don't propagate the error to avoid breaking the UI
    }
  }, [offlineStorage]);

  const getCachedData = useCallback(async (entityType, key = null) => {
    try {
      const result = await offlineStorage.getData(entityType, key);
      // Ensure we always return an array for list operations, even if empty
      return Array.isArray(result) ? result : (result ? [result] : []);
    } catch (error) {
      console.error(`Error getting cached ${entityType}:`, error);
      return []; // Return empty array on error
    }
  }, [offlineStorage]);

  const addOfflineChange = useCallback(async (entity, operation, data) => {
    try {
      const change = await offlineStorage.addPendingChange(entity, operation, data);
      setPendingChanges(prev => [...prev, change]);
      return change;
    }
    catch (error) {
      console.error('Error adding offline change:', error);
      throw error;
    }
  }, [offlineStorage]);

  const syncPendingChanges = async () => {
    if (!isOnline || pendingChanges.length === 0 || syncStatus === 'syncing') return;

    setSyncStatus('syncing');
    const failedChanges = [];

    // Dynamically import entities to avoid circular dependencies
    let entityMap = {};
    try {
      const [
        { InventoryItem },
        { Container },
        { Location },
        { BorrowedItem }
      ] = await Promise.all([
        import('@/entities/InventoryItem'),
        import('@/entities/Container'),
        import('@/entities/Location'),
        import('@/entities/BorrowedItem')
      ]);

      entityMap = {
        items: InventoryItem,
        containers: Container,
        locations: Location,
        borrowedItems: BorrowedItem,
      };
    } catch (importError) {
      console.error('Failed to import entities for sync:', importError);
      setSyncStatus('error');
      return;
    }

    for (const change of pendingChanges) {
      try {
        const EntityClass = entityMap[change.entity];
        if (!EntityClass) {
          console.warn(`No entity class found for ${change.entity}. Skipping sync.`);
          continue;
        }

        switch (change.operation) {
          case 'create':
            await EntityClass.create(change.data);
            break;
          case 'update':
            await EntityClass.update(change.data.id, change.data);
            break;
          case 'delete':
            await EntityClass.delete(change.data.id);
            break;
          default:
             console.warn(`Unknown operation type: ${change.operation}`);
        }

        await offlineStorage.removePendingChange(change.id);
      } catch (error) {
        console.error('Error syncing change:', change, error);
        failedChanges.push(change);
      }
    }

    if (failedChanges.length > 0) {
      setPendingChanges(failedChanges);
      setSyncStatus('error');
    } else {
      setPendingChanges([]);
      setSyncStatus('success');
      setLastSyncTime(new Date());
      setTimeout(() => setSyncStatus('idle'), 3000); // Revert to idle after 3s
    }
  };

  const downloadForOffline = async () => {
    setDownloadStatus('downloading');
    setDownloadProgress({ stage: 'Initializing...', current: 0, total: 100 });
    try {
      // Step 1: Import entities
      setDownloadProgress({ stage: 'Loading required modules...', current: 5, total: 100 });
      const [
        { InventoryItem }, { Container }, { Location }, { Category },
        { BorrowedItem }, { RentalOrder }, { Renter }, { Invoice }
      ] = await Promise.all([
        import('@/entities/InventoryItem'),
        import('@/entities/Container'),
        import('@/entities/Location'),
        import('@/entities/Category'),
        import('@/entities/BorrowedItem'),
        import('@/entities/RentalOrder'),
        import('@/entities/Renter'),
        import('@/entities/Invoice')
      ]);

      // Step 2: Download all data lists
      setDownloadProgress({ stage: 'Fetching all data from server...', current: 15, total: 100 });
      const [
        items, containers, locations, categories, borrowedItems,
        rentalOrders, renters, invoices
      ] = await Promise.all([
        InventoryItem.list(),
        Container.list(),
        Location.list(),
        Category.list(),
        BorrowedItem.list(),
        RentalOrder.list(),
        Renter.list(),
        Invoice.list(),
      ]);

      // Step 3: Cache text-based data
      setDownloadProgress({ stage: 'Caching data for offline access...', current: 25, total: 100 });
      await Promise.all([
        cacheData('items', items),
        cacheData('containers', containers),
        cacheData('locations', locations),
        cacheData('categories', categories),
        cacheData('borrowedItems', borrowedItems),
        cacheData('rentalOrders', rentalOrders),
        cacheData('renters', renters),
        cacheData('invoices', invoices),
      ]);

      // Step 4: Gather and cache photos with progress
      setDownloadProgress({ stage: 'Preparing photos for download...', current: 35, total: 100 });
      const allPhotos = [];
      items.forEach(item => {
        if (item.photos && Array.isArray(item.photos)) {
          item.photos.forEach(photo => {
            if (photo.url) allPhotos.push(photo.url);
          });
        }
      });
      borrowedItems.forEach(item => {
        if (item.photos && Array.isArray(item.photos)) {
          item.photos.forEach(photo => {
            if (photo.url) allPhotos.push(photo.url);
          });
        }
      });

      if (allPhotos.length > 0) {
        const photoProgressStart = 35;
        const photoProgressEnd = 95;
        const photoProgressRange = photoProgressEnd - photoProgressStart;

        for (let i = 0; i < allPhotos.length; i++) {
          const url = allPhotos[i];
          try {
            await offlineStorage.cachePhoto(url);
          } catch (photoError) {
            console.warn(`Failed to cache photo: ${url}`, photoError);
          }
          // Update progress after each photo
          const currentProgress = photoProgressStart + Math.round(((i + 1) / allPhotos.length) * photoProgressRange);
          setDownloadProgress({ stage: `Compressing photo ${i + 1} of ${allPhotos.length}`, current: currentProgress, total: 100 });
          
          // Yield to the main thread every 5 photos to prevent UI freeze
          if ((i + 1) % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }
      }
      
      setDownloadProgress({ stage: 'Finalizing...', current: 95, total: 100 });

      // Mark download as successful immediately after caching all data and photos.
      setDownloadStatus('success');
      setDownloadProgress({ stage: 'Download Complete!', current: 100, total: 100 });
      setTimeout(() => setDownloadStatus('idle'), 5000);

      return true;

    } catch (error) {
      console.error('Error downloading offline data:', error);
      setDownloadStatus('error');
      setDownloadProgress({ stage: 'error', current: 0, total: 0 });
      setTimeout(() => setDownloadStatus('idle'), 5000);
      return false;
    }
  };

  const getOfflinePhoto = useCallback(async (url) => {
    if (!url) return null;
    try {
      const cachedPhoto = await offlineStorage.getPhotoByUrl(url);
      return cachedPhoto ? cachedPhoto.dataUrl : url;
    } catch (error) {
      console.error('Error getting offline photo:', error);
      return url; // Fallback to original URL
    }
  }, [offlineStorage]);

  const contextValue = {
    isOnline,
    pendingChanges,
    syncStatus,
    lastSyncTime,
    cacheData,
    getCachedData,
    addOfflineChange,
    syncPendingChanges,
    downloadForOffline,
    downloadStatus,
    downloadProgress,
    getOfflinePhoto,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
};

// Button + dialog for downloading data for offline use. Rendered inside the
// app shell (mobile top bar / desktop sidebar) so it never covers page content.
export const OfflineSetupButton = ({ compact = false, className = '' }) => {
  const { downloadForOffline, downloadStatus, downloadProgress } = useOffline();
  if (IS_LOCAL_MODE) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className={`flex-shrink-0 ${className}`}
            aria-label="Offline setup"
            title="Offline setup"
          >
            <Download className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={`w-full justify-start ${className}`}>
            <Download className="w-4 h-4 mr-2" />
            Offline Setup
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Offline Access</DialogTitle>
          <DialogDescription>
            Download all inventory data to your device to browse and make changes while offline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="h-24">
            <Button
              onClick={downloadForOffline}
              disabled={downloadStatus === 'downloading'}
              className="w-full h-16"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-content)',
              }}
            >
              {downloadStatus === 'downloading' ? (
                <div className="w-full text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin"/> 
                    Downloading...
                  </div>
                  <p className="text-xs mt-1 text-primary-content/70 truncate">{downloadProgress.stage}</p>
                  {downloadProgress.total > 0 && (
                    <div className="w-full bg-primary-content/20 rounded-full h-2 mt-2.5">
                      <div 
                        className="bg-primary-content h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              ) : downloadStatus === 'success' ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2"/> 
                  Download Complete!
                </>
              ) : downloadStatus === 'error' ? (
                <>
                  <AlertCircle className="w-4 h-4 mr-2"/> 
                  Download Failed. Retry?
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2"/> 
                  Download Data for Offline Use
                </>
              )}
            </Button>
            {downloadStatus === 'downloading' && (
                <p className="text-center text-xs text-base-content/60 mt-2">
                  Please keep this window open. Photos are compressed for faster offline access.
                </p>
            )}
          </div>

          {downloadStatus === 'success' && (
            <Alert variant="default" className="bg-success/10 border-success/50">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success-content">
                All data has been successfully downloaded for offline use. You can now browse your inventory even without an internet connection.
                <br /><br />
                <strong>Install the app</strong> by looking for the install button in your browser or the install prompt to get the full offline experience!
              </AlertDescription>
            </Alert>
          )}
          
          {downloadStatus === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                There was an error downloading the data. Please check your connection and try again.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-base-content/60 space-y-2">
            <p><strong>What gets downloaded:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>All inventory items with photos</li>
              <li>Container and location data</li>
              <li>Rental orders and borrowed items</li>
              <li>Categories and subcategories</li>
            </ul>
            <p className="text-xs">
              <strong>Note:</strong> Photos are compressed for offline storage to save space.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
