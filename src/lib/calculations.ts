// Calculation utilities for hotel bookings

export interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface Surcharge {
  type: 'percentage' | 'fixed';
  value: number;
}

export function clampMoney(value: number): number {
  return Math.max(0, value);
}

export function ensure<T>(obj: any, key: string, defaultValue: T): T {
  return obj && obj[key] !== undefined ? obj[key] : defaultValue;
}

export function calculateSubtotal(rate: number, nights: number): number {
  return clampMoney(rate * nights);
}

export function applyDiscount(subtotal: number, discount: Discount | null): number {
  if (!discount || discount.value <= 0) return 0;
  
  if (discount.type === 'percentage') {
    return clampMoney((subtotal * discount.value) / 100);
  }
  
  return clampMoney(discount.value);
}

export function applySurcharge(subtotal: number, surcharge: Surcharge | null): number {
  if (!surcharge || surcharge.value <= 0) return 0;
  
  if (surcharge.type === 'percentage') {
    return clampMoney((subtotal * surcharge.value) / 100);
  }
  
  return clampMoney(surcharge.value);
}

export function calculateTotal(
  subtotal: number,
  discountAmt: number,
  surchargeAmt: number
): number {
  return clampMoney(subtotal - discountAmt + surchargeAmt);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
