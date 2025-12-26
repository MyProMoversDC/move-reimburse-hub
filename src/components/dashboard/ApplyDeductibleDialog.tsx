import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";

interface Mover {
  id: string;
  first_name: string;
  last_name: string;
}

interface ApplyDeductibleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId?: string;
  reportTitle?: string;
  onSuccess?: () => void;
}

const ApplyDeductibleDialog = ({
  open,
  onOpenChange,
  reportId,
  reportTitle,
  onSuccess,
}: ApplyDeductibleDialogProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [selectedMoverIds, setSelectedMoverIds] = useState<string[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (open) {
      fetchMovers();
      if (reportTitle) {
        setReason(`Deductible for: ${reportTitle}`);
      }
    }
  }, [open, reportTitle]);

  const fetchMovers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");

      if (error) throw error;
      setMovers(data || []);
    } catch (error) {
      toast.error(handleError(error));
    }
  };

  const handleMoverToggle = (moverId: string) => {
    setSelectedMoverIds((prev) =>
      prev.includes(moverId)
        ? prev.filter((id) => id !== moverId)
        : [...prev, moverId]
    );
  };

  const removeMover = (moverId: string) => {
    setSelectedMoverIds((prev) => prev.filter((id) => id !== moverId));
  };

  const handleSubmit = async () => {
    if (selectedMoverIds.length === 0) {
      toast.error("Please select at least one mover");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Create deductible for each selected mover
      const deductibles = selectedMoverIds.map((moverId) => {
        const selectedMover = movers.find((m) => m.id === moverId);
        const moverName = selectedMover
          ? `${selectedMover.first_name} ${selectedMover.last_name}`
          : "Unknown";

        return {
          report_id: reportId || null,
          mover_id: moverId,
          mover_name: moverName,
          amount: parseFloat(amount),
          reason: reason.trim() || null,
          created_by: userData.user.id,
        };
      });

      const { error } = await supabase.from("deductibles").insert(deductibles);

      if (error) throw error;

      toast.success(`Deductible applied to ${selectedMoverIds.length} mover(s) successfully`);
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMoverIds([]);
    setAmount("");
    setReason("");
    setSearchQuery("");
  };

  const filteredMovers = movers.filter((mover) => {
    const fullName = `${mover.first_name} ${mover.last_name}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const selectedMovers = movers.filter((m) => selectedMoverIds.includes(m.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply Deductible</DialogTitle>
          <DialogDescription>
            Select one or more movers and enter the deduction amount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Movers Display */}
          {selectedMovers.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Movers ({selectedMovers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedMovers.map((mover) => (
                  <Badge key={mover.id} variant="secondary" className="pl-2 pr-1">
                    {mover.first_name} {mover.last_name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                      onClick={() => removeMover(mover.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Mover Selection */}
          <div className="space-y-2">
            <Label>Select Movers</Label>
            <Input
              placeholder="Search movers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <ScrollArea className="h-[150px] border rounded-md p-2">
              <div className="space-y-2">
                {filteredMovers.map((mover) => (
                  <div key={mover.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={mover.id}
                      checked={selectedMoverIds.includes(mover.id)}
                      onCheckedChange={() => handleMoverToggle(mover.id)}
                    />
                    <label
                      htmlFor={mover.id}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {mover.first_name} {mover.last_name}
                    </label>
                  </div>
                ))}
                {filteredMovers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No movers found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount per Mover ($)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter amount..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {selectedMoverIds.length > 1 && amount && (
              <p className="text-sm text-muted-foreground">
                Total: ${(parseFloat(amount) * selectedMoverIds.length).toFixed(2)} ({selectedMoverIds.length} movers × ${parseFloat(amount).toFixed(2)})
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for deduction..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Applying..." : `Apply to ${selectedMoverIds.length || 0} Mover(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyDeductibleDialog;
