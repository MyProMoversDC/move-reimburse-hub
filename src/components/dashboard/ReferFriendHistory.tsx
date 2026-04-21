import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInDays, addMonths } from "date-fns";
import { referralTranslations } from "@/lib/referralTranslations";
import { Gift, Clock } from "lucide-react";

interface ReferFriendHistoryProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
  refreshKey: number;
}

const ReferFriendHistory = ({ userId, language, refreshKey }: ReferFriendHistoryProps) => {
  const t = referralTranslations[language];
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferrals();
  }, [userId, refreshKey]);

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from("referral_requests" as any)
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReferrals(data || []);
    } catch (error) {
      console.error("Error fetching referrals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (referral: any) => {
    try {
      const { error } = await supabase
        .from("referral_requests" as any)
        .update({ 
          status: "bonus_claimed", 
          bonus_claimed_at: new Date().toISOString() 
        } as any)
        .eq("id", referral.id);

      if (error) throw error;

      // Notify admin
      await supabase.functions.invoke("send-referral-notification", {
        body: {
          type: "bonus_claimed",
          referrerName: referral.referrer_name,
          referredName: referral.referred_name,
          position: referral.referred_position === "driver" ? "Driver" : "Moving Helper",
          bonusAmount: referral.bonus_amount,
        },
      });

      toast.success(t.rewardClaimed);
      fetchReferrals();
    } catch (error: any) {
      console.error("Error claiming reward:", error);
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: t.pending },
      approved: { variant: "default", label: t.approved },
      declined: { variant: "destructive", label: t.declined },
      bonus_eligible: { variant: "outline", label: t.bonusEligible },
      bonus_claimed: { variant: "secondary", label: t.bonusClaimed },
      bonus_paid: { variant: "default", label: t.bonusPaid },
    };
    const s = variants[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const getCountdown = (referral: any) => {
    if (referral.status !== "approved" || !referral.admin_start_date) return null;
    const bonusDate = addMonths(new Date(referral.admin_start_date), 3);
    const daysLeft = differenceInDays(bonusDate, new Date());
    if (daysLeft <= 0) return null;
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Clock className="h-3 w-3" />
        {daysLeft} {t.days}
      </div>
    );
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  if (referrals.length === 0) {
    return <p className="text-muted-foreground text-center py-4">{t.noReferrals}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.referralHistory}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.referredName}</TableHead>
                <TableHead>{t.position}</TableHead>
                <TableHead>{t.dateSubmitted}</TableHead>
                <TableHead>{t.startDate}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead>{t.hiringStage}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.referred_name}</TableCell>
                  <TableCell>{r.referred_position === "driver" ? t.driver : t.movingHelper}</TableCell>
                  <TableCell>{format(new Date(r.created_at), "MM/dd/yyyy")}</TableCell>
                  <TableCell>
                    {r.admin_start_date ? format(new Date(r.admin_start_date), "MM/dd/yyyy") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(r.status)}
                      {getCountdown(r)}
                      {r.status === "declined" && r.decline_reason && (
                        <p className="text-xs text-destructive">{r.decline_reason}</p>
                      )}
                      {r.status === "bonus_paid" && r.bonus_amount && (
                        <p className="text-xs text-green-600 font-medium">${r.bonus_amount}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.hiring_stage ? (
                      <Badge variant="outline">{t[`stage_${r.hiring_stage}` as keyof typeof t] || r.hiring_stage}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "bonus_eligible" && (
                      <Button size="sm" onClick={() => handleClaimReward(r)} className="gap-1">
                        <Gift className="h-3 w-3" />
                        {t.claimReward}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferFriendHistory;
