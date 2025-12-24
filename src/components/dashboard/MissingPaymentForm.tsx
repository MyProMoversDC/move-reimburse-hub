import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";

interface MissingPaymentFormProps {
  userId: string;
  onSuccess: () => void;
  language: DashboardLanguage;
}

type DiscrepancyType = "missing_hours" | "incorrect_hourly_rate" | "missing_tip" | "missing_bonus" | "other";

const MissingPaymentForm = ({ userId, onSuccess, language }: MissingPaymentFormProps) => {
  const t = missingPaymentTranslations[language];
  
  const discrepancyOptions: { value: DiscrepancyType; label: string }[] = [
    { value: "missing_hours", label: t.missingHours },
    { value: "incorrect_hourly_rate", label: t.incorrectHourlyRate },
    { value: "missing_tip", label: t.missingTip },
    { value: "missing_bonus", label: t.missingBonus },
    { value: "other", label: t.other },
  ];

  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [discrepancyDate, setDiscrepancyDate] = useState<Date | undefined>();
  const [selectedDiscrepancies, setSelectedDiscrepancies] = useState<DiscrepancyType[]>([]);
  const [discrepancyDetails, setDiscrepancyDetails] = useState("");
  const [missingAmount, setMissingAmount] = useState("");

  const handleDiscrepancyToggle = (value: DiscrepancyType) => {
    setSelectedDiscrepancies((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error(t.errorFullName);
      return;
    }
    if (!customerName.trim()) {
      toast.error(t.errorCustomerName);
      return;
    }
    if (!jobNumber.trim()) {
      toast.error(t.errorJobNumber);
      return;
    }
    if (!discrepancyDate) {
      toast.error(t.errorDiscrepancyDate);
      return;
    }
    if (selectedDiscrepancies.length === 0) {
      toast.error(t.errorDiscrepancyType);
      return;
    }
    if (!discrepancyDetails.trim()) {
      toast.error(t.errorDiscrepancyDetails);
      return;
    }
    if (!missingAmount.trim()) {
      toast.error(t.errorMissingAmount);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("missing_payments").insert({
        mover_id: userId,
        mover_full_name: fullName.trim(),
        customer_name: customerName.trim(),
        job_number: jobNumber.trim(),
        discrepancy_date: format(discrepancyDate, "yyyy-MM-dd"),
        discrepancy_types: selectedDiscrepancies,
        discrepancy_details: discrepancyDetails.trim(),
        missing_amount: missingAmount.trim(),
      });

      if (error) throw error;

      toast.success(t.submitSuccess);
      onSuccess();
    } catch (error: any) {
      console.error("Error submitting missing payment:", error);
      toast.error(error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t.fullNameQuestion} *</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t.fullNamePlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerName">{t.customerNameQuestion} *</Label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={t.customerNamePlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobNumber">{t.jobNumberQuestion} *</Label>
        <Input
          id="jobNumber"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder={t.jobNumberPlaceholder}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>{t.discrepancyDateQuestion} *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !discrepancyDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {discrepancyDate ? format(discrepancyDate, "MM/dd/yyyy") : t.selectDate}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={discrepancyDate}
              onSelect={setDiscrepancyDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>{t.discrepancyTypeQuestion} *</Label>
        <div className="space-y-3 mt-2">
          {discrepancyOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={option.value}
                checked={selectedDiscrepancies.includes(option.value)}
                onCheckedChange={() => handleDiscrepancyToggle(option.value)}
              />
              <Label htmlFor={option.value} className="font-normal cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discrepancyDetails">
          {t.discrepancyDetailsQuestion} *
        </Label>
        <Textarea
          id="discrepancyDetails"
          value={discrepancyDetails}
          onChange={(e) => setDiscrepancyDetails(e.target.value)}
          placeholder={t.discrepancyDetailsPlaceholder}
          rows={5}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="missingAmount">
          {t.missingAmountQuestion} *
        </Label>
        <Input
          id="missingAmount"
          value={missingAmount}
          onChange={(e) => setMissingAmount(e.target.value)}
          placeholder={t.missingAmountPlaceholder}
          required
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? t.submitting : t.submitButton}
      </Button>
    </form>
  );
};

export default MissingPaymentForm;
