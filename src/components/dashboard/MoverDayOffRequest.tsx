import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { handleError } from "@/lib/errorHandler";
import {
  DAY_OFF_REASON_KEYS,
  dayOffReasonLabels,
  dayOffTranslations,
  getReasonLabel,
  type DayOffLanguage,
} from "@/lib/dayOffTranslations";

interface MoverDayOffRequestProps {
  userId: string;
  language: DayOffLanguage;
}

const MoverDayOffRequest = ({ userId, language }: MoverDayOffRequestProps) => {
  const t = dayOffTranslations[language] ?? dayOffTranslations.en;
  const reasonLabels = dayOffReasonLabels[language] ?? dayOffReasonLabels.en;

  const [showForm, setShowForm] = useState(false);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; email: string } | null>(null);
  const [requests, setRequests] = useState<any[]>([]);

  const [isRange, setIsRange] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [reasonKey, setReasonKey] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const moverName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("day_off_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("request_type", "mover")
      .order("created_at", { ascending: false });
    setRequests(data || []);
  }, [userId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .maybeSingle();
      setProfile(data as any);
    })();
    fetchRequests();
  }, [userId, fetchRequests]);

  const resetForm = () => {
    setIsRange(false);
    setStartDate(undefined);
    setEndDate(undefined);
    setReasonKey("");
    setOtherReason("");
    setComment("");
  };

  const handleSubmit = async () => {
    const finalEnd = isRange ? endDate : startDate;
    if (!startDate || !finalEnd || !reasonKey || !comment.trim() || (reasonKey === "other" && !otherReason.trim())) {
      toast.error(t.fillAll);
      return;
    }
    if (finalEnd < startDate) {
      toast.error(t.invalidRange);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("day_off_requests").insert({
        user_id: userId,
        user_name: moverName || "Mover",
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(finalEnd, "yyyy-MM-dd"),
        request_type: "mover",
        reason_category: reasonKey,
        reason_other: reasonKey === "other" ? otherReason.trim() : null,
        comment: comment.trim(),
        submitted_language: language,
        reason: reasonKey === "other" ? otherReason.trim() : dayOffReasonLabels.en[reasonKey as keyof typeof dayOffReasonLabels.en],
      });
      if (error) throw error;

      try {
        await supabase.functions.invoke("send-shift-notification", {
          body: {
            type: "mover_day_off_request",
            userName: moverName,
            startDate: format(startDate, "PPP"),
            endDate: format(finalEnd, "PPP"),
            reason: dayOffReasonLabels.en[reasonKey as keyof typeof dayOffReasonLabels.en],
            otherReason: reasonKey === "other" ? otherReason.trim() : null,
            comment: comment.trim(),
            submittedLanguage: language,
          },
        });
      } catch {
        /* non-critical */
      }

      toast.success(t.success);
      resetForm();
      setShowForm(false);
      fetchRequests();
    } catch (e: any) {
      toast.error(handleError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "alternative_proposed") return <Badge variant="secondary">{t.altPending}</Badge>;
    const label = status === "approved" ? t.approved : status === "declined" ? t.declined : t.pending;
    const variant = status === "approved" ? "default" : status === "declined" ? "destructive" : "secondary";
    return <Badge variant={variant as any}>{label}</Badge>;
  };

  const respondToAlternative = async (request: any, accept: boolean, reason?: string) => {
    setRespondingId(request.id);
    try {
      const { error } = await supabase.rpc("respond_day_off_alternative", {
        _request_id: request.id,
        _accept: accept,
        _reason: reason ?? null,
      } as any);
      if (error) throw error;

      try {
        await supabase.functions.invoke("send-shift-notification", {
          body: {
            type: accept ? "day_off_alternative_accepted" : "day_off_alternative_declined",
            userName: moverName || request.user_name,
            startDate: request.start_date,
            endDate: request.end_date,
            altStartDate: request.alt_start_date,
            altEndDate: request.alt_end_date,
            reason: reason ?? null,
          },
        });
      } catch {
        /* non-critical */
      }

      toast.success(accept ? t.altAccepted : t.altDeclined);
      setDeclineAltFor(null);
      setAltDeclineReason("");
      fetchRequests();
    } catch (e: any) {
      toast.error(handleError(e));
    } finally {
      setRespondingId(null);
    }
  };


  return (
    <div className="space-y-6">
      {!showForm && (
        <Card className="p-6">
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t.newRequest}
          </Button>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {t.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border-2 border-primary/40 bg-primary/10 p-4 text-sm font-medium text-foreground">
              {t.description}
            </div>

            <div className="space-y-2">
              <Label>{t.moverName} *</Label>
              <Input value={moverName} readOnly disabled />
            </div>

            <div className="space-y-2">
              <Label>{t.requestType} *</Label>
              <Select
                value={isRange ? "range" : "single"}
                onValueChange={(v) => {
                  setIsRange(v === "range");
                  setEndDate(undefined);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="single">{t.singleDate}</SelectItem>
                  <SelectItem value="range">{t.dateRange}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={cn("grid gap-4", isRange && "sm:grid-cols-2")}>
              <div className="space-y-2">
                <Label>{isRange ? t.startDate : t.date} *</Label>
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : t.pickDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => {
                        setStartDate(d);
                        setStartOpen(false);
                      }}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {isRange && (
                <div className="space-y-2">
                  <Label>{t.endDate} *</Label>
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : t.pickDate}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(d) => {
                          setEndDate(d);
                          setEndOpen(false);
                        }}
                        disabled={startDate ? { before: startDate } : undefined}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t.reason} *</Label>
              <Select value={reasonKey} onValueChange={setReasonKey}>
                <SelectTrigger>
                  <SelectValue placeholder={t.selectReason} />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-72">
                  {DAY_OFF_REASON_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {reasonLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reasonKey === "other" && (
              <div className="space-y-2">
                <Label>{t.otherReason} *</Label>
                <Input
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value.slice(0, 300))}
                  placeholder={t.otherReasonPlaceholder}
                  maxLength={300}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t.comment} *</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 2000))}
                placeholder={t.commentPlaceholder}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                disabled={submitting}
              >
                {t.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? t.submitting : t.submit}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.myRequests}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">{t.noRequests}</p>}
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {r.start_date === r.end_date ? r.start_date : `${r.start_date} — ${r.end_date}`}
                </span>
                {statusBadge(r.status)}
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t.reason}: </span>
                {r.reason_category === "other"
                  ? r.reason_other
                  : getReasonLabel(r.reason_category, language) || r.reason}
              </p>
              {r.comment && (
                <p className="text-sm whitespace-pre-wrap">
                  <span className="text-muted-foreground">{t.comment}: </span>
                  {r.comment}
                </p>
              )}
              {r.status === "declined" && r.decline_reason && (
                <p className="text-sm text-destructive whitespace-pre-wrap">
                  <span className="font-medium">{t.declineReason}: </span>
                  {r.decline_reason}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t.submittedOn}: {format(new Date(r.created_at), "PPp")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default MoverDayOffRequest;
