import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResponsiveDialog from "@/components/mobile/ResponsiveDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, Check, X, Languages, Loader2, CalendarClock, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/errorHandler";
import { getReasonLabel } from "@/lib/dayOffTranslations";

interface AdminDayOffRequestsProps {
  userId: string;
  onUpdate?: () => void;
}

const statusVariant = (status: string) =>
  status === "approved" ? "default" : status === "declined" ? "destructive" : "secondary";

const statusLabel = (status: string) =>
  status === "alternative_proposed" ? "awaiting mover response" : status;

const langLabel: Record<string, string> = { en: "English", es: "Spanish", ru: "Russian" };

const AdminDayOffRequests = ({ userId, onUpdate }: AdminDayOffRequestsProps) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "alternative_proposed" | "approved" | "declined" | "all">("pending");
  const [selected, setSelected] = useState<any>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<{ reason: string; comment: string } | null>(null);
  const [altOpen, setAltOpen] = useState(false);
  const [altRange, setAltRange] = useState(false);
  const [altStart, setAltStart] = useState<Date | undefined>();
  const [altEnd, setAltEnd] = useState<Date | undefined>();
  const [altStartOpen, setAltStartOpen] = useState(false);
  const [altEndOpen, setAltEndOpen] = useState(false);
  const [altNote, setAltNote] = useState("");


  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("day_off_requests")
      .select("*")
      .eq("request_type", "mover")
      .order("created_at", { ascending: false });
    const list = data || [];
    setRequests(list);

    const ids = [...new Set(list.map((r: any) => r.user_id))];
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", ids);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        map[p.id] = p.email;
      });
      setEmails(map);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filtered = useMemo(
    () => (filter === "all" ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter],
  );
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const altCount = requests.filter((r) => r.status === "alternative_proposed").length;


  const openDetails = (r: any) => {
    setSelected(r);
    setTranslated(null);
    setDeclineReason("");
  };

  const reasonText = (r: any) =>
    r.reason_category === "other" ? r.reason_other || r.reason : getReasonLabel(r.reason_category, "en") || r.reason;

  const handleTranslate = async () => {
    if (!selected) return;
    setTranslating(true);
    try {
      const texts = [selected.reason_category === "other" ? selected.reason_other || "" : "", selected.comment || ""];
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: { texts, targetLanguage: "en" },
      });
      if (error) throw error;
      const out = data?.translations || texts;
      setTranslated({ reason: out[0] || "", comment: out[1] || "" });
    } catch (e: any) {
      toast.error(handleError(e));
    } finally {
      setTranslating(false);
    }
  };

  const notify = async (type: string, r: any, reason?: string) => {
    try {
      await supabase.functions.invoke("send-shift-notification", {
        body: {
          type,
          userEmail: emails[r.user_id],
          userName: r.user_name,
          startDate: r.start_date,
          endDate: r.end_date,
          reason,
        },
      });
    } catch {
      /* non-critical */
    }
  };

  const handleApprove = async (r: any) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("day_off_requests")
        .update({ status: "approved" as any, reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
      await notify("day_off_approved", r);
      toast.success("Day off request approved");
      setSelected(null);
      fetchRequests();
      onUpdate?.();
    } catch (e: any) {
      toast.error(handleError(e));
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selected || !declineReason.trim()) {
      toast.error("A reason for decline is required");
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("day_off_requests")
        .update({
          status: "declined" as any,
          decline_reason: declineReason.trim(),
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) throw error;
      await notify("day_off_declined", selected, declineReason.trim());
      toast.success("Day off request declined");
      setDeclineOpen(false);
      setSelected(null);
      setDeclineReason("");
      fetchRequests();
      onUpdate?.();
    } catch (e: any) {
      toast.error(handleError(e));
    } finally {
      setProcessing(false);
    }
  };

  const openAltDialog = () => {
    setAltRange(false);
    setAltStart(undefined);
    setAltEnd(undefined);
    setAltNote("");
    setAltOpen(true);
  };

  const handleProposeAlternative = async () => {
    if (!selected) return;
    const finalEnd = altRange ? altEnd : altStart;
    if (!altStart || !finalEnd) {
      toast.error("Please select the alternative date(s)");
      return;
    }
    if (finalEnd < altStart) {
      toast.error("End date cannot be before start date");
      return;
    }
    setProcessing(true);
    try {
      const altStartStr = format(altStart, "yyyy-MM-dd");
      const altEndStr = format(finalEnd, "yyyy-MM-dd");
      const { error } = await supabase
        .from("day_off_requests")
        .update({
          status: "alternative_proposed" as any,
          alt_start_date: altStartStr,
          alt_end_date: altEndStr,
          alt_note: altNote.trim() || null,
          alt_proposed_by: userId,
          alt_proposed_at: new Date().toISOString(),
          alt_response: null,
          alt_decline_reason: null,
          alt_responded_at: null,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", selected.id);
      if (error) throw error;

      try {
        await supabase.functions.invoke("send-shift-notification", {
          body: {
            type: "day_off_alternative_proposed",
            userEmail: emails[selected.user_id],
            userName: selected.user_name,
            startDate: selected.start_date,
            endDate: selected.end_date,
            altStartDate: altStartStr,
            altEndDate: altEndStr,
            note: altNote.trim() || null,
          },
        });
      } catch {
        /* non-critical */
      }

      toast.success("Alternative dates submitted to the mover");
      setAltOpen(false);
      setSelected(null);
      fetchRequests();
      onUpdate?.();
    } catch (e: any) {
      toast.error(handleError(e));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Day Off Requests</h2>
        {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending</Badge>}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="alternative_proposed">Alternative proposed ({altCount})</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="declined">Declined</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>


      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{filtered.length} request(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No requests found.</p>}
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0 space-y-1">
                <p className="font-medium truncate">{r.user_name}</p>
                <p className="text-sm text-muted-foreground">
                  {r.start_date === r.end_date ? r.start_date : `${r.start_date} — ${r.end_date}`} · {reasonText(r)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(r.status) as any}>{statusLabel(r.status)}</Badge>
                <Button size="icon" variant="outline" onClick={() => openDetails(r)} aria-label="View details">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title="Day Off Request"
        description={selected ? `Submitted by ${selected.user_name}` : undefined}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Mover: </span>
                {selected.user_name}
              </div>
              <div>
                <span className="text-muted-foreground">Email: </span>
                {emails[selected.user_id] || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Dates: </span>
                {selected.start_date === selected.end_date
                  ? selected.start_date
                  : `${selected.start_date} — ${selected.end_date}`}
              </div>
              <div>
                <span className="text-muted-foreground">Submitted in: </span>
                {langLabel[selected.submitted_language] || "English"}
              </div>
              <div>
                <span className="text-muted-foreground">Reason: </span>
                {reasonText(selected)}
              </div>
              <div className="whitespace-pre-wrap">
                <span className="text-muted-foreground">Comment: </span>
                {selected.comment || "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Submitted: {format(new Date(selected.created_at), "PPp")}
              </div>
            </div>

            {selected.submitted_language && selected.submitted_language !== "en" && (
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={handleTranslate} disabled={translating}>
                  {translating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Languages className="h-4 w-4 mr-2" />}
                  Translate to English
                </Button>
                {translated && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                    {translated.reason && (
                      <p>
                        <span className="text-muted-foreground">Reason (EN): </span>
                        {translated.reason}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">
                      <span className="text-muted-foreground">Comment (EN): </span>
                      {translated.comment}
                    </p>
                  </div>
                )}
              </div>
            )}

            {selected.status === "declined" && selected.decline_reason && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm whitespace-pre-wrap">
                <span className="font-medium">Reason for decline: </span>
                {selected.decline_reason}
              </div>
            )}

            {selected.status === "pending" && (
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <Button variant="destructive" onClick={() => setDeclineOpen(true)} disabled={processing}>
                  <X className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button onClick={() => handleApprove(selected)} disabled={processing}>
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        )}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline Request"
        description="A reason is required and will be emailed to the mover."
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
            <Button variant="outline" onClick={() => setDeclineOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={processing || !declineReason.trim()}>
              Confirm Decline
            </Button>
          </div>
        }
      >
        <Textarea
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value.slice(0, 1000))}
          placeholder="Explain why this request is declined"
          rows={4}
          maxLength={1000}
        />
      </ResponsiveDialog>
    </div>
  );
};

export default AdminDayOffRequests;
