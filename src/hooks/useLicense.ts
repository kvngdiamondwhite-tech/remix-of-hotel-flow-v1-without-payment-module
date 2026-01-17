import { useState, useEffect, useCallback } from 'react';
import {
  LicenseState,
  getLicenseState,
  getLicenseInfo,
  isActionAllowed,
  getBlockedMessage,
  activateLicense,
  TRIAL_LIMITS,
} from '@/lib/license';
import { getAllItems, Booking } from '@/lib/db';
import { toast } from 'sonner';

export interface LicenseHook {
  // State
  state: LicenseState;
  stateLabel: string;
  machineId: string;
  expiryDate: string | null;
  daysRemaining: number | null;
  activationDate: string | null;
  
  // Trial info
  trialBookingsUsed: number;
  trialBookingsRemaining: number;
  isTrialLimitReached: boolean;
  
  // Actions
  checkAction: (action: string) => boolean;
  getBlockedReason: (action: string) => string;
  activate: (key: string) => { success: boolean; error?: string };
  refresh: () => void;
  
  // Helpers
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isInvalid: boolean;
  canCreateBooking: boolean;
  showTrialWatermark: boolean;
}

export function useLicense(): LicenseHook {
  const [info, setInfo] = useState(getLicenseInfo());
  const [trialBookingsUsed, setTrialBookingsUsed] = useState(0);

  const loadTrialUsage = useCallback(async () => {
    const bookings = await getAllItems<Booking>('bookings');
    setTrialBookingsUsed(bookings.length);
  }, []);

  const refresh = useCallback(() => {
    setInfo(getLicenseInfo());
    loadTrialUsage();
  }, [loadTrialUsage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkAction = useCallback((action: string): boolean => {
    return isActionAllowed(action as any);
  }, []);

  const getBlockedReason = useCallback((action: string): string => {
    return getBlockedMessage(action);
  }, []);

  const activate = useCallback((key: string): { success: boolean; error?: string } => {
    const result = activateLicense(key);
    if (result.success) {
      refresh();
      toast.success('License activated successfully!');
    }
    return result;
  }, [refresh]);

  // Calculate trial limits
  const trialBookingsRemaining = Math.max(0, TRIAL_LIMITS.maxBookings - trialBookingsUsed);
  const isTrialLimitReached = info.state === 'trial' && trialBookingsUsed >= TRIAL_LIMITS.maxBookings;

  // Check if can create booking (considering trial limits)
  const canCreateBooking = 
    info.state === 'active' || 
    (info.state === 'trial' && !isTrialLimitReached);

  return {
    // State
    state: info.state,
    stateLabel: info.stateLabel,
    machineId: info.machineId,
    expiryDate: info.expiryDate,
    daysRemaining: info.daysRemaining,
    activationDate: info.activationDate,
    
    // Trial info
    trialBookingsUsed,
    trialBookingsRemaining,
    isTrialLimitReached,
    
    // Actions
    checkAction,
    getBlockedReason,
    activate,
    refresh,
    
    // Helpers
    isActive: info.state === 'active',
    isTrial: info.state === 'trial',
    isExpired: info.state === 'expired',
    isInvalid: info.state === 'invalid',
    canCreateBooking,
    showTrialWatermark: info.state === 'trial',
  };
}
