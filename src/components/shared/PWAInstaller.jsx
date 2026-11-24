import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone, Monitor } from 'lucide-react';
import { useAppSettings } from './AppSettingsContext';

export default function PWAInstaller() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const { appSettings } = useAppSettings();

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show the install prompt only if it hasn't been dismissed before
      if (sessionStorage.getItem('pwa_install_dismissed') !== 'true') {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setInstallPrompt(null);
      setIsVisible(false);
    });
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Use sessionStorage to remember dismissal only for the current session
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!isVisible || !installPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div 
        className="bg-base-100 rounded-2xl shadow-2xl max-w-sm w-full mx-auto p-6 text-center relative animate-in fade-in zoom-in-95"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute top-2 right-2"
        >
          <X className="w-5 h-5 text-base-content/50" />
        </Button>
        
        <div className="flex justify-center items-center gap-4 mb-4">
          <Monitor className="w-8 h-8 text-primary"/>
          <Smartphone className="w-6 h-6 text-primary"/>
        </div>

        <h2 className="text-xl font-bold text-base-content mb-2">Install {appSettings.appName}</h2>
        <p className="text-base-content/80 mb-6">
          For the best experience, including full offline access and faster loading, install the app to your home screen.
        </p>
        
        <Button 
          onClick={handleInstallClick} 
          className="w-full"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-content)'
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Install App
        </Button>
      </div>
    </div>
  );
}