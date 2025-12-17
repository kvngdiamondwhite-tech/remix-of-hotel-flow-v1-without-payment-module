import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllItems, Booking, Guest, Room, RoomType } from "@/lib/db";
import { getAllPayments, Payment } from "@/lib/payments";
import { formatCurrency } from "@/lib/calculations";
import { formatDate } from "@/lib/dates";
import { FileText, Calendar, DollarSign, TrendingUp, Users, Building, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useSettings } from "@/hooks/useSettings";

interface ReportData {
  bookings: Booking[];
  guests: Guest[];
  rooms: Room[];
  roomTypes: RoomType[];
  payments: Payment[];
}

export default function Reports() {
  const { settings } = useSettings();
  const [data, setData] = useState<ReportData>({
    bookings: [],
    guests: [],
    rooms: [],
    roomTypes: [],
    payments: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [occupancyStartDate, setOccupancyStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [occupancyEndDate, setOccupancyEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bookings, guests, rooms, roomTypes, payments] = await Promise.all([
        getAllItems<Booking>("bookings"),
        getAllItems<Guest>("guests"),
        getAllItems<Room>("rooms"),
        getAllItems<RoomType>("roomTypes"),
        getAllPayments(),
      ]);
      setData({ bookings, guests, rooms, roomTypes, payments });
    } catch (error) {
      console.error("Failed to load report data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Helper functions
  const getGuestName = (guestId: string) => data.guests.find((g) => g.id === guestId)?.fullName || "Unknown";
  const getRoomNumber = (roomId: string) => data.rooms.find((r) => r.id === roomId)?.roomNumber || "Unknown";
  const getTotalPaidForBooking = (bookingId: string) =>
    data.payments.filter((p) => p.bookingId === bookingId).reduce((sum, p) => sum + p.amount, 0);

  // Daily Lodge History Report
  function getDailyLodgeHistory() {
    const dateStart = startOfDay(parseISO(selectedDate));
    const dateEnd = endOfDay(parseISO(selectedDate));

    const dailyPayments = data.payments.filter((p) =>
      isWithinInterval(parseISO(p.paymentDate), { start: dateStart, end: dateEnd })
    );

    const posTotal = dailyPayments.filter((p) => p.paymentMethod === "pos").reduce((sum, p) => sum + p.amount, 0);
    const cashTotal = dailyPayments.filter((p) => p.paymentMethod === "cash").reduce((sum, p) => sum + p.amount, 0);
    const transferTotal = dailyPayments.filter((p) => p.paymentMethod === "transfer").reduce((sum, p) => sum + p.amount, 0);

    // Get bookings active on this date
    const activeBookings = data.bookings.filter((b) => {
      const checkIn = parseISO(b.checkInDate);
      const checkOut = parseISO(b.checkOutDate);
      return dateStart <= checkOut && dateEnd >= checkIn;
    });

    // Calculate daily outstanding (debt for active bookings)
    const dailyDebt = activeBookings.reduce((sum, b) => {
      const paid = getTotalPaidForBooking(b.id);
      return sum + Math.max(0, b.total - paid);
    }, 0);

    const grandTotal = posTotal + cashTotal + transferTotal + dailyDebt;

    return {
      dailyPayments,
      posTotal,
      cashTotal,
      transferTotal,
      dailyDebt,
      grandTotal,
      activeBookings,
    };
  }

  // Daily Revenue Report
  function getDailyRevenue() {
    const dateStart = startOfDay(parseISO(selectedDate));
    const dateEnd = endOfDay(parseISO(selectedDate));

    const dailyPayments = data.payments.filter((p) =>
      isWithinInterval(parseISO(p.paymentDate), { start: dateStart, end: dateEnd })
    );

    return {
      total: dailyPayments.reduce((sum, p) => sum + p.amount, 0),
      pos: dailyPayments.filter((p) => p.paymentMethod === "pos").reduce((sum, p) => sum + p.amount, 0),
      cash: dailyPayments.filter((p) => p.paymentMethod === "cash").reduce((sum, p) => sum + p.amount, 0),
      transfer: dailyPayments.filter((p) => p.paymentMethod === "transfer").reduce((sum, p) => sum + p.amount, 0),
      payments: dailyPayments,
    };
  }

  // Monthly Revenue Summary
  function getMonthlyRevenue() {
    const monthStart = startOfMonth(parseISO(selectedMonth + "-01"));
    const monthEnd = endOfMonth(parseISO(selectedMonth + "-01"));

    const monthlyPayments = data.payments.filter((p) =>
      isWithinInterval(parseISO(p.paymentDate), { start: monthStart, end: monthEnd })
    );

    const monthlyBookings = data.bookings.filter((b) =>
      isWithinInterval(parseISO(b.checkInDate), { start: monthStart, end: monthEnd })
    );

    return {
      totalRevenue: monthlyPayments.reduce((sum, p) => sum + p.amount, 0),
      bookingsCount: monthlyBookings.length,
      paymentsCount: monthlyPayments.length,
      pos: monthlyPayments.filter((p) => p.paymentMethod === "pos").reduce((sum, p) => sum + p.amount, 0),
      cash: monthlyPayments.filter((p) => p.paymentMethod === "cash").reduce((sum, p) => sum + p.amount, 0),
      transfer: monthlyPayments.filter((p) => p.paymentMethod === "transfer").reduce((sum, p) => sum + p.amount, 0),
    };
  }

  // Outstanding Debt Report
  function getOutstandingDebt() {
    return data.bookings
      .map((b) => {
        const paid = getTotalPaidForBooking(b.id);
        const balance = b.total - paid;
        return {
          booking: b,
          guestName: getGuestName(b.guestId),
          roomNumber: getRoomNumber(b.roomId),
          total: b.total,
          paid,
          balance,
        };
      })
      .filter((item) => item.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }

  // Occupancy Report
  function getOccupancyReport() {
    const startDate = parseISO(occupancyStartDate);
    const endDate = parseISO(occupancyEndDate);
    const totalRooms = data.rooms.length;

    const occupiedRoomIds = new Set(
      data.bookings
        .filter((b) => {
          const checkIn = parseISO(b.checkInDate);
          const checkOut = parseISO(b.checkOutDate);
          return startDate <= checkOut && endDate >= checkIn;
        })
        .map((b) => b.roomId)
    );

    const occupiedCount = occupiedRoomIds.size;
    const availableCount = totalRooms - occupiedCount;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

    return {
      totalRooms,
      occupiedCount,
      availableCount,
      occupancyRate,
    };
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  const lodgeHistory = getDailyLodgeHistory();
  const dailyRevenue = getDailyRevenue();
  const monthlyRevenue = getMonthlyRevenue();
  const outstandingDebt = getOutstandingDebt();
  const occupancy = getOccupancyReport();

  return (
    <div className="p-8 print:p-4">
      {/* Print Header - only visible when printing */}
      <div className="hidden print:flex print:items-center print:gap-4 print:mb-6 print:pb-4 print:border-b">
        {settings.logo && (
          <img src={settings.logo} alt="Logo" className="h-12 w-12 object-contain" />
        )}
        <div>
          <h1 className="text-xl font-bold">{settings.hotelName}</h1>
          {settings.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
        </div>
      </div>
      
      <div className="mb-8 flex justify-between items-start print:hidden">
        <div className="flex items-center gap-4">
          {settings.logo && (
            <img src={settings.logo} alt="Hotel logo" className="h-12 w-12 object-contain rounded-lg" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">View financial and operational summaries</p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print Report
        </Button>
      </div>

      <Tabs defaultValue="lodge-history" className="space-y-6">
        <TabsList className="print:hidden">
          <TabsTrigger value="lodge-history">
            <FileText className="h-4 w-4 mr-2" />
            Lodge History
          </TabsTrigger>
          <TabsTrigger value="daily-revenue">
            <DollarSign className="h-4 w-4 mr-2" />
            Daily Revenue
          </TabsTrigger>
          <TabsTrigger value="monthly-revenue">
            <TrendingUp className="h-4 w-4 mr-2" />
            Monthly Summary
          </TabsTrigger>
          <TabsTrigger value="outstanding-debt">
            <Users className="h-4 w-4 mr-2" />
            Outstanding Debt
          </TabsTrigger>
          <TabsTrigger value="occupancy">
            <Building className="h-4 w-4 mr-2" />
            Occupancy
          </TabsTrigger>
        </TabsList>

        {/* Daily Lodge History Report */}
        <TabsContent value="lodge-history" className="space-y-6">
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Lodge History Report
              </CardTitle>
              <div className="flex items-center gap-4 print:hidden">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Report for: {format(parseISO(selectedDate), "PPPP")}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Blocks */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-primary/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">POS</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(lodgeHistory.posTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-success/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Cash</p>
                    <p className="text-xl font-bold text-success">{formatCurrency(lodgeHistory.cashTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-warning/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Transfer</p>
                    <p className="text-xl font-bold text-warning">{formatCurrency(lodgeHistory.transferTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-destructive/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-xl font-bold text-destructive">{formatCurrency(lodgeHistory.dailyDebt)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Grand Total</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(lodgeHistory.grandTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Payments Table */}
              <div>
                <h3 className="font-semibold mb-3">Payment Transactions</h3>
                {lodgeHistory.dailyPayments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No payments recorded for this date.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lodgeHistory.dailyPayments.map((payment) => {
                        const booking = data.bookings.find((b) => b.id === payment.bookingId);
                        return (
                          <TableRow key={payment.id}>
                            <TableCell>{booking ? getGuestName(booking.guestId) : "Unknown"}</TableCell>
                            <TableCell>{booking ? getRoomNumber(booking.roomId) : "Unknown"}</TableCell>
                            <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                            <TableCell className="capitalize">{payment.paymentType}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Revenue Report */}
        <TabsContent value="daily-revenue" className="space-y-6">
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Daily Revenue Report
              </CardTitle>
              <div className="flex items-center gap-4 print:hidden">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Report for: {format(parseISO(selectedDate), "PPPP")}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-primary/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(dailyRevenue.total)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">POS</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyRevenue.pos)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Cash</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyRevenue.cash)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Transfer</p>
                    <p className="text-xl font-bold">{formatCurrency(dailyRevenue.transfer)}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Transactions ({dailyRevenue.payments.length})</h3>
                {dailyRevenue.payments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No payments for this date.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyRevenue.payments.map((payment) => {
                        const booking = data.bookings.find((b) => b.id === payment.bookingId);
                        return (
                          <TableRow key={payment.id}>
                            <TableCell>{format(parseISO(payment.paymentDate), "HH:mm")}</TableCell>
                            <TableCell>{booking ? getGuestName(booking.guestId) : "Unknown"}</TableCell>
                            <TableCell className="capitalize">{payment.paymentMethod}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Revenue Summary */}
        <TabsContent value="monthly-revenue" className="space-y-6">
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Revenue Summary
              </CardTitle>
              <div className="flex items-center gap-4 print:hidden">
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Report for: {format(parseISO(selectedMonth + "-01"), "MMMM yyyy")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-primary/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(monthlyRevenue.totalRevenue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Bookings</p>
                    <p className="text-2xl font-bold">{monthlyRevenue.bookingsCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Payments</p>
                    <p className="text-2xl font-bold">{monthlyRevenue.paymentsCount}</p>
                  </CardContent>
                </Card>
              </div>

              <h3 className="font-semibold mb-3">Breakdown by Payment Method</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>POS</TableCell>
                    <TableCell className="text-right">{formatCurrency(monthlyRevenue.pos)}</TableCell>
                    <TableCell className="text-right">
                      {monthlyRevenue.totalRevenue > 0
                        ? Math.round((monthlyRevenue.pos / monthlyRevenue.totalRevenue) * 100)
                        : 0}
                      %
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cash</TableCell>
                    <TableCell className="text-right">{formatCurrency(monthlyRevenue.cash)}</TableCell>
                    <TableCell className="text-right">
                      {monthlyRevenue.totalRevenue > 0
                        ? Math.round((monthlyRevenue.cash / monthlyRevenue.totalRevenue) * 100)
                        : 0}
                      %
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Transfer</TableCell>
                    <TableCell className="text-right">{formatCurrency(monthlyRevenue.transfer)}</TableCell>
                    <TableCell className="text-right">
                      {monthlyRevenue.totalRevenue > 0
                        ? Math.round((monthlyRevenue.transfer / monthlyRevenue.totalRevenue) * 100)
                        : 0}
                      %
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(monthlyRevenue.totalRevenue)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding Debt Report */}
        <TabsContent value="outstanding-debt" className="space-y-6">
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Outstanding Debt Report
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Bookings with unpaid balances ({outstandingDebt.length} records)
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-destructive/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Outstanding</p>
                    <p className="text-2xl font-bold text-destructive">
                      {formatCurrency(outstandingDebt.reduce((sum, item) => sum + item.balance, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Unpaid Bookings</p>
                    <p className="text-2xl font-bold">{outstandingDebt.length}</p>
                  </CardContent>
                </Card>
              </div>

              {outstandingDebt.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No outstanding debts.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstandingDebt.map((item) => (
                      <TableRow key={item.booking.id}>
                        <TableCell className="font-medium">{item.guestName}</TableCell>
                        <TableCell>Room {item.roomNumber}</TableCell>
                        <TableCell>{formatDate(item.booking.checkInDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                        <TableCell className="text-right text-success">{formatCurrency(item.paid)}</TableCell>
                        <TableCell className="text-right text-destructive font-bold">
                          {formatCurrency(item.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Occupancy Report */}
        <TabsContent value="occupancy" className="space-y-6">
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Occupancy Report
              </CardTitle>
              <div className="flex items-center gap-4 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Input
                    type="date"
                    value={occupancyStartDate}
                    onChange={(e) => setOccupancyStartDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Input
                    type="date"
                    value={occupancyEndDate}
                    onChange={(e) => setOccupancyEndDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Period: {format(parseISO(occupancyStartDate), "PP")} - {format(parseISO(occupancyEndDate), "PP")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Rooms</p>
                    <p className="text-2xl font-bold">{occupancy.totalRooms}</p>
                  </CardContent>
                </Card>
                <Card className="bg-destructive/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Occupied</p>
                    <p className="text-2xl font-bold text-destructive">{occupancy.occupiedCount}</p>
                  </CardContent>
                </Card>
                <Card className="bg-success/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold text-success">{occupancy.availableCount}</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/10">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                    <p className="text-2xl font-bold text-primary">{occupancy.occupancyRate}%</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
