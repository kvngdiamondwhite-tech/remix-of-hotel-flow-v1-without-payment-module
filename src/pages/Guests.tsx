import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getAllItems, addItem, updateItem, deleteItem, Guest } from "@/lib/db";
import { getAllPayments } from '@/lib/payments';
import { useNavigate } from 'react-router-dom';
import { uid } from "@/lib/id";
import { nowIso } from "@/lib/dates";
import { Plus, Edit, Trash2, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { formatCurrency } from '@/lib/calculations';
import { toast } from "sonner";

export default function Guests() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [historyGuest, setHistoryGuest] = useState<Guest | null>(null);
  const [historyBookings, setHistoryBookings] = useState<any[]>([]);
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    idType: "",
    idNumber: "",
    notes: "",
  });

  useEffect(() => {
    loadGuests();
  }, []);

  async function loadGuests() {
    const data = await getAllItems<Guest>('guests');
    setGuests(data.sort((a, b) => a.fullName.localeCompare(b.fullName)));
  }

  function resetForm() {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      address: "",
      idType: "",
      idNumber: "",
      notes: "",
    });
    setEditingGuest(null);
  }

  function handleEdit(guest: Guest) {
    setEditingGuest(guest);
    setFormData({
      fullName: guest.fullName,
      email: guest.email,
      phone: guest.phone,
      address: guest.address,
      idType: guest.idType,
      idNumber: guest.idNumber,
      notes: guest.notes,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      toast.error("Guest name is required");
      return;
    }

    try {
      if (editingGuest) {
        const updated: Guest = {
          ...editingGuest,
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          idType: formData.idType.trim(),
          idNumber: formData.idNumber.trim(),
          notes: formData.notes.trim(),
          updatedAt: nowIso(),
        };
        await updateItem('guests', updated);
        toast.success("Guest updated successfully");
      } else {
        const newGuest: Guest = {
          id: uid(),
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          idType: formData.idType.trim(),
          idNumber: formData.idNumber.trim(),
          notes: formData.notes.trim(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        await addItem('guests', newGuest);
        toast.success("Guest added successfully");
      }

      await loadGuests();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save guest");
      console.error(error);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete guest "${name}"?`)) return;

    try {
      await deleteItem('guests', id);
      toast.success("Guest deleted successfully");
      await loadGuests();
    } catch (error) {
      toast.error("Failed to delete guest");
      console.error(error);
    }
  }

  const filteredGuests = guests.filter(guest =>
    guest.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guest.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guest.phone.includes(searchTerm)
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Guests</h1>
          <p className="text-muted-foreground mt-1">Manage guest information</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Guest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingGuest ? "Edit Guest" : "Add New Guest"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St, City, Country"
                  />
                </div>
                <div>
                  <Label htmlFor="idType">ID Type</Label>
                  <Input
                    id="idType"
                    value={formData.idType}
                    onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                    placeholder="Passport, Driver's License, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="idNumber">ID Number</Label>
                  <Input
                    id="idNumber"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    placeholder="ABC123456"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional information about the guest..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingGuest ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <Input
          placeholder="Search guests by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {guests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No guests found</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Guest
            </Button>
          </CardContent>
        </Card>
      ) : filteredGuests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No guests match your search</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuests.map((guest) => (
            <Card key={guest.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-foreground">{guest.fullName}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(guest)}
                      title="Edit guest"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(guest.id, guest.fullName)}
                      title="Delete guest"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        // Quick create booking: navigate to Bookings page with guest prefilled
                        navigate(`/bookings?guestId=${guest.id}`);
                      }}
                      title="Create booking for guest"
                    >
                      <Plus className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        // Open history modal for this guest; fetch bookings, payments and rooms
                        setHistoryGuest(guest);
                        try {
                          const [allBookings, allPayments, allRooms] = await Promise.all([
                            getAllItems('bookings'),
                            getAllPayments(),
                            getAllItems('rooms'),
                          ]);

                          const guestBookings = (allBookings as any[])
                            .filter(b => b.guestId === guest.id)
                            .sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                          // Build map of roomId -> readable room label (prefer roomNumber)
                          const roomsMap: Record<string, string> = {};
                          (allRooms as any[]).forEach(r => {
                            roomsMap[r.id] = r.roomNumber || r.name || r.id;
                          });

                          // Enrich bookings with a stable roomLabel for display
                          const enrichedBookings = guestBookings.map(b => ({
                            ...b,
                            roomLabel: roomsMap[b.roomId] || b.roomId,
                          }));

                          const guestPayments = (allPayments as any[]).filter(p => p.guestId === guest.id || (p.bookingId && enrichedBookings.find(bb=>bb.id===p.bookingId)));

                          setHistoryBookings(enrichedBookings);
                          setHistoryPayments(guestPayments);
                        } catch (err) {
                          console.error('Failed to load guest history', err);
                          setHistoryBookings([]);
                          setHistoryPayments([]);
                        }
                      }}
                      title="View guest history"
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {guest.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{guest.email}</span>
                    </div>
                  )}
                  {guest.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{guest.phone}</span>
                    </div>
                  )}
                  {guest.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{guest.address}</span>
                    </div>
                  )}
                  {guest.idType && guest.idNumber && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-muted-foreground">
                        {guest.idType}: {guest.idNumber}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Guest History Dialog */}
      <Dialog open={!!historyGuest} onOpenChange={(open) => { if (!open) setHistoryGuest(null); }}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader>
            <DialogTitle>{historyGuest ? `${historyGuest.fullName} — History` : 'History'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4 max-h-[80vh] overflow-y-auto">
            <h4 className="font-semibold">Bookings ({historyBookings.length})</h4>
            {historyBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings found for this guest.</p>
            ) : (
              <div className="space-y-2">
                {historyBookings.map((b) => (
                  <div key={b.id} className="p-3 border rounded">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-semibold">Room: {b.roomLabel || b.roomId}</div>
                        <div className="text-sm text-muted-foreground">{b.checkInDate} → {b.checkOutDate}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(b.total || 0)}</div>
                        <div className="text-sm text-muted-foreground">Status: {b.paymentStatus}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 className="font-semibold">Payments ({historyPayments.length})</h4>
            {historyPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments found for this guest.</p>
            ) : (
              <div className="space-y-2">
                {historyPayments.map(p => (
                  <div key={p.id} className="p-2 border rounded flex justify-between">
                    <div>
                      <div className="font-medium">{p.paymentMethod}</div>
                      <div className="text-sm text-muted-foreground">{new Date(p.paymentDate).toLocaleString()}</div>
                    </div>
                    <div className="font-semibold">{formatCurrency(p.amount || 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
