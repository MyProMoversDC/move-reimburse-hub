import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, DollarSign } from "lucide-react";

interface Reimbursement {
  id: string;
  reimbursement_number: number;
  mover_full_name: string;
  job_number: string;
  truck_number: string;
  customer_name: string;
  gas_expenses: number;
  road_expenses: number;
  hotel_expenses: number;
  other_expenses: number;
  total_expenses: number;
  zelle_info: string;
  status: string;
  created_at: string;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
}

interface ReimbursementDetailsProps {
  reimbursement: Reimbursement;
  userRole: "mover" | "admin" | "accountant";
  onUpdate: () => void;
  onClose: () => void;
}

const ReimbursementDetails = ({ reimbursement, userRole, onUpdate, onClose }: ReimbursementDetailsProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAttachments();
  }, [reimbursement.id]);

  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from("reimbursement_attachments")
      .select("*")
      .eq("reimbursement_id", reimbursement.id);

    if (error) {
      console.error("Error fetching attachments:", error);
    } else {
      setAttachments(data || []);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("reimbursements")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", reimbursement.id);

      if (error) throw error;

      // Send confirmation notification
      await supabase.functions.invoke("send-confirmation-notification", {
        body: {
          reimbursementNumber: String(reimbursement.reimbursement_number).padStart(5, "0"),
          reimbursementId: reimbursement.id,
        },
      });

      toast.success("Reimbursement confirmed!");
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("reimbursements")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", reimbursement.id);

      if (error) throw error;

      toast.success("Reimbursement marked as paid!");
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mover Name</p>
          <p className="text-base">{reimbursement.mover_full_name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Job #</p>
          <p className="text-base">{reimbursement.job_number}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Truck #</p>
          <p className="text-base">{reimbursement.truck_number}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Customer</p>
          <p className="text-base">{reimbursement.customer_name}</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Expenses</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Gas:</span>
            <span>${reimbursement.gas_expenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Road/Tolls:</span>
            <span>${reimbursement.road_expenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Hotel:</span>
            <span>${reimbursement.hotel_expenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Other:</span>
            <span>${reimbursement.other_expenses.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t font-semibold">
            <span>Total:</span>
            <span>${reimbursement.total_expenses.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground">Zelle Payment Info</p>
        <p className="text-base">{reimbursement.zelle_info}</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Attachments ({attachments.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={attachment.file_url}
                alt={attachment.file_name}
                className="w-full h-32 object-cover rounded border hover:opacity-80 transition-opacity"
              />
            </a>
          ))}
        </div>
      </div>

      {userRole === "admin" && reimbursement.status === "pending" && (
        <Button onClick={handleConfirm} disabled={loading} className="w-full">
          <CheckCircle className="h-4 w-4 mr-2" />
          {loading ? "Confirming..." : "Confirm Reimbursement"}
        </Button>
      )}

      {userRole === "accountant" && reimbursement.status === "confirmed" && (
        <Button onClick={handleMarkPaid} disabled={loading} className="w-full">
          <DollarSign className="h-4 w-4 mr-2" />
          {loading ? "Processing..." : "Mark as Paid"}
        </Button>
      )}
    </div>
  );
};

export default ReimbursementDetails;
