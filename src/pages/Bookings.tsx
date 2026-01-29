import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getAllItems, addItem, updateItem, deleteItem, getItem, Booking, Guest, Room, RoomType, hasOverlappingBooking } from "@/lib/db";
import { bookingWindowMs } from '@/lib/dates';
import { getSettings } from '@/lib/settings';
import { uid } from "@/lib/id";
import { nowIso, todayIso, daysBetweenIso, formatDate } from "@/lib/dates";
import { calculateSubtotal, applyDiscount, applySurcharge, calculateTotal, formatCurrency, Discount, Surcharge } from "@/lib/calculations";
import { Plus, Edit, Trash2, Calendar, User, DoorOpen, FileText, CreditCard, AlertCircle } from "lucide-react";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [bookingPayments, setBookingPayments] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    // First, update room statuses based on checkout times
    await updateRoomStatusesBasedOnCheckout();
    
    const [bookingsData, guestsData, roomsData, typesData] = await Promise.all([
      getAllItems<Booking>('bookings'),
      getAllItems<Guest>('guests'),
      getAllItems<Room>('rooms'),
      getAllItems<RoomType>('roomTypes')
    ]);
    setBookings(bookingsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setGuests(guestsData);
    setRooms(roomsData);
    setRoomTypes(typesData);
    
    // Load payment totals for each booking
    const paymentsMap: Record<string, number> = {};
    for (const booking of bookingsData) {
      paymentsMap[booking.id] = await getTotalPaidForBooking(booking.id);
    }
    setBookingPayments(paymentsMap);
  }

  function resetForm() {
    setFormData({
      guestId: "",
      roomId: "",
      checkInDate: todayIso(),
      checkOutDate: todayIso(),
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
  }

  function handleEdit(booking: Booking) {
    setEditingBooking(booking);
    setFormData({
      guestId: booking.guestId,
      roomId: booking.roomId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      ratePerNight: booking.ratePerNight.toString(),
      discountType: booking.discount?.type || "percentage",
      discountValue: booking.discount?.value.toString() || "",
      surchargeType: booking.surcharge?.type || "percentage",
      surchargeValue: booking.surcharge?.value.toString() || "",
      paymentStatus: booking.paymentStatus,
      notes: booking.notes,
      isHourly: booking.stayType === 'hourly',
      startDateTime: booking.startAtMs ? new Date(booking.startAtMs).toISOString().slice(0,16) : '',
      durationMinutes: (booking as any).durationMinutes ? String((booking as any).durationMinutes) : '',
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
        setFormData({
          ...formData,
          roomId,
          ratePerNight: roomType.basePrice.toString(),
        });
      }
    }
  }

  function calculateBookingSummary() {
    const nights = daysBetweenIso(formData.checkInDate, formData.checkOutDate);
    const rate = parseFloat(formData.ratePerNight) || 0;
    const subtotal = calculateSubtotal(rate, nights);

    const discount: Discount | null = formData.discountValue
      ? { type: formData.discountType, value: parseFloat(formData.discountValue) || 0 }
      : null;
    const discountAmt = applyDiscount(subtotal, discount);

    const surcharge: Surcharge | null = formData.surchargeValue
      ? { type: formData.surchargeType, value: parseFloat(formData.surchargeValue) || 0 }
      : null;
    const surchargeAmt = applySurcharge(subtotal, surcharge);

    const total = calculateTotal(subtotal, discountAmt, surchargeAmt);

    return { nights, rate, subtotal, discountAmt, surchargeAmt, total, discount, surcharge };
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

    if (!formData.roomId) {
      toast.error("Please select a room");
      return;
    }

    if (new Date(formData.checkOutDate) < new Date(formData.checkInDate)) {
      toast.error("Check-out date must be after check-in date");
      return;
    }

    const rate = parseFloat(formData.ratePerNight);
    if (isNaN(rate) || rate < 0) {
      toast.error("Valid rate per night is required");
      return;
    }

    // Check for overlapping bookings
    if (formData.isHourly) {
      // Build candidate window
      const settings = getSettings();
      const startAtMs = formData.startDateTime ? new Date(formData.startDateTime).getTime() : Date.now();
      const duration = parseInt(formData.durationMinutes || '', 10) || 120; // minutes
      const endAtMs = startAtMs + Math.round(duration * 60000);

      if (endAtMs <= startAtMs) {
        toast.error('Invalid duration for hourly booking');
        return;
      }

      // Check overlap against existing bookings for the same room
      const allBookings = await getAllItems<Booking>('bookings');
      for (const b of allBookings) {
        if (b.id === editingBooking?.id) continue;
        if (b.roomId !== formData.roomId) continue;
        try {
          const maybe = b as unknown as { startAtMs?: number; endAtMs?: number; stayType?: 'overnight'|'hourly' };
          const bw = bookingWindowMs({ startAtMs: maybe.startAtMs, endAtMs: maybe.endAtMs, checkInDate: b.checkInDate, checkOutDate: b.checkOutDate, stayType: maybe.stayType }, settings);
          if (startAtMs < bw.endAtMs && endAtMs > bw.startAtMs) {
            const roomNum = getRoomNumber(formData.roomId);
            const from = new Date(bw.startAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const to = new Date(bw.endAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            toast.error(`Room ${roomNum} already has a booking from ${from}–${to}.`);
            return;
          }
        } catch (err) {
          // fallback to date-only check
          const bStart = new Date(b.checkInDate).getTime();
          const bEnd = new Date(b.checkOutDate).getTime();
          if (startAtMs < bEnd && endAtMs > bStart) {
            toast.error('This room already has a booking that overlaps the selected time');
            return;
          }
        }
      }
    } else {
      const hasOverlap = await hasOverlappingBooking(
        formData.roomId,
        formData.checkInDate,
        formData.checkOutDate,
        editingBooking?.id
      );

      if (hasOverlap) {
        toast.error("This room is already booked for the selected dates");
        return;
      }
    }

    try {
      const summary = calculateBookingSummary();
      const room = rooms.find(r => r.id === formData.roomId);

      if (editingBooking) {
        const updated: Booking = {
          ...editingBooking,
          guestId: formData.guestId,
          roomId: formData.roomId,
          roomTypeId: room!.roomTypeId,
          checkInDate: formData.checkInDate,
          checkOutDate: formData.checkOutDate,
          nights: summary.nights,
          ratePerNight: summary.rate,
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

        // If hourly, set explicit time fields
        if (formData.isHourly) {
          const startAtMs = formData.startDateTime ? new Date(formData.startDateTime).getTime() : Date.now();
          const duration = parseInt(formData.durationMinutes || '', 10) || 120;
          (updated as any).stayType = 'hourly';
          (updated as any).startAtMs = startAtMs;
          (updated as any).endAtMs = startAtMs + Math.round(duration * 60000);
          (updated as any).durationMinutes = duration;
        } else {
          (updated as any).stayType = 'overnight';
        }
        await updateItem('bookings', updated);
        toast.success("Booking updated successfully");
      } else {
        const newBooking: Booking = {
          id: uid(),
          guestId: formData.guestId,
          roomId: formData.roomId,
          roomTypeId: room!.roomTypeId,
          checkInDate: formData.checkInDate,
          checkOutDate: formData.checkOutDate,
          nights: summary.nights,
          ratePerNight: summary.rate,
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
          (newBooking as any).stayType = 'hourly';
          (newBooking as any).startAtMs = startAtMs;
          (newBooking as any).endAtMs = startAtMs + Math.round(duration * 60000);
          (newBooking as any).durationMinutes = duration;
        } else {
          (newBooking as any).stayType = 'overnight';
        }
        await addItem('bookings', newBooking);
        
        // Update room status to Occupied for new bookings
        const roomToUpdate = room as Room;
        await updateItem('rooms', {
          ...roomToUpdate,
          status: 'Occupied' as const,
        });
        
        toast.success("Booking created successfully");
      }

      // Refresh room statuses to ensure consistency
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

  function getGuestName(guestId: string): string {
    return guests.find(g => g.id === guestId)?.fullName || "Unknown";
  }

  function getRoomNumber(roomId: string): string {
    return rooms.find(r => r.id === roomId)?.roomNumber || "Unknown";
  }

  // Filter and search bookings based on search term, room, and date range
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const guestName = getGuestName(booking.guestId).toLowerCase();
      const roomNumber = getRoomNumber(booking.roomId).toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      // Search filter (guest name or room number)
      const matchesSearch = searchTerm === "" || 
        guestName.includes(searchLower) || 
        roomNumber.includes(searchLower);
      
      // Room filter
      const matchesRoom = filterRoom === "all" || booking.roomId === filterRoom;
      
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
  }, [bookings, searchTerm, filterRoom, filterStartDate, filterEndDate]);

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

                <div>
                  <Label htmlFor="checkIn">Check-in Date *</Label>
                  <Input
                    id="checkIn"
                    type="date"
                    value={formData.checkInDate}
                    onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
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

                <div className="col-span-2 flex items-center gap-3">
                  <input
                    id="isHourly"
                    type="checkbox"
                    checked={formData.isHourly}
                    onChange={(e) => setFormData({ ...formData, isHourly: e.target.checked })}
                  />
                  <Label htmlFor="isHourly">Short stay / Hourly booking</Label>
                </div>

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

              {/* Summary Card */}
              <Card className="bg-muted">
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nights:</span>
                    <span className="font-semibold">{summary.nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate per Night:</span>
                    <span className="font-semibold">{formatCurrency(summary.rate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-semibold">{formatCurrency(summary.subtotal)}</span>
                  </div>
                  {summary.discountAmt > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrency(summary.discountAmt)}</span>
                    </div>
                  )}
                  {summary.surchargeAmt > 0 && (
                    <div className="flex justify-between text-warning">
                      <span>Surcharge:</span>
                      <span className="font-semibold">+{formatCurrency(summary.surchargeAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(summary.total)}</span>
                  </div>
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
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <User className="h-4 w-4" />
                        <span>Guest</span>
                      </div>
                      <p className="font-semibold text-foreground">{getGuestName(booking.guestId)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <DoorOpen className="h-4 w-4" />
                        <span>Room</span>
                      </div>
                      <p className="font-semibold text-foreground">{getRoomNumber(booking.roomId)}</p>
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
                        if (guest && room && roomType) {
                          await printInvoice(booking, guest, room, roomType);
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
