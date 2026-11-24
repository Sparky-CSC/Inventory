import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { User } from '@/entities/User';
import { useOffline } from './OfflineManager';

const UserDataContext = createContext(null);

export const UserDataProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { isOnline = true, cacheData = () => Promise.resolve(), getCachedData = () => Promise.resolve([]) } = useOffline();

  const hasLoadedOnce = useRef(false);

  const loadUserData = useCallback(async () => {
    // Only the very first load shows the full-screen spinner; later refreshes
    // (after saving a preference, say) happen quietly in the background.
    if (!hasLoadedOnce.current) setIsLoading(true);
    try {
      let user;
      let favorites;

      if (isOnline) {
        // ONLINE: Fetch fresh data from server
        try {
          user = await User.me();
        } catch (userError) {
          console.warn("Could not load user online:", userError);
          user = null;
        }

        if (user) {
          // Remember the built-in administrator flag before `role` is
          // replaced by the full role record below.
          user.is_admin = user.role === 'admin';
          user.system_role = typeof user.role === 'string' ? user.role : 'user';

          // Fetch role and attach it
          if (!user.role_id) {
            user.role = null;
          }
          if (user.role_id) {
            try {
              const { UserRole } = await import('@/entities/UserRole');
              const role = await UserRole.get(user.role_id);
              user.role = role;
            } catch (roleError) {
              console.warn("Could not load user role online:", roleError);
              user.role = null;
            }
          }
          
          // Fetch favorites
          try {
            const { FavoriteItem } = await import('@/entities/FavoriteItem');
            favorites = await FavoriteItem.filter({ user_id: user.id });
          } catch (favError) {
            console.warn("Could not load favorites online:", favError);
            favorites = [];
          }

          // Cache the fresh data for offline use (if caching is available)
          if (cacheData) {
            try {
              await cacheData('userProfile', { ...user, id: user.id });
              await cacheData('favoriteItems', favorites);
            } catch (cacheError) {
              console.warn("Could not cache user data:", cacheError);
            }
          }

        } else {
          favorites = [];
        }
      } else {
        // OFFLINE: Load data from cache (if available)
        if (getCachedData) {
          try {
            const cachedUsers = await getCachedData('userProfile');
            user = cachedUsers.length > 0 ? cachedUsers[0] : null;

            const cachedFavorites = await getCachedData('favoriteItems');
            favorites = cachedFavorites || [];
          } catch (cacheError) {
            console.warn("Could not load cached user data:", cacheError);
            user = null;
            favorites = [];
          }
        } else {
          user = null;
          favorites = [];
        }
      }
      
      setCurrentUser(user);
      setFavoriteItems(favorites || []);

    } catch (error) {
      console.error("Failed to load user data:", error);
      setCurrentUser(null);
      setFavoriteItems([]);
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  }, [isOnline, cacheData, getCachedData]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const value = {
    currentUser,
    favoriteItems,
    isLoadingUserData: isLoading,
    reloadUserData: loadUserData,
  };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};