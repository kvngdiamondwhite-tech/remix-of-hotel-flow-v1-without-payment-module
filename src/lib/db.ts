// IndexedDB setup and operations

const DB_NAME = 'HotelManagementDB';
const DB_VERSION = 3;

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
}

let dbInstance: IDBDatabase | null = null;

function isConnectionValid(db: IDBDatabase | null): boolean {
  if (!db) return false;
  try {
    // Try to access objectStoreNames - this will throw if connection is closed
    db.objectStoreNames;
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

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle connection closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      
      dbInstance.onerror = () => {
        dbInstance = null;
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
    };
  });
}

// Generic CRUD operations
export async function addItem<T>(storeName: string, item: T): Promise<string> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    request.onsuccess = () => resolve(request.result as string);
    request.onerror = () => reject(request.error);
  });
}

export async function updateItem<T>(storeName: string, item: T): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName: string, id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getItem<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
  
  return bookings.some(booking => {
    if (booking.id === excludeBookingId) return false;
    if (booking.roomId !== roomId) return false;
    
    const bookingStart = new Date(booking.checkInDate);
    const bookingEnd = new Date(booking.checkOutDate);
    const newStart = new Date(checkIn);
    const newEnd = new Date(checkOut);
    
    return newStart < bookingEnd && newEnd > bookingStart;
  });
}
