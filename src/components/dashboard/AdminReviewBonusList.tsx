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
  mover_id: string;
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
  status: 'pending' | 'confirmed' | 'declined' | 'appeal';
  appeal_note: string | null;
  appeal_at: string | null;
  decline_reason: string | null;
  submission_date: string;
  review_month: string;
  appeal_count?: number;
}

interface AppealAttachment {
  id: string;
  file_url: string;
  file_name: string;
}

interface AdminReviewBonusListProps {
  language: DashboardLanguage;
  startDate?: Date;
  endDate?: Date;
  userRole?: 'admin' | 'reviews_admin';
}

const AdminReviewBonusList = ({ language, startDate, endDate }: AdminReviewBonusListProps) => {
  const t = dashboardTranslations[language];
  
  const [reviews, setReviews] = useState<ReviewBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<ReviewBonus | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [appealAttachments, setAppealAttachments] = useState<AppealAttachment[]>([]);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, [startDate, endDate]);

  const fetchReviews = async () => {
    try {
      let query = supabase
        .from("review_bonuses")
        .select("*")
        .order("submission_date", { ascending: false });

      if (startDate) {
        query = query.gte("submission_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("submission_date", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

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
        return <Badge variant="secondary">Pending</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">Confirmed</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      case "appeal":
        if (appealCount === 2) {
          return <Badge variant="outline" className="border-red-500 text-red-600">Final Appeal</Badge>;
        }
        return <Badge variant="outline" className="border-orange-500 text-orange-600">First Appeal</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleViewDetails = async (review: ReviewBonus) => {
    setSelectedReview(review);
    setAppealAttachments([]);
    
    const filePath = review.screenshot_url.replace("review-screenshots/", "");
    const { data } = await supabase.storage
      .from("review-screenshots")
      .createSignedUrl(filePath, 3600);
    
    if (data?.signedUrl) {
      setScreenshotUrl(data.signedUrl);
    }

    // Fetch appeal attachments if in appeal status
    if (review.status === "appeal") {
      const { data: attachments } = await supabase
        .from("review_appeal_attachments")
        .select("id, file_url, file_name")
        .eq("review_bonus_id", review.id);
      
      if (attachments) {
        setAppealAttachments(attachments);
      }
    }
  };

  const handleConfirm = async (reviewId: string, moverId: string, invoiceNumber: string) => {
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

      // Get mover's email for approval notification
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", moverId)
        .maybeSingle();

      if (profileData?.email) {
        // Send approval notification to mover
        await supabase.functions.invoke("send-mover-approval-notification", {
          body: {
            type: "review_approved",
            moverEmail: profileData.email,
            moverName: `${profileData.first_name} ${profileData.last_name}`,
            invoiceNumber: invoiceNumber,
          },
        });
      }

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
      // First update the status
      const { error } = await supabase
        .from("review_bonuses")
        .update({
          status: "declined",
          decline_reason: declineReason.trim(),
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReview.id);

      if (error) throw error;

      // Get mover's email from profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("email, first_name, last_name")
        .eq("id", selectedReview.mover_id)
        .single();

      if (!profileError && profileData) {
        // Send decline notification email
        try {
          await supabase.functions.invoke("send-review-decline-notification", {
            body: {
              invoiceNumber: selectedReview.invoice_number,
              moverEmail: profileData.email,
              moverName: `${profileData.first_name} ${profileData.last_name}`,
              clientName: selectedReview.client_full_name,
              declineReason: declineReason.trim(),
            },
          });
          console.log("Decline notification email sent");
        } catch (emailError) {
          console.error("Failed to send decline notification email:", emailError);
          // Don't fail the whole operation if email fails
        }
      }

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
                  {getStatusBadge(review.status, review.appeal_count)}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleViewDetails(review)}>
                  View Details
                </Button>
                {(review.status === "pending" || review.status === "appeal") && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(review.id, review.mover_id, review.invoice_number)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  {getStatusBadge(selectedReview.status, selectedReview.appeal_count)}
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

              {selectedReview.appeal_note && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-orange-700">
                    Appeal Note {selectedReview.appeal_count === 2 ? "(Final Appeal)" : "(First Appeal)"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{selectedReview.appeal_note}</p>
                  {selectedReview.appeal_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Appealed on: {format(new Date(selectedReview.appeal_at), "MM/dd/yyyy HH:mm")}
                    </p>
                  )}
                </div>
              )}

              {appealAttachments.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                  <p className="text-sm font-medium text-orange-700 mb-2">Appeal Attachments</p>
                  <div className="grid grid-cols-2 gap-2">
                    {appealAttachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-white rounded border hover:bg-gray-50"
                      >
                        <span className="text-sm truncate text-primary hover:underline">
                          {attachment.file_name}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {screenshotUrl && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Review Screenshot</p>
                  <img src={screenshotUrl} alt="Review screenshot" className="max-w-full rounded-lg border" />
                </div>
              )}

              <div className="flex gap-2">
                {(selectedReview.status === "pending" || selectedReview.status === "appeal") && (
                  <>
                    <Button
                      onClick={() => handleConfirm(selectedReview.id, selectedReview.mover_id, selectedReview.invoice_number)}
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
                <Button variant="outline" onClick={() => setSelectedReview(null)} className={(selectedReview.status === "pending" || selectedReview.status === "appeal") ? "" : "w-full"}>
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
