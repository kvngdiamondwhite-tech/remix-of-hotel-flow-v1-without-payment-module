import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllItems, addItem, updateItem, deleteItem, Expenditure } from "@/lib/db";
import { uid } from "@/lib/id";
import { nowIso, todayIso, formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/calculations";
import { Plus, Edit, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Cleaning",
  "Utilities",
  "Staff",
  "Supplies",
  "Marketing",
  "Insurance",
  "Other",
];

export default function Expenditures() {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpenditure, setEditingExpenditure] = useState<Expenditure | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [formData, setFormData] = useState({
    date: todayIso(),
    category: "Other",
    description: "",
    amount: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await getAllItems<Expenditure>('expenditures');
      setExpenditures(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("Failed to load expenditures:", error);
      toast.error("Failed to load expenditures");
    }
  }

  function resetForm() {
    setFormData({
      date: todayIso(),
      category: "Other",
      description: "",
      amount: "",
    });
    setEditingExpenditure(null);
  }

  function handleEdit(expenditure: Expenditure) {
    setEditingExpenditure(expenditure);
    setFormData({
      date: expenditure.date,
      category: expenditure.category,
      description: expenditure.description,
      amount: expenditure.amount.toString(),
    });
  }

  async function handleSave() {
    try {
      if (!formData.date || !formData.category || !formData.amount) {
        toast.error("Please fill in all required fields");
        return;
      }

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Amount must be a valid positive number");
        return;
      }

      if (editingExpenditure) {
        const updated: Expenditure = {
          ...editingExpenditure,
          date: formData.date,
          category: formData.category,
          description: formData.description.trim(),
          amount: amount,
          updatedAt: nowIso(),
        };
        await updateItem('expenditures', updated);
        toast.success("Expenditure updated successfully");
      } else {
        const newExpenditure: Expenditure = {
          id: uid(),
          date: formData.date,
          category: formData.category,
          description: formData.description.trim(),
          amount: amount,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        await addItem('expenditures', newExpenditure);
        toast.success("Expenditure created successfully");
      }

      await loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error saving expenditure:", errorMessage, error);
      toast.error(`Failed to save expenditure: ${errorMessage}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this expenditure?")) return;

    try {
      await deleteItem('expenditures', id);
      toast.success("Expenditure deleted successfully");
      await loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error deleting expenditure:", errorMessage, error);
      toast.error(`Failed to delete expenditure: ${errorMessage}`);
    }
  }

  // Filter and search expenditures
  const filteredExpenditures = useMemo(() => {
    return expenditures.filter(exp => {
      // Search filter (description or category)
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === "" ||
        exp.description.toLowerCase().includes(searchLower) ||
        exp.category.toLowerCase().includes(searchLower);

      // Category filter
      const matchesCategory = filterCategory === "all" || exp.category === filterCategory;

      // Date range filter
      const expDate = new Date(exp.date);
      const matchesStartDate = filterStartDate === "" || expDate >= new Date(filterStartDate);
      const matchesEndDate = filterEndDate === "" || expDate <= new Date(filterEndDate + "T23:59:59");

      return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate;
    });
  }, [expenditures, searchTerm, filterCategory, filterStartDate, filterEndDate]);

  const totalAmount = useMemo(() => {
    return filteredExpenditures.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenditures]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Expenditures</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Expenditure
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingExpenditure ? "Edit Expenditure" : "Add New Expenditure"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Date */}
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              {/* Category */}
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Amount */}
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingExpenditure ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by description or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="category-filter">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger id="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-primary/5 border-primary">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenditures</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Count</p>
              <p className="text-2xl font-bold">{filteredExpenditures.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average</p>
              <p className="text-2xl font-bold">
                {formatCurrency(filteredExpenditures.length > 0 ? totalAmount / filteredExpenditures.length : 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-2xl font-bold">{new Set(filteredExpenditures.map(e => e.category)).size}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filteredExpenditures.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No expenditures found. {searchTerm || filterCategory !== "all" || filterStartDate || filterEndDate
              ? "Try adjusting your filters."
              : "Create your first expenditure to get started."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenditures.map((expenditure) => (
                    <TableRow key={expenditure.id}>
                      <TableCell>{formatDate(expenditure.date)}</TableCell>
                      <TableCell>{expenditure.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {expenditure.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(expenditure.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleEdit(expenditure);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(expenditure.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
