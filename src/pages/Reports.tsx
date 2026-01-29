import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getAllItems, Booking, Guest, Room, RoomType } from "@/lib/db";
import { getAllPayments, Payment } from "@/lib/payments";
import { formatCurrency } from "@/lib/calculations";
import { formatDate } from "@/lib/dates";
import { FileText, Calendar, DollarSign, TrendingUp, Users, Building, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useSettings } from "@/hooks/useSettings";
import { PaymentMethodConfig, getPaymentMethodColor } from "@/lib/settings";

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
  const [dailyStartDate, setDailyStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dailyEndDate, setDailyEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [monthlyStartDate, setMonthlyStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [monthlyEndDate, setMonthlyEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
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
  const getRoomTypeName = (roomTypeId: string) => data.roomTypes.find((rt) => rt.id === roomTypeId)?.name || "Unknown";
  const getTotalPaidForBooking = (bookingId: string) =>
    data.payments.filter((p) => p.bookingId === bookingId).reduce((sum, p) => sum + p.amount, 0);

  // Get payment status label
  const getPaymentStatus = (total: number, paid: number): "Full" | "Partial" | "Unpaid" => {
    if (paid >= total) return "Full";
    if (paid > 0) return "Partial";
    return "Unpaid";
  };

  // Get primary payment method for a booking's payments on a specific date
  const getPaymentMethodForDate = (bookingId: string, dateStart: Date, dateEnd: Date): string => {
    const payments = data.payments.filter((p) => 
      p.bookingId === bookingId && 
      isWithinInterval(parseISO(p.paymentDate), { start: dateStart, end: dateEnd })
    );
    if (payments.length === 0) return "-";
    // Return comma-separated unique method names (not IDs)
    const methodIds = [...new Set(payments.map(p => p.paymentMethod))];
    return methodIds.map(id => getPaymentMethodName(id)).join(", ");
  };

  // Get amount paid for a booking on a specific date
  const getAmountPaidForDate = (bookingId: string, dateStart: Date, dateEnd: Date): number => {
    return data.payments
      .filter((p) => 
        p.bookingId === bookingId && 
        isWithinInterval(parseISO(p.paymentDate), { start: dateStart, end: dateEnd })
      )
      .reduce((sum, p) => sum + p.amount, 0);
  };

  // Build dynamic payment totals based on all payment methods (including disabled ones)
  // This ensures historical data remains accurate regardless of current settings
  const getPaymentTotalsByMethod = (payments: Payment[]): Record<string, number> => {
    const totals: Record<string, number> = {};
    // Include ALL methods from settings to ensure consistency
    settings.paymentMethods.forEach(pm => {
      totals[pm.id] = 0;
    });
    // Aggregate payments by method ID
    payments.forEach(p => {
      totals[p.paymentMethod] = (totals[p.paymentMethod] || 0) + p.amount;
    });
    return totals;
  };

  // Helper to get payment method name by ID
  const getPaymentMethodName = (methodId: string): string => {
    const method = settings.paymentMethods.find(pm => pm.id === methodId);
    return method ? method.name : methodId;
  };

  // Daily Lodge History Report - now shows ALL bookings active on this date
  function getDailyLodgeHistory() {
    const dateStart = startOfDay(parseISO(dailyStartDate));
    const dateEnd = endOfDay(parseISO(dailyEndDate));

    const dailyPayments = data.payments.filter((p) =>
      isWithinInterval(parseISO(p.paymentDate), { start: dateStart, end: dateEnd })
    );

    // Dynamically calculate totals for each payment method
    const methodTotals = getPaymentTotalsByMethod(dailyPayments);
    
    // Get ALL bookings active on this date range (checked in on or before, checked out on or after)
    const activeBookings = data.bookings.filter((b) => {
      const checkIn = parseISO(b.checkInDate);
      const checkOut = parseISO(b.checkOutDate);
      return dateStart <= checkOut && dateEnd >= checkIn;
    });

    // Enrich bookings with payment info
    const enrichedBookings = activeBookings.map((booking) => {
      const room = data.rooms.find(r => r.id === booking.roomId);
      const totalPaid = getTotalPaidForBooking(booking.id);
      const amountPaidToday = getAmountPaidForDate(booking.id, dateStart, dateEnd);
      const paymentMethodToday = getPaymentMethodForDate(booking.id, dateStart, dateEnd);
      const paymentStatus = getPaymentStatus(booking.total, totalPaid);
      const balance = Math.max(0, booking.total - totalPaid);

      return {
        booking,
        guestName: getGuestName(booking.guestId),
        roomNumber: getRoomNumber(booking.roomId),
        roomTypeName: room ? getRoomTypeName(room.roomTypeId) : "Unknown",
        total: booking.total,
        totalPaid,
        amountPaidToday,
        paymentMethodToday,
        paymentStatus,
        balance,
      };
    });

    // Calculate daily outstanding (debt for active bookings)
    const dailyDebt = enrichedBookings.reduce((sum, b) => sum + b.balance, 0);

    // Sum all method totals for grand total
    const grandTotal = Object.values(methodTotals).reduce((sum, val) => sum + val, 0) + dailyDebt;

    return {
      dailyPayments,
      methodTotals,
      dailyDebt,
      grandTotal,
      activeBookings,
      enrichedBookings,
    };
  }

  // Daily Revenue Report
  function getDailyRevenue() {
    const dateStart = startOfDay(parseISO(dailyStartDate));
    const dateEnd = endOfDay(parseISO(dailyEndDate));

    const dailyPayments = data.payments.filter((p) =>
      isWithinInterval(parseISO(p.paymentDate), { start: dateStart, end: dateEnd })
    );

    const methodTotals = getPaymentTotalsByMethod(dailyPayments);
    const total = Object.values(methodTotals).reduce((sum, val) => sum + val, 0);

    return {
      total,
      methodTotals,
      payments: dailyPayments,
    };
  }

  // Monthly Revenue Summary
  function getMonthlyRevenue() {
    const rangeStart = startOfDay(parseISO(monthlyStartDate));
    const rangeEnd = endOfDay(parseISO(monthlyEndDate));

    const monthlyPayments = data.payments.filter((p) =>
      isWithinInterval(parseISO(p.paymentDate), { start: rangeStart, end: rangeEnd })
    );

    const monthlyBookings = data.bookings.filter((b) =>
      isWithinInterval(parseISO(b.checkInDate), { start: rangeStart, end: rangeEnd })
    );

    const methodTotals = getPaymentTotalsByMethod(monthlyPayments);
    const totalRevenue = Object.values(methodTotals).reduce((sum, val) => sum + val, 0);

    return {
      totalRevenue,
      bookingsCount: monthlyBookings.length,
      paymentsCount: monthlyPayments.length,
      methodTotals,
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

    // For date range reports, check bookings that overlap with the selected period
    // and also count rooms with 'Occupied' status for current occupancy
    const occupiedRoomIds = new Set(
      data.bookings
        .filter((b) => {
          const checkIn = parseISO(b.checkInDate);
          const checkOut = parseISO(b.checkOutDate);
          return startDate <= checkOut && endDate >= checkIn;
        })
        .map((b) => b.roomId)
    );

    // Also include rooms currently marked as 'Occupied' (set by Bookings module)
    data.rooms
      .filter(r => r.status === 'Occupied')
      .forEach(r => occupiedRoomIds.add(r.id));

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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Input type="date" value={dailyStartDate} onChange={(e) => setDailyStartDate(e.target.value)} className="w-auto" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Input type="date" value={dailyEndDate} onChange={(e) => setDailyEndDate(e.target.value)} className="w-auto" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Period: {format(parseISO(dailyStartDate), "PP")} - {format(parseISO(dailyEndDate), "PP")}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Totals - Inline Row Format */}
              <div className="report-totals-container">
                {settings.paymentMethods.map((method) => {
                  const methodColor = getPaymentMethodColor(method.id);
                  return (
                    <div 
                      key={method.id} 
                      className="report-total-row"
                      style={{ borderLeftColor: methodColor }}
                    >
                      <span className="report-total-label" style={{ color: methodColor }}>{method.name}</span>
                      <span className="report-total-amount">{formatCurrency(lodgeHistory.methodTotals[method.id] || 0)}</span>
                    </div>
                  );
                })}
                <div className="report-total-row outstanding">
                  <span className="report-total-label">Outstanding Debt</span>
                  <span className="report-total-amount">{formatCurrency(lodgeHistory.dailyDebt)}</span>
                </div>
                <div className="report-total-row grand-total">
                  <span className="report-total-label">Grand Total</span>
                  <span className="report-total-amount">{formatCurrency(lodgeHistory.grandTotal)}</span>
                </div>
              </div>

              {/* Lodges/Bookings Table - Shows ALL bookings */}
              <div>
                <h3 className="font-semibold mb-3">Lodges ({lodgeHistory.enrichedBookings.length})</h3>
                {lodgeHistory.enrichedBookings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No lodges/bookings for this date.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guest</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Room Type</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount Paid (Today)</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lodgeHistory.enrichedBookings.map((item) => (
                        <TableRow key={item.booking.id}>
                          <TableCell className="font-medium">{item.guestName}</TableCell>
                          <TableCell>{item.roomNumber}</TableCell>
                          <TableCell>{item.roomTypeName}</TableCell>
                          <TableCell className="capitalize">{item.paymentMethodToday}</TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                item.paymentStatus === "Full" 
                                  ? "bg-success text-success-foreground" 
                                  : item.paymentStatus === "Partial" 
                                    ? "bg-warning text-warning-foreground"
                                    : "bg-destructive text-destructive-foreground"
                              }
                            >
                              {item.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amountPaidToday)}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {item.balance > 0 ? formatCurrency(item.balance) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
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
              {/* Revenue Totals - Inline Row Format */}
              <div className="report-totals-container">
                {settings.paymentMethods.map((method) => {
                  const methodColor = getPaymentMethodColor(method.id);
                  return (
                    <div 
                      key={method.id}
                      className="report-total-row"
                      style={{ borderLeftColor: methodColor }}
                    >
                      <span className="report-total-label" style={{ color: methodColor }}>{method.name}</span>
                      <span className="report-total-amount">{formatCurrency(dailyRevenue.methodTotals[method.id] || 0)}</span>
                    </div>
                  );
                })}
                <div className="report-total-row grand-total">
                  <span className="report-total-label">Total Revenue</span>
                  <span className="report-total-amount">{formatCurrency(dailyRevenue.total)}</span>
                </div>
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
                            <TableCell>{getPaymentMethodName(payment.paymentMethod)}</TableCell>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">From:</span>
                  <Input type="date" value={monthlyStartDate} onChange={(e) => setMonthlyStartDate(e.target.value)} className="w-auto" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">To:</span>
                  <Input type="date" value={monthlyEndDate} onChange={(e) => setMonthlyEndDate(e.target.value)} className="w-auto" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Period: {format(parseISO(monthlyStartDate), "PP")} - {format(parseISO(monthlyEndDate), "PP")}
              </p>
            </CardHeader>
            <CardContent>
              {/* Monthly Summary Totals - Inline Row Format */}
              <div className="report-totals-container mb-6">
                {settings.paymentMethods.map((method) => {
                  const methodColor = getPaymentMethodColor(method.id);
                  return (
                    <div 
                      key={method.id}
                      className="report-total-row"
                      style={{ borderLeftColor: methodColor }}
                    >
                      <span className="report-total-label" style={{ color: methodColor }}>{method.name}</span>
                      <span className="report-total-amount">{formatCurrency(monthlyRevenue.methodTotals[method.id] || 0)}</span>
                    </div>
                  );
                })}
                <div className="report-total-row grand-total">
                  <span className="report-total-label">Total Revenue</span>
                  <span className="report-total-amount">{formatCurrency(monthlyRevenue.totalRevenue)}</span>
                </div>
                <div className="report-total-row" style={{ borderColor: 'hsl(var(--border))' }}>
                  <span className="report-total-label">Bookings Count</span>
                  <span className="report-total-amount" style={{ color: 'hsl(var(--foreground))' }}>{monthlyRevenue.bookingsCount}</span>
                </div>
                <div className="report-total-row" style={{ borderColor: 'hsl(var(--border))' }}>
                  <span className="report-total-label">Payments Count</span>
                  <span className="report-total-amount" style={{ color: 'hsl(var(--foreground))' }}>{monthlyRevenue.paymentsCount}</span>
                </div>
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
                  {settings.paymentMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell>{method.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(monthlyRevenue.methodTotals[method.id] || 0)}</TableCell>
                      <TableCell className="text-right">
                        {monthlyRevenue.totalRevenue > 0
                          ? Math.round(((monthlyRevenue.methodTotals[method.id] || 0) / monthlyRevenue.totalRevenue) * 100)
                          : 0}
                        %
                      </TableCell>
                    </TableRow>
                  ))}
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
              {/* Outstanding Debt Summary - Inline Row Format */}
              <div className="report-totals-container mb-6">
                <div className="report-total-row outstanding">
                  <span className="report-total-label">Total Outstanding</span>
                  <span className="report-total-amount">{formatCurrency(outstandingDebt.reduce((sum, item) => sum + item.balance, 0))}</span>
                </div>
                <div className="report-total-row" style={{ borderColor: 'hsl(var(--border))' }}>
                  <span className="report-total-label">Unpaid Bookings</span>
                  <span className="report-total-amount" style={{ color: 'hsl(var(--foreground))' }}>{outstandingDebt.length}</span>
                </div>
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
                        <TableCell>{item.roomNumber}</TableCell>
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
              {/* Occupancy Summary - Inline Row Format */}
              <div className="report-totals-container">
                <div className="report-total-row" style={{ borderColor: 'hsl(var(--border))' }}>
                  <span className="report-total-label">Total Rooms</span>
                  <span className="report-total-amount" style={{ color: 'hsl(var(--foreground))' }}>{occupancy.totalRooms}</span>
                </div>
                <div className="report-total-row outstanding">
                  <span className="report-total-label">Occupied</span>
                  <span className="report-total-amount">{occupancy.occupiedCount}</span>
                </div>
                <div className="report-total-row cash">
                  <span className="report-total-label">Available</span>
                  <span className="report-total-amount">{occupancy.availableCount}</span>
                </div>
                <div className="report-total-row grand-total">
                  <span className="report-total-label">Occupancy Rate</span>
                  <span className="report-total-amount">{occupancy.occupancyRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
