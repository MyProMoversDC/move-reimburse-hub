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

interface MissingPaymentFormProps {
  userId: string;
  onSuccess: () => void;
  language: DashboardLanguage;
}

const discrepancyOptions = [
  { value: "missing_hours", label: "Missing Hours" },
  { value: "incorrect_hourly_rate", label: "Incorrect Hourly Rate" },
  { value: "missing_tip", label: "Missing Tip" },
  { value: "missing_bonus", label: "Missing Bonus" },
  { value: "other", label: "Other" },
] as const;

type DiscrepancyType = typeof discrepancyOptions[number]["value"];

const MissingPaymentForm = ({ userId, onSuccess, language }: MissingPaymentFormProps) => {
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
      toast.error("Please enter your full name");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Please enter the customer's name");
      return;
    }
    if (!jobNumber.trim()) {
      toast.error("Please enter the job or invoice number");
      return;
    }
    if (!discrepancyDate) {
      toast.error("Please select the date of discrepancy");
      return;
    }
    if (selectedDiscrepancies.length === 0) {
      toast.error("Please select at least one discrepancy type");
      return;
    }
    if (!discrepancyDetails.trim()) {
      toast.error("Please explain the discrepancy in detail");
      return;
    }
    if (!missingAmount.trim()) {
      toast.error("Please enter the missing amount");
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

      toast.success("Missing payment request submitted successfully");
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
        <Label htmlFor="fullName">What is your full name? *</Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Enter your full name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerName">What is the customer's name associated with this job? *</Label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Enter customer's name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobNumber">What is the job or invoice number? *</Label>
        <Input
          id="jobNumber"
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          placeholder="Enter job or invoice number"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>What is the date of the discrepancy you are requesting to be reviewed? *</Label>
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
              {discrepancyDate ? format(discrepancyDate, "MM/dd/yyyy") : "Select date"}
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
        <Label>What do you believe is incorrect? (Choose all that apply) *</Label>
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
          Please explain the discrepancy in detail. Be as specific as possible (include dates, jobs, and any relevant information) *
        </Label>
        <Textarea
          id="discrepancyDetails"
          value={discrepancyDetails}
          onChange={(e) => setDiscrepancyDetails(e.target.value)}
          placeholder="Provide detailed explanation..."
          rows={5}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="missingAmount">
          What is the total number of hours and/or dollar amount you believe is missing or incorrect? *
        </Label>
        <Input
          id="missingAmount"
          value={missingAmount}
          onChange={(e) => setMissingAmount(e.target.value)}
          placeholder="e.g., 3 hours or $150"
          required
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit Missing Payment Request
      </Button>
    </form>
  );
};

export default MissingPaymentForm;
