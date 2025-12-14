// ID generation utility

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
