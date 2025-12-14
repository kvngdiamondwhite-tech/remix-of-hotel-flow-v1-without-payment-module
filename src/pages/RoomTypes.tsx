import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getAllItems, addItem, updateItem, deleteItem, RoomType } from "@/lib/db";
import { uid } from "@/lib/id";
import { nowIso } from "@/lib/dates";
import { Plus, Edit, Trash2, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/calculations";

export default function RoomTypes() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    basePrice: "",
    description: "",
    maxAdults: "",
    maxChildren: "",
  });

  useEffect(() => {
    loadRoomTypes();
  }, []);

  async function loadRoomTypes() {
    const types = await getAllItems<RoomType>('roomTypes');
    setRoomTypes(types.sort((a, b) => a.name.localeCompare(b.name)));
  }

  function resetForm() {
    setFormData({
      name: "",
      basePrice: "",
      description: "",
      maxAdults: "",
      maxChildren: "",
    });
    setEditingType(null);
  }

  function handleEdit(type: RoomType) {
    setEditingType(type);
    setFormData({
      name: type.name,
      basePrice: type.basePrice.toString(),
      description: type.description,
      maxAdults: type.maxAdults.toString(),
      maxChildren: type.maxChildren.toString(),
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Room type name is required");
      return;
    }

    const basePrice = parseFloat(formData.basePrice);
    if (isNaN(basePrice) || basePrice < 0) {
      toast.error("Valid base price is required");
      return;
    }

    const maxAdults = parseInt(formData.maxAdults);
    const maxChildren = parseInt(formData.maxChildren);

    if (isNaN(maxAdults) || maxAdults < 1) {
      toast.error("Valid number of adults is required (minimum 1)");
      return;
    }

    if (isNaN(maxChildren) || maxChildren < 0) {
      toast.error("Valid number of children is required (minimum 0)");
      return;
    }

    try {
      if (editingType) {
        const updated: RoomType = {
          ...editingType,
          name: formData.name.trim(),
          basePrice,
          description: formData.description.trim(),
          maxAdults,
          maxChildren,
          updatedAt: nowIso(),
        };
        await updateItem('roomTypes', updated);
        toast.success("Room type updated successfully");
      } else {
        // Check for duplicate name
        const exists = roomTypes.some(
          rt => rt.name.toLowerCase() === formData.name.trim().toLowerCase()
        );
        if (exists) {
          toast.error("A room type with this name already exists");
          return;
        }

        const newType: RoomType = {
          id: uid(),
          name: formData.name.trim(),
          basePrice,
          description: formData.description.trim(),
          maxAdults,
          maxChildren,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        await addItem('roomTypes', newType);
        toast.success("Room type created successfully");
      }

      await loadRoomTypes();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save room type");
      console.error(error);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await deleteItem('roomTypes', id);
      toast.success("Room type deleted successfully");
      await loadRoomTypes();
    } catch (error) {
      toast.error("Failed to delete room type");
      console.error(error);
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Room Types</h1>
          <p className="text-muted-foreground mt-1">Manage different room categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Room Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Edit Room Type" : "Add New Room Type"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Room Type Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Deluxe Suite"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="basePrice">Base Price per Night *</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="maxAdults">Max Adults *</Label>
                  <Input
                    id="maxAdults"
                    type="number"
                    min="1"
                    value={formData.maxAdults}
                    onChange={(e) => setFormData({ ...formData, maxAdults: e.target.value })}
                    placeholder="2"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="maxChildren">Max Children *</Label>
                  <Input
                    id="maxChildren"
                    type="number"
                    min="0"
                    value={formData.maxChildren}
                    onChange={(e) => setFormData({ ...formData, maxChildren: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the room type features..."
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
                  {editingType ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {roomTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No room types found</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Room Type
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roomTypes.map((type) => (
            <Card key={type.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{type.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(type)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(type.id, type.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-accent font-semibold text-lg">
                  <DollarSign className="h-5 w-5" />
                  {formatCurrency(type.basePrice)} / night
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {type.maxAdults} adults, {type.maxChildren} children
                  </span>
                </div>
                {type.description && (
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
