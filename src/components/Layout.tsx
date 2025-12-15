import { NavLink } from "react-router-dom";
import { Home, Bed, DoorOpen, Users, Calendar, Hotel, Settings, CreditCard, AlertCircle, FileText } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navItems = [
    { to: "/", icon: Home, label: "Dashboard" },
    { to: "/room-types", icon: Hotel, label: "Room Types" },
    { to: "/rooms", icon: DoorOpen, label: "Rooms" },
    { to: "/guests", icon: Users, label: "Guests" },
    { to: "/bookings", icon: Calendar, label: "Bookings" },
    { to: "/payments", icon: CreditCard, label: "Payments" },
    { to: "/debt", icon: AlertCircle, label: "Outstanding" },
    { to: "/reports", icon: FileText, label: "Reports" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <Bed className="h-8 w-8 text-sidebar-ring" />
            <div>
              <h1 className="text-xl font-bold text-sidebar-foreground">HotelFlow</h1>
              <p className="text-xs text-sidebar-foreground/70">Management System</p>
            </div>
          </div>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
