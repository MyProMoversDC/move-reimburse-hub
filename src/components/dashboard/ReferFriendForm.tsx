import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Upload, X, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { referralTranslations } from "@/lib/referralTranslations";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReferFriendFormProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
  onSuccess: () => void;
  onCancel: () => void;
}

const ReferFriendForm = ({ userId, language, onSuccess, onCancel }: ReferFriendFormProps) => {
  const t = referralTranslations[language];
  const [moverName, setMoverName] = useState("");
  const [referredName, setReferredName] = useState("");
  const [position, setPosition] = useState<string>("");
  const [availableDate, setAvailableDate] = useState<Date>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setMoverName(`${data.first_name} ${data.last_name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referredName.trim() || !position || !availableDate) return;
    if (position === "driver" && !licenseFile) {
      toast.error(t.licenseRequired);
      return;
    }

    setSubmitting(true);
    try {
      let licenseUrl = null;
      let licenseFileName = null;

      if (licenseFile) {
        const fileExt = licenseFile.name.split(".").pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("referral-licenses")
          .upload(filePath, licenseFile);
        if (uploadError) throw uploadError;
        licenseUrl = filePath;
        licenseFileName = licenseFile.name;
      }

      const { error } = await supabase
        .from("referral_requests" as any)
        .insert({
          referrer_id: userId,
          referrer_name: moverName,
          referred_name: referredName.trim(),
          referred_position: position,
          available_date: format(availableDate, "yyyy-MM-dd"),
          license_url: licenseUrl,
          license_file_name: licenseFileName,
        } as any);

      if (error) throw error;

      // Send notification email
      await supabase.functions.invoke("send-referral-notification", {
        body: {
          type: "new_referral",
          referrerName: moverName,
          referredName: referredName.trim(),
          position: position === "driver" ? "Driver" : "Moving Helper",
          availableDate: format(availableDate, "MM/dd/yyyy"),
        },
      });

      toast.success(t.submitted);
      onSuccess();
    } catch (error: any) {
      console.error("Error submitting referral:", error);
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.referralForm}</CardTitle>
        <CardDescription>
          <Alert className="mt-2">
            <Info className="h-4 w-4" />
            <AlertDescription>{t.disclaimer}</AlertDescription>
          </Alert>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t.yourName}</Label>
            <Input value={moverName} disabled />
          </div>

          <div className="space-y-2">
            <Label>{t.referredPersonName}</Label>
            <Input
              value={referredName}
              onChange={(e) => setReferredName(e.target.value)}
              placeholder={t.namePlaceholder}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t.referredPosition}</Label>
            <Select value={position} onValueChange={setPosition} required>
              <SelectTrigger>
                <SelectValue placeholder={t.referredPosition} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">{t.driver}</SelectItem>
                <SelectItem value="moving_helper">{t.movingHelper}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.availableDate}</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !availableDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {availableDate ? format(availableDate, "PPP") : t.selectDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={availableDate}
                  onSelect={(date) => { setAvailableDate(date); setCalendarOpen(false); }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {position === "driver" && (
            <div className="space-y-2">
              <Label>{t.driversLicense}</Label>
              {licenseFile ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                  <span className="text-sm truncate flex-1">{licenseFile.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLicenseFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t.uploadLicense}</p>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setLicenseFile(e.target.files[0]);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? t.submitting : t.submit}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReferFriendForm;
