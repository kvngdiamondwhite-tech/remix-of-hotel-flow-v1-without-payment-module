/**
 * License Management System
 * Offline-first, per-PC yearly license with trial mode
 */

// License states
export type LicenseState = 'trial' | 'active' | 'expired' | 'invalid';

// License data structure stored locally
export interface LicenseData {
  machineId: string;
  licenseKey: string;
  activationDate: string; // ISO date
  expiryDate: string; // ISO date
  activatedAt: string; // ISO timestamp
}

// Trial limits
export const TRIAL_LIMITS = {
  maxBookings: 20,
};

// License key format: APPID-MACHINEID_SHORTENED-STARTDATE-EXPIRYDATE-CHECKSUM
// Example: HMS-abc123-20250117-20260117-XYZABC
const APP_IDENTIFIER = 'HMS';
const LICENSE_STORAGE_KEY = 'hotel_license_data';
const MACHINE_ID_STORAGE_KEY = 'hotel_machine_id';

/**
 * Generate a stable, deterministic Machine ID
 * Uses browser fingerprinting techniques to create a consistent ID
 */
export function generateMachineId(): string {
  // Check if we already have a stored machine ID
  const storedId = localStorage.getItem(MACHINE_ID_STORAGE_KEY);
  if (storedId) {
    return storedId;
  }

  // Generate a new machine ID based on browser characteristics
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '0',
    navigator.platform || 'unknown',
  ];

  // Create a hash from these components
  const fingerprint = components.join('|');
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to base36 and add random suffix for uniqueness
  const randomPart = Math.random().toString(36).substring(2, 6);
  const machineId = Math.abs(hash).toString(36).toUpperCase() + randomPart.toUpperCase();
  
  // Store the machine ID
  localStorage.setItem(MACHINE_ID_STORAGE_KEY, machineId);
  
  return machineId;
}

/**
 * Get the stored machine ID
 */
export function getMachineId(): string {
  const stored = localStorage.getItem(MACHINE_ID_STORAGE_KEY);
  if (stored) return stored;
  return generateMachineId();
}

/**
 * Get stored license data
 */
export function getLicenseData(): LicenseData | null {
  const stored = localStorage.getItem(LICENSE_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as LicenseData;
  } catch {
    return null;
  }
}

/**
 * Store license data
 */
export function storeLicenseData(data: LicenseData): void {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Clear license data
 */
export function clearLicenseData(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
}

/**
 * Generate a simple checksum for license key validation
 */
function generateChecksum(parts: string[]): string {
  const combined = parts.join('');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
}

/**
 * Parse and validate a license key
 * Returns the decoded data if valid, null otherwise
 */
export function parseLicenseKey(key: string): {
  valid: boolean;
  machineId?: string;
  startDate?: string;
  expiryDate?: string;
  error?: string;
} {
  // Remove any whitespace and convert to uppercase
  const cleanKey = key.trim().toUpperCase().replace(/\s+/g, '');
  
  // Expected format: HMS-MACHINEID-STARTDATE-EXPIRYDATE-CHECKSUM
  const parts = cleanKey.split('-');
  
  if (parts.length !== 5) {
    return { valid: false, error: 'Invalid license key format' };
  }

  const [appId, machineIdPart, startDatePart, expiryDatePart, checksumPart] = parts;

  // Validate app identifier
  if (appId !== APP_IDENTIFIER) {
    return { valid: false, error: 'Invalid license key' };
  }

  // Validate checksum
  const expectedChecksum = generateChecksum([appId, machineIdPart, startDatePart, expiryDatePart]);
  if (checksumPart !== expectedChecksum) {
    return { valid: false, error: 'License key validation failed' };
  }

  // Validate date format (YYYYMMDD)
  const startYear = parseInt(startDatePart.substring(0, 4));
  const startMonth = parseInt(startDatePart.substring(4, 6));
  const startDay = parseInt(startDatePart.substring(6, 8));
  
  const expiryYear = parseInt(expiryDatePart.substring(0, 4));
  const expiryMonth = parseInt(expiryDatePart.substring(4, 6));
  const expiryDay = parseInt(expiryDatePart.substring(6, 8));

  if (isNaN(startYear) || isNaN(startMonth) || isNaN(startDay) ||
      isNaN(expiryYear) || isNaN(expiryMonth) || isNaN(expiryDay)) {
    return { valid: false, error: 'Invalid date in license key' };
  }

  // Convert to ISO dates
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  const expiryDate = `${expiryYear}-${String(expiryMonth).padStart(2, '0')}-${String(expiryDay).padStart(2, '0')}`;

  return {
    valid: true,
    machineId: machineIdPart,
    startDate,
    expiryDate,
  };
}

/**
 * Generate a license key (for app owner use)
 * This would typically be done externally, but provided here for testing
 */
export function generateLicenseKey(machineId: string, startDate: Date, months: number = 12): string {
  const start = startDate.toISOString().split('T')[0].replace(/-/g, '');
  
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + months);
  const expiry = expiryDate.toISOString().split('T')[0].replace(/-/g, '');
  
  // Use first 8 chars of machine ID for the key
  const machineIdShort = machineId.substring(0, 8).toUpperCase();
  
  const checksum = generateChecksum([APP_IDENTIFIER, machineIdShort, start, expiry]);
  
  return `${APP_IDENTIFIER}-${machineIdShort}-${start}-${expiry}-${checksum}`;
}

/**
 * Activate a license key
 */
export function activateLicense(key: string): {
  success: boolean;
  error?: string;
  licenseData?: LicenseData;
} {
  const parsed = parseLicenseKey(key);
  
  if (!parsed.valid) {
    return { success: false, error: parsed.error };
  }

  const currentMachineId = getMachineId();
  const machineIdShort = currentMachineId.substring(0, 8).toUpperCase();

  // Validate machine ID matches
  if (parsed.machineId !== machineIdShort) {
    return { 
      success: false, 
      error: 'This license key is not valid for this device. Please contact support.' 
    };
  }

  // Store the license
  const licenseData: LicenseData = {
    machineId: currentMachineId,
    licenseKey: key.trim().toUpperCase(),
    activationDate: parsed.startDate!,
    expiryDate: parsed.expiryDate!,
    activatedAt: new Date().toISOString(),
  };

  storeLicenseData(licenseData);

  return { success: true, licenseData };
}

/**
 * Get current license state
 */
export function getLicenseState(): LicenseState {
  const licenseData = getLicenseData();
  
  if (!licenseData) {
    return 'trial';
  }

  // Validate the stored license
  const parsed = parseLicenseKey(licenseData.licenseKey);
  if (!parsed.valid) {
    return 'invalid';
  }

  // Check machine ID
  const currentMachineId = getMachineId();
  if (licenseData.machineId !== currentMachineId) {
    return 'invalid';
  }

  // Check expiry
  const now = new Date();
  const expiryDate = new Date(licenseData.expiryDate);
  expiryDate.setHours(23, 59, 59, 999); // End of expiry day

  if (now > expiryDate) {
    return 'expired';
  }

  return 'active';
}

/**
 * Get expiry date formatted
 */
export function getExpiryDate(): string | null {
  const licenseData = getLicenseData();
  if (!licenseData) return null;
  return licenseData.expiryDate;
}

/**
 * Get days until expiry
 */
export function getDaysUntilExpiry(): number | null {
  const licenseData = getLicenseData();
  if (!licenseData) return null;

  const now = new Date();
  const expiryDate = new Date(licenseData.expiryDate);
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if a specific action is allowed based on license state
 */
export function isActionAllowed(action: 
  'create_booking' | 
  'add_payment' | 
  'edit_debt' | 
  'print_receipt' | 
  'generate_report' | 
  'change_settings' |
  'export_backup' |
  'import_data' |
  'customize'
): boolean {
  const state = getLicenseState();

  switch (state) {
    case 'active':
      return true;
    
    case 'trial':
      // Trial allows limited actions
      switch (action) {
        case 'export_backup':
        case 'import_data':
        case 'customize':
        case 'generate_report':
          return false;
        case 'print_receipt':
          return true; // Allowed but with watermark
        default:
          return true;
      }
    
    case 'expired':
      // Expired allows read-only + export
      switch (action) {
        case 'export_backup':
          return true;
        default:
          return false;
      }
    
    case 'invalid':
      // Invalid is read-only + export
      switch (action) {
        case 'export_backup':
          return true;
        default:
          return false;
      }
    
    default:
      return false;
  }
}

/**
 * Get action blocked message
 */
export function getBlockedMessage(action: string): string {
  const state = getLicenseState();
  
  switch (state) {
    case 'trial':
      return `This feature is not available in Trial Mode. Please activate a license to unlock all features.`;
    case 'expired':
      return `Your license has expired. Please renew to continue using this feature.`;
    case 'invalid':
      return `Your license is invalid. Please contact support for assistance.`;
    default:
      return `This action is not available.`;
  }
}

/**
 * Get license status info for display
 */
export function getLicenseInfo(): {
  state: LicenseState;
  stateLabel: string;
  machineId: string;
  expiryDate: string | null;
  daysRemaining: number | null;
  activationDate: string | null;
} {
  const state = getLicenseState();
  const licenseData = getLicenseData();
  const machineId = getMachineId();
  
  const stateLabels: Record<LicenseState, string> = {
    trial: 'Trial Mode',
    active: 'Active',
    expired: 'Expired',
    invalid: 'Invalid',
  };

  return {
    state,
    stateLabel: stateLabels[state],
    machineId,
    expiryDate: licenseData?.expiryDate || null,
    daysRemaining: getDaysUntilExpiry(),
    activationDate: licenseData?.activationDate || null,
  };
}
