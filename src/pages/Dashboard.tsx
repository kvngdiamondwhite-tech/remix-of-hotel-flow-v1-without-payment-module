import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllItems, Room, Booking } from "@/lib/db";
import { DoorOpen, Calendar, CheckCircle, Clock } from "lucide-react";
import { todayIso } from "@/lib/dates";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    activeBookings: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const rooms = await getAllItems<Room>('rooms');
    const bookings = await getAllItems<Booking>('bookings');
    const today = todayIso();

    const availableRooms = rooms.filter(r => r.status === 'Available').length;
    const activeBookings = bookings.filter(b => {
      const checkIn = b.checkInDate;
      const checkOut = b.checkOutDate;
      return checkIn <= today && checkOut >= today;
    }).length;
    
    const todayCheckIns = bookings.filter(b => b.checkInDate === today).length;
    const todayCheckOuts = bookings.filter(b => b.checkOutDate === today).length;

    setStats({
      totalRooms: rooms.length,
      availableRooms,
      activeBookings,
      todayCheckIns,
      todayCheckOuts,
    });
  }

  const cards = [
    {
      title: "Total Rooms",
      value: stats.totalRooms,
      icon: DoorOpen,
      color: "text-primary",
    },
    {
      title: "Available Rooms",
      value: stats.availableRooms,
      icon: CheckCircle,
      color: "text-success",
    },
    {
      title: "Active Bookings",
      value: stats.activeBookings,
      icon: Calendar,
      color: "text-accent",
    },
    {
      title: "Today's Check-ins",
      value: stats.todayCheckIns,
      icon: Clock,
      color: "text-warning",
    },
    {
      title: "Today's Check-outs",
      value: stats.todayCheckOuts,
      icon: Clock,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to HotelFlow Management System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {cards.map((card, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Occupancy Rate</span>
                <span className="font-semibold text-foreground">
                  {stats.totalRooms > 0
                    ? Math.round(((stats.totalRooms - stats.availableRooms) / stats.totalRooms) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Rooms Available</span>
                <span className="font-semibold text-success">{stats.availableRooms}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Rooms Occupied</span>
                <span className="font-semibold text-accent">
                  {stats.totalRooms - stats.availableRooms}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expected Check-ins</span>
                <span className="font-semibold text-warning">{stats.todayCheckIns}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expected Check-outs</span>
                <span className="font-semibold text-muted-foreground">{stats.todayCheckOuts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Guests</span>
                <span className="font-semibold text-primary">{stats.activeBookings}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
