import { getAllItems, initDB } from './db';

// App metadata for backup versioning
const APP_NAME = 'Hotel Management App';
const APP_VERSION = '1.0.0';

/**
 * Generate timestamped filename using local time
 * Format: hotel_backup_YYYY-MM-DD_HH-mm.json
 */
function generateBackupFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `hotel_backup_${year}-${month}-${day}_${hours}-${minutes}.json`;
}

/**
 * Export all data with metadata wrapper
 * Metadata includes app name, version, and export timestamp
 */
export async function exportAllData() {
  const roomTypes = await getAllItems('roomTypes');
  const rooms = await getAllItems('rooms');
  const guests = await getAllItems('guests');
  const bookings = await getAllItems('bookings');

  // Wrapped with metadata (TASK 2)
  const exportData = {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      version: '1.0', // Legacy compatibility
      exportDate: new Date().toISOString(),
      data: {
        roomTypes,
        rooms,
        guests,
        bookings,
      },
    },
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Use timestamped filename (TASK 1)
  a.download = generateBackupFilename();
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Check if any data exists in the database
 */
export async function hasExistingData(): Promise<boolean> {
  const roomTypes = await getAllItems('roomTypes');
  const rooms = await getAllItems('rooms');
  const guests = await getAllItems('guests');
  const bookings = await getAllItems('bookings');
  
  return roomTypes.length > 0 || rooms.length > 0 || guests.length > 0 || bookings.length > 0;
}

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  const storeNames = ['roomTypes', 'rooms', 'guests', 'bookings'];
  
  for (const storeName of storeNames) {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Import data from backup file
 * Handles both new format (with metadata) and legacy format
 */
export async function importData(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Handle new format with metadata wrapper
    let backupData = parsed;
    if (parsed.appName && parsed.data) {
      // New format: extract inner data
      backupData = parsed.data;
    }

    // Validate backup structure
    if (!backupData.version || !backupData.data) {
      return { success: false, message: 'Invalid backup file format' };
    }

    const { addItem } = await import('./db');

    // Import in order: roomTypes -> rooms -> guests -> bookings
    for (const roomType of backupData.data.roomTypes || []) {
      await addItem('roomTypes', roomType);
    }
    for (const room of backupData.data.rooms || []) {
      await addItem('rooms', room);
    }
    for (const guest of backupData.data.guests || []) {
      await addItem('guests', guest);
    }
    for (const booking of backupData.data.bookings || []) {
      await addItem('bookings', booking);
    }

    return { success: true, message: 'Data imported successfully' };
  } catch (error) {
    return { success: false, message: `Import failed: ${error}` };
  }
}
