// Room status management - Automatic status updates based on booking checkout

import { getAllItems, updateItem, Booking, Room } from './db';
import { getSettings } from './settings';
import { bookingWindowMs } from './dates';

/**
 * Check and update room statuses based on booking checkout dates and times
 * Rooms automatically return to 'Available' after the checkout date/time has passed
 */
export async function updateRoomStatusesBasedOnCheckout(): Promise<void> {
  try {
    const [bookings, rooms] = await Promise.all([
      getAllItems<Booking>('bookings'),
      getAllItems<Room>('rooms'),
    ]);

    const settings = getSettings();
    const nowMs = Date.now();

    for (const room of rooms) {
      // Find all bookings for this room
      const roomBookings = bookings.filter(b => b.roomId === room.id);

      // Find any booking whose occupancy window contains now
      const activeBooking = roomBookings.find(b => {
        try {
          const maybe = b as unknown as { startAtMs?: number; endAtMs?: number; stayType?: 'overnight'|'hourly' };
          const w = bookingWindowMs({ startAtMs: maybe.startAtMs, endAtMs: maybe.endAtMs, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, stayType: maybe.stayType }, settings);
          return w.startAtMs <= nowMs && nowMs < w.endAtMs;
        } catch (err) {
          // If computing window fails, fall back to simple date-only check (coarse)
          try {
            const checkInMs = new Date(b.checkInDate).getTime();
            const checkOutMs = new Date(b.checkOutDate).getTime();
            return checkInMs <= nowMs && nowMs < checkOutMs;
          } catch {
            return false;
          }
        }
      });

      let newStatus = room.status;

      if (activeBooking) {
        // There's an active booking - room should be Occupied
        newStatus = 'Occupied';
      } else {
        // No active bookings - room should be Available
        newStatus = 'Available';
      }

      // Update if status changed
      if (room.status !== newStatus) {
        await updateItem('rooms', {
          ...room,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('Failed to update room statuses:', error);
  }
}

/**
 * Mark a room as Occupied when a booking is created
 */
export async function markRoomAsOccupied(roomId: string): Promise<void> {
  try {
    const room = await getAllItems<Room>('rooms');
    const targetRoom = room.find(r => r.id === roomId);
    
    if (targetRoom && targetRoom.status !== 'Occupied') {
      await updateItem('rooms', {
        ...targetRoom,
        status: 'Occupied',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Failed to mark room as occupied:', error);
  }
}
