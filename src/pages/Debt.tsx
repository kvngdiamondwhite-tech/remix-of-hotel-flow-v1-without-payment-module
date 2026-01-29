import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllItems, Booking, Guest, Room, RoomType } from "@/lib/db";
import { getAllPayments, Payment, getTotalPaidForBooking } from "@/lib/payments";
import { formatCurrency } from "@/lib/calculations";
import { formatDate } from "@/lib/dates";
import { AlertCircle, Search, ArrowUpDown, Eye, User, DoorOpen, Calendar, CreditCard, TrendingDown } from "lucide-react";

interface BookingDebtInfo {
  booking: Booking;
  guest: Guest | undefined;
  room: Room | undefined;
  roomType: RoomType | undefined;
  totalPaid: number;
  outstanding: number;
  payments: Payment[];
}

type SortField = "outstanding" | "total" | "guestName" | "checkInDate";
type SortOrder = "asc" | "desc";
type FilterStatus = "all" | "outstanding" | "paid";

export default function Debt() {
  const [debtData, setDebtData] = useState<BookingDebtInfo[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("outstanding");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("outstanding");
  const [selectedBooking, setSelectedBooking] = useState<BookingDebtInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bookingsData, guestsData, roomsData, typesData, paymentsData] = await Promise.all([
        getAllItems<Booking>('bookings'),
        getAllItems<Guest>('guests'),
        getAllItems<Room>('rooms'),
        getAllItems<RoomType>('roomTypes'),
        getAllPayments()
      ]);

      setGuests(guestsData);
      setRooms(roomsData);
      setRoomTypes(typesData);
      setAllPayments(paymentsData);

      // Calculate debt info for each booking
      const debtInfo: BookingDebtInfo[] = await Promise.all(
        bookingsData.map(async (booking) => {
          const totalPaid = await getTotalPaidForBooking(booking.id);
          const bookingPayments = paymentsData.filter(p => p.bookingId === booking.id);
          
          return {
            booking,
            guest: guestsData.find(g => g.id === booking.guestId),
            room: roomsData.find(r => r.id === booking.roomId),
            roomType: typesData.find(rt => rt.id === booking.roomTypeId),
            totalPaid,
            outstanding: booking.total - totalPaid,
            payments: bookingPayments.sort((a, b) => 
              new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
            )
          };
        })
      );

      setDebtData(debtInfo);
    } catch (error) {
      console.error("Failed to load debt data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter and sort data
  const filteredAndSortedData = debtData
    .filter((item) => {
      // Filter by status
      if (filterStatus === "outstanding" && item.outstanding <= 0) return false;
      if (filterStatus === "paid" && item.outstanding > 0) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const guestName = item.guest?.fullName?.toLowerCase() || "";
        const roomNumber = item.room?.roomNumber?.toLowerCase() || "";
        return guestName.includes(query) || roomNumber.includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "outstanding":
          comparison = a.outstanding - b.outstanding;
          break;
        case "total":
          comparison = a.booking.total - b.booking.total;
          break;
        case "guestName":
          comparison = (a.guest?.fullName || "").localeCompare(b.guest?.fullName || "");
          break;
        case "checkInDate":
          comparison = new Date(a.booking.checkInDate).getTime() - new Date(b.booking.checkInDate).getTime();
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

  // Calculate summary stats
  const totalOutstanding = debtData.reduce((sum, item) => sum + Math.max(0, item.outstanding), 0);
  const totalBookingsWithDebt = debtData.filter(item => item.outstanding > 0).length;
  const totalCollected = debtData.reduce((sum, item) => sum + item.totalPaid, 0);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  function getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      cash: "Cash",
      transfer: "Bank Transfer",
      pos: "POS"
    };
    return labels[method] || method;
  }

  function getPaymentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      deposit: "Deposit",
      full: "Full Payment",
      partial: "Partial Payment"
    };
    return labels[type] || type;
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading debt information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Debt / Outstanding Balance</h1>
        <p className="text-muted-foreground mt-1">Track and monitor outstanding payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">
              From {totalBookingsWithDebt} booking(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <CreditCard className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalCollected)}</div>
            <p className="text-xs text-muted-foreground">
              From {allPayments.length} payment(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalCollected + totalOutstanding > 0 
                ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Of total billed amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by guest name or room number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v: FilterStatus) => setFilterStatus(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bookings</SelectItem>
            <SelectItem value="outstanding">With Outstanding</SelectItem>
            <SelectItem value="paid">Fully Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortField} onValueChange={(v: SortField) => setSortField(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outstanding">Outstanding Amount</SelectItem>
            <SelectItem value="total">Total Amount</SelectItem>
            <SelectItem value="guestName">Guest Name</SelectItem>
            <SelectItem value="checkInDate">Check-in Date</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          title={sortOrder === "asc" ? "Ascending" : "Descending"}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Debt List */}
      {filteredAndSortedData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filterStatus === "outstanding" 
                ? "No outstanding balances found" 
                : "No bookings found matching your criteria"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedData.map((item) => (
            <Card 
              key={item.booking.id} 
              className={`hover:shadow-lg transition-shadow ${
                item.outstanding > 0 ? "border-l-4 border-l-destructive" : ""
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <User className="h-4 w-4" />
                        <span>Guest</span>
                      </div>
                      <p className="font-semibold text-foreground">
                        {item.guest?.fullName || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <DoorOpen className="h-4 w-4" />
                        <span>Room</span>
                      </div>
                      <p className="font-semibold text-foreground">
                        {item.room?.roomNumber || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.roomType?.name}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                        <Calendar className="h-4 w-4" />
                        <span>Dates</span>
                      </div>
                      <p className="font-semibold text-foreground">
                        {formatDate(item.booking.checkInDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        to {formatDate(item.booking.checkOutDate)}
                      </p>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm mb-1">Payment Summary</div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-semibold">{formatCurrency(item.booking.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Paid:</span>
                          <span className="text-success font-semibold">{formatCurrency(item.totalPaid)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-sm mb-1">Outstanding</div>
                      <p className={`font-bold text-xl ${
                        item.outstanding > 0 ? "text-destructive" : "text-success"
                      }`}>
                        {formatCurrency(Math.max(0, item.outstanding))}
                      </p>
                      <Badge
                        className={
                          item.outstanding <= 0
                            ? "bg-success text-success-foreground"
                            : item.totalPaid > 0
                            ? "bg-warning text-warning-foreground"
                            : "bg-destructive text-destructive-foreground"
                        }
                      >
                        {item.outstanding <= 0 ? "Paid" : item.totalPaid > 0 ? "Partial" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBooking(item);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payment Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Breakdown</DialogTitle>
            <DialogDescription>
              Detailed payment history for this booking
            </DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-6">
              {/* Booking Info */}
              <Card className="bg-muted">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Guest</p>
                      <p className="font-semibold">{selectedBooking.guest?.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Room</p>
                      <p className="font-semibold">
                        {selectedBooking.room?.roomNumber} - {selectedBooking.roomType?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Check-in</p>
                      <p className="font-semibold">{formatDate(selectedBooking.booking.checkInDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Check-out</p>
                      <p className="font-semibold">{formatDate(selectedBooking.booking.checkOutDate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{formatCurrency(selectedBooking.booking.total)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="text-xl font-bold text-success">{formatCurrency(selectedBooking.totalPaid)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className={`text-xl font-bold ${
                      selectedBooking.outstanding > 0 ? "text-destructive" : "text-success"
                    }`}>
                      {formatCurrency(Math.max(0, selectedBooking.outstanding))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment History Table */}
              <div>
                <h4 className="font-semibold mb-3">Payment History</h4>
                {selectedBooking.payments.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No payments recorded for this booking
                    </CardContent>
                  </Card>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBooking.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                          <TableCell>{getPaymentMethodLabel(payment.paymentMethod)}</TableCell>
                          <TableCell>{getPaymentTypeLabel(payment.paymentType)}</TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
