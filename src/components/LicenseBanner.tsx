import { useLicense } from '@/hooks/useLicense';
import { AlertCircle, Shield, Clock, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { TRIAL_LIMITS } from '@/lib/license';

export function LicenseBanner() {
  const license = useLicense();

  if (license.isActive) {
    return null; // No banner needed for active licenses
  }

  if (license.isTrial) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 px-4 py-2 flex items-center gap-3">
        <Clock className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">
          <strong>Trial Mode</strong> – {license.trialBookingsRemaining} of {TRIAL_LIMITS.maxBookings} bookings remaining. 
          Some features are limited. Activate a license for full access.
        </span>
      </div>
    );
  }

  if (license.isExpired) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 px-4 py-3 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm">
          <strong>License expired on {license.expiryDate ? formatDate(license.expiryDate) : 'N/A'}</strong>. 
          Renew to continue operations. You can still view data and export backups.
        </span>
      </div>
    );
  }

  if (license.isInvalid) {
    return (
      <div className="bg-red-600/10 border border-red-600/30 text-red-700 dark:text-red-400 px-4 py-3 flex items-center gap-3">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <span className="text-sm">
          <strong>Invalid License</strong>. 
          This license is not valid for this device. Please contact support for assistance.
        </span>
      </div>
    );
  }

  return null;
}

export function TrialBadge() {
  const license = useLicense();

  if (!license.isTrial) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md text-xs font-medium">
      <Clock className="h-3 w-3" />
      Trial Mode
    </div>
  );
}

export function LicenseStatusBadge() {
  const license = useLicense();

  const badges = {
    trial: {
      icon: Clock,
      label: 'Trial',
      className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
    },
    active: {
      icon: Shield,
      label: 'Licensed',
      className: 'bg-green-500/20 text-green-700 dark:text-green-400',
    },
    expired: {
      icon: AlertCircle,
      label: 'Expired',
      className: 'bg-red-500/20 text-red-700 dark:text-red-400',
    },
    invalid: {
      icon: XCircle,
      label: 'Invalid',
      className: 'bg-red-600/20 text-red-700 dark:text-red-400',
    },
  };

  const badge = badges[license.state];
  const Icon = badge.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${badge.className}`}>
      <Icon className="h-3 w-3" />
      {badge.label}
    </div>
  );
}
