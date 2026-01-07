import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { reviewBonusTranslations, ReviewBonusLanguage } from "@/lib/reviewBonusTranslations";
import { formatDateEST, formatDateTimeEST } from "@/lib/dateUtils";
import { AlertCircle, AlertTriangle } from "lucide-react";
import AppealForm from "./AppealForm";

interface ReviewBonus {
  id: string;
  job_date: string;
  client_full_name: string;
  invoice_number: string;
  crew_member_1: string;
  crew_member_2: string;
  crew_member_3: string;
  crew_member_4: string | null;
  crew_member_5: string | null;
  crew_member_6: string | null;
  crew_member_7: string | null;
  crew_member_8: string | null;
  review_url: string | null;
  screenshot_url: string;
  status: 'pending' | 'confirmed' | 'declined' | 'appeal';
  appeal_note: string | null;
  appeal_at: string | null;
  decline_reason: string | null;
  submission_date: string;
  review_month: string;
  appeal_count?: number;
  reviewed_at?: string | null;
}

interface ReviewBonusHistoryProps {
  userId: string;
  refreshKey: number;
  language: ReviewBonusLanguage;
}

const ReviewBonusHistory = ({ userId, refreshKey, language }: ReviewBonusHistoryProps) => {
  const t = reviewBonusTranslations[language];
  
  const [reviews, setReviews] = useState<ReviewBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<ReviewBonus | null>(null);
  const [appealReview, setAppealReview] = useState<ReviewBonus | null>(null);
  const [disclaimerReview, setDisclaimerReview] = useState<ReviewBonus | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [appealHistory, setAppealHistory] = useState<any[]>([]);
  const [appealAttachmentsByHistory, setAppealAttachmentsByHistory] = useState<Record<string, any[]>>({});
  const [initialDeclineReason, setInitialDeclineReason] = useState<{reason: string; date: string} | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [userId, refreshKey]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("review_bonuses")
        .select("*")
        .eq("mover_id", userId)
        .order("submission_date", { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, appealCount?: number) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">{t.pending}</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">{t.confirmed}</Badge>;
      case "declined":
        // Check appeal count to determine which declined status to show
        if (appealCount === 1) {
          return <Badge variant="destructive">{t.declinedFirstAppeal}</Badge>;
        } else if (appealCount && appealCount >= 2) {
          return <Badge variant="destructive">{t.declinedFinalAppeal}</Badge>;
        }
        return <Badge variant="destructive">{t.declined}</Badge>;
      case "appeal":
        if (appealCount === 2) {
          return <Badge variant="outline" className="border-red-500 text-red-600">{t.finalAppealStatus}</Badge>;
        }
        return <Badge variant="outline" className="border-orange-500 text-orange-600">{t.firstAppealStatus}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewDetails = async (review: ReviewBonus) => {
    setSelectedReview(review);
    setAppealHistory([]);
    setAppealAttachmentsByHistory({});
    setInitialDeclineReason(null);
    
    // Get signed URL for screenshot
    const filePath = review.screenshot_url.replace("review-screenshots/", "");
    const { data } = await supabase.storage
      .from("review-screenshots")
      .createSignedUrl(filePath, 3600);
    
    if (data?.signedUrl) {
      setScreenshotUrl(data.signedUrl);
    }

    // Fetch appeal history
    const { data: historyData } = await supabase
      .from("review_bonus_appeal_history")
      .select("*")
      .eq("review_bonus_id", review.id)
      .order("appeal_number", { ascending: true });

    if (historyData && historyData.length > 0) {
      setAppealHistory(historyData);
      
      // The first appeal's existence means there was an initial decline
      // We need to find the initial decline reason - it's stored in the review_bonuses.decline_reason
      // when the review was first declined before any appeals
      // Since the appeal_history stores decline reasons for each appeal attempt,
      // we look at the first appeal - the initial decline happened before it
      if (review.decline_reason) {
        // The current decline_reason on the review is actually the latest one
        // For initial decline, we need to check if appeal_count > 0 and there's history
        // The initial decline would be captured when first appeal was made
        // Let's use the reviewed_at date if available, otherwise use the first appeal's date minus a bit
        const firstAppealDate = historyData[0]?.appeal_at;
        if (firstAppealDate) {
          setInitialDeclineReason({
            reason: review.decline_reason,
            date: review.reviewed_at || firstAppealDate
          });
        }
      }

      // Fetch attachments for each appeal history record
      const attachmentsByHistory: Record<string, any[]> = {};
      for (const hist of historyData) {
        const { data: attachments } = await supabase
          .from("review_appeal_attachments")
          .select("id, file_url, file_name")
          .eq("appeal_history_id", hist.id);

        if (attachments && attachments.length > 0) {
          // Get signed URLs for attachments
          const attachmentsWithUrls = await Promise.all(
            attachments.map(async (att) => {
              const { data: signedData } = await supabase.storage
                .from("appeal-attachments")
                .createSignedUrl(att.file_url, 3600);
              return {
                ...att,
                signed_url: signedData?.signedUrl || att.file_url,
              };
            })
          );
          attachmentsByHistory[hist.id] = attachmentsWithUrls;
        } else {
          attachmentsByHistory[hist.id] = [];
        }
      }
      setAppealAttachmentsByHistory(attachmentsByHistory);
    }
  };

  const getCrewMembers = (review: ReviewBonus) => {
    const members = [
      review.crew_member_1,
      review.crew_member_2,
      review.crew_member_3,
      review.crew_member_4,
      review.crew_member_5,
      review.crew_member_6,
      review.crew_member_7,
      review.crew_member_8,
    ].filter(Boolean);
    return members;
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (reviews.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">{t.noReviews}</p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">{review.client_full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {t.invoiceNumber}: {review.invoice_number} | {t.jobDate}: {formatDateEST(review.job_date)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(review.status, review.appeal_count)}
                </div>
                {review.status === "declined" && review.decline_reason && (
                  <p className="text-sm text-destructive mt-2">
                    <strong>{t.declineReason}:</strong> {review.decline_reason}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleViewDetails(review)}>
                  {t.viewDetails}
                </Button>
                {review.status === "declined" && (!review.appeal_count || review.appeal_count < 2) && (
                  <Button
                    variant="outline"
                    onClick={() => setDisclaimerReview(review)}
                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {review.appeal_count === 1 ? t.finalAppeal : t.appeal}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.viewDetails}</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t.clientFullName}</p>
                  <p className="font-medium">{selectedReview.client_full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.invoiceNumber}</p>
                  <p className="font-medium">{selectedReview.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.jobDate}</p>
                  <p className="font-medium">{formatDateEST(selectedReview.job_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.status}</p>
                  {getStatusBadge(selectedReview.status, selectedReview.appeal_count)}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">{t.crewMember}</p>
                <div className="flex flex-wrap gap-2">
                  {getCrewMembers(selectedReview).map((member, idx) => (
                    <Badge key={idx} variant="outline">{member}</Badge>
                  ))}
                </div>
              </div>

              {selectedReview.review_url && (
                <div>
                  <p className="text-sm text-muted-foreground">{t.reviewUrl}</p>
                  <a href={selectedReview.review_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {selectedReview.review_url}
                  </a>
                </div>
              )}

              {selectedReview.decline_reason && appealHistory.length === 0 && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm font-medium text-destructive">{t.declineReason}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{selectedReview.decline_reason}</p>
                </div>
              )}

              {/* Appeal History Section */}
              {appealHistory.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">{t.appealHistory}</h4>
                  
                  {/* Initial Decline Reason - shown at the top of appeal history */}
                  <div className="bg-red-100 border border-red-300 p-4 rounded-lg space-y-2">
                    <p className="font-medium text-red-800">{t.initialDeclineReason}</p>
                    <p className="text-sm text-red-700">{selectedReview.decline_reason}</p>
                  </div>
                  
                  {appealHistory.map((hist) => (
                    <div key={hist.id} className="bg-orange-50 border border-orange-200 p-4 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-orange-700">
                          {t.appealNumber}{hist.appeal_number} {hist.appeal_number === 2 ? `(${t.finalAppeal})` : `(${t.firstAppealStatus})`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.appealed}: {formatDateTimeEST(hist.appeal_at)} EST
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Appeal Note:</p>
                        <p className="whitespace-pre-wrap text-sm">{hist.appeal_note}</p>
                      </div>

                      {hist.decline_reason && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded">
                          <p className="text-sm font-medium text-red-700">{t.declineReason}:</p>
                          <p className="text-sm text-red-600">{hist.decline_reason}</p>
                          {hist.declined_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.declinedOn}: {formatDateTimeEST(hist.declined_at)} EST
                            </p>
                          )}
                        </div>
                      )}

                      {/* Attachments for this appeal */}
                      <div>
                        <p className="text-sm font-medium text-orange-700 mb-2">
                          {t.attachmentsForAppeal}{hist.appeal_number}:
                        </p>
                        {appealAttachmentsByHistory[hist.id]?.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {appealAttachmentsByHistory[hist.id].map((att: any) => (
                              <a
                                key={att.id}
                                href={att.signed_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-white rounded border hover:bg-gray-50"
                              >
                                <span className="text-sm truncate text-primary hover:underline">
                                  {att.file_name}
                                </span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">{t.noAttachments}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {screenshotUrl && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t.screenshotUpload}</p>
                  <img src={screenshotUrl} alt="Review screenshot" className="max-w-full rounded-lg border" />
                </div>
              )}

              <Button variant="outline" onClick={() => setSelectedReview(null)} className="w-full">
                {t.close}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!appealReview} onOpenChange={() => setAppealReview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Appeal Review Submission - {appealReview?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {appealReview && (
            <AppealForm
              type="review"
              itemId={appealReview.id}
              itemNumber={appealReview.invoice_number}
              declineReason={appealReview.decline_reason || ""}
              onSuccess={() => {
                fetchReviews();
                setAppealReview(null);
              }}
              onClose={() => setAppealReview(null)}
              isFinalAppeal={appealReview.appeal_count === 1}
              language={language}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Appeal Disclaimer Dialog */}
      <AlertDialog open={!!disclaimerReview} onOpenChange={() => setDisclaimerReview(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {t.appealDisclaimerTitle}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                  <p className="font-medium text-orange-800">
                    ⚠️ {t.appealWarning}
                  </p>
                  <p className="text-sm text-orange-700">
                    {disclaimerReview?.appeal_count === 1 
                      ? t.appealFinalAttempt
                      : t.appealFirstAttempt
                    }
                  </p>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{t.appealTipsTitle}</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>{t.appealTip1}</li>
                    <li>{t.appealTip2}</li>
                    <li>{t.appealTip3}</li>
                    <li>{t.appealTip4}</li>
                  </ul>
                </div>
                <p className="text-sm font-medium text-destructive">
                  {t.appealFinalWarning}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.appealCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAppealReview(disclaimerReview);
                setDisclaimerReview(null);
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {t.appealContinue}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReviewBonusHistory;
