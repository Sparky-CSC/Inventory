
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AppSettings } from '@/entities/AppSettings';
import { applyTheme } from '@/lib/theme';
import { rememberAppInfo } from '@/api/appInfo';

const AppSettingsContext = createContext(null);

// This component applies the theme object as CSS variables to the root element.
const ThemeApplicator = ({ theme }) => {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return null; // This component doesn't render anything visible
};

export const AppSettingsProvider = ({ children }) => {
  // Define the single, high-contrast theme as the only option.
  const highContrastTheme = {
    // Core Colors
    primary: '#0D6EFD', // Accessible Blue
    primaryFocus: '#0A58CA',
    primaryContent: '#FFFFFF',
    secondary: '#6C757D', // Neutral Gray
    secondaryFocus: '#5C636A',
    secondaryContent: '#FFFFFF',
    
    // Background & Surface Colors
    base100: '#FFFFFF', // White background
    base200: '#F8F9FA', // Light gray surface
    base300: '#E9ECEF', // Borders and dividers
    
    // Text & Content Colors
    baseContent: '#212529', // Near-black for text
    baseContentSecondary: '#6C757D', // Gray for secondary text
    
    // Status & Feedback Colors
    info: '#0DCAF0', // Cyan
    success: '#198754', // Green
    warning: '#FFC107', // Yellow
    error: '#DC3545', // Red
  };

  const defaultValues = {
    appName: 'StageVault',
    logoUrl: null,
    theme: 'high_contrast', // Static theme name
    customTheme: highContrastTheme,
    // Subtitles
    sidebarSubtitle: 'Inventory Management',
    dashboardSubtitle: 'Your comprehensive inventory management dashboard',
    settingsSubtitle: 'Configure your application settings and preferences',
    administrationSubtitle: 'Manage users, roles, and system permissions',
    inventorySubtitle: 'Browse and manage your inventory collection',
    searchSubtitle: 'Find exactly what you need with advanced search',
  };

  const [appSettings, setAppSettings] = useState(defaultValues);
  const [isLoading, setIsLoading] = useState(true);

  const hasLoadedOnce = useRef(false);

  const loadSettings = async () => {
    // Only the first load blocks the screen; later reloads refresh quietly.
    if (!hasLoadedOnce.current) setIsLoading(true);
    try {
      // Oldest first, so everyone agrees on which record is "the" settings.
      const settingsRecords = await AppSettings.list('created_date');
      if (settingsRecords.length > 0) {
        // Overlay fetched settings on top of defaults, but keep the static theme.
        // Ensure both 'theme' property and 'customTheme' object are enforced.
        setAppSettings({ 
          ...defaultValues, 
          ...settingsRecords[0], 
          theme: 'high_contrast', // Enforce the specific theme name
          customTheme: highContrastTheme // Enforce the specific custom theme object
        });
      } else {
        // If no settings exist, create them using the defaults.
        try {
          const newSettings = await AppSettings.create(defaultValues);
          setAppSettings(newSettings);
        } catch (createError) {
          console.warn("Could not create app settings:", createError);
          setAppSettings(defaultValues);
        }
      }
    } catch (err) {
      console.error("Failed to load app settings, using defaults.", err);
      setAppSettings(defaultValues);
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Show the app's name in the browser tab and remember it for the sign-in screen.
  useEffect(() => {
    if (isLoading) return;
    if (appSettings.appName) document.title = appSettings.appName;
    rememberAppInfo(appSettings);
  }, [appSettings.appName, appSettings.logoUrl, isLoading]);

  const value = { appSettings, isLoading, reloadSettings: loadSettings };

  return (
    <AppSettingsContext.Provider value={value}>
      <ThemeApplicator theme={appSettings.customTheme} />
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
