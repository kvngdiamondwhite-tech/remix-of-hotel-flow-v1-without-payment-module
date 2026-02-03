import { NavLink } from "react-router-dom";
import { Home, Bed, DoorOpen, Users, Calendar, Hotel, Settings, CreditCard, AlertCircle, FileText, Briefcase, TrendingDown, BarChart3 } from "lucide-react";

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
    { to: "/business-analysis", icon: BarChart3, label: "Business Analysis" },
    { to: "/expenditures", icon: TrendingDown, label: "Expenditures" },
    { to: "/extras", icon: Briefcase, label: "Extras" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - hidden in print */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border print:hidden">
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Bed className="h-7 w-7 text-sidebar-ring" />
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground leading-tight">DWBS HotelFlow</h1>
              <p className="text-xs text-sidebar-foreground/70">Management System</p>
            </div>
          </div>
        </div>
        
        <nav className="p-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
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
      <main className="flex-1 overflow-auto print:m-0 print:w-full">
        {children}
      </main>
    </div>
  );
}
