// Payment module - Isolated from existing db.ts
// This file contains the Payment interface and payment-specific operations

import { initDB, getAllItems, Booking, updateItem } from './db';
import { uid } from './id';
import { nowIso } from './dates';

export interface Payment {
  id: string;
  bookingId: string;
  paymentMethod: string; // Dynamic - uses payment method ID from settings
  paymentType: 'deposit' | 'full' | 'partial';
  amount: number;
  paymentDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const PAYMENTS_STORE = 'payments';

// Initialize payments store (called on app startup)
export async function initPaymentsStore(): Promise<void> {
  const db = await initDB();
  
  // Check if payments store already exists
  if (db.objectStoreNames.contains(PAYMENTS_STORE)) {
    return;
  }
  
  // Close existing connection and reopen with higher version
  const currentVersion = db.version;
  db.close();
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HotelManagementDB', currentVersion + 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(PAYMENTS_STORE)) {
        const paymentsStore = database.createObjectStore(PAYMENTS_STORE, { keyPath: 'id' });
        paymentsStore.createIndex('bookingId', 'bookingId', { unique: false });
        paymentsStore.createIndex('paymentDate', 'paymentDate', { unique: false });
        paymentsStore.createIndex('paymentMethod', 'paymentMethod', { unique: false });
      }
    };
  });
}

// Add a new payment
export async function addPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
  await initPaymentsStore();
  const db = await initDB();
  
  const newPayment: Payment = {
    ...payment,
    id: uid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(PAYMENTS_STORE);
    const request = store.add(newPayment);
    
    request.onsuccess = () => resolve(newPayment);
    request.onerror = () => reject(request.error);
  });
}

// Get all payments
export async function getAllPayments(): Promise<Payment[]> {
  await initPaymentsStore();
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENTS_STORE], 'readonly');
    const store = transaction.objectStore(PAYMENTS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get payments for a specific booking
export async function getPaymentsByBookingId(bookingId: string): Promise<Payment[]> {
  const allPayments = await getAllPayments();
  return allPayments.filter(p => p.bookingId === bookingId);
}

// Get total paid amount for a booking
export async function getTotalPaidForBooking(bookingId: string): Promise<number> {
  const payments = await getPaymentsByBookingId(bookingId);
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

// Delete a payment
export async function deletePayment(id: string): Promise<void> {
  await initPaymentsStore();
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PAYMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(PAYMENTS_STORE);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Calculate payment status for a booking (read-only calculation)
export async function calculateBookingPaymentStatus(bookingId: string, bookingTotal: number): Promise<{
  totalPaid: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Pending';
}> {
  const totalPaid = await getTotalPaidForBooking(bookingId);
  const balance = bookingTotal - totalPaid;
  
  let status: 'Paid' | 'Partial' | 'Pending';
  if (totalPaid >= bookingTotal) {
    status = 'Paid';
  } else if (totalPaid > 0) {
    status = 'Partial';
  } else {
    status = 'Pending';
  }
  
  return { totalPaid, balance, status };
}

// Update booking payment status after recording payment
export async function updateBookingPaymentStatus(bookingId: string): Promise<void> {
  const bookings = await getAllItems<Booking>('bookings');
  const booking = bookings.find(b => b.id === bookingId);
  
  if (!booking) return;
  
  const { status } = await calculateBookingPaymentStatus(bookingId, booking.total);
  
  // Map 'Partial' to 'Pending' to match existing Booking interface
  const bookingStatus: 'Paid' | 'Pending' = status === 'Paid' ? 'Paid' : 'Pending';
  
  if (booking.paymentStatus !== bookingStatus) {
    await updateItem('bookings', {
      ...booking,
      paymentStatus: bookingStatus,
      updatedAt: nowIso(),
    });
  }
}
