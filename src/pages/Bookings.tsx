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
import { uid } from "@/lib/id";
import { nowIso, todayIso, daysBetweenIso, formatDate } from "@/lib/dates";
import { calculateSubtotal, applyDiscount, applySurcharge, calculateTotal, formatCurrency, Discount, Surcharge } from "@/lib/calculations";
import { Plus, Edit, Trash2, Calendar, User, DoorOpen, FileText, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { printReceipt } from "@/lib/receipt";
import { getTotalPaidForBooking } from "@/lib/payments";
import PaymentForm from "@/components/PaymentForm";
import { naturalSort } from "@/lib/naturalSort";
import { useLicense } from "@/hooks/useLicense";
import { LicenseBanner } from "@/components/LicenseBanner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TRIAL_LIMITS } from "@/lib/license";

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
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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
    });
    setIsDialogOpen(true);
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
        };
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
        };
        await addItem('bookings', newBooking);
        toast.success("Booking created successfully");
      }

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
          {bookings.map((booking) => (
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
                      <p className="font-semibold text-foreground">Room {getRoomNumber(booking.roomId)}</p>
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
                          printReceipt(booking, guest, room, roomType);
                        } else {
                          toast.error("Failed to load booking details");
                        }
                      }}
                      title="Print Receipt"
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
