import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Check, X, Eye, Gift } from "lucide-react";

const AdminReferralList = ({ language }: { language: string }) => {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReferral, setSelectedReferral] = useState<any>(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [declineDialog, setDeclineDialog] = useState(false);
  const [bonusDialog, setBonusDialog] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from("referral_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReferrals(data || []);
    } catch (error) {
      console.error("Error fetching referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  const viewLicense = async (referral: any) => {
    if (!referral.license_url) return;
    try {
      const { data } = await supabase.storage
        .from("referral-licenses")
        .createSignedUrl(referral.license_url, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error("Error getting license URL:", error);
    }
  };

  const handleApprove = async () => {
    if (!selectedReferral || !startDate) return;
    setProcessing(true);
    try {
      const bonusAmount = selectedReferral.referred_position === "driver" ? 400 : 300;
      const bonusEligibleAt = addMonths(startDate, 3).toISOString();

      const { error } = await supabase
        .from("referral_requests" as any)
        .update({
          status: "approved",
          admin_start_date: format(startDate, "yyyy-MM-dd"),
          approved_at: new Date().toISOString(),
          bonus_amount: bonusAmount,
          bonus_eligible_at: bonusEligibleAt,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedReferral.id);

      if (error) throw error;

      // Send email to referrer
      await supabase.functions.invoke("send-referral-notification", {
        body: {
          type: "referral_approved",
          referrerName: selectedReferral.referrer_name,
          referredName: selectedReferral.referred_name,
          position: selectedReferral.referred_position === "driver" ? "Driver" : "Moving Helper",
          startDate: format(startDate, "MM/dd/yyyy"),
          referrerId: selectedReferral.referrer_id,
        },
      });

      toast.success("Referral approved!");
      setApproveDialog(false);
      setStartDate(undefined);
      setSelectedReferral(null);
      fetchReferrals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedReferral || !declineReason.trim()) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("referral_requests" as any)
        .update({
          status: "declined",
          declined_at: new Date().toISOString(),
          decline_reason: declineReason.trim(),
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedReferral.id);

      if (error) throw error;
      toast.success("Referral declined");
      setDeclineDialog(false);
      setDeclineReason("");
      setSelectedReferral(null);
      fetchReferrals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveBonusClaim = async () => {
    if (!selectedReferral) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("referral_requests" as any)
        .update({
          status: "bonus_paid",
          bonus_paid_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedReferral.id);

      if (error) throw error;

      // Notify mover
      await supabase.functions.invoke("send-referral-notification", {
        body: {
          type: "bonus_paid",
          referrerName: selectedReferral.referrer_name,
          referredName: selectedReferral.referred_name,
          bonusAmount: selectedReferral.bonus_amount,
          referrerId: selectedReferral.referrer_id,
        },
      });

      toast.success("Bonus approved!");
      setBonusDialog(false);
      setSelectedReferral(null);
      fetchReferrals();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      approved: { variant: "default", label: "Approved" },
      declined: { variant: "destructive", label: "Declined" },
      bonus_eligible: { variant: "outline", label: "Bonus Eligible" },
      bonus_claimed: { variant: "secondary", label: "Bonus Claimed" },
      bonus_paid: { variant: "default", label: "Bonus Paid" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referred Person</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Available Date</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No referral requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  referrals.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.referrer_name}</TableCell>
                      <TableCell>{r.referred_name}</TableCell>
                      <TableCell>{r.referred_position === "driver" ? "Driver" : "Moving Helper"}</TableCell>
                      <TableCell>{format(new Date(r.available_date), "MM/dd/yyyy")}</TableCell>
                      <TableCell>{r.admin_start_date ? format(new Date(r.admin_start_date), "MM/dd/yyyy") : "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(r.status)}
                          {r.bonus_amount && <p className="text-xs text-muted-foreground">${r.bonus_amount}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.license_url && (
                          <Button variant="ghost" size="sm" onClick={() => viewLicense(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => { setSelectedReferral(r); setApproveDialog(true); }}
                              >
                                <Check className="h-3 w-3 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => { setSelectedReferral(r); setDeclineDialog(true); }}
                              >
                                <X className="h-3 w-3 mr-1" /> Decline
                              </Button>
                            </>
                          )}
                          {r.status === "bonus_claimed" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => { setSelectedReferral(r); setBonusDialog(true); }}
                            >
                              <Gift className="h-3 w-3 mr-1" /> Approve Bonus
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Referral</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the start date for <strong>{selectedReferral?.referred_name}</strong>.
              The 3-month countdown will begin from this date.
            </p>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => { setStartDate(d); setCalendarOpen(false); }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={!startDate || processing}>
              {processing ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialog} onOpenChange={setDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Referral</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Reason for Decline</Label>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Please explain why this referral is being declined..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDecline} disabled={!declineReason.trim() || processing}>
              {processing ? "Declining..." : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Bonus Dialog */}
      <Dialog open={bonusDialog} onOpenChange={setBonusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Bonus Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Approve <strong>${selectedReferral?.bonus_amount}</strong> bonus for{" "}
              <strong>{selectedReferral?.referrer_name}</strong> for referring{" "}
              <strong>{selectedReferral?.referred_name}</strong>?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBonusDialog(false)}>Cancel</Button>
            <Button onClick={handleApproveBonusClaim} disabled={processing}>
              {processing ? "Approving..." : "Approve Bonus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReferralList;
