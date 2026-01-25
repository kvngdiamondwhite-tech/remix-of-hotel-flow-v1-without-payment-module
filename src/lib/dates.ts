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