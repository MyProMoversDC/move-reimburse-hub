import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { Check, X } from "lucide-react";

interface MissingPayment {
  id: string;
  mover_id: string;
  mover_full_name: string;
  customer_name: string;
  job_number: string;
  discrepancy_date: string;
  discrepancy_types: string[];
  discrepancy_details: string;
  missing_amount: string;
  status: 'pending' | 'confirmed' | 'declined' | 'appeal';
  decline_reason: string | null;
  appeal_note: string | null;
  appeal_at: string | null;
  created_at: string;
}

interface AdminMissingPaymentListProps {
  language: DashboardLanguage;
  startDate?: Date;
  endDate?: Date;
}

const discrepancyLabels: Record<string, string> = {
  missing_hours: "Missing Hours",
  incorrect_hourly_rate: "Incorrect Hourly Rate",
  missing_tip: "Missing Tip",
  missing_bonus: "Missing Bonus",
  other: "Other",
};

const AdminMissingPaymentList = ({ language, startDate, endDate }: AdminMissingPaymentListProps) => {
  const [payments, setPayments] = useState<MissingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<MissingPayment | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, [startDate, endDate]);

  const fetchPayments = async () => {
    try {
      let query = supabase
        .from("missing_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("created_at", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching missing payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      case "appeal":
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Under Appeal</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleConfirm = async (paymentId: string, moverId: string, jobNumber: string) => {
    setProcessingId(paymentId);
    try {
      const { error } = await supabase
        .from("missing_payments")
        .update({
          status: "confirmed",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) throw error;

      toast.success("Missing payment confirmed successfully");
      fetchPayments();
      setSelectedPayment(null);
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Failed to confirm missing payment");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async () => {
    if (!selectedPayment || !declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }

    setProcessingId(selectedPayment.id);
    try {
      const { error } = await supabase
        .from("missing_payments")
        .update({
          status: "declined",
          decline_reason: declineReason.trim(),
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedPayment.id);

      if (error) throw error;

      toast.success("Missing payment declined");
      setShowDeclineDialog(false);
      setDeclineReason("");
      fetchPayments();
      setSelectedPayment(null);
    } catch (error) {
      console.error("Error declining payment:", error);
      toast.error("Failed to decline missing payment");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (payments.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No missing payment submissions yet</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {payments.map((payment) => (
          <Card key={payment.id} className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">{payment.mover_full_name}</p>
                <p className="text-sm text-muted-foreground">
                  Customer: {payment.customer_name} | Job: {payment.job_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  Date: {format(new Date(payment.discrepancy_date), "MM/dd/yyyy")} | Amount: {payment.missing_amount}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(payment.status)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedPayment(payment)}>
                  View Details
                </Button>
                {(payment.status === "pending" || payment.status === "appeal") && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(payment.id, payment.mover_id, payment.job_number)}
                      disabled={processingId === payment.id}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setShowDeclineDialog(true);
                      }}
                      disabled={processingId === payment.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* View Details Dialog */}
      <Dialog open={!!selectedPayment && !showDeclineDialog} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Missing Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mover Name</p>
                  <p className="font-medium">{selectedPayment.mover_full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer Name</p>
                  <p className="font-medium">{selectedPayment.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job/Invoice Number</p>
                  <p className="font-medium">{selectedPayment.job_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Discrepancy Date</p>
                  <p className="font-medium">{format(new Date(selectedPayment.discrepancy_date), "MM/dd/yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Missing Amount</p>
                  <p className="font-medium">{selectedPayment.missing_amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedPayment.status)}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Discrepancy Types</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPayment.discrepancy_types.map((type, idx) => (
                    <Badge key={idx} variant="outline">{discrepancyLabels[type] || type}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Discrepancy Details</p>
                <p className="mt-1 whitespace-pre-wrap bg-muted p-3 rounded-lg">{selectedPayment.discrepancy_details}</p>
              </div>

              {selectedPayment.decline_reason && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Decline Reason</p>
                  <p className="mt-1">{selectedPayment.decline_reason}</p>
                </div>
              )}

              {selectedPayment.appeal_note && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-orange-700">Appeal Note</p>
                  <p className="mt-1">{selectedPayment.appeal_note}</p>
                  {selectedPayment.appeal_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Appealed on: {format(new Date(selectedPayment.appeal_at), "MM/dd/yyyy HH:mm")}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {(selectedPayment.status === "pending" || selectedPayment.status === "appeal") && (
                  <>
                    <Button
                      onClick={() => handleConfirm(selectedPayment.id, selectedPayment.mover_id, selectedPayment.job_number)}
                      disabled={processingId === selectedPayment.id}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                    >
                      <Check className="h-4 w-4 mr-2" /> Confirm
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeclineDialog(true)}
                      disabled={processingId === selectedPayment.id}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" /> Decline
                    </Button>
                  </>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedPayment(null)} 
                  className={(selectedPayment.status === "pending" || selectedPayment.status === "appeal") ? "" : "w-full"}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Missing Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="declineReason">Reason for declining *</Label>
              <Textarea
                id="declineReason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter the reason for declining this request..."
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={!declineReason.trim() || processingId !== null}
                className="flex-1"
              >
                Decline
              </Button>
              <Button variant="outline" onClick={() => setShowDeclineDialog(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminMissingPaymentList;
