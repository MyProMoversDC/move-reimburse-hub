import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";
import { AlertCircle } from "lucide-react";
import AppealForm from "./AppealForm";
import { MoverTranslateButton } from "./MoverTranslateButton";
import { useTargetTranslation } from "@/hooks/useTargetTranslation";

interface MissingPayment {
  id: string;
  mover_full_name: string;
  customer_name: string;
  job_number: string;
  discrepancy_date: string;
  discrepancy_types: string[];
  discrepancy_details: string;
  missing_amount: string;
  status: "pending" | "confirmed" | "declined" | "appeal";
  decline_reason: string | null;
  appeal_note: string | null;
  appeal_at: string | null;
  created_at: string;
}

interface MissingPaymentHistoryProps {
  userId: string;
  refreshKey: number;
  language: DashboardLanguage;
}

const MissingPaymentHistory = ({ userId, refreshKey, language }: MissingPaymentHistoryProps) => {
  const t = missingPaymentTranslations[language];
  
  const discrepancyLabels: Record<string, string> = {
    missing_hours: t.missingHours,
    incorrect_hourly_rate: t.incorrectHourlyRate,
    missing_tip: t.missingTip,
    missing_bonus: t.missingBonus,
    other: t.other,
  };

  const [payments, setPayments] = useState<MissingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<MissingPayment | null>(null);
  const [appealPayment, setAppealPayment] = useState<MissingPayment | null>(null);
  
  // Translation state
  const [translatedDeclineReason, setTranslatedDeclineReason] = useState<string | null>(null);
  const [declineTranslatedToLang, setDeclineTranslatedToLang] = useState<'es' | 'ru' | null>(null);
  const { translateTexts, isTranslating } = useTargetTranslation();

  const handleTranslateDeclineReason = async (targetLang: 'es' | 'ru') => {
    if (!selectedPayment?.decline_reason) return;
    const results = await translateTexts([selectedPayment.decline_reason], targetLang);
    if (results[0]) {
      setTranslatedDeclineReason(results[0]);
      setDeclineTranslatedToLang(targetLang);
    }
  };

  const handleShowOriginalDeclineReason = () => {
    setTranslatedDeclineReason(null);
    setDeclineTranslatedToLang(null);
  };

  useEffect(() => {
    fetchPayments();
  }, [userId, refreshKey]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("missing_payments")
        .select("*")
        .eq("mover_id", userId)
        .order("created_at", { ascending: false });

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
        return <Badge variant="secondary">{t.pending}</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">{t.confirmed}</Badge>;
      case "declined":
        return <Badge variant="destructive">{t.declined}</Badge>;
      case "appeal":
        return <Badge variant="outline" className="border-orange-500 text-orange-600">{t.underAppeal}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (payments.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">{t.noRequests}</p>
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
                <p className="font-medium">{payment.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  {t.jobNumber}: {payment.job_number} | {t.discrepancyDate}: {format(new Date(payment.discrepancy_date), "MM/dd/yyyy")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.missingAmount}: {payment.missing_amount}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(payment.status)}
                </div>
                {payment.status === "declined" && payment.decline_reason && (
                  <p className="text-sm text-destructive mt-2">
                    <strong>{t.declineReason}:</strong> {payment.decline_reason}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedPayment(payment)}>
                  {t.viewDetails}
                </Button>
                {payment.status === "declined" && (
                  <Button
                    variant="outline"
                    onClick={() => setAppealPayment(payment)}
                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {t.appeal}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* View Details Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.detailsTitle}</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.yourName}</p>
                  <p className="font-medium">{selectedPayment.mover_full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.customerName}</p>
                  <p className="font-medium">{selectedPayment.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.jobNumber}</p>
                  <p className="font-medium">{selectedPayment.job_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.discrepancyDate}</p>
                  <p className="font-medium">{format(new Date(selectedPayment.discrepancy_date), "MM/dd/yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.missingAmount}</p>
                  <p className="font-medium">{selectedPayment.missing_amount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.status}</p>
                  {getStatusBadge(selectedPayment.status)}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">{t.discrepancyTypes}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPayment.discrepancy_types.map((type, idx) => (
                    <Badge key={idx} variant="outline">{discrepancyLabels[type] || type}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t.discrepancyDetails}</p>
                <p className="mt-1 whitespace-pre-wrap">{selectedPayment.discrepancy_details}</p>
              </div>

              {selectedPayment.status === "declined" && selectedPayment.decline_reason && (
                <div className="space-y-2">
                  <div className="bg-destructive/10 p-4 rounded-lg">
                    <p className="text-sm font-medium text-destructive">{t.declineReason}</p>
                    <p className="mt-1">{translatedDeclineReason || selectedPayment.decline_reason}</p>
                    {declineTranslatedToLang && (
                      <p className="text-xs italic mt-1 text-muted-foreground">
                        Translated to {declineTranslatedToLang === 'es' ? 'Español' : 'Русский'}
                      </p>
                    )}
                  </div>
                  <MoverTranslateButton
                    onTranslate={handleTranslateDeclineReason}
                    onShowOriginal={handleShowOriginalDeclineReason}
                    isTranslating={isTranslating}
                    isTranslated={!!translatedDeclineReason}
                    translatedToLang={declineTranslatedToLang}
                  />
                </div>
              )}

              {selectedPayment.appeal_note && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-orange-700">{t.appealNote}</p>
                  <p className="mt-1">{selectedPayment.appeal_note}</p>
                  {selectedPayment.appeal_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t.appealedOn}: {format(new Date(selectedPayment.appeal_at), "MM/dd/yyyy HH:mm")}
                    </p>
                  )}
                </div>
              )}

              <Button variant="outline" onClick={() => setSelectedPayment(null)} className="w-full">
                {t.close}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Appeal Dialog */}
      <Dialog open={!!appealPayment} onOpenChange={() => setAppealPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t.appeal} - {appealPayment?.job_number}
            </DialogTitle>
          </DialogHeader>
          {appealPayment && (
            <AppealForm
              type="missing_payment"
              itemId={appealPayment.id}
              itemNumber={appealPayment.job_number}
              declineReason={appealPayment.decline_reason || ""}
              onSuccess={() => {
                fetchPayments();
                setAppealPayment(null);
              }}
              onClose={() => setAppealPayment(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MissingPaymentHistory;
