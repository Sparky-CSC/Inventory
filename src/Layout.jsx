import React, { Suspense } from 'react';
import { AppSettingsProvider } from './components/shared/AppSettingsContext';
import { UserDataProvider } from './components/shared/UserDataContext';
import { OfflineProvider } from './components/shared/OfflineManager';
import { DataProvider } from './components/shared/DataManager';
import AppShell from './components/shared/AppShell';
import AccountStatusGate from './components/shared/AccountStatusGate';
import { TooltipProvider } from '@/components/ui/tooltip';
import PWAInstaller from './components/shared/PWAInstaller';

// Shown in the page area while a page's code is being fetched the first time.
const PageLoading = () => (
  <div className="flex h-64 w-full items-center justify-center">
    <div className="w-8 h-8 border-4 border-base-300 border-t-primary rounded-full animate-spin"></div>
  </div>
);

export default function Layout({ children, currentPageName }) {
  const isPrintPage = ['PrintQuote', 'PrintInvoice', 'PrintHangTags', 'PrintView'].includes(currentPageName);

  return (
    <AppSettingsProvider>
      <OfflineProvider showOfflineSetup={!isPrintPage}>
        <UserDataProvider>
          <DataProvider>
            <TooltipProvider delayDuration={100}>
              <div className="h-full">
                <AccountStatusGate>
                  {isPrintPage ? (
                    <Suspense fallback={<PageLoading />}>{children}</Suspense>
                  ) : (
                    <>
                      <AppShell currentPageName={currentPageName}>
                        <Suspense fallback={<PageLoading />}>{children}</Suspense>
                      </AppShell>
                      <PWAInstaller />
                    </>
                  )}
                </AccountStatusGate>
              </div>
            </TooltipProvider>
          </DataProvider>
        </UserDataProvider>
      </OfflineProvider>
    </AppSettingsProvider>
  );
}
