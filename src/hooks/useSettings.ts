import { useState, useEffect, useCallback } from 'react';
import { HotelSettings, getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<HotelSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadedSettings = getSettings();
    setSettings(loadedSettings);
    setLoading(false);

    // Apply dark mode on initial load
    if (loadedSettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const handleUpdate = (e: CustomEvent<HotelSettings>) => {
      setSettings(e.detail);
      // Apply dark mode when settings change
      if (e.detail.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    window.addEventListener('settings-updated', handleUpdate as EventListener);
    return () => {
      window.removeEventListener('settings-updated', handleUpdate as EventListener);
    };
  }, []);

  const updateSettings = useCallback((newSettings: HotelSettings) => {
    saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  return { settings, updateSettings, loading };
}
