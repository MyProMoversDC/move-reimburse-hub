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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedMoverId, setSelectedMoverId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async () => {
    if (!selectedMoverId) {
      toast.error("Please select a mover");
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

      const selectedMover = movers.find((m) => m.id === selectedMoverId);
      const moverName = selectedMover
        ? `${selectedMover.first_name} ${selectedMover.last_name}`
        : "Unknown";

      const { error } = await supabase.from("deductibles").insert({
        report_id: reportId || null,
        mover_id: selectedMoverId,
        mover_name: moverName,
        amount: parseFloat(amount),
        reason: reason.trim() || null,
        created_by: userData.user.id,
      });

      if (error) throw error;

      toast.success("Deductible applied successfully");
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
    setSelectedMoverId("");
    setAmount("");
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Apply Deductible</DialogTitle>
          <DialogDescription>
            Select a mover and enter the deduction amount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mover">Select Mover</Label>
            <Select value={selectedMoverId} onValueChange={setSelectedMoverId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a mover..." />
              </SelectTrigger>
              <SelectContent>
                {movers.map((mover) => (
                  <SelectItem key={mover.id} value={mover.id}>
                    {mover.first_name} {mover.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter amount..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
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
            {loading ? "Applying..." : "Apply Deductible"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyDeductibleDialog;
