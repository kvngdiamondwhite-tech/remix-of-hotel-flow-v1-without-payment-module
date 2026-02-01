// IndexedDB setup and operations

import { bookingWindowMs, MinimalSettings } from './dates';
import { getSettings } from './settings';

const DB_NAME = 'HotelManagementDB';
const DB_VERSION = 1003;

export interface RoomType {
  id: string;
  name: string;
  basePrice: number;
  description: string;
  maxAdults: number;
  maxChildren: number;
  createdAt: string;
  updatedAt: string;
}
// End Booking

// NOTE: Backwards-compatible optional time fields for hourly/short stays
export type BookingTimeFields = {
  startAtMs?: number;
  endAtMs?: number;
  stayType?: 'overnight' | 'hourly';
  durationMinutes?: number;
};

export interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  status: 'Available' | 'Occupied' | 'Cleaning' | 'Out of Service';
  createdAt: string;
  updatedAt: string;
}

export interface Guest {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  idType: string;
  idNumber: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  ratePerNight: number;
  subtotal: number;
  discount: { type: 'percentage' | 'fixed'; value: number } | null;
  discountAmount: number;
  surcharge: { type: 'percentage' | 'fixed'; value: number } | null;
  surchargeAmount: number;
  total: number;
  paymentStatus: 'Paid' | 'Pending';
  notes: string;
  createdAt: string;
  updatedAt: string;
  // Optional time-aware fields for short/hourly stays (backwards-compatible)
  startAtMs?: number;
  endAtMs?: number;
  stayType?: 'overnight' | 'hourly';
  durationMinutes?: number;
}

// Multi-room booking support (backwards-compatible)
export interface BookingRoom {
  id: string;
  bookingId: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  priceAtBooking: number;
  checkInDate: string;
  checkOutDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expenditure {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

let dbInstance: IDBDatabase | null = null;

function isConnectionValid(db: IDBDatabase | null): boolean {
  if (!db) return false;
  try {
    // Try to access objectStoreNames - this will throw if connection is closed
    db.objectStoreNames.length;
    return true;
  } catch {
    return false;
  }
}

export async function initDB(): Promise<IDBDatabase> {
  // Check if existing connection is still valid
  if (dbInstance && isConnectionValid(dbInstance)) {
    return dbInstance;
  }
  
  // Clear stale reference
  dbInstance = null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
    
    // Handle blocked state - another tab has the DB open with older version
    request.onblocked = () => {
      console.warn('IndexedDB blocked - close other tabs and refresh');
      // Still try to proceed, the block may resolve
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle connection closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      
      dbInstance.onerror = (event) => {
        console.error('IndexedDB error:', event);
        dbInstance = null;
      };
      
      // Handle version change from another tab
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        console.log('Database version changed, connection closed');
      };
      
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Room Types Store
      if (!db.objectStoreNames.contains('roomTypes')) {
        const roomTypesStore = db.createObjectStore('roomTypes', { keyPath: 'id' });
        roomTypesStore.createIndex('name', 'name', { unique: true });
      }

      // Rooms Store
      if (!db.objectStoreNames.contains('rooms')) {
        const roomsStore = db.createObjectStore('rooms', { keyPath: 'id' });
        roomsStore.createIndex('roomNumber', 'roomNumber', { unique: true });
        roomsStore.createIndex('roomTypeId', 'roomTypeId', { unique: false });
        roomsStore.createIndex('status', 'status', { unique: false });
      }

      // Guests Store
      if (!db.objectStoreNames.contains('guests')) {
        const guestsStore = db.createObjectStore('guests', { keyPath: 'id' });
        guestsStore.createIndex('fullName', 'fullName', { unique: false });
        guestsStore.createIndex('email', 'email', { unique: false });
      }

      // Bookings Store
      if (!db.objectStoreNames.contains('bookings')) {
        const bookingsStore = db.createObjectStore('bookings', { keyPath: 'id' });
        bookingsStore.createIndex('guestId', 'guestId', { unique: false });
        bookingsStore.createIndex('roomId', 'roomId', { unique: false });
        bookingsStore.createIndex('checkInDate', 'checkInDate', { unique: false });
        bookingsStore.createIndex('checkOutDate', 'checkOutDate', { unique: false });
        bookingsStore.createIndex('paymentStatus', 'paymentStatus', { unique: false });
      }

      // Payments Store
      if (!db.objectStoreNames.contains('payments')) {
        const paymentsStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentsStore.createIndex('bookingId', 'bookingId', { unique: false });
        paymentsStore.createIndex('paymentDate', 'paymentDate', { unique: false });
        paymentsStore.createIndex('paymentMethod', 'paymentMethod', { unique: false });
      }

      // Expenditures Store
      if (!db.objectStoreNames.contains('expenditures')) {
        const expendituresStore = db.createObjectStore('expenditures', { keyPath: 'id' });
        expendituresStore.createIndex('date', 'date', { unique: false });
        expendituresStore.createIndex('category', 'category', { unique: false });
      }

      // BookingRooms Store (Multi-room booking support)
      if (!db.objectStoreNames.contains('bookingRooms')) {
        const bookingRoomsStore = db.createObjectStore('bookingRooms', { keyPath: 'id' });
        bookingRoomsStore.createIndex('bookingId', 'bookingId', { unique: false });
        bookingRoomsStore.createIndex('roomId', 'roomId', { unique: false });
        bookingRoomsStore.createIndex('checkInDate', 'checkInDate', { unique: false });
      }
    };
  });
}

// Generic CRUD operations
async function withRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries) throw error;
      // Reset connection and retry
      dbInstance = null;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Operation failed after retries');
}

export async function addItem<T>(storeName: string, item: T): Promise<string> {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };
      
      transaction.onabort = () => {
        dbInstance = null;
        reject(new Error('Transaction aborted'));
      };

      request.onsuccess = () => resolve(request.result as string);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function updateItem<T>(storeName: string, item: T): Promise<void> {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };
      
      transaction.onabort = () => {
        dbInstance = null;
        reject(new Error('Transaction aborted'));
      };

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

export async function deleteItem(storeName: string, id: string): Promise<void> {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };
      
      transaction.onabort = () => {
        dbInstance = null;
        reject(new Error('Transaction aborted'));
      };

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

export async function getItem<T>(storeName: string, id: string): Promise<T | undefined> {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function getAllItems<T>(storeName: string): Promise<T[]> {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

// Check for overlapping bookings
export async function hasOverlappingBooking(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): Promise<boolean> {
  const bookings = await getAllItems<Booking>('bookings');
  const settings: MinimalSettings = getSettings();

  // Compute candidate window using bookingWindowMs. If it fails, fall back to simple date-only comparison.
  let newWindow;
  try {
    newWindow = bookingWindowMs({ checkInDate: checkIn, checkOutDate: checkOut }, settings);
  } catch (err) {
    const newStart = new Date(checkIn).getTime();
    const newEnd = new Date(checkOut).getTime();
    return bookings.some(b => {
      if (b.id === excludeBookingId) return false;
      if (b.roomId !== roomId) return false;
      const bStart = new Date(b.checkInDate).getTime();
      const bEnd = new Date(b.checkOutDate).getTime();
      return newStart < bEnd && newEnd > bStart;
    });
  }

  return bookings.some(b => {
    if (b.id === excludeBookingId) return false;
    if (b.roomId !== roomId) return false;

    try {
      const maybe = b as unknown as { startAtMs?: number; endAtMs?: number; stayType?: 'overnight'|'hourly' };
      const bWindow = bookingWindowMs({ startAtMs: maybe.startAtMs, endAtMs: maybe.endAtMs, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, stayType: maybe.stayType }, settings);
      return newWindow.startAtMs < bWindow.endAtMs && newWindow.endAtMs > bWindow.startAtMs;
    } catch (err) {
      // Fallback
      const bStart = new Date(b.checkInDate).getTime();
      const bEnd = new Date(b.checkOutDate).getTime();
      return newWindow.startAtMs < bEnd && newWindow.endAtMs > bStart;
    }
  });
}

// Multi-room booking support functions
export async function getBookingRoomsByBookingId(bookingId: string): Promise<BookingRoom[]> {
  return withRetry(async () => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['bookingRooms'], 'readonly');
      const store = transaction.objectStore('bookingRooms');
      const index = store.index('bookingId');
      const request = index.getAll(bookingId);

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function deleteBookingRoomsByBookingId(bookingId: string): Promise<void> {
  return withRetry(async () => {
    const db = await initDB();
    const rooms = await getBookingRoomsByBookingId(bookingId);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['bookingRooms'], 'readwrite');
      const store = transaction.objectStore('bookingRooms');
      
      rooms.forEach(room => {
        store.delete(room.id);
      });

      transaction.onerror = () => {
        dbInstance = null;
        reject(transaction.error || new Error('Transaction failed'));
      };
      
      transaction.onabort = () => {
        dbInstance = null;
        reject(new Error('Transaction aborted'));
      };

      transaction.oncomplete = () => resolve();
    });
  });
}
