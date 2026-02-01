// Room status management - Automatic status updates based on booking checkout

import { getAllItems, updateItem, Booking, Room, BookingRoom } from './db';
import { getSettings } from './settings';
import { bookingWindowMs } from './dates';

/**
 * Check and update room statuses based on booking checkout dates and times
 * Rooms automatically return to 'Available' after the checkout date/time has passed
 * Supports both single-room (booking.roomId) and multi-room (BookingRoom) bookings
 */
export async function updateRoomStatusesBasedOnCheckout(): Promise<void> {
  try {
    const [bookings, bookingRooms, rooms] = await Promise.all([
      getAllItems<Booking>('bookings'),
      getAllItems<BookingRoom>('bookingRooms'),
      getAllItems<Room>('rooms'),
    ]);

    const settings = getSettings();
    const nowMs = Date.now();

    for (const room of rooms) {
      let isOccupied = false;

      // Check multi-room bookings first
      const bookingRoomsForThisRoom = bookingRooms.filter(br => br.roomId === room.id);
      for (const br of bookingRoomsForThisRoom) {
        try {
          const checkInDate = new Date(br.checkInDate);
          const checkOutDate = new Date(br.checkOutDate);
          
          // Apply check-in and check-out times from settings
          const checkInTime = settings.defaultCheckInTime || '14:00';
          const checkOutTime = settings.defaultCheckOutTime || '11:00';
          
          // Parse times
          const [checkInHour, checkInMin] = checkInTime.split(':').map(Number);
          const [checkOutHour, checkOutMin] = checkOutTime.split(':').map(Number);
          
          // Create booking window in milliseconds
          const checkInMs = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate(), checkInHour, checkInMin).getTime();
          const checkOutMs = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate(), checkOutHour, checkOutMin).getTime();
          
          // Room is occupied if now is between check-in and check-out time
          if (checkInMs <= nowMs && nowMs < checkOutMs) {
            isOccupied = true;
            break;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Fall back to single-room bookings (backward compatibility)
      if (!isOccupied) {
        const roomBookings = bookings.filter(b => b.roomId === room.id);
        
        const activeBooking = roomBookings.find(b => {
          try {
            const maybe = b as unknown as { startAtMs?: number; endAtMs?: number; stayType?: 'overnight'|'hourly' };
            const w = bookingWindowMs({ startAtMs: maybe.startAtMs, endAtMs: maybe.endAtMs, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, stayType: maybe.stayType }, settings);
            return w.startAtMs <= nowMs && nowMs < w.endAtMs;
          } catch (err) {
            // If computing window fails, fall back to simple date-only check with times
            try {
              const checkInDate = new Date(b.checkInDate);
              const checkOutDate = new Date(b.checkOutDate);
              
              const checkInTime = settings.defaultCheckInTime || '14:00';
              const checkOutTime = settings.defaultCheckOutTime || '11:00';
              
              const [checkInHour, checkInMin] = checkInTime.split(':').map(Number);
              const [checkOutHour, checkOutMin] = checkOutTime.split(':').map(Number);
              
              const checkInMs = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate(), checkInHour, checkInMin).getTime();
              const checkOutMs = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate(), checkOutHour, checkOutMin).getTime();
              
              return checkInMs <= nowMs && nowMs < checkOutMs;
            } catch {
              return false;
            }
          }
        });

        if (activeBooking) {
          isOccupied = true;
        }
      }

      const newStatus = isOccupied ? 'Occupied' : 'Available';

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
