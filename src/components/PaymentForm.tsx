import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { addPayment, Payment, calculateBookingPaymentStatus, updateBookingPaymentStatus } from "@/lib/payments";
import { Booking, Guest, Room, getItem } from "@/lib/db";
import { formatCurrency } from "@/lib/calculations";
import { todayIso, currentTimeHHmm } from "@/lib/dates";
import { CreditCard, DollarSign } from "lucide-react";
import { getEnabledPaymentMethods, PaymentMethodConfig } from "@/lib/settings";

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
  onPaymentAdded: () => void;
}

export default function PaymentForm({ open, onOpenChange, booking, onPaymentAdded }: PaymentFormProps) {
  // Get enabled payment methods from settings
  const enabledMethods = getEnabledPaymentMethods();
  const defaultMethod = enabledMethods.length > 0 ? enabledMethods[0].id : 'cash';
  
  const [paymentMethod, setPaymentMethod] = useState(defaultMethod);
  const [paymentType, setPaymentType] = useState<'deposit' | 'full' | 'partial'>('full');
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentTime, setPaymentTime] = useState(currentTimeHHmm());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<{ totalPaid: number; balance: number } | null>(null);

  useEffect(() => {
    if (booking && open) {
      loadBookingDetails();
    }
  }, [booking, open]);

  const loadBookingDetails = async () => {
    if (!booking) return;

    const [guest, room, paymentStatus] = await Promise.all([
      getItem<Guest>('guests', booking.guestId),
      getItem<Room>('rooms', booking.roomId),
      calculateBookingPaymentStatus(booking.id, booking.total),
    ]);

    setGuestName(guest?.fullName || 'Unknown Guest');
    setRoomNumber(room?.roomNumber || 'Unknown');
    setPaymentInfo({ totalPaid: paymentStatus.totalPaid, balance: paymentStatus.balance });
    
    // Pre-fill amount with balance for full payment
    if (paymentStatus.balance > 0) {
      setAmount(paymentStatus.balance.toString());
    }
  };

  const resetForm = () => {
    setPaymentMethod('cash');
    setPaymentType('full');
    setAmount("");
    setPaymentDate(todayIso());
    setPaymentTime(currentTimeHHmm());
    setNotes("");
    setPaymentInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!booking) {
      toast.error("No booking selected");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      await addPayment({
        bookingId: booking.id,
        paymentMethod,
        paymentType,
        amount: amountNum,
        paymentDate,
        paymentTime,
        notes: notes.trim(),
      });

      // Update booking payment status
      await updateBookingPaymentStatus(booking.id);

      toast.success("Payment recorded successfully");
      resetForm();
      onOpenChange(false);
      onPaymentAdded();
    } catch (error) {
      toast.error("Failed to record payment");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        {booking && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Guest:</span>
                <p className="font-medium">{guestName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Room:</span>
                <p className="font-medium">Room {roomNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Booking Total:</span>
                <p className="font-medium text-primary">{formatCurrency(booking.total)}</p>
              </div>
              {paymentInfo && (
                <>
                  <div>
                    <span className="text-muted-foreground">Already Paid:</span>
                    <p className="font-medium text-success">{formatCurrency(paymentInfo.totalPaid)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Balance Due:</span>
                    <p className="font-bold text-lg text-warning">{formatCurrency(paymentInfo.balance)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Type</Label>
              <Select value={paymentType} onValueChange={(v) => setPaymentType(v as typeof paymentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="partial">Partial Payment</SelectItem>
                  <SelectItem value="full">Full Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentTime">Payment Time</Label>
            <Input
              id="paymentTime"
              type="time"
              value={paymentTime}
              onChange={(e) => setPaymentTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
