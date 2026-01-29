import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { CreditCard, Search, Trash2, Calendar, User, DoorOpen, Filter, FileText } from "lucide-react";
import { toast } from "sonner";
import { Payment, getAllPayments, deletePayment, initPaymentsStore } from "@/lib/payments";
import { Booking, Guest, Room, getAllItems, getItem } from "@/lib/db";
import { formatCurrency } from "@/lib/calculations";
import { formatDate, formatDateTime } from "@/lib/dates";
import PaymentForm from "@/components/PaymentForm";
import { useSettings } from "@/hooks/useSettings";
import { getPaymentMethodColor } from "@/lib/settings";
import { printPaymentReceipt } from "@/lib/receipt";
import { getTotalPaidForBooking } from "@/lib/payments";

export default function Payments() {
  const { settings } = useSettings();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  // Helper to get payment method name by ID
  const getPaymentMethodName = (methodId: string): string => {
    const method = settings.paymentMethods.find(pm => pm.id === methodId);
    return method ? method.name : methodId;
  };

  // Helper to get dynamic payment method totals
  const getPaymentMethodTotals = (): Record<string, number> => {
    const totals: Record<string, number> = {};
    settings.paymentMethods.forEach(pm => {
      totals[pm.id] = payments.filter(p => p.paymentMethod === pm.id).reduce((s, p) => s + p.amount, 0);
    });
    return totals;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await initPaymentsStore();
      const [paymentsData, bookingsData, guestsData, roomsData] = await Promise.all([
        getAllPayments(),
        getAllItems<Booking>('bookings'),
        getAllItems<Guest>('guests'),
        getAllItems<Room>('rooms'),
      ]);
      
      // Sort by payment date and time in chronological order (newest first)
      setPayments(paymentsData.sort((a, b) => {
        const dateCompare = new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        // If dates are same, sort by time (fallback to '00:00' if missing)
        const timeA = a.paymentTime || '00:00';
        const timeB = b.paymentTime || '00:00';
        return timeB.localeCompare(timeA);
      }));
      setBookings(bookingsData);
      setGuests(guestsData);
      setRooms(roomsData);
    } catch (error) {
      toast.error("Failed to load payments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getGuestName = (bookingId: string): string => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return 'Unknown';
    const guest = guests.find(g => g.id === booking.guestId);
    return guest?.fullName || 'Unknown Guest';
  };

  const getRoomNumber = (bookingId: string): string => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return 'Unknown';
    const room = rooms.find(r => r.id === booking.roomId);
    return room?.roomNumber || 'Unknown';
  };

  const getBookingTotal = (bookingId: string): number => {
    const booking = bookings.find(b => b.id === bookingId);
    return booking?.total || 0;
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePayment(id);
      toast.success("Payment deleted");
      loadData();
    } catch (error) {
      toast.error("Failed to delete payment");
      console.error(error);
    }
  };

  const getMethodBadgeColor = (methodId: string) => {
    // Get the method's defined color and create badge styling
    const color = getPaymentMethodColor(methodId);
    // Apply the color as border and semi-transparent background for badge
    return {
      borderColor: color,
      backgroundColor: `${color}20`, // 20% opacity
      color: color,
    };
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'full': return 'bg-success text-success-foreground';
      case 'partial': return 'bg-warning text-warning-foreground';
      case 'deposit': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredPayments = payments.filter(payment => {
    const guestName = getGuestName(payment.bookingId).toLowerCase();
    const roomNumber = getRoomNumber(payment.bookingId).toLowerCase();
    const matchesSearch = guestName.includes(searchTerm.toLowerCase()) || 
                          roomNumber.includes(searchTerm.toLowerCase());
    const matchesMethod = filterMethod === 'all' || payment.paymentMethod === filterMethod;
    
    // Date range filtering
    let matchesDateRange = true;
    if (filterStartDate) {
      matchesDateRange = matchesDateRange && payment.paymentDate >= filterStartDate;
    }
    if (filterEndDate) {
      matchesDateRange = matchesDateRange && payment.paymentDate <= filterEndDate;
    }
    
    return matchesSearch && matchesMethod && matchesDateRange;
  });

  const totalPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground mt-1">Track and manage all payment records</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Collected</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalPayments)}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest name or room number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterMethod} onValueChange={setFilterMethod}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Payment Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {settings.paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment-start-date" className="mb-2 block text-sm">Payment From</Label>
                <Input
                  id="payment-start-date"
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="payment-end-date" className="mb-2 block text-sm">Payment Until</Label>
                <Input
                  id="payment-end-date"
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            {(searchTerm || filterMethod !== "all" || filterStartDate || filterEndDate) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setFilterMethod("all");
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Payments</div>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        {settings.paymentMethods.map((method) => {
          const methodTotal = getPaymentMethodTotals()[method.id] || 0;
          return (
            <Card key={method.id}>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{method.name} Payments</div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(methodTotal)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No payments found</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterMethod !== 'all' 
                  ? "Try adjusting your search or filters" 
                  : "Payments will appear here when recorded from bookings"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <Card key={payment.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <User className="h-4 w-4" />
                        <span>Guest</span>
                      </div>
                      <p className="font-semibold text-foreground">{getGuestName(payment.bookingId)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <DoorOpen className="h-4 w-4" />
                        <span>Room</span>
                      </div>
                      <p className="font-semibold text-foreground">{getRoomNumber(payment.bookingId)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Calendar className="h-4 w-4" />
                        <span>Date & Time</span>
                      </div>
                      <p className="font-semibold text-foreground">{formatDate(payment.paymentDate)}</p>
                      <p className="text-sm text-muted-foreground">{payment.paymentTime || '00:00'}</p>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm mb-1">Method / Type</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge 
                          variant="outline"
                          style={getMethodBadgeColor(payment.paymentMethod)}
                        >
                          {getPaymentMethodName(payment.paymentMethod)}
                        </Badge>
                        <Badge className={getTypeBadgeColor(payment.paymentType)}>
                          {payment.paymentType}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm mb-1">Amount</div>
                      <p className="font-bold text-xl text-primary">{formatCurrency(payment.amount)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        try {
                          const booking = bookings.find(b => b.id === payment.bookingId);
                          const guest = guests.find(g => g.id === booking?.guestId);
                          const room = rooms.find(r => r.id === booking?.roomId);
                          const methodName = getPaymentMethodName(payment.paymentMethod);
                          const totalPaid = await getTotalPaidForBooking(payment.bookingId);
                          
                          if (booking && guest && room) {
                            printPaymentReceipt(payment, booking, guest, room, methodName, totalPaid);
                          } else {
                            toast.error("Failed to load payment details");
                          }
                        } catch (error) {
                          toast.error("Failed to generate receipt");
                          console.error(error);
                        }
                      }}
                      title="Generate Receipt"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Delete Payment">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this payment record. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(payment.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {payment.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">{payment.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaymentForm
        open={showPaymentForm}
        onOpenChange={setShowPaymentForm}
        booking={selectedBooking}
        onPaymentAdded={loadData}
      />
    </div>
  );
}
