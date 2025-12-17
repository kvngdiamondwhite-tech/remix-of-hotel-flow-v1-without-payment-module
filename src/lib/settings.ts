// Business profile settings storage and utilities

export interface HotelSettings {
  hotelName: string;
  logo: string; // base64 encoded image
  address: string;
  phone: string;
  email: string;
  currency: string;
}

const SETTINGS_KEY = 'hotel_settings';

export const DEFAULT_SETTINGS: HotelSettings = {
  hotelName: 'HotelFlow Management System',
  logo: '',
  address: '',
  phone: '',
  email: '',
  currency: 'USD',
};

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
];

export function getSettings(): HotelSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: HotelSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: settings }));
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

export function formatCurrencyWithSettings(amount: number, currency?: string): string {
  const settings = getSettings();
  const currencyCode = currency || settings.currency;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}
