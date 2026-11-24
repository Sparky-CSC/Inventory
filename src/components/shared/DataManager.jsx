import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useOffline } from './OfflineManager';
import { onDataChanged } from '@/api/events';
import { BorrowedItem, Category, Container, InventoryItem, Location, RentalOrder } from '@/api/entities';

const DataContext = createContext(null);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

// The lists several screens share (dashboard, inventory, filters). Each entry
// says where the data comes from and under which name it is cached for
// offline use.
const SOURCES = {
  items: { entity: InventoryItem, entityName: 'InventoryItem', cacheKey: 'items' },
  containers: { entity: Container, entityName: 'Container', cacheKey: 'containers' },
  rentalOrders: { entity: RentalOrder, entityName: 'RentalOrder', cacheKey: 'rentalOrders' },
  borrowedItems: { entity: BorrowedItem, entityName: 'BorrowedItem', cacheKey: 'borrowedItems' },
  locations: { entity: Location, entityName: 'Location', cacheKey: 'locations' },
  categories: { entity: Category, entityName: 'Category', cacheKey: 'categories' },
};

const EMPTY = { items: [], containers: [], rentalOrders: [], borrowedItems: [], locations: [], categories: [] };

const newestFirst = (list) =>
  [...(list || [])].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));

export const DataProvider = ({ children }) => {
  const [data, setData] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isOnline, getCachedData, cacheData } = useOffline();
  const loadId = useRef(0);

  const loadOne = useCallback(
    async (key) => {
      const source = SOURCES[key];
      const fresh = await source.entity.list('-created_date');
      setData((prev) => ({ ...prev, [key]: fresh || [] }));
      // Keep a copy for offline use; a failure here must not break the page.
      cacheData(source.cacheKey, fresh).catch(() => {});
      return fresh;
    },
    [cacheData]
  );

  const loadAllData = useCallback(async () => {
    const thisLoad = ++loadId.current;
    setIsLoading(true);
    setError(null);

    if (!isOnline) {
      // Offline: show whatever was saved on this device last time.
      const entries = await Promise.all(
        Object.entries(SOURCES).map(async ([key, source]) => [
          key,
          newestFirst(await getCachedData(source.cacheKey).catch(() => [])),
        ])
      );
      if (thisLoad === loadId.current) {
        setData(Object.fromEntries(entries));
        setIsLoading(false);
      }
      return;
    }

    const results = await Promise.allSettled(Object.keys(SOURCES).map((key) => loadOne(key)));
    if (thisLoad !== loadId.current) return;

    const failedKeys = Object.keys(SOURCES).filter((_, index) => results[index].status === 'rejected');
    if (failedKeys.length > 0) {
      console.warn('Some data could not be loaded:', failedKeys);
      // Fall back to the saved copy for anything that failed.
      const fallbacks = await Promise.all(
        failedKeys.map(async (key) => [key, newestFirst(await getCachedData(SOURCES[key].cacheKey).catch(() => []))])
      );
      if (thisLoad !== loadId.current) return;
      setData((prev) => ({ ...prev, ...Object.fromEntries(fallbacks) }));
      setError('Failed to load some data. Using saved data where available.');
    }
    setIsLoading(false);
  }, [isOnline, getCachedData, loadOne]);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Refresh a list as soon as something in it is added, edited or deleted
  // anywhere in the app, so the dashboard and inventory never show stale data.
  useEffect(() => {
    const pending = new Set();
    let timer = null;
    const stop = onDataChanged(({ entity }) => {
      const key = Object.keys(SOURCES).find((k) => SOURCES[k].entityName === entity);
      if (!key) return;
      pending.add(key);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const keys = [...pending];
        pending.clear();
        keys.forEach((k) => loadOne(k).catch((err) => console.warn(`Could not refresh ${k}:`, err)));
      }, 150);
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [loadOne]);

  const value = {
    // Data
    items: data.items,
    containers: data.containers,
    rentalOrders: data.rentalOrders,
    borrowedItems: data.borrowedItems,
    locations: data.locations,
    categories: data.categories,

    // State
    isLoading,
    error,

    // Actions
    refreshData: loadAllData,
    loadAllData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
