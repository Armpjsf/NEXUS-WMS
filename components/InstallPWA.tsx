'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from './providers/LanguageProvider';

export default function InstallPWA() {
  const { t } = useLanguage();
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = (evt: any) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
  };

  if (isInstalled) {
      // Optional: Show "App Installed" message or nothing
      return null; 
  }

  if (!supportsPWA) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors mb-2"
    >
      <Download className="w-5 h-5" />
      <span>Install App</span>
    </button>
  );
}
