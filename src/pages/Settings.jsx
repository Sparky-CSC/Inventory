
import React, { useState, useEffect, useRef } from 'react';
import { useAppSettings } from '../components/shared/AppSettingsContext';
import { AppSettings } from '@/entities/AppSettings';
import { UploadFile } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, Image as ImageIcon, Save, CheckCircle, Loader2, Upload, Tag } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SidebarCustomizer from '../components/settings/SidebarCustomizer';
import { User } from '@/entities/User';
import { useUserData } from '../components/shared/UserDataContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BackButton from '../components/shared/BackButton';
import { MAIN_NAV_LINKS, DEFAULT_PAGE_OPTIONS } from '@/lib/navigation';
import { canManageSettings } from '@/lib/permissions';


// Define the single, high-contrast theme that will be enforced
const ENFORCED_HIGH_CONTRAST_THEME_KEY = 'high-contrast-default';
const ENFORCED_HIGH_CONTRAST_THEME_CONFIG = {
  primary: '#00BFFF', // DeepSkyBlue
  primaryFocus: '#008CBA',
  primaryContent: '#FFFFFF',
  secondary: '#FFD700', // Gold
  secondaryFocus: '#DAA520',
  secondaryContent: '#1A1A1A', // Dark text on gold
  base100: '#1A1A1A', // Dark background
  base200: '#2A2A2A', // Slightly lighter dark for cards
  base300: '#3A3A3A', // Even lighter dark for borders
  baseContent: '#FFFFFF', // White text
  baseContentSecondary: '#B0B0B0' // Light grey for secondary text
};

const subtitleFields = [
  { key: 'sidebarSubtitle', label: 'Sidebar Subtitle', placeholder: 'e.g., Inventory Management' },
  { key: 'dashboardSubtitle', label: 'Dashboard Subtitle', placeholder: 'Subtitle for the dashboard' },
  { key: 'inventorySubtitle', label: 'Inventory Page Subtitle', placeholder: 'Subtitle for the inventory page' },
  { key: 'searchSubtitle', label: 'Search Page Subtitle', placeholder: 'Subtitle for the search page' },
  { key: 'administrationSubtitle', label: 'Administration Page Subtitle', placeholder: 'Subtitle for the administration page' },
  { key: 'settingsSubtitle', label: 'Settings Page Subtitle', placeholder: 'Subtitle for the settings page' },
];

export default function Settings() {
  const { appSettings, isLoading: isSettingsLoading, reloadSettings } = useAppSettings();
  const { currentUser, reloadUserData, isLoadingUserData } = useUserData();
  const [localSettings, setLocalSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const fileInputRef = useRef(null);
  const [showSidebarDialog, setShowSidebarDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('app'); // New state for tabs

  useEffect(() => {
    if (appSettings) {
      // When appSettings are loaded, enforce the high-contrast theme locally
      setLocalSettings({
        ...appSettings,
        theme: ENFORCED_HIGH_CONTRAST_THEME_KEY,
        customTheme: ENFORCED_HIGH_CONTRAST_THEME_CONFIG
      });
    }
    if (currentUser) {
      setPhone(currentUser.phone || '');
    }
  }, [appSettings, currentUser]);
  
  // Show a confirmation for a few seconds. A newer message restarts the clock
  // so an older timer cannot hide it early.
  const successTimer = useRef(null);
  const showSuccess = (message) => {
    setSuccessMessage(message);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessMessage(''), 4000);
  };
  useEffect(() => () => clearTimeout(successTimer.current), []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSingleSettingChange = async (key, value) => {
    if (!localSettings) return;

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      // For single setting changes, ensure theme properties are enforced if they are the ones being changed
      const updatePayload = { [key]: value };
      if (key === 'theme') {
        updatePayload[key] = ENFORCED_HIGH_CONTRAST_THEME_KEY;
        updatePayload.customTheme = ENFORCED_HIGH_CONTRAST_THEME_CONFIG;
      } else if (key === 'customTheme') {
        updatePayload[key] = ENFORCED_HIGH_CONTRAST_THEME_CONFIG;
        updatePayload.theme = ENFORCED_HIGH_CONTRAST_THEME_KEY;
      }

      await AppSettings.update(localSettings.id, updatePayload);
      await reloadSettings();
      showSuccess(`${key.replace(/([A-Z])/g, ' $1')} updated successfully!`);
    } catch (err) {
      console.error(`Error saving ${key}:`, err);
      setError(`Failed to save ${key}.`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !localSettings) return;
    
    setIsUploading(true);
    setError('');
    setSuccessMessage('');
    try {
      const { file_url } = await UploadFile({ file });
      await handleSingleSettingChange('logoUrl', file_url);
    } catch (err) {
      console.error("Error uploading logo:", err);
      setError("Failed to upload logo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSubtitles = async () => {
    if (!localSettings) return;

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const subtitleUpdates = {};
      subtitleFields.forEach(field => {
        subtitleUpdates[field.key] = localSettings[field.key] || ''; // Save current value, or empty string if not set
      });

      await AppSettings.update(localSettings.id, subtitleUpdates);
      await reloadSettings();
      showSuccess('Subtitle settings updated successfully!');
    } catch (err) {
      console.error('Error saving subtitles:', err);
      setError('Failed to save subtitle settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAllSubtitles = async () => {
    if (!localSettings) return;

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const resetPayload = {};
      subtitleFields.forEach(field => {
        resetPayload[field.key] = ''; // Reset to empty string
      });

      await AppSettings.update(localSettings.id, resetPayload);
      await reloadSettings(); 
      showSuccess('Subtitle settings reset to default!');
    } catch (err) {
      console.error('Error resetting subtitles:', err);
      setError('Failed to reset subtitle settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Same list (and names) the sidebar itself uses, so a saved order always applies.
  const defaultSidebarOrder = MAIN_NAV_LINKS;

  const handleSaveSidebarOrder = async (newOrder) => {
    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');
      await User.updateMyUserData({ sidebar_order: newOrder });
      await reloadUserData();
      setShowSidebarDialog(false);
      showSuccess('Sidebar order saved successfully!');
    } catch (err) {
      console.error('Error saving sidebar order:', err);
      setError('Failed to save sidebar order.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSidebarOrder = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');
      await User.updateMyUserData({ sidebar_order: null });
      await reloadUserData();
      setShowSidebarDialog(false);
      showSuccess('Sidebar order has been reset to default.');
    } catch (err) {
      console.error('Error resetting sidebar order:', err);
      setError('Failed to reset sidebar order.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveContactInfo = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await User.updateMyUserData({ phone });
      await reloadUserData();
      showSuccess('Contact information updated successfully!');
    } catch (err) {
      console.error('Error saving contact info:', err);
      setError('Failed to save your contact information.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefaultPageChange = async (newPage) => {
    if (!currentUser) return;
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await User.updateMyUserData({ default_page: newPage });
      await reloadUserData();
      showSuccess('Default page updated successfully!');
    } catch(err) {
      console.error('Error saving default page:', err);
      setError('Failed to save your default page preference.');
    } finally {
      setIsSaving(false);
    }
  };


  const isLoading = isSettingsLoading || !localSettings || isLoadingUserData;
  // Shared settings (name, logo, subtitles) can only be changed by people whose role allows it.
  const canEditAppSettings = canManageSettings(currentUser);

  return (
    <div className="min-h-screen bg-base-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton className="mb-4" />
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Application Settings
          </h1>
          <p className="text-base lg:text-lg text-primary font-medium">
            {appSettings?.settingsSubtitle || 'Configure your application settings and preferences'}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert variant="default" className="mb-6 bg-success/10 border-success/20">
             <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">{successMessage}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto gap-2 mb-6">
            <TabsTrigger value="app">App Settings</TabsTrigger>
            <TabsTrigger value="personal">My Preferences</TabsTrigger>
          </TabsList>
          
          {/* App Settings Tab */}
          <TabsContent value="app" className="space-y-8">
            {!isLoading && !canEditAppSettings && (
              <Alert>
                <AlertDescription>
                  These settings apply to everyone, so only administrators (or roles with the "manage settings"
                  permission) can change them. Your own preferences are on the "My Preferences" tab.
                </AlertDescription>
              </Alert>
            )}
            {/* App Name & Logo Card */}
            <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle>App Name & Logo</CardTitle>
                <CardDescription>Change the name and logo that appears in the sidebar.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 grid md:grid-cols-2 gap-8">
                {/* App Name */}
                <div>
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="appName">Application Name</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="appName"
                          name="appName"
                          value={localSettings?.appName || ''}
                          onChange={handleInputChange}
                          className="bg-base-100"
                        />
                        <Button 
                          onClick={() => handleSingleSettingChange('appName', localSettings.appName)} 
                          disabled={isSaving || isLoading || !localSettings?.appName || !canEditAppSettings}
                          style={{
                            backgroundColor: 'var(--primary)',
                            color: 'var(--primary-content)',
                            borderColor: 'var(--primary)',
                          }}
                          className="shrink-0"
                        >
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {/* Logo */}
                <div className="space-y-2">
                  <Label>App Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-xl border border-dashed flex items-center justify-center bg-base-100">
                      {isLoading ? (
                        <Skeleton className="w-full h-full rounded-xl" />
                      ) : localSettings?.logoUrl ? (
                        <img src={localSettings.logoUrl} alt="Current Logo" className="w-full h-full object-contain rounded-xl p-2" />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-base-content/30" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isUploading || isLoading || !canEditAppSettings} 
                      variant="outline"
                      style={{
                        borderColor: 'var(--base-300)',
                        color: 'var(--base-content)',
                      }}
                    >
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload Logo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Subtitle Customization Card */}
            <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle>Customize Page Subtitles</CardTitle>
                <CardDescription>Change the descriptive text that appears on each page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {subtitleFields.map(field => (
                  <div key={field.key}>
                    {isLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          name={field.key}
                          value={localSettings?.[field.key] || ''}
                          onChange={handleInputChange}
                          placeholder={field.placeholder}
                          className="bg-base-100"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
              <CardFooter className="bg-base-200/80 p-4 rounded-b-xl border-t border-base-300">
                <div className="flex justify-end w-full gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={resetAllSubtitles} 
                    disabled={isSaving || isLoading || !canEditAppSettings}
                    style={{
                      color: 'var(--base-content)',
                    }}
                  >
                    Reset to Default
                  </Button>
                  <Button 
                    onClick={handleSaveSubtitles} 
                    disabled={isSaving || isLoading || !canEditAppSettings}
                    className="hover:bg-primary-focus" // Keep hover class
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-content)',
                      borderColor: 'var(--primary)',
                    }}
                  >
                    {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save Changes
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Manage Categories Link Card */}
            <Link to={createPageUrl('ManageCategories')} className="block">
              <Card className="hover:bg-base-200/80 hover:shadow-lg transition-all duration-200 cursor-pointer border border-base-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Tag className="w-6 h-6 text-primary" />
                    Manage Categories
                  </CardTitle>
                  <CardDescription>
                    Add, edit, or remove item categories and subcategories.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </TabsContent>

          {/* Personal Preferences Tab */}
          <TabsContent value="personal" className="space-y-8">
            <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle>My Preferences</CardTitle>
                <CardDescription>Personalize your experience in the application.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Default Page Setting */}
                <div>
                  {isLoadingUserData ? (
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="defaultPage">Default Landing Page</Label>
                      <Select
                        value={
                          DEFAULT_PAGE_OPTIONS.some(o => o.value === currentUser?.default_page)
                            ? currentUser.default_page
                            : 'Dashboard'
                        }
                        onValueChange={handleDefaultPageChange}
                      >
                        <SelectTrigger id="defaultPage" className="bg-base-100">
                          <SelectValue placeholder="Select a default page" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEFAULT_PAGE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-base-content/60">
                        Choose the page you see first after logging in.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
                <CardHeader>
                    <CardTitle>My Contact Information</CardTitle>
                    <CardDescription>Update your contact details that appear on production team lists.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingUserData ? (
                        <Skeleton className="h-24 w-full" />
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="Your phone number"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="bg-base-100"
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button 
                                  onClick={handleSaveContactInfo} 
                                  disabled={isSaving}
                                  style={{
                                    backgroundColor: 'var(--primary)',
                                    color: 'var(--primary-content)',
                                    borderColor: 'var(--primary)',
                                  }}
                                >
                                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Save Contact Info
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Sidebar Customization */}
            <Card className="bg-base-200/50 backdrop-blur-sm shadow-md">
              <CardHeader>
                <CardTitle>Sidebar Navigation</CardTitle>
                <CardDescription>Reorder the main navigation items in your sidebar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Dialog open={showSidebarDialog} onOpenChange={setShowSidebarDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        disabled={isLoading}
                        style={{
                          borderColor: 'var(--base-300)',
                          color: 'var(--base-content)',
                        }}
                      >
                        Customize Sidebar Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Customize Sidebar</DialogTitle>
                      </DialogHeader>
                      <SidebarCustomizer
                        defaultOrder={defaultSidebarOrder}
                        userOrder={currentUser?.sidebar_order || []}
                        onSave={handleSaveSidebarOrder}
                        onReset={handleResetSidebarOrder}
                        isSaving={isSaving}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
