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
import { DashboardLanguage, dashboardTranslations } from "@/lib/dashboardTranslations";
import { Check, X } from "lucide-react";

interface ReviewBonus {
  id: string;
  foreman_name: string;
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
  status: 'pending' | 'confirmed' | 'declined';
  decline_reason: string | null;
  submission_date: string;
  review_month: string;
}

interface AdminReviewBonusListProps {
  language: DashboardLanguage;
}

const AdminReviewBonusList = ({ language }: AdminReviewBonusListProps) => {
  const t = dashboardTranslations[language];
  
  const [reviews, setReviews] = useState<ReviewBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<ReviewBonus | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from("review_bonuses")
        .select("*")
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
        return <Badge variant="secondary">Pending</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewDetails = async (review: ReviewBonus) => {
    setSelectedReview(review);
    
    const filePath = review.screenshot_url.replace("review-screenshots/", "");
    const { data } = await supabase.storage
      .from("review-screenshots")
      .createSignedUrl(filePath, 3600);
    
    if (data?.signedUrl) {
      setScreenshotUrl(data.signedUrl);
    }
  };

  const handleConfirm = async (reviewId: string) => {
    setProcessingId(reviewId);
    try {
      const { error } = await supabase
        .from("review_bonuses")
        .update({
          status: "confirmed",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (error) throw error;
      toast.success("Review confirmed successfully");
      fetchReviews();
      setSelectedReview(null);
    } catch (error) {
      console.error("Error confirming review:", error);
      toast.error("Failed to confirm review");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async () => {
    if (!selectedReview || !declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }

    setProcessingId(selectedReview.id);
    try {
      const { error } = await supabase
        .from("review_bonuses")
        .update({
          status: "declined",
          decline_reason: declineReason.trim(),
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReview.id);

      if (error) throw error;
      toast.success("Review declined");
      setShowDeclineDialog(false);
      setDeclineReason("");
      fetchReviews();
      setSelectedReview(null);
    } catch (error) {
      console.error("Error declining review:", error);
      toast.error("Failed to decline review");
    } finally {
      setProcessingId(null);
    }
  };

  const getCrewMembers = (review: ReviewBonus) => {
    return [
      review.crew_member_1,
      review.crew_member_2,
      review.crew_member_3,
      review.crew_member_4,
      review.crew_member_5,
      review.crew_member_6,
      review.crew_member_7,
      review.crew_member_8,
    ].filter(Boolean);
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  if (reviews.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No review bonus submissions yet</p>
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
                  Foreman: {review.foreman_name} | Invoice: {review.invoice_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  Job Date: {format(new Date(review.job_date), "MM/dd/yyyy")} | Month: {review.review_month}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge(review.status)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleViewDetails(review)}>
                  View Details
                </Button>
                {review.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(review.id)}
                      disabled={processingId === review.id}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setSelectedReview(review);
                        setShowDeclineDialog(true);
                      }}
                      disabled={processingId === review.id}
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
      <Dialog open={!!selectedReview && !showDeclineDialog} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Bonus Details</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Foreman</p>
                  <p className="font-medium">{selectedReview.foreman_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client Name</p>
                  <p className="font-medium">{selectedReview.client_full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">{selectedReview.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job Date</p>
                  <p className="font-medium">{format(new Date(selectedReview.job_date), "MM/dd/yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Review Month</p>
                  <p className="font-medium">{selectedReview.review_month}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedReview.status)}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Crew Members</p>
                <div className="flex flex-wrap gap-2">
                  {getCrewMembers(selectedReview).map((member, idx) => (
                    <Badge key={idx} variant="outline">{member}</Badge>
                  ))}
                </div>
              </div>

              {selectedReview.review_url && (
                <div>
                  <p className="text-sm text-muted-foreground">Review URL</p>
                  <a href={selectedReview.review_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {selectedReview.review_url}
                  </a>
                </div>
              )}

              {selectedReview.decline_reason && (
                <div className="bg-destructive/10 p-4 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Decline Reason</p>
                  <p className="mt-1">{selectedReview.decline_reason}</p>
                </div>
              )}

              {screenshotUrl && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Review Screenshot</p>
                  <img src={screenshotUrl} alt="Review screenshot" className="max-w-full rounded-lg border" />
                </div>
              )}

              <div className="flex gap-2">
                {selectedReview.status === "pending" && (
                  <>
                    <Button
                      onClick={() => handleConfirm(selectedReview.id)}
                      disabled={processingId === selectedReview.id}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                    >
                      <Check className="h-4 w-4 mr-2" /> Confirm
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeclineDialog(true)}
                      disabled={processingId === selectedReview.id}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" /> Decline
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setSelectedReview(null)} className={selectedReview.status === "pending" ? "" : "w-full"}>
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
            <DialogTitle>Decline Review Bonus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="declineReason">Reason for declining *</Label>
              <Textarea
                id="declineReason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter the reason for declining this review..."
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

export default AdminReviewBonusList;
