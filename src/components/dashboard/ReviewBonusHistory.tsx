import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { reviewBonusTranslations, ReviewBonusLanguage } from "@/lib/reviewBonusTranslations";
import { AlertCircle } from "lucide-react";
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
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">{t.pending}</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">{t.confirmed}</Badge>;
      case "declined":
        return <Badge variant="destructive">{t.declined}</Badge>;
      case "appeal":
        return <Badge variant="outline" className="border-orange-500 text-orange-600">Under Appeal</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewDetails = async (review: ReviewBonus) => {
    setSelectedReview(review);
    
    // Get signed URL for screenshot
    const filePath = review.screenshot_url.replace("review-screenshots/", "");
    const { data } = await supabase.storage
      .from("review-screenshots")
      .createSignedUrl(filePath, 3600);
    
    if (data?.signedUrl) {
      setScreenshotUrl(data.signedUrl);
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
                  {t.invoiceNumber}: {review.invoice_number} | {t.jobDate}: {format(new Date(review.job_date), "MM/dd/yyyy")}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(review.status)}
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
                {review.status === "declined" && (
                  <Button
                    variant="outline"
                    onClick={() => setAppealReview(review)}
                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Appeal
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <p className="font-medium">{format(new Date(selectedReview.job_date), "MM/dd/yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.status}</p>
                  {getStatusBadge(selectedReview.status)}
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

              {selectedReview.status === "declined" && selectedReview.decline_reason && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm font-medium text-destructive">{t.declineReason}</p>
                  <p className="mt-1">{selectedReview.decline_reason}</p>
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
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReviewBonusHistory;
