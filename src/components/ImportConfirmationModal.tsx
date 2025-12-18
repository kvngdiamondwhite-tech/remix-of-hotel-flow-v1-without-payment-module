import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Database, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export type ImportMode = 'empty-only' | 'clear-first';

interface ImportConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: ImportMode) => void;
  hasExistingData: boolean;
}

/**
 * Import Confirmation Modal (TASK 3)
 * Shows safeguards before import executes
 */
export function ImportConfirmationModal({
  open,
  onClose,
  onConfirm,
  hasExistingData,
}: ImportConfirmationModalProps) {
  const [mode, setMode] = useState<ImportMode>('empty-only');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleConfirm = () => {
    if (mode === 'clear-first') {
      // Require second confirmation for clearing data
      setShowClearConfirm(true);
    } else {
      onConfirm(mode);
    }
  };

  const handleClearConfirm = () => {
    setShowClearConfirm(false);
    onConfirm('clear-first');
  };

  const handleClose = () => {
    setShowClearConfirm(false);
    setMode('empty-only');
    onClose();
  };

  // Second confirmation for clearing data
  if (showClearConfirm) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Confirm Data Deletion
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              All existing room types, rooms, guests, and bookings will be permanently deleted before importing the new data.
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Go Back
            </Button>
            <Button variant="destructive" onClick={handleClearConfirm}>
              Yes, Clear & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Import Data
          </DialogTitle>
          <DialogDescription>
            Choose how to handle the import
          </DialogDescription>
        </DialogHeader>

        {/* Warning about duplicates */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Importing data may create duplicate records if data already exists.
          </AlertDescription>
        </Alert>

        {/* Import mode selection */}
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ImportMode)} className="space-y-3">
          <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="empty-only" id="empty-only" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="empty-only" className="font-medium cursor-pointer">
                Import into empty database only
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {hasExistingData 
                  ? 'Existing data detected. Import will be blocked to prevent duplicates.'
                  : 'Database is empty. Safe to proceed with import.'}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="clear-first" id="clear-first" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="clear-first" className="font-medium cursor-pointer">
                Clear existing data before import
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                All current data will be deleted before importing. Requires additional confirmation.
              </p>
            </div>
          </div>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
