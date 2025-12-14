import { getAllItems } from './db';

export async function exportAllData() {
  const roomTypes = await getAllItems('roomTypes');
  const rooms = await getAllItems('rooms');
  const guests = await getAllItems('guests');
  const bookings = await getAllItems('bookings');

  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      roomTypes,
      rooms,
      guests,
      bookings,
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hotelflow-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !data.data) {
      return { success: false, message: 'Invalid backup file format' };
    }

    const { addItem } = await import('./db');

    // Import in order: roomTypes -> rooms -> guests -> bookings
    for (const roomType of data.data.roomTypes || []) {
      await addItem('roomTypes', roomType);
    }
    for (const room of data.data.rooms || []) {
      await addItem('rooms', room);
    }
    for (const guest of data.data.guests || []) {
      await addItem('guests', guest);
    }
    for (const booking of data.data.bookings || []) {
      await addItem('bookings', booking);
    }

    return { success: true, message: 'Data imported successfully' };
  } catch (error) {
    return { success: false, message: `Import failed: ${error}` };
  }
}
