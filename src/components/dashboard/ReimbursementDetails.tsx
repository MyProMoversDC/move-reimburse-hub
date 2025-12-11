import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, DollarSign, XCircle, Trash2 } from "lucide-react";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";

interface Reimbursement {
  id: string;
  reimbursement_number: number;
  mover_full_name: string;
  mover_id: string;
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
  decline_reason?: string | null;
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
  language: DashboardLanguage;
}

const ReimbursementDetails = ({ reimbursement, userRole, onUpdate, onClose, language }: ReimbursementDetailsProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  
  const t = dashboardTranslations[language];

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
      return;
    }

    // Generate signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      (data || []).map(async (attachment) => {
        // Extract the file path from the public URL
        const urlParts = attachment.file_url.split('/reimbursement-attachments/');
        const filePath = urlParts[1] || attachment.file_url;
        
        const { data: signedData } = await supabase.storage
          .from("reimbursement-attachments")
          .createSignedUrl(filePath, 3600);
        
        return {
          ...attachment,
          file_url: signedData?.signedUrl || attachment.file_url,
        };
      })
    );

    setAttachments(attachmentsWithUrls);
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

      toast.success(t.reimbursementConfirmed);
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

      toast.success(t.markedPaid);
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast.error(t.declineReasonRequired);
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("reimbursements")
        .update({ 
          status: "declined",
          decline_reason: declineReason.trim()
        })
        .eq("id", reimbursement.id);

      if (error) throw error;

      // Get mover's email for notification
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", reimbursement.mover_id)
        .maybeSingle();

      if (profileData?.email) {
        // Send decline notification email to mover
        await supabase.functions.invoke("send-decline-notification", {
          body: {
            reimbursementNumber: String(reimbursement.reimbursement_number).padStart(5, "0"),
            moverEmail: profileData.email,
            moverName: reimbursement.mover_full_name,
            declineReason: declineReason.trim(),
          },
        });
      }

      toast.success(t.reimbursementDeclined);
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setShowDeclineDialog(false);
      setDeclineReason("");
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("reimbursements")
        .delete()
        .eq("id", reimbursement.id);

      if (error) throw error;

      toast.success(t.reimbursementDeleted);
      onUpdate();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
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

      {reimbursement.status === "declined" && reimbursement.decline_reason && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm font-medium text-destructive">{t.declineReasonLabel}</p>
          <p className="text-base mt-1">{reimbursement.decline_reason}</p>
        </div>
      )}

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
        <div className="space-y-2">
          <Button onClick={handleConfirm} disabled={loading} className="w-full">
            <CheckCircle className="h-4 w-4 mr-2" />
            {loading ? "Confirming..." : "Confirm Reimbursement"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setShowDeclineDialog(true)}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t.declineReimbursement}
            </Button>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t.deleteReimbursement}
            </Button>
          </div>
        </div>
      )}

      {userRole === "accountant" && reimbursement.status === "confirmed" && (
        <Button onClick={handleMarkPaid} disabled={loading} className="w-full">
          <DollarSign className="h-4 w-4 mr-2" />
          {loading ? "Processing..." : "Mark as Paid"}
        </Button>
      )}

      <AlertDialog open={showDeclineDialog} onOpenChange={(open) => {
        setShowDeclineDialog(open);
        if (!open) setDeclineReason("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.declineReimbursement}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDecline}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="declineReason">{t.declineReason} *</Label>
            <Textarea
              id="declineReason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t.declineReasonPlaceholder}
              className="mt-2"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.close}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecline} disabled={!declineReason.trim()}>
              {loading ? t.declining : t.declineReimbursement}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteReimbursement}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteReimbursement}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.close}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {loading ? t.deleting : t.deleteReimbursement}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReimbursementDetails;
