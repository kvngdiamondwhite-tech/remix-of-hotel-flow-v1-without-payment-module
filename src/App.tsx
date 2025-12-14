import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import RoomTypes from "./pages/RoomTypes";
import Rooms from "./pages/Rooms";
import Guests from "./pages/Guests";
import Bookings from "./pages/Bookings";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { initDB } from "./lib/db";
import { initPaymentsStore } from "./lib/payments";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    initDB()
      .then(() => initPaymentsStore())
      .catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/room-types" element={<RoomTypes />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/guests" element={<Guests />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
