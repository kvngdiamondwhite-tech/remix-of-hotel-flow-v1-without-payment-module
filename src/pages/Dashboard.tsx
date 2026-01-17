import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAllItems, Room, Booking, Guest } from "@/lib/db";
import { getAllPayments, Payment } from "@/lib/payments";
import { DollarSign, AlertCircle, DoorOpen, Users, Clock, Shield } from "lucide-react";
import { todayIso, formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/calculations";
import { useSettings } from "@/hooks/useSettings";
import { useLicense } from "@/hooks/useLicense";
import { LicenseBanner, LicenseStatusBadge } from "@/components/LicenseBanner";
import { TRIAL_LIMITS } from "@/lib/license";

interface RecentActivity {
  id: string;
  bookingId: string;
  time: string;
  room: string;
  guest: string;
  amount: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
}

interface RevenueBreakdown {
  cash: number;
  pos: number;
  transfer: number;
  debt: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const license = useLicense();
  const [stats, setStats] = useState({
    todayRevenue: 0,
    outstandingDebt: 0,
    occupiedRooms: 0,
    totalRooms: 0,
    todayLodges: 0,
  });
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueBreakdown>({
    cash: 0,
    pos: 0,
    transfer: 0,
    debt: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    const [rooms, bookings, guests, payments] = await Promise.all([
      getAllItems<Room>('rooms'),
      getAllItems<Booking>('bookings'),
      getAllItems<Guest>('guests'),
      getAllPayments(),
    ]);

    const today = todayIso();

    // Calculate occupancy
    const occupiedRooms = rooms.filter(r => r.status === 'Occupied').length;
    const totalRooms = rooms.length;

    // Today's lodges (bookings checked in today)
    const todayLodges = bookings.filter(b => b.checkInDate === today).length;

    // Today's payments
    const todayPayments = payments.filter(p => p.paymentDate.startsWith(today));
    const todayRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    // Revenue breakdown by payment method
    const breakdown: RevenueBreakdown = { cash: 0, pos: 0, transfer: 0, debt: 0 };
    todayPayments.forEach(p => {
      const method = p.paymentMethod?.toLowerCase() || '';
      if (method.includes('cash')) {
        breakdown.cash += p.amount;
      } else if (method.includes('pos') || method.includes('card')) {
        breakdown.pos += p.amount;
      } else if (method.includes('transfer')) {
        breakdown.transfer += p.amount;
      }
    });

    // Calculate outstanding debt (sum of all unpaid balances)
    let totalDebt = 0;
    const paymentsByBooking: Record<string, number> = {};
    payments.forEach(p => {
      paymentsByBooking[p.bookingId] = (paymentsByBooking[p.bookingId] || 0) + p.amount;
    });
    bookings.forEach(b => {
      const paid = paymentsByBooking[b.id] || 0;
      const balance = b.total - paid;
      if (balance > 0) {
        totalDebt += balance;
      }
    });
    breakdown.debt = totalDebt;

    // Build recent activity from recent bookings and payments
    const guestMap = new Map(guests.map(g => [g.id, g.fullName]));
    const roomMap = new Map(rooms.map(r => [r.id, r.roomNumber]));
    const bookingMap = new Map(bookings.map(b => [b.id, b]));

    // Combine recent bookings with their payment status
    const recentBookings = [...bookings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const activities: RecentActivity[] = recentBookings.map(booking => {
      const paid = paymentsByBooking[booking.id] || 0;
      let status: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
      if (paid >= booking.total) {
        status = 'Paid';
      } else if (paid > 0) {
        status = 'Partial';
      }

      return {
        id: booking.id,
        bookingId: booking.id,
        time: formatDate(booking.createdAt),
        room: roomMap.get(booking.roomId) || 'Unknown',
        guest: guestMap.get(booking.guestId) || 'Unknown',
        amount: booking.total,
        status,
      };
    });

    setStats({
      todayRevenue,
      outstandingDebt: totalDebt,
      occupiedRooms,
      totalRooms,
      todayLodges,
    });
    setRevenueBreakdown(breakdown);
    setRecentActivity(activities);
  }

  const handleRowClick = (bookingId: string) => {
    navigate('/bookings');
  };

  const getStatusBadge = (status: 'Paid' | 'Partial' | 'Unpaid') => {
    switch (status) {
      case 'Paid':
        return <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>;
      case 'Partial':
        return <Badge className="bg-yellow-600 hover:bg-yellow-700">Partial</Badge>;
      case 'Unpaid':
        return <Badge variant="destructive">Unpaid</Badge>;
    }
  };

  // Format revenue breakdown for display
  const breakdownItems = [
    { label: 'Cash', amount: revenueBreakdown.cash, color: 'text-green-600' },
    { label: 'POS', amount: revenueBreakdown.pos, color: 'text-blue-600' },
    { label: 'Transfer', amount: revenueBreakdown.transfer, color: 'text-purple-600' },
  ].filter(item => item.amount > 0);

  const breakdownText = breakdownItems.length > 0 
    ? breakdownItems.map(item => `${item.label}: ${formatCurrency(item.amount)}`).join(' | ')
    : 'No payments yet';

  return (
    <div className="flex flex-col">
      {/* License Banner */}
      <LicenseBanner />
      
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {settings.logo && (
              <img 
                src={settings.logo} 
                alt="Hotel logo" 
                className="h-12 w-12 object-contain rounded-lg"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{settings.hotelName}</h1>
              <p className="text-muted-foreground text-sm">Real-time Status Console</p>
            </div>
          </div>
          <LicenseStatusBadge />
        </div>

      {/* KPI Cards - 4 cards in a row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Today's Revenue */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.todayRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={breakdownText}>
              {breakdownText}
            </p>
          </CardContent>
        </Card>

        {/* Outstanding Debt */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Outstanding Debt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.outstandingDebt)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total unpaid</p>
          </CardContent>
        </Card>

        {/* Occupancy */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DoorOpen className="h-4 w-4" />
              Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.occupiedRooms} / {stats.totalRooms}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalRooms > 0 
                ? `${Math.round((stats.occupiedRooms / stats.totalRooms) * 100)}% occupied`
                : 'No rooms'}
            </p>
          </CardContent>
        </Card>

        {/* Today's Lodges */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Today's Lodges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.todayLodges}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Check-ins today</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Revenue Breakdown (Today)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Cash</span>
              <span className="font-semibold text-green-600">{formatCurrency(revenueBreakdown.cash)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">POS</span>
              <span className="font-semibold text-blue-600">{formatCurrency(revenueBreakdown.pos)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Transfer</span>
              <span className="font-semibold text-purple-600">{formatCurrency(revenueBreakdown.transfer)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Outstanding</span>
              <span className="font-semibold text-red-600">{formatCurrency(revenueBreakdown.debt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No recent activity
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((activity) => (
                  <TableRow 
                    key={activity.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(activity.bookingId)}
                  >
                    <TableCell className="text-sm">{activity.time}</TableCell>
                    <TableCell className="font-medium">{activity.room}</TableCell>
                    <TableCell>{activity.guest}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(activity.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(activity.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
