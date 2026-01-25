// Business profile and operational settings storage and utilities

// Payment method configuration
export interface PaymentMethodConfig {
  id: string;
  name: string;
  enabled: boolean;
  color?: string; // Hex color or design token for UI accents (e.g., '#10b981', 'hsl(var(--primary))')
}

export interface HotelSettings {
  // Business Profile
  hotelName: string;
  logo: string; // base64 encoded image
  address: string;
  phone: string;
  email: string;
  currency: string;
  
  // Payment Settings
  paymentMethods: PaymentMethodConfig[];
  
  // Booking Rules
  allowDebt: boolean; // When false, bookings require full payment
  defaultCheckInTime: string; // HH:MM format
  defaultCheckOutTime: string; // HH:MM format
  
  // Receipt & Printing
  receiptFooter: string; // Multi-line footer text for receipts
  
  // System Preferences
  softDeleteMode: boolean; // When true, replace delete with cancel/void
  darkMode: boolean; // Light/Dark mode toggle
}

const SETTINGS_KEY = 'hotel_settings';

// Default payment methods with default colors
export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'cash', name: 'Cash', enabled: true, color: '#10b981' }, // green
  { id: 'transfer', name: 'Bank Transfer', enabled: true, color: '#3b82f6' }, // blue
  { id: 'pos', name: 'POS / Card', enabled: true, color: '#f59e0b' }, // amber
];

export const DEFAULT_SETTINGS: HotelSettings = {
  hotelName: 'HotelFlow Management System',
  logo: '',
  address: '',
  phone: '',
  email: '',
  currency: 'USD',
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  allowDebt: true,
  defaultCheckInTime: '14:00',
  defaultCheckOutTime: '11:00',
  receiptFooter: 'Thank you for your patronage!',
  softDeleteMode: false,
  darkMode: false,
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

// Color palette for payment method selection
export const PAYMENT_METHOD_COLORS = [
  { label: 'Green', value: '#10b981' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Indigo', value: '#6366f1' },
];

export function getSettings(): HotelSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure all new fields have defaults for backwards compatibility
      return { 
        ...DEFAULT_SETTINGS, 
        ...parsed,
        // Ensure payment methods array exists
        paymentMethods: parsed.paymentMethods || DEFAULT_PAYMENT_METHODS,
      };
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

// Get only enabled payment methods for forms
export function getEnabledPaymentMethods(): PaymentMethodConfig[] {
  const settings = getSettings();
  return settings.paymentMethods.filter(pm => pm.enabled);
}

// Check if debt is allowed for new bookings
export function isDebtAllowed(): boolean {
  return getSettings().allowDebt;
}

// Check if soft delete mode is enabled
export function isSoftDeleteEnabled(): boolean {
  return getSettings().softDeleteMode;
}

// Get payment method color by ID (used by Dashboard, Reports, Payments)
export function getPaymentMethodColor(methodId: string): string {
  const settings = getSettings();
  const method = settings.paymentMethods.find(pm => pm.id === methodId);
  // Return method's color if defined, otherwise fallback to neutral gray
  return method?.color || '#6b7280';
}
