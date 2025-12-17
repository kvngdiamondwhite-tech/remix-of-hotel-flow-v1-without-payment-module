import { useState, useEffect, useCallback } from 'react';
import { HotelSettings, getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/settings';

export function useSettings() {
  const [settings, setSettings] = useState<HotelSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSettings(getSettings());
    setLoading(false);

    const handleUpdate = (e: CustomEvent<HotelSettings>) => {
      setSettings(e.detail);
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
