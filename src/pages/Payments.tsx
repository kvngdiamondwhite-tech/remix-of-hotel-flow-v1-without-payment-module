import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { CreditCard, Search, Trash2, Calendar, User, DoorOpen, Filter } from "lucide-react";
import { toast } from "sonner";
import { Payment, getAllPayments, deletePayment, initPaymentsStore } from "@/lib/payments";
import { Booking, Guest, Room, getAllItems, getItem } from "@/lib/db";
import { formatCurrency } from "@/lib/calculations";
import { formatDate, formatDateTime } from "@/lib/dates";
import PaymentForm from "@/components/PaymentForm";

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

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
      
      setPayments(paymentsData.sort((a, b) => 
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      ));
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

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'cash': return 'bg-success/20 text-success border-success/30';
      case 'transfer': return 'bg-primary/20 text-primary border-primary/30';
      case 'pos': return 'bg-warning/20 text-warning border-warning/30';
      default: return 'bg-muted text-muted-foreground';
    }
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
    const matchesFilter = filterMethod === 'all' || payment.paymentMethod === filterMethod;
    return matchesSearch && matchesFilter;
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
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                  <SelectItem value="pos">POS / Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Cash Payments</div>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(payments.filter(p => p.paymentMethod === 'cash').reduce((s, p) => s + p.amount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Transfer Payments</div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(payments.filter(p => p.paymentMethod === 'transfer').reduce((s, p) => s + p.amount, 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">POS/Card Payments</div>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(payments.filter(p => p.paymentMethod === 'pos').reduce((s, p) => s + p.amount, 0))}
            </div>
          </CardContent>
        </Card>
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
                      <p className="font-semibold text-foreground">Room {getRoomNumber(payment.bookingId)}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Calendar className="h-4 w-4" />
                        <span>Date</span>
                      </div>
                      <p className="font-semibold text-foreground">{formatDate(payment.paymentDate)}</p>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm mb-1">Method / Type</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={getMethodBadgeColor(payment.paymentMethod)}>
                          {payment.paymentMethod.toUpperCase()}
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
