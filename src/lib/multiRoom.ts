/**
 * Multi-room booking support utilities
 * Maintains backward compatibility with single-room bookings
 */

import { BookingRoom, Booking, Room, RoomType } from './db';
import { getAllItems, getBookingRoomsByBookingId } from './db';

/**
 * Get all rooms for a booking
 * Returns bookingRooms if they exist, otherwise constructs from booking.roomId for backward compatibility
 */
export async function getRoomsForBooking(booking: Booking): Promise<BookingRoom[]> {
  try {
    const bookingRooms = await getBookingRoomsByBookingId(booking.id);
    
    // If bookingRooms exist, return them
    if (bookingRooms.length > 0) {
      return bookingRooms;
    }
  } catch (error) {
    console.error('Error fetching booking rooms:', error);
  }

  // Fallback: construct from single roomId for backward compatibility
  if (booking.roomId) {
    try {
      const rooms = await getAllItems<Room>('rooms');
      const room = rooms.find(r => r.id === booking.roomId);
      
      if (room) {
        const roomTypes = await getAllItems<RoomType>('roomTypes');
        const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
        
        return [{
          id: `virtual-${booking.id}-${room.id}`,
          bookingId: booking.id,
          roomId: room.id,
          roomNumber: room.roomNumber,
          roomTypeName: roomType?.name || 'Unknown',
          priceAtBooking: booking.ratePerNight,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        }];
      }
    } catch (error) {
      console.error('Error constructing booking rooms:', error);
    }
  }

  return [];
}

/**
 * Calculate total booking amount from multiple rooms
 * Fallback to old single-room calculation if bookingRooms don't exist
 */
export async function calculateMultiRoomTotal(
  bookingRooms: BookingRoom[],
  nights: number,
  discount: { type: 'percentage' | 'fixed'; value: number } | null,
  surcharge: { type: 'percentage' | 'fixed'; value: number } | null
): Promise<number> {
  // Calculate subtotal from all rooms
  let subtotal = 0;
  for (const br of bookingRooms) {
    subtotal += br.priceAtBooking * nights;
  }

  // Apply discount
  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = (subtotal * discount.value) / 100;
    } else {
      discountAmount = discount.value;
    }
  }

  // Apply surcharge
  let surchargeAmount = 0;
  if (surcharge) {
    if (surcharge.type === 'percentage') {
      surchargeAmount = (subtotal * surcharge.value) / 100;
    } else {
      surchargeAmount = surcharge.value;
    }
  }

  return subtotal - discountAmount + surchargeAmount;
}

/**
 * Get occupied rooms for a date range from multi-room bookings
 */
export async function getOccupiedRoomsForDateRange(
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  try {
    const bookingRooms = await getAllItems<BookingRoom>('bookingRooms');
    const occupiedRoomIds = new Set<string>();

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    for (const br of bookingRooms) {
      const roomCheckIn = new Date(br.checkInDate);
      const roomCheckOut = new Date(br.checkOutDate);

      // Check if dates overlap
      if (roomCheckIn <= rangeEnd && roomCheckOut >= rangeStart) {
        occupiedRoomIds.add(br.roomId);
      }
    }

    return occupiedRoomIds;
  } catch (error) {
    console.error('Error getting occupied rooms:', error);
    return new Set();
  }
}

/**
 * Check if a room is available for multi-room bookings
 */
export async function isRoomAvailableForDates(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): Promise<boolean> {
  try {
    const bookingRooms = await getAllItems<BookingRoom>('bookingRooms');
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    for (const br of bookingRooms) {
      // Skip if this is the same booking being edited
      if (excludeBookingId && br.bookingId === excludeBookingId) {
        continue;
      }

      if (br.roomId !== roomId) continue;

      const brCheckIn = new Date(br.checkInDate);
      const brCheckOut = new Date(br.checkOutDate);

      // Check for overlap
      if (checkInDate < brCheckOut && checkOutDate > brCheckIn) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking room availability:', error);
    return true; // Assume available on error
  }
}
