import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getAllItems, addItem, updateItem, deleteItem, getItem, Booking, Guest, Room, RoomType, BookingRoom, hasOverlappingBooking, deleteBookingRoomsByBookingId, getBookingRoomsByBookingId, initDB } from "@/lib/db";
import { bookingWindowMs } from '@/lib/dates';
import { getSettings, HotelSettings } from '@/lib/settings';
import { uid } from "@/lib/id";
import { nowIso, todayIso, daysBetweenIso, formatDate, formatDateTime } from "@/lib/dates";
import { calculateSubtotal, applyDiscount, applySurcharge, calculateTotal, formatCurrency, Discount, Surcharge } from "@/lib/calculations";
import { Plus, Edit, Trash2, Calendar, User, DoorOpen, FileText, CreditCard, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { printInvoice } from "@/lib/receipt";
import { getTotalPaidForBooking } from "@/lib/payments";
import PaymentForm from "@/components/PaymentForm";
import { naturalSort } from "@/lib/naturalSort";
import { useLicense } from "@/hooks/useLicense";
import { LicenseBanner } from "@/components/LicenseBanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TRIAL_LIMITS } from "@/lib/license";
import { updateRoomStatusesBasedOnCheckout } from "@/lib/roomStatus";

export default function Bookings() {
  const license = useLicense();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [bookingRooms, setBookingRooms] = useState<BookingRoom[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [bookingPayments, setBookingPayments] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [hotelSettings, setHotelSettings] = useState<HotelSettings | null>(null);
  
  // Multi-room support - room lines (per-room dates & price)
  type RoomLine = {
    tempId: string;
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    priceAtBooking: number;
  };

  const [roomLines, setRoomLines] = useState<RoomLine[]>([]);
  
  // Helper function to calculate default checkout date based on check-in time and checkout time from settings
  const getDefaultCheckoutDate = (checkInDate: string): string => {
    if (!hotelSettings) return checkInDate;
    
    try {
      const checkInTime = hotelSettings.defaultCheckInTime || '14:00';
      const checkOutTime = hotelSettings.defaultCheckOutTime || '11:00';
      
      // Compare times as strings (HH:MM format)
      // If checkout is earlier or same as check-in, checkout is next day
      if (checkOutTime <= checkInTime) {
        const nextDay = new Date(checkInDate);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay.toISOString().split('T')[0];
      }
      
      return checkInDate;
    } catch (error) {
      return checkInDate;
    }
  };
  
  const [formData, setFormData] = useState({
    guestId: "",
    roomId: "",
    checkInDate: todayIso(),
    checkOutDate: todayIso(),
    ratePerNight: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    surchargeType: "percentage" as "percentage" | "fixed",
    surchargeValue: "",
    paymentStatus: "Pending" as "Paid" | "Pending",
    notes: "",
    // Hourly/short-stay options (hidden by default)
    isHourly: false,
    startDateTime: '', // datetime-local string
    durationMinutes: '',
  });

  // Expand/collapse state for booking rows
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (bookingId: string) => {
    setExpandedBookingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const settings = getSettings();
    setHotelSettings(settings);
    
    // Update default checkout date whenever settings change
    setFormData(prev => ({
      ...prev,
      checkOutDate: getDefaultCheckoutDate(prev.checkInDate)
    }));
  }, []);

  async function loadData() {
    // First, update room statuses based on checkout times
    await updateRoomStatusesBasedOnCheckout();
    
    const [bookingsData, guestsData, roomsData, typesData, bookingRoomsData] = await Promise.all([
      getAllItems<Booking>('bookings'),
      getAllItems<Guest>('guests'),
      getAllItems<Room>('rooms'),
      getAllItems<RoomType>('roomTypes'),
      getAllItems<BookingRoom>('bookingRooms')
    ]);
    setBookings(bookingsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setGuests(guestsData);
    setRooms(roomsData);
    setRoomTypes(typesData);
    setBookingRooms(bookingRoomsData);
    
    // Load payment totals for each booking
    const paymentsMap: Record<string, number> = {};
    for (const booking of bookingsData) {
      paymentsMap[booking.id] = await getTotalPaidForBooking(booking.id);
    }
    setBookingPayments(paymentsMap);
  }

  function resetForm() {
    const today = todayIso();
    const defaultCheckout = getDefaultCheckoutDate(today);
    
    setFormData({
      guestId: "",
      roomId: "",
      checkInDate: today,
      checkOutDate: defaultCheckout,
      ratePerNight: "",
      discountType: "percentage",
      discountValue: "",
      surchargeType: "percentage",
      surchargeValue: "",
      paymentStatus: "Pending",
      notes: "",
      isHourly: false,
      startDateTime: '',
      durationMinutes: '',
    });
    setEditingBooking(null);
    setRoomLines([]);
  }

  async function handleEdit(booking: Booking) {
    setEditingBooking(booking);

    // Hydrate room lines from bookingRooms if present (backward compatible)
    try {
      const brs = await getBookingRoomsByBookingId(booking.id);
      if (brs && brs.length > 0) {
        const lines = brs.map(br => ({
          tempId: br.id,
          roomId: br.roomId,
          checkInDate: br.checkInDate,
          checkOutDate: br.checkOutDate,
          priceAtBooking: br.priceAtBooking,
        }));
        setRoomLines(lines);
      } else {
        // Legacy single-room booking
        setRoomLines([{
          tempId: 'primary',
          roomId: booking.roomId,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          priceAtBooking: booking.ratePerNight,
        }]);
      }
    } catch (err) {
      // Fallback to legacy single-room
      setRoomLines([{
        tempId: 'primary',
        roomId: booking.roomId,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        priceAtBooking: booking.ratePerNight,
      }]);
    }

    setFormData({
      guestId: booking.guestId,
      roomId: booking.roomId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      ratePerNight: booking.ratePerNight.toString(),
      discountType: booking.discount?.type || "percentage",
      discountValue: booking.discount?.value?.toString() || "",
      surchargeType: booking.surcharge?.type || "percentage",
      surchargeValue: booking.surcharge?.value?.toString() || "",
      paymentStatus: booking.paymentStatus,
      notes: booking.notes,
      isHourly: booking.stayType === 'hourly',
      startDateTime: booking.startAtMs ? new Date(booking.startAtMs).toISOString().slice(0,16) : '',
      durationMinutes: booking.durationMinutes ? String(booking.durationMinutes) : '',
    });
    setIsDialogOpen(true);
  }

  function msToLocalDatetimeInput(ms?: number) {
    if (!ms) return '';
    const d = new Date(ms);
    // format as yyyy-mm-ddThh:MM for input[type=datetime-local]
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function handleRoomChange(roomId: string) {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
      if (roomType) {
        const newCheckoutDate = getDefaultCheckoutDate(formData.checkInDate);
        
        setFormData({
          ...formData,
          roomId,
          ratePerNight: roomType.basePrice.toString(),
          checkOutDate: newCheckoutDate,
        });

        // Ensure primary room line exists/updated (primary line uses tempId 'primary')
        setRoomLines(prev => {
          const others = prev.filter(l => l.tempId !== 'primary');
          const primaryLine: RoomLine = {
            tempId: 'primary',
            roomId,
            checkInDate: formData.checkInDate,
            checkOutDate: newCheckoutDate,
            priceAtBooking: roomType.basePrice,
          };
          return [primaryLine, ...others];
        });
      }
    }
  }

  // Get all selected rooms with their prices
  function getSelectedRoomsWithPrices() {
    // Use roomLines as the source of truth; fallback to virtual primary line
    const lines: RoomLine[] = roomLines.length > 0 ? roomLines : (formData.roomId ? [{ tempId: 'primary', roomId: formData.roomId, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate, priceAtBooking: parseFloat(formData.ratePerNight) || 0 }] as RoomLine[] : [] as RoomLine[]);
    return lines.map((line: RoomLine) => {
      const room = rooms.find(r => r.id === line.roomId);
      const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
      return {
        roomId: line.roomId,
        roomNumber: room?.roomNumber || 'Unknown',
        roomType: roomType?.name || 'Unknown',
        price: line.priceAtBooking || 0,
        checkInDate: line.checkInDate,
        checkOutDate: line.checkOutDate,
      };
    });
  }

  // Calculate booking summary with multi-room support (per-line nights & subtotals)
  function calculateBookingSummary() {
    const selected = getSelectedRoomsWithPrices();

    // For each room line, compute nights and subtotal using its own dates
    const roomSubtotals: number[] = selected.map(r => {
      const nights = daysBetweenIso(r.checkInDate, r.checkOutDate);
      return (r.price || 0) * nights;
    });

    const subtotal = roomSubtotals.reduce((sum, amt) => sum + amt, 0);

    const discount: Discount | null = formData.discountValue
      ? { type: formData.discountType, value: parseFloat(formData.discountValue) || 0 }
      : null;
    const discountAmt = applyDiscount(subtotal, discount);

    const surcharge: Surcharge | null = formData.surchargeValue
      ? { type: formData.surchargeType, value: parseFloat(formData.surchargeValue) || 0 }
      : null;
    const surchargeAmt = applySurcharge(subtotal, surcharge);

    const total = calculateTotal(subtotal, discountAmt, surchargeAmt);

    // booking-level nights for display/search is min..max of line dates
    const allLines: RoomLine[] = roomLines.length > 0 ? roomLines : (formData.roomId ? [{ tempId: 'primary', roomId: formData.roomId, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate, priceAtBooking: parseFloat(formData.ratePerNight) || 0 }] as RoomLine[] : [] as RoomLine[]);
    let minStart = formData.checkInDate;
    let maxEnd = formData.checkOutDate;
    if (allLines.length > 0) {
      minStart = allLines.reduce((min, l) => l.checkInDate < min ? l.checkInDate : min, allLines[0].checkInDate);
      maxEnd = allLines.reduce((max, l) => l.checkOutDate > max ? l.checkOutDate : max, allLines[0].checkOutDate);
    }
    const displayNights = daysBetweenIso(minStart, maxEnd);

    return {
      nights: displayNights,
      rate: parseFloat(formData.ratePerNight) || 0,
      roomCount: selected.length,
      selectedRooms: selected,
      roomSubtotals,
      subtotal,
      discountAmt,
      surchargeAmt,
      total,
      discount,
      surcharge,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // License enforcement - check if creating new booking
    if (!editingBooking) {
      if (!license.canCreateBooking) {
        if (license.isTrialLimitReached) {
          toast.error(`Trial limit reached. Maximum ${TRIAL_LIMITS.maxBookings} bookings in Trial Mode.`);
        } else {
          toast.error(license.getBlockedReason('create_booking'));
        }
        return;
      }
    }

    if (!formData.guestId) {
      toast.error("Please select a guest");
      return;
    }

    // Ensure at least one room line exists (primary must be selected)
    if (!formData.roomId && roomLines.length === 0) {
      toast.error("Please select a room");
      return;
    }

    // For hourly/short-stay bookings, validate differently
    if (formData.isHourly) {
      if (!formData.startDateTime) {
        toast.error("Please select a start time for short stay booking");
        return;
      }
      if (!formData.durationMinutes) {
        toast.error("Please enter duration in minutes for short stay booking");
        return;
      }
      
      const duration = parseInt(formData.durationMinutes, 10);
      if (isNaN(duration) || duration < 1) {
        toast.error("Duration must be at least 1 minute");
        return;
      }
    } else {
      // For overnight bookings, validate dates
      // Build room lines to validate (use roomLines or virtual primary)
      const linesToBook = roomLines.length > 0
        ? roomLines
        : [{ tempId: 'primary', roomId: formData.roomId, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate, priceAtBooking: parseFloat(formData.ratePerNight) || 0 }];

      // Basic validation per line
      const seenRoomIds = new Set<string>();
      for (const line of linesToBook) {
        if (!line.roomId) {
          toast.error('Each room line must have a room selected');
          return;
        }
        if (new Date(line.checkOutDate) <= new Date(line.checkInDate)) {
          const rn = getRoomNumber(line.roomId);
          toast.error(`Check-out must be after check-in for room ${rn}`);
          return;
        }
        if (seenRoomIds.has(line.roomId)) {
          const rn = getRoomNumber(line.roomId);
          toast.error(`Room ${rn} is selected multiple times`);
          return;
        }
        seenRoomIds.add(line.roomId);
      }
    }

    // Build room lines (use roomLines or virtual primary)
    const linesToBook = roomLines.length > 0
      ? roomLines
      : [{ tempId: 'primary', roomId: formData.roomId, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate, priceAtBooking: parseFloat(formData.ratePerNight) || 0 }];

    const rate = parseFloat(formData.ratePerNight);
    if (isNaN(rate) || rate < 0) {
      // Keep default rate validation, but totals will be computed from room lines
      toast.error("Valid rate per night is required");
      return;
    }

    // Overlap validation: check bookingRooms and legacy bookings
    const allBookings = await getAllItems<Booking>('bookings');
    const allBookingRooms = await getAllItems<BookingRoom>('bookingRooms');

    for (const line of linesToBook) {
      if (formData.isHourly) {
        const settings = getSettings();
        const startAtMs = formData.startDateTime ? new Date(formData.startDateTime).getTime() : Date.now();
        const duration = parseInt(formData.durationMinutes || '', 10) || 120;
        const endAtMs = startAtMs + Math.round(duration * 60000);

        if (endAtMs <= startAtMs) {
          toast.error('Invalid duration for hourly booking');
          return;
        }

        for (const b of allBookings) {
          if (b.id === editingBooking?.id) continue;
          const usesRoomLegacy = b.roomId === line.roomId;
          const usesRoomViaRooms = allBookingRooms.some(br => br.bookingId === b.id && br.roomId === line.roomId);
          if (!usesRoomLegacy && !usesRoomViaRooms) continue;
          try {
            const maybe = b as unknown as { startAtMs?: number; endAtMs?: number; stayType?: 'overnight'|'hourly' };
            const bw = bookingWindowMs({ startAtMs: maybe.startAtMs, endAtMs: maybe.endAtMs, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, stayType: maybe.stayType }, settings);
            if (startAtMs < bw.endAtMs && endAtMs > bw.startAtMs) {
              const roomNum = getRoomNumber(line.roomId);
              const from = new Date(bw.startAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const to = new Date(bw.endAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              toast.error(`Room ${roomNum} already has a booking from ${from}–${to}.`);
              return;
            }
          } catch (err) {
            const bStart = new Date(b.checkInDate).getTime();
            const bEnd = new Date(b.checkOutDate).getTime();
            if (startAtMs < bEnd && endAtMs > bStart) {
              toast.error('This room already has a booking that overlaps the selected time');
              return;
            }
          }
        }
      } else {
        // Overnight: check bookingRooms entries first
        const newStart = new Date(line.checkInDate).getTime();
        const newEnd = new Date(line.checkOutDate).getTime();

        for (const br of allBookingRooms) {
          if (br.bookingId === editingBooking?.id) continue;
          if (br.roomId !== line.roomId) continue;
          const bStart = new Date(br.checkInDate).getTime();
          const bEnd = new Date(br.checkOutDate).getTime();
          if (newStart < bEnd && newEnd > bStart) {
            const roomNum = getRoomNumber(line.roomId);
            toast.error(`${roomNum} is already booked for the selected dates`);
            return;
          }
        }

        for (const b of allBookings) {
          if (b.id === editingBooking?.id) continue;
          if (b.roomId !== line.roomId) continue;
          const bStart = new Date(b.checkInDate).getTime();
          const bEnd = new Date(b.checkOutDate).getTime();
          if (newStart < bEnd && newEnd > bStart) {
            const roomNum = getRoomNumber(line.roomId);
            toast.error(`${roomNum} is already booked for the selected dates`);
            return;
          }
        }
      }
    }

    try {
      const summary = calculateBookingSummary();

      // Build linesToBook again for persistence
      const linesToBook = roomLines.length > 0
        ? roomLines
        : [{ tempId: 'primary', roomId: formData.roomId, checkInDate: formData.checkInDate, checkOutDate: formData.checkOutDate, priceAtBooking: parseFloat(formData.ratePerNight) || 0 }];

      // Determine booking-level dates (min start, max end)
      const minStart = linesToBook.reduce((min, l) => l.checkInDate < min ? l.checkInDate : min, linesToBook[0].checkInDate);
      const maxEnd = linesToBook.reduce((max, l) => l.checkOutDate > max ? l.checkOutDate : max, linesToBook[0].checkOutDate);
      const displayNights = daysBetweenIso(minStart, maxEnd);

      const db = await initDB();

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['bookings', 'bookingRooms'], 'readwrite');
        const bookingsStore = tx.objectStore('bookings');
        const bookingRoomsStore = tx.objectStore('bookingRooms');

        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.oncomplete = () => resolve();

        if (editingBooking) {
          const room = rooms.find(r => r.id === formData.roomId);
          const updated: Booking = {
            ...editingBooking,
            guestId: formData.guestId,
            roomId: formData.roomId,
            roomTypeId: room!.roomTypeId,
            checkInDate: minStart,
            checkOutDate: maxEnd,
            nights: displayNights,
            ratePerNight: parseFloat(formData.ratePerNight) || 0,
            subtotal: summary.subtotal,
            discount: summary.discount,
            discountAmount: summary.discountAmt,
            surcharge: summary.surcharge,
            surchargeAmount: summary.surchargeAmt,
            total: summary.total,
            paymentStatus: formData.paymentStatus,
            notes: formData.notes.trim(),
            updatedAt: nowIso(),
          } as Booking;

          if (formData.isHourly) {
            const startAtMs = formData.startDateTime ? new Date(formData.startDateTime).getTime() : Date.now();
            const duration = parseInt(formData.durationMinutes || '', 10) || 120;
            updated.stayType = 'hourly';
            updated.startAtMs = startAtMs;
            updated.endAtMs = startAtMs + Math.round(duration * 60000);
            updated.durationMinutes = duration;
          } else {
            updated.stayType = 'overnight';
          }

          const putReq = bookingsStore.put(updated);
          putReq.onerror = () => reject(putReq.error);
          putReq.onsuccess = () => {
            // Remove existing bookingRooms for this booking within same transaction
            const idxReq = bookingRoomsStore.index('bookingId').getAll(editingBooking.id);
            idxReq.onerror = () => reject(idxReq.error);
            idxReq.onsuccess = () => {
              const existing: BookingRoom[] = idxReq.result || [];
                existing.forEach(er => bookingRoomsStore.delete(er.id));

              // Add new bookingRooms
              for (const line of linesToBook) {
                const selectedRoom = rooms.find(r => r.id === line.roomId);
                if (selectedRoom) {
                  const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
                  const bookingRoom: BookingRoom = {
                    id: uid(),
                    bookingId: editingBooking.id,
                    roomId: selectedRoom.id,
                    roomNumber: selectedRoom.roomNumber,
                    roomTypeName: roomType?.name || 'Unknown',
                    priceAtBooking: line.priceAtBooking,
                    checkInDate: line.checkInDate,
                    checkOutDate: line.checkOutDate,
                    createdAt: nowIso(),
                    updatedAt: nowIso(),
                  };
                  bookingRoomsStore.add(bookingRoom);
                }
              }
            };
          };
        } else {
          // Create new booking and bookingRooms in single transaction
          const newBooking: Booking = {
            id: uid(),
            guestId: formData.guestId,
            roomId: formData.roomId,
            roomTypeId: (rooms.find(r => r.id === formData.roomId)?.roomTypeId) || '',
            checkInDate: minStart,
            checkOutDate: maxEnd,
            nights: displayNights,
            ratePerNight: parseFloat(formData.ratePerNight) || 0,
            subtotal: summary.subtotal,
            discount: summary.discount,
            discountAmount: summary.discountAmt,
            surcharge: summary.surcharge,
            surchargeAmount: summary.surchargeAmt,
            total: summary.total,
            paymentStatus: formData.paymentStatus,
            notes: formData.notes.trim(),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          } as Booking;

          if (formData.isHourly) {
            const startAtMs = formData.startDateTime ? new Date(formData.startDateTime).getTime() : Date.now();
            const duration = parseInt(formData.durationMinutes || '', 10) || 120;
            newBooking.stayType = 'hourly';
            newBooking.startAtMs = startAtMs;
            newBooking.endAtMs = startAtMs + Math.round(duration * 60000);
            newBooking.durationMinutes = duration;
          } else {
            newBooking.stayType = 'overnight';
          }

          const addReq = bookingsStore.add(newBooking);
          addReq.onerror = () => reject(addReq.error);
          addReq.onsuccess = () => {
            const createdId = addReq.result as string;
            for (const line of linesToBook) {
              const selectedRoom = rooms.find(r => r.id === line.roomId);
              if (selectedRoom) {
                const roomType = roomTypes.find(rt => rt.id === selectedRoom.roomTypeId);
                const bookingRoom: BookingRoom = {
                  id: uid(),
                  bookingId: createdId,
                  roomId: selectedRoom.id,
                  roomNumber: selectedRoom.roomNumber,
                  roomTypeName: roomType?.name || 'Unknown',
                  priceAtBooking: line.priceAtBooking,
                  checkInDate: line.checkInDate,
                  checkOutDate: line.checkOutDate,
                  createdAt: nowIso(),
                  updatedAt: nowIso(),
                };
                bookingRoomsStore.add(bookingRoom);
              }
            }
          };
        }
      });

      toast.success(editingBooking ? "Booking updated successfully" : "Booking created successfully");

      // Refresh room statuses to ensure consistency (do not manually set status here)
      await updateRoomStatusesBasedOnCheckout();
      await loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save booking");
      console.error(error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      // Delete booking and associated BookingRoom records
      await deleteBookingRoomsByBookingId(id);
      await deleteItem('bookings', id);
      toast.success("Booking deleted successfully");
      
      // Refresh room statuses after deletion
      await updateRoomStatusesBasedOnCheckout();
      await loadData();
    } catch (error) {
      toast.error("Failed to delete booking");
      console.error(error);
    }
  }

  const getGuestName = useCallback((guestId: string): string => {
    return guests.find(g => g.id === guestId)?.fullName || "Unknown";
  }, [guests]);

  const getRoomNumber = useCallback((roomId: string): string => {
    return rooms.find(r => r.id === roomId)?.roomNumber || "Unknown";
  }, [rooms]);

  // Get all rooms for a booking (multi-room support)
  const getBookingRoomsForDisplay = useCallback((bookingId: string): BookingRoom[] => {
    const bookingRoomRecords = bookingRooms.filter(br => br.bookingId === bookingId);
    
    // If we have BookingRoom records, use them
    if (bookingRoomRecords.length > 0) {
      return bookingRoomRecords;
    }
    
    // Fallback: create virtual BookingRoom from booking.roomId for backward compatibility
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      const room = rooms.find(r => r.id === booking.roomId);
      const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
      return [{
        id: `virtual-${bookingId}-${booking.roomId}`,
        bookingId: bookingId,
        roomId: booking.roomId,
        roomNumber: room?.roomNumber || 'Unknown',
        roomTypeName: roomType?.name || 'Unknown',
        priceAtBooking: booking.ratePerNight,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      }];
    }
    
    return [];
  }, [bookingRooms, bookings, rooms, roomTypes]);

  // Build memoized map of bookingRooms by bookingId for efficient lookup
  const bookingRoomsByBookingId = useMemo(() => {
    const map = new Map<string, BookingRoom[]>();
    
    // Add all BookingRoom records grouped by bookingId
    for (const br of bookingRooms) {
      const arr = map.get(br.bookingId) ?? [];
      arr.push(br);
      map.set(br.bookingId, arr);
    }
    
    // Add fallback for legacy bookings without BookingRoom records
    for (const booking of bookings) {
      if (!map.has(booking.id)) {
        const room = rooms.find(r => r.id === booking.roomId);
        const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
        if (room) {
          map.set(booking.id, [{
            id: `virtual-${booking.id}-${booking.roomId}`,
            bookingId: booking.id,
            roomId: booking.roomId,
            roomNumber: room.roomNumber,
            roomTypeName: roomType?.name || 'Unknown',
            priceAtBooking: booking.ratePerNight,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
          }]);
        }
      }
    }
    
    return map;
  }, [bookingRooms, bookings, rooms, roomTypes]);

  // Filter and search bookings based on search term, room, and date range
  const filteredBookings = useMemo(() => {
    // First apply filters (search, room, date range)
    const results = bookings.filter(booking => {
      const guestName = getGuestName(booking.guestId).toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      // Rooms for this booking (handles bookingRooms and legacy fallback)
      const bookingRoomsList = getBookingRoomsForDisplay(booking.id);
      const roomNumbers = bookingRoomsList.map(br => (getRoomNumber(br.roomId) || br.roomNumber || '').toLowerCase());

      // Search filter (guest name or any room number)
      const matchesSearch = searchTerm === "" ||
        guestName.includes(searchLower) ||
        roomNumbers.some(rn => rn.includes(searchLower));

      // Room filter: match if any room in booking matches the filterRoom id
      const matchesRoom = filterRoom === "all" || booking.roomId === filterRoom || bookingRoomsList.some(br => br.roomId === filterRoom);

      // Date range filter (check-in and check-out dates overlap with filter range)
      let matchesDateRange = true;
      if (filterStartDate || filterEndDate) {
        const bookingStart = new Date(booking.checkInDate);
        const bookingEnd = new Date(booking.checkOutDate);
        const filterStart = filterStartDate ? new Date(filterStartDate) : new Date('1900-01-01');
        const filterEnd = filterEndDate ? new Date(filterEndDate) : new Date('2100-12-31');

        // Check if booking dates overlap with filter dates
        matchesDateRange = bookingStart <= filterEnd && bookingEnd >= filterStart;
      }

      return matchesSearch && matchesRoom && matchesDateRange;
    });

    // Then apply sorting to the filtered results (do not mutate original)
    const sorted = results.slice();
    if (sortBy === 'createdAt') {
      sorted.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime() || 0;
        const tb = new Date(b.createdAt).getTime() || 0;
        return tb - ta; // newest first
      });
    } else if (sortBy === 'updatedAt') {
      sorted.sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt).getTime() || 0;
        const tb = new Date(b.updatedAt || b.createdAt).getTime() || 0;
        return tb - ta; // newest first
      });
    }

    return sorted;
  }, [bookings, searchTerm, filterRoom, filterStartDate, filterEndDate, getBookingRoomsForDisplay, getGuestName, getRoomNumber, sortBy]);

  const summary = calculateBookingSummary();

  return (
    <div className="flex flex-col">
      <LicenseBanner />
      <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bookings</h1>
          <p className="text-muted-foreground mt-1">Manage reservations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              disabled={!license.canCreateBooking && !editingBooking}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBooking ? "Edit Booking" : "Create New Booking"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="guest">Guest *</Label>
                  <Select
                    value={formData.guestId}
                    onValueChange={(value) => setFormData({ ...formData, guestId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.map((guest) => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="room">Room *</Label>
                  <Select
                    value={formData.roomId}
                    onValueChange={handleRoomChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {naturalSort(
                        rooms.filter(r => r.status === 'Available' || r.id === editingBooking?.roomId),
                        r => r.roomNumber
                      ).map((room) => {
                          const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
                          return (
                            <SelectItem key={room.id} value={room.id}>
                              {room.roomNumber} - {roomType?.name} ({formatCurrency(roomType?.basePrice || 0)}/night)
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Multi-room support: manage room lines */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Additional Rooms (Optional)</Label>
                    <Select
                      value=""
                      onValueChange={(roomId) => {
                        if (!roomLines.some(l => l.roomId === roomId)) {
                          const room = rooms.find(r => r.id === roomId);
                          const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
                          const newLine = {
                            tempId: uid(),
                            roomId,
                            checkInDate: formData.checkInDate,
                            checkOutDate: formData.checkOutDate,
                            priceAtBooking: roomType?.basePrice || parseFloat(formData.ratePerNight) || 0,
                          };
                          setRoomLines(prev => [...prev, newLine]);
                        }
                      }}
                    >
                      <SelectTrigger className="w-auto">
                        <SelectValue placeholder="+ Add Room" />
                      </SelectTrigger>
                      <SelectContent>
                        {naturalSort(
                          rooms.filter(r => r.status === 'Available' && r.id !== formData.roomId && !roomLines.some(l => l.roomId === r.id)),
                          r => r.roomNumber
                        ).map((room) => {
                          const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
                          return (
                            <SelectItem key={room.id} value={room.id}>
                              {room.roomNumber} - {roomType?.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {roomLines.length > 0 ? (
                    <div className="space-y-2 bg-muted p-3 rounded-md">
                      {roomLines.map(line => {
                        const selectedRoom = rooms.find(r => r.id === line.roomId);
                        const roomType = roomTypes.find(rt => rt.id === selectedRoom?.roomTypeId);
                        return (
                          <div key={line.tempId} className="flex items-center justify-between bg-background p-2 rounded border gap-2">
                            <div className="flex-1">
                              <div className="text-sm font-medium">{selectedRoom?.roomNumber} - {roomType?.name}</div>
                              <div className="flex gap-2 mt-1">
                                <div>
                                  <div className="text-xs text-muted-foreground">Check-in</div>
                                  <Input type="date" value={line.checkInDate} onChange={(e) => setRoomLines(prev => prev.map(l => l.tempId === line.tempId ? { ...l, checkInDate: e.target.value } : l))} />
                                </div>
                                <div>
                                  <div className="text-xs text-muted-foreground">Check-out</div>
                                  <Input type="date" value={line.checkOutDate} onChange={(e) => setRoomLines(prev => prev.map(l => l.tempId === line.tempId ? { ...l, checkOutDate: e.target.value } : l))} />
                                </div>
                                <div className="ml-2">
                                  <div className="text-xs text-muted-foreground">Rate</div>
                                  <div className="font-semibold">{formatCurrency(line.priceAtBooking)}/night</div>
                                </div>
                              </div>
                            </div>
                            <div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setRoomLines(prev => prev.filter(l => l.tempId !== line.tempId))}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No additional rooms selected. Primary room will be used.</p>
                  )}
                </div>

                {/* Date Range - Only show for overnight bookings */}
                {!formData.isHourly && (
                  <>
                    <div>
                      <Label htmlFor="checkIn">Check-in Date *</Label>
                      <Input
                        id="checkIn"
                        type="date"
                        value={formData.checkInDate}
                        onChange={(e) => {
                          const newCheckInDate = e.target.value;
                          const newCheckOutDate = getDefaultCheckoutDate(newCheckInDate);
                          setFormData({ ...formData, checkInDate: newCheckInDate, checkOutDate: newCheckOutDate });
                          
                          // Update room lines
                          setRoomLines(prev => prev.map(line => ({
                            ...line,
                            checkInDate: newCheckInDate,
                            checkOutDate: newCheckOutDate
                          })));
                        }}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="checkOut">Check-out Date *</Label>
                      <Input
                        id="checkOut"
                        type="date"
                        value={formData.checkOutDate}
                        min={formData.checkInDate}
                        onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="col-span-2 flex items-center gap-3">
                  <input
                    id="isHourly"
                    type="checkbox"
                    checked={formData.isHourly}
                    onChange={(e) => setFormData({ ...formData, isHourly: e.target.checked })}
                  />
                  <Label htmlFor="isHourly">Short stay / Hourly booking</Label>
                </div>

                {/* Short Stay Options - Only show when isHourly is true */}
                {formData.isHourly && (
                  <>
                    <div>
                      <Label htmlFor="startDateTime">Start (local)</Label>
                      <Input
                        id="startDateTime"
                        type="datetime-local"
                        value={formData.startDateTime}
                        onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                      <Input
                        id="durationMinutes"
                        type="number"
                        min="1"
                        step="1"
                        value={formData.durationMinutes}
                        onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                        placeholder="120"
                      />
                      <p className="text-sm text-muted-foreground mt-1">Set duration from 1 minute upward (e.g., 30, 90, 120).</p>
                    </div>
                  </>
                )}

                <div className="col-span-2">
                  <Label htmlFor="rate">Rate per Night *</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.ratePerNight}
                    onChange={(e) => setFormData({ ...formData, ratePerNight: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Discount Type</Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setFormData({ ...formData, discountType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discountValue">
                    Discount Value {formData.discountType === "percentage" && "(%)"} 
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Surcharge Type</Label>
                  <Select
                    value={formData.surchargeType}
                    onValueChange={(value: "percentage" | "fixed") =>
                      setFormData({ ...formData, surchargeType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="surchargeValue">
                    Surcharge Value {formData.surchargeType === "percentage" && "(%)"} 
                  </Label>
                  <Input
                    id="surchargeValue"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.surchargeValue}
                    onChange={(e) => setFormData({ ...formData, surchargeValue: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2">
                  <Label>Payment Status</Label>
                  <Select
                    value={formData.paymentStatus}
                    onValueChange={(value: "Paid" | "Pending") =>
                      setFormData({ ...formData, paymentStatus: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional booking notes..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Summary Card with Room Breakdown */}
              <Card className="bg-muted">
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Room Breakdown Table */}
                  {summary.selectedRooms && summary.selectedRooms.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-background border-b">
                          <tr>
                            <th className="text-left p-2 font-semibold">Room</th>
                            <th className="text-left p-2 font-semibold">Type</th>
                            <th className="text-right p-2 font-semibold">Rate/Night</th>
                            <th className="text-right p-2 font-semibold">Nights</th>
                            <th className="text-right p-2 font-semibold">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.selectedRooms.map((room, idx) => (
                            <tr key={room.roomId} className={idx % 2 === 0 ? 'bg-background/50' : ''}>
                              <td className="p-2 font-medium">{room.roomNumber}</td>
                              <td className="p-2">{room.roomType}</td>
                              <td className="text-right p-2">{formatCurrency(room.price)}</td>
                              <td className="text-right p-2">{daysBetweenIso(room.checkInDate, room.checkOutDate)}</td>
                              <td className="text-right p-2 font-semibold">{formatCurrency(summary.roomSubtotals[idx] || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Total Calculation */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Subtotal ({summary.roomCount} room{summary.roomCount !== 1 ? 's' : ''}):</span>
                      <span className="font-semibold">{formatCurrency(summary.subtotal)}</span>
                    </div>
                    {summary.discountAmt > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Discount {summary.discount && summary.discount.type === 'percentage' ? `(${summary.discount.value}%)` : ''}:</span>
                        <span className="font-semibold">-{formatCurrency(summary.discountAmt)}</span>
                      </div>
                    )}
                    {summary.surchargeAmt > 0 && (
                      <div className="flex justify-between text-warning">
                        <span>Surcharge {summary.surcharge && summary.surcharge.type === 'percentage' ? `(${summary.surcharge.value}%)` : ''}:</span>
                        <span className="font-semibold">+{formatCurrency(summary.surchargeAmt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-3 border-t border-border">
                      <span>Total Amount:</span>
                      <span className="text-primary">{formatCurrency(summary.total)}</span>
                    </div>
                  </div>
                  {editingBooking && (
                    <div className="pt-2 border-t border-border text-sm text-muted-foreground">
                      <div>Created: {formatDateTime(editingBooking.createdAt)}</div>
                      <div>Last updated: {formatDateTime(editingBooking.updatedAt || editingBooking.createdAt)}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBooking ? "Update" : "Create"} Booking
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No bookings found</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Booking
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Search and Filter Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search Input */}
                  <div className="flex-1">
                    <Label htmlFor="search" className="mb-2 block">Search</Label>
                    <Input
                      id="search"
                      placeholder="Search by guest name or room number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {/* Room Filter */}
                  <div className="w-full md:w-48">
                    <Label htmlFor="room-filter" className="mb-2 block">Filter by Room</Label>
                    <Select value={filterRoom} onValueChange={setFilterRoom}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Rooms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Rooms</SelectItem>
                        {naturalSort(rooms, r => r.roomNumber).map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.roomNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Sort By */}
                  <div className="w-full md:w-48">
                    <Label htmlFor="sort-by" className="mb-2 block">Sort by</Label>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'createdAt' | 'updatedAt')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt">Created (newest first)</SelectItem>
                        <SelectItem value="updatedAt">Last updated (newest first)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date" className="mb-2 block">Check-in From</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="mb-2 block">Check-out Until</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(searchTerm || filterRoom !== "all" || filterStartDate || filterEndDate) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterRoom("all");
                      setFilterStartDate("");
                      setFilterEndDate("");
                    }}
                    className="w-full md:w-auto"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredBookings.length} of {bookings.length} bookings
          </div>

          {/* Filtered Bookings List */}
          {filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No bookings match your search criteria</p>
              </CardContent>
            </Card>
          ) : (
            <>
          {filteredBookings.map((booking) => (
            <Card key={booking.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Main Info */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                          <User className="h-4 w-4" />
                          <span>Guest</span>
                        </div>
                        <p className="font-semibold text-foreground">{getGuestName(booking.guestId)}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                          <Calendar className="h-4 w-4" />
                          <span>Dates</span>
                        </div>
                        <p className="font-semibold text-foreground">
                          {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                        </p>
                        <p className="text-sm text-muted-foreground">{booking.nights} night(s)</p>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm mb-1">Total / Paid / Balance</div>
                        <p className="font-bold text-lg text-primary">{formatCurrency(booking.total)}</p>
                        <div className="text-sm">
                          <span className="text-success">Paid: {formatCurrency(bookingPayments[booking.id] || 0)}</span>
                          <span className="mx-1">|</span>
                          <span className="text-warning">Bal: {formatCurrency(booking.total - (bookingPayments[booking.id] || 0))}</span>
                        </div>
                        <Badge
                          className={
                            booking.paymentStatus === "Paid"
                              ? "bg-success text-success-foreground"
                              : "bg-warning text-warning-foreground"
                          }
                        >
                          {booking.paymentStatus}
                        </Badge>
                      </div>
                    </div>

                    {/* Rooms Summary (Collapsed) */}
                    {(() => {
                      const roomsForBooking = bookingRoomsByBookingId.get(booking.id) ?? [];
                      const roomSummary = (() => {
                        const nums = roomsForBooking.map(r => r.roomNumber);
                        if (nums.length === 0) return "—";
                        if (nums.length <= 2) return nums.join(", ");
                        return `${nums.slice(0, 2).join(", ")} (+${nums.length - 2})`;
                      })();

                      return (
                        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DoorOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              <span className="font-semibold">Rooms:</span> {roomSummary}
                            </span>
                          </div>
                          {roomsForBooking.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(booking.id)}
                              className="text-xs"
                            >
                              {expandedBookingIds.has(booking.id) ? "Hide rooms" : "View rooms"}
                            </Button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Rooms Table (Expanded) */}
                    {(() => {
                      const roomsForBooking = bookingRoomsByBookingId.get(booking.id) ?? [];
                      if (!expandedBookingIds.has(booking.id) || roomsForBooking.length === 0) return null;

                      return (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="mb-3">
                            <span className="text-sm font-semibold text-muted-foreground">
                              Rooms in this Booking ({roomsForBooking.length})
                            </span>
                          </div>
                          
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted border-b">
                                <tr>
                                  <th className="text-left p-2 font-semibold">Room</th>
                                  <th className="text-left p-2 font-semibold">Type</th>
                                  <th className="text-right p-2 font-semibold">Rate/Night</th>
                                  <th className="text-left p-2 font-semibold">Check-in</th>
                                  <th className="text-left p-2 font-semibold">Check-out</th>
                                  <th className="text-right p-2 font-semibold">Nights</th>
                                  <th className="text-right p-2 font-semibold">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {roomsForBooking.map((br, idx) => {
                                  const nights = daysBetweenIso(br.checkInDate, br.checkOutDate);
                                  const subtotal = br.priceAtBooking * nights;
                                  return (
                                    <tr key={br.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                                      <td className="p-2 font-medium">{br.roomNumber}</td>
                                      <td className="p-2">{br.roomTypeName}</td>
                                      <td className="text-right p-2">{formatCurrency(br.priceAtBooking)}</td>
                                      <td className="p-2">{formatDate(br.checkInDate)}</td>
                                      <td className="p-2">{formatDate(br.checkOutDate)}</td>
                                      <td className="text-right p-2">{nights}</td>
                                      <td className="text-right p-2 font-semibold">{formatCurrency(subtotal)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPaymentBooking(booking);
                        setShowPaymentForm(true);
                      }}
                      title="Add Payment"
                    >
                      <CreditCard className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        const guest = await getItem<Guest>('guests', booking.guestId);
                        const room = await getItem<Room>('rooms', booking.roomId);
                        const roomType = await getItem<RoomType>('roomTypes', booking.roomTypeId);
                        const bookingRoomsList = await getBookingRoomsByBookingId(booking.id);
                        if (guest) {
                          await printInvoice(booking, guest, room || null, roomType || null, bookingRoomsList.length > 0 ? bookingRoomsList : undefined);
                        } else {
                          toast.error("Failed to load booking details");
                        }
                      }}
                      title="Print Invoice"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(booking)}
                      title="Edit Booking"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(booking.id)}
                      title="Delete Booking"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
            </>
          )}
        </div>
      )}

      <PaymentForm
        open={showPaymentForm}
        onOpenChange={setShowPaymentForm}
        booking={paymentBooking}
        onPaymentAdded={loadData}
      />
    </div>
    </div>
  );
}
