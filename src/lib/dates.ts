// Date utility functions for hotel management

export function todayIso(): string {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoToDate(iso: string): Date {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  } catch {
    return new Date();
  }
}

export function daysBetweenIso(startIso: string, endIso: string): number {
  const start = isoToDate(startIso);
  const end = isoToDate(endIso);
  
  // Set to midnight for accurate day calculation
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Always return at least 1 night
  return Math.max(1, diffDays);
}

export function formatDate(iso: string): string {
  const date = isoToDate(iso);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(iso: string): string {
  const date = isoToDate(iso);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
export function currentTimeHHmm(): string {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Parse HH:mm into {hours, minutes}
export function parseHHmm(hhmm: string): { hours: number; minutes: number } {
  if (typeof hhmm !== 'string') throw new Error('Invalid time format');
  const parts = hhmm.split(':');
  if (parts.length !== 2) throw new Error('Invalid time format');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) throw new Error('Invalid time numbers');
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) throw new Error('Time out of range');
  return { hours, minutes };
}

// Combine a date-only string (YYYY-MM-DD) or a Date object with an HH:mm string into epoch ms in LOCAL time
export function combineDateAndTime(dateOrIso: string | Date, hhmm: string): number {
  const { hours, minutes } = parseHHmm(hhmm || '00:00');

  let year: number, month: number, day: number;
  if (dateOrIso instanceof Date) {
    year = dateOrIso.getFullYear();
    month = dateOrIso.getMonth();
    day = dateOrIso.getDate();
  } else if (typeof dateOrIso === 'string') {
    // Expect YYYY-MM-DD or full ISO. Prefer YYYY-MM-DD to avoid timezone shift.
    const m = dateOrIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]) - 1;
      day = Number(m[3]);
    } else {
      // Fallback to Date parsing for full ISO strings
      const d = new Date(dateOrIso);
      if (isNaN(d.getTime())) throw new Error('Invalid date input');
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else {
    throw new Error('Invalid date input');
  }

  // Create a local Date with provided components
  const dt = new Date(year, month, day, hours, minutes, 0, 0);
  return dt.getTime();
}

// Minimal shapes to avoid circular imports
export type MinimalBooking = {
  startAtMs?: number;
  endAtMs?: number;
  stayType?: 'overnight' | 'hourly';
  durationMinutes?: number;
  checkInDate?: string;
  checkOutDate?: string;
};

export type MinimalSettings = {
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
};

// Return occupancy window in epoch ms (local time). Throws on invalid window.
export function bookingWindowMs(booking: MinimalBooking, settings: MinimalSettings): { startAtMs: number; endAtMs: number } {
  // 1) If explicit start and end exist, use them
  if (typeof booking.startAtMs === 'number' && typeof booking.endAtMs === 'number') {
    if (booking.endAtMs <= booking.startAtMs) throw new Error('Booking end must be after start');
    return { startAtMs: booking.startAtMs, endAtMs: booking.endAtMs };
  }

  // 1b) If startAtMs exists and durationMinutes provided, compute end
  if (typeof booking.startAtMs === 'number' && typeof booking.endAtMs !== 'number' && typeof booking.durationMinutes === 'number') {
    const endAtMs = booking.startAtMs + Math.round(booking.durationMinutes * 60000);
    if (endAtMs <= booking.startAtMs) throw new Error('Booking end must be after start');
    return { startAtMs: booking.startAtMs, endAtMs };
  }

  // 1c) If endAtMs exists and durationMinutes provided, compute start
  if (typeof booking.endAtMs === 'number' && typeof booking.startAtMs !== 'number' && typeof booking.durationMinutes === 'number') {
    const startAtMs = booking.endAtMs - Math.round(booking.durationMinutes * 60000);
    if (booking.endAtMs <= startAtMs) throw new Error('Booking end must be after start');
    return { startAtMs, endAtMs: booking.endAtMs };
  }

  // 2) Otherwise compute from checkInDate/checkOutDate + settings
  const defaultCheckIn = settings?.defaultCheckInTime || '14:00';
  const defaultCheckOut = settings?.defaultCheckOutTime || '11:00';

  if (!booking.checkInDate) throw new Error('Missing check-in date for computed booking window');

  const startAtMs = combineDateAndTime(booking.checkInDate, defaultCheckIn);

  // If checkOutDate provided, use it; otherwise assume same as checkInDate
  const checkOutDate = booking.checkOutDate || booking.checkInDate;
  let endAtMs = combineDateAndTime(checkOutDate, defaultCheckOut);

  // If computed end is not after start, assume checkout is next day (overnight crossing midnight)
  if (endAtMs <= startAtMs) {
    endAtMs += 24 * 60 * 60 * 1000; // add one day
  }

  if (endAtMs <= startAtMs) throw new Error('Computed booking end must be after start');

  return { startAtMs, endAtMs };
}