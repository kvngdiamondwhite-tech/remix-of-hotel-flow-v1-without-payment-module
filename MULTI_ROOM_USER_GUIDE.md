# Multi-Room Booking Feature - User Guide

## Quick Start

### Creating a Single-Room Booking (Unchanged)
1. Click "New Booking"
2. Select Guest
3. Select Room
4. Set dates and pricing
5. Click "Create Booking"
*(Works exactly as before - no changes to single-room workflow)*

### Creating a Multi-Room Booking (NEW)
1. Click "New Booking"
2. Select Guest
3. Select Primary Room
4. Click "+ Add Room" dropdown
5. Select additional rooms (can add multiple)
6. Each selected room appears in the list with ✕ to remove
7. Set dates and pricing (applies to all selected rooms)
8. Click "Create Booking"

**Result**: One booking with multiple rooms, each room marked as "Occupied"

---

## What Happens Behind the Scenes

### Single-Room Booking
```
Booking Record Created
  └─ roomId: "room-123"
  └─ BookingRoom Record Created (for consistency)
     └─ roomId: "room-123"
```

### Multi-Room Booking
```
Booking Record Created
  └─ roomId: "room-101" (primary room)
  └─ BookingRoom Record #1
     └─ roomId: "room-101"
  └─ BookingRoom Record #2
     └─ roomId: "room-102"
  └─ BookingRoom Record #3
     └─ roomId: "room-103"
```

---

## Key Features

✅ **Select Multiple Rooms** - Add as many rooms as needed for one booking  
✅ **Unified Booking** - One booking for all selected rooms  
✅ **Single Price** - Rate applies to all rooms (future: per-room pricing)  
✅ **Room Status Sync** - All rooms auto-marked as "Occupied"  
✅ **Clean Removal** - Delete booking removes all room links  
✅ **Edit Support** - Change rooms when editing a booking  
✅ **Backward Compatible** - Old single-room bookings still work  

---

## Room Selection UI

### Add Room Dropdown
- Only shows **Available** rooms
- Excludes already-selected rooms
- Excludes the primary room
- Sorted by room number

### Selected Rooms Display
- Shows room number and type
- Click ✕ to remove room from booking
- Shows message when no additional rooms selected

---

## Data Storage

### Booking Table (Unchanged)
- Still stores `roomId` (primary room) for backward compatibility
- All other fields work as before

### BookingRooms Table (NEW)
- Links each room to the booking
- Stores room number and type for quick lookups
- Stores original price at booking time
- Tracks check-in/out dates

---

## Reporting & Analytics

### Room Occupancy Reports
- Count occupied rooms for each day
- Multi-room bookings count each room separately
- Accurate occupancy rate calculation

### Revenue Reports
- Sum all payments for multi-room bookings
- Payment method tracking works across all rooms

### Booking History
- Shows all rooms in multi-room bookings
- Filtering by room works correctly

---

## Technical Notes

### Database Version
- Updated to v1003 for multi-room support
- Automatic on first load (no manual migration)

### Backward Compatibility
- System auto-detects which data structure to use
- Old bookings work without modification
- New bookings automatically get BookingRoom records

### Room Status Automation
- Checks both BookingRoom and old booking.roomId
- Marks rooms as "Occupied" for entire stay
- Auto-switches to "Available" after checkout

---

## Limitations & Future Work

Current Version:
- Uniform price for all rooms (rate applies to all)
- Single check-in/out for all rooms
- Invoice shows primary room details

Future Enhancements:
- Per-room pricing and rates
- Individual room check-in/out times
- Detailed room breakdown on invoices
- Advanced occupancy analytics

---

## Troubleshooting

**Q: Can I add the same room twice?**
A: No - the system prevents duplicate room selection

**Q: What if I delete a room after booking?**
A: The booking remains; room details are stored in BookingRoom records

**Q: How do old bookings work with this system?**
A: They work normally - the system creates virtual BookingRoom records as needed

**Q: Can I edit a multi-room booking?**
A: Yes - open the booking and add/remove rooms, then save

**Q: Are multi-room bookings charged differently?**
A: No - currently the same rate applies to all rooms. Future versions will support per-room pricing

---

## Support

For issues or questions about multi-room bookings, check:
- [Database setup](src/lib/db.ts)
- [Room status automation](src/lib/roomStatus.ts)
- [Multi-room utilities](src/lib/multiRoom.ts)
- [Booking form](src/pages/Bookings.tsx)
