import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getAllItems, addItem, updateItem, deleteItem, Room, RoomType } from "@/lib/db";
import { uid } from "@/lib/id";
import { nowIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/calculations";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { naturalSort } from "@/lib/naturalSort";

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRoomTypeId, setFilterRoomTypeId] = useState<string>("all");
  const [formData, setFormData] = useState({
    roomNumber: "",
    roomTypeId: "",
    status: "Available" as Room['status'],
  });

  // Filtered and sorted rooms
  const filteredRooms = useMemo(() => {
    let result = rooms;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(room => 
        room.roomNumber.toLowerCase().includes(query)
      );
    }
    
    // Filter by room type
    if (filterRoomTypeId && filterRoomTypeId !== "all") {
      result = result.filter(room => room.roomTypeId === filterRoomTypeId);
    }
    
    // Natural sort
    return naturalSort(result, r => r.roomNumber);
  }, [rooms, searchQuery, filterRoomTypeId]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [roomsData, typesData] = await Promise.all([
      getAllItems<Room>('rooms'),
      getAllItems<RoomType>('roomTypes')
    ]);
    setRooms(roomsData);
    setRoomTypes(typesData);
  }

  function resetForm() {
    setFormData({
      roomNumber: "",
      roomTypeId: "",
      status: "Available",
    });
    setEditingRoom(null);
  }

  function handleEdit(room: Room) {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      status: room.status,
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.roomNumber.trim()) {
      toast.error("Room number is required");
      return;
    }

    if (!formData.roomTypeId) {
      toast.error("Please select a room type");
      return;
    }

    try {
      if (editingRoom) {
        const updated: Room = {
          ...editingRoom,
          roomNumber: formData.roomNumber.trim(),
          roomTypeId: formData.roomTypeId,
          status: formData.status,
          updatedAt: nowIso(),
        };
        await updateItem('rooms', updated);
        toast.success("Room updated successfully");
      } else {
        // Check for duplicate room number
        const exists = rooms.some(
          r => r.roomNumber.toLowerCase() === formData.roomNumber.trim().toLowerCase()
        );
        if (exists) {
          toast.error("A room with this number already exists");
          return;
        }

        const newRoom: Room = {
          id: uid(),
          roomNumber: formData.roomNumber.trim(),
          roomTypeId: formData.roomTypeId,
          status: formData.status,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        await addItem('rooms', newRoom);
        toast.success("Room created successfully");
      }

      await loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save room");
      console.error(error);
    }
  }

  async function handleDelete(id: string, roomNumber: string) {
    if (!confirm(`Are you sure you want to delete room "${roomNumber}"?`)) return;

    try {
      await deleteItem('rooms', id);
      toast.success("Room deleted successfully");
      await loadData();
    } catch (error) {
      toast.error("Failed to delete room");
      console.error(error);
    }
  }

  function getRoomTypeName(roomTypeId: string): string {
    return roomTypes.find(rt => rt.id === roomTypeId)?.name || "Unknown";
  }

  function getRoomPrice(roomTypeId: string): number {
    return roomTypes.find(rt => rt.id === roomTypeId)?.basePrice || 0;
  }

  function getStatusColor(status: Room['status']) {
    switch (status) {
      case 'Available':
        return 'bg-success text-success-foreground';
      case 'Occupied':
        return 'bg-destructive text-destructive-foreground';
      case 'Cleaning':
        return 'bg-warning text-warning-foreground';
      case 'Out of Service':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rooms</h1>
          <p className="text-muted-foreground mt-1">Manage hotel rooms</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? "Edit Room" : "Add New Room"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="roomNumber">Room Number *</Label>
                <Input
                  id="roomNumber"
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                  placeholder="e.g., 101"
                  required
                />
              </div>
              <div>
                <Label htmlFor="roomType">Room Type *</Label>
                <Select
                  value={formData.roomTypeId}
                  onValueChange={(value) => setFormData({ ...formData, roomTypeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Room['status']) => setFormData({ ...formData, status: value })}
                  disabled={editingRoom?.status === 'Occupied'}
                >
                  <SelectTrigger className={editingRoom?.status === 'Occupied' ? 'opacity-60 cursor-not-allowed' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Cleaning">Cleaning</SelectItem>
                    <SelectItem value="Out of Service">Out of Service</SelectItem>
                  </SelectContent>
                </Select>
                {editingRoom?.status === 'Occupied' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ℹ️ Occupied rooms have automatic status updates. Room will return to Available after checkout time.
                  </p>
                )}
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
                  {editingRoom ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      {roomTypes.length > 0 && rooms.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterRoomTypeId} onValueChange={setFilterRoomTypeId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {roomTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {roomTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Please create room types first</p>
            <Button onClick={() => window.location.href = "/room-types"}>
              Go to Room Types
            </Button>
          </CardContent>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No rooms found</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Room
            </Button>
          </CardContent>
        </Card>
      ) : filteredRooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No rooms match your search</p>
            <Button variant="outline" onClick={() => { setSearchQuery(""); setFilterRoomTypeId("all"); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredRooms.map((room) => (
            <Card key={room.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">
                      {room.roomNumber}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getRoomTypeName(room.roomTypeId)}
                    </p>
                    <p className="text-lg font-semibold text-primary mt-2">
                      {formatCurrency(getRoomPrice(room.roomTypeId))} / night
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(room)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(room.id, room.roomNumber)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <Badge className={getStatusColor(room.status)}>
                  {room.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
