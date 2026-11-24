import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAppSettings } from './AppSettingsContext';
import { useUserData } from './UserDataContext';
import { useOffline } from './OfflineManager';
import { User } from '@/entities/User';
import { isAdminUser } from '@/lib/permissions';
import { MAIN_NAV_LINKS } from '@/lib/navigation';
import { Settings, Shield, LogOut, Drama, Menu, X,
  WifiOff, Wifi, Upload, AlertCircle, CheckCircle, Loader2, HardDrive
} from "lucide-react";
import { IS_LOCAL_MODE } from '@/api/config';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SidebarLink = ({ link, currentPageName, onClick }) => {
  const isActive = currentPageName === link.name;
  return (
    <Link
      to={link.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 min-h-[44px] ${
        isActive
          ? 'bg-primary text-primary-content shadow-md'
          : 'text-base-content hover:bg-base-300 active:bg-base-300/80'
      }`}
    >
      <link.icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-medium truncate">{link.name}</span>
    </Link>
  );
};

// New component for sidebar-specific online status
const OnlineStatusIndicator = () => {
  const { isOnline, pendingChanges, syncStatus, syncPendingChanges } = useOffline();

  if (!isOnline) {
    return (
      <div className="bg-warning/10 border border-warning/50 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <WifiOff className="h-3 w-3 text-warning" />
          <span className="text-xs text-warning-content">Offline</span>
          {pendingChanges.length > 0 && (
            <Badge variant="secondary" className="text-xs">{pendingChanges.length}</Badge>
          )}
        </div>
      </div>
    );
  }

  if (pendingChanges.length > 0) {
    if (syncStatus === 'syncing') {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
            <span className="text-xs text-blue-800">Syncing...</span>
          </div>
        </div>
      );
    } else if (syncStatus === 'error') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-red-600" />
            <span className="text-xs text-red-800">Sync failed</span>
            <Button variant="link" size="sm" onClick={syncPendingChanges} className="p-0 h-auto text-xs text-red-600">
              Retry
            </Button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <Upload className="h-3 w-3 text-amber-600" />
            <span className="text-xs text-amber-800">{pendingChanges.length} to sync</span>
            <Button variant="link" size="sm" onClick={syncPendingChanges} className="p-0 h-auto text-xs text-amber-600">
              Sync
            </Button>
          </div>
        </div>
      );
    }
  }

  if (syncStatus === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-3 w-3 text-green-600" />
          <span className="text-xs text-green-800">All synced</span>
        </div>
      </div>
    );
  }

  // Default online status
  if (IS_LOCAL_MODE) {
    // The data lives in this browser, so there is no connection to report.
    return (
      <div className="bg-base-100 border border-base-300 rounded-lg p-2" title="Data is stored in this browser on this device">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3 w-3 text-primary" />
          <span className="text-xs text-base-content/80">Saved on this device</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <Wifi className="h-3 w-3 text-green-600" />
        <span className="text-xs text-green-800">Online</span>
      </div>
    </div>
  );
};

export default function AppShell({ children, currentPageName }) {
  const { appSettings, isLoading: settingsLoading } = useAppSettings();
  const { currentUser, isLoadingUserData } = useUserData();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const [orderedSidebarLinks, setOrderedSidebarLinks] = useState([]);

  useEffect(() => {
    const allPossibleLinks = MAIN_NAV_LINKS.map(link => ({
      name: link.name,
      href: createPageUrl(link.page),
      icon: link.icon,
    }));

    if (currentUser?.sidebar_order?.length > 0) {
      const links = currentUser.sidebar_order
        .map(name => allPossibleLinks.find(link => link.name === name))
        .filter(Boolean);

      allPossibleLinks.forEach(link => {
        if (!links.find(l => l.name === link.name)) {
          links.push(link);
        }
      });
      setOrderedSidebarLinks(links);
    } else {
      setOrderedSidebarLinks(allPossibleLinks);
    }
  }, [currentUser]);

  // Only administrators see the Administration page.
  const bottomLinks = [
    { name: 'Settings', href: createPageUrl('Settings'), icon: Settings },
    ...(isAdminUser(currentUser)
      ? [{ name: 'Administration', href: createPageUrl('Administration'), icon: Shield }]
      : []),
  ];

  useEffect(() => {
    const checkDesktop = () => {
      const isDesktopView = window.innerWidth >= 768;
      setIsDesktop(isDesktopView);
      setIsSidebarOpen(isDesktopView);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleLogout = async () => {
    try {
      navigate(createPageUrl('Dashboard'));
      await User.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const closeSidebar = () => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  };

  if (settingsLoading || isLoadingUserData) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-base-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-base-content/70">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full text-base-content border-r border-base-300">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-base-300">
        {/* Online Status - Now at top of sidebar */}
        <div className="mb-3">
          <OnlineStatusIndicator />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {appSettings.logoUrl ? (
              <img src={appSettings.logoUrl} alt="Logo" className="h-10 w-10 flex-shrink-0 rounded-lg" />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Drama className="w-6 h-6 text-primary-content" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-base-content truncate">{appSettings.appName}</h1>
              <p className="text-xs text-primary font-medium truncate">{appSettings.sidebarSubtitle}</p>
            </div>
          </div>
          {!isDesktop && (
            <Button variant="ghost" size="icon" onClick={closeSidebar} className="flex-shrink-0 ml-2">
              <X className="w-6 h-6" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto ios-scroll-fix">
        {orderedSidebarLinks.map((link) => (
          <SidebarLink key={link.name} link={link} currentPageName={currentPageName} onClick={closeSidebar} />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="flex-shrink-0 px-3 py-4 border-t border-base-300 space-y-1">
        {bottomLinks.map((link) => (
          <SidebarLink key={link.name} link={link} currentPageName={currentPageName} onClick={closeSidebar} />
        ))}
        
        {/* User Info */}
        <div className="p-3 bg-base-300/50 rounded-lg mt-3">
          <p className="text-sm font-semibold truncate">{currentUser?.full_name || 'User'}</p>
          <p className="text-xs text-base-content/70 truncate">{currentUser?.email}</p>
          <Button 
            variant="ghost" 
            onClick={handleLogout} 
            className="w-full justify-start text-left mt-2 p-2 h-auto min-h-[44px]"
          >
            <LogOut className="w-4 h-4 mr-2 flex-shrink-0" /> 
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden safe-area-inset" style={{ backgroundColor: 'var(--base-100)' }}>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <aside className="w-64 flex-shrink-0 h-full" style={{ backgroundColor: 'var(--base-200)' }}>
          {sidebarContent}
        </aside>
      )}

      {/* Mobile Sidebar Overlay */}
      {!isDesktop && (
        <>
          <div 
            className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeSidebar}
          />
          <div 
            className={`fixed inset-y-0 left-0 w-64 transform transition-transform duration-300 z-50 ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ backgroundColor: 'var(--base-200)' }}
          >
            {sidebarContent}
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        {!isDesktop && (
          <header className="flex-shrink-0 border-b border-base-300 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--base-100)' }}>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              className="flex-shrink-0"
            >
              <Menu className="w-6 h-6" />
            </Button>
            <h2 className="text-lg font-semibold truncate">{currentPageName}</h2>
          </header>
        )}
        
        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto ios-scroll-fix scroll-container">
          {children}
        </main>
      </div>
    </div>
  );
}