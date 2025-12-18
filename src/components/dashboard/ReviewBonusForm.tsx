import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reviewBonusTranslations, ReviewBonusLanguage } from "@/lib/reviewBonusTranslations";
import { handleError, handleUploadError } from "@/lib/errorHandler";

// File validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface ReviewBonusFormProps {
  userId: string;
  foremanName: string;
  onSuccess: () => void;
  language: ReviewBonusLanguage;
}

const ReviewBonusForm = ({ userId, foremanName, onSuccess, language }: ReviewBonusFormProps) => {
  const t = reviewBonusTranslations[language];
  
  const [loading, setLoading] = useState(false);
  const [jobDate, setJobDate] = useState<Date>();
  const [clientFullName, setClientFullName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [crewMembers, setCrewMembers] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [reviewUrl, setReviewUrl] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);

  const handleCrewMemberChange = (index: number, value: string) => {
    const newCrewMembers = [...crewMembers];
    newCrewMembers[index] = value;
    setCrewMembers(newCrewMembers);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large (max 5MB)`;
    }
    if (!VALID_FILE_TYPES.includes(file.type)) {
      return `Invalid file type. Please use JPEG, PNG, GIF, or WebP.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        e.target.value = '';
        return;
      }
      setScreenshotFile(file);
    }
  };

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobDate) {
      toast.error("Please select a job date");
      return;
    }

    if (!clientFullName.trim()) {
      toast.error("Client full name is required");
      return;
    }

    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }

    // Check for duplicate invoice number
    const { data: existingInvoice, error: checkError } = await supabase
      .from("review_bonuses")
      .select("id")
      .eq("invoice_number", invoiceNumber.trim())
      .maybeSingle();

    if (checkError) {
      console.error("Error checking invoice number:", checkError);
      toast.error("Failed to validate invoice number. Please try again.");
      return;
    }

    if (existingInvoice) {
      toast.error("This invoice number has already been submitted. Each invoice number can only be used once.");
      return;
    }

    if (!crewMembers[0].trim() || !crewMembers[1].trim() || !crewMembers[2].trim()) {
      toast.error("First 3 crew members are required");
      return;
    }

    if (!screenshotFile) {
      toast.error(t.screenshotRequired);
      return;
    }

    setLoading(true);

    try {
      // Upload screenshot
      const fileExt = screenshotFile.name.split(".").pop();
      const safeFilename = sanitizeFilename(screenshotFile.name);
      const fileName = `${userId}/${Date.now()}_${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("review-screenshots")
        .upload(fileName, screenshotFile);

      if (uploadError) throw uploadError;

      const screenshotUrl = `review-screenshots/${fileName}`;
      const reviewMonth = format(jobDate, "yyyy-MM");

      // Insert review bonus record
      const { error: insertError } = await supabase
        .from("review_bonuses")
        .insert({
          mover_id: userId,
          foreman_name: foremanName,
          job_date: format(jobDate, "yyyy-MM-dd"),
          client_full_name: clientFullName.trim(),
          invoice_number: invoiceNumber.trim(),
          crew_member_1: crewMembers[0].trim(),
          crew_member_2: crewMembers[1].trim(),
          crew_member_3: crewMembers[2].trim(),
          crew_member_4: crewMembers[3].trim() || null,
          crew_member_5: crewMembers[4].trim() || null,
          crew_member_6: crewMembers[5].trim() || null,
          crew_member_7: crewMembers[6].trim() || null,
          crew_member_8: crewMembers[7].trim() || null,
          review_url: reviewUrl.trim() || null,
          screenshot_url: screenshotUrl,
          review_month: reviewMonth,
        });

      if (insertError) {
        // Check if it's a unique constraint violation
        if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          throw new Error('DUPLICATE_INVOICE');
        }
        throw insertError;
      }

      toast.success(t.successMessage);
      onSuccess();
    } catch (error: unknown) {
      console.error("Error submitting review:", error);
      
      // Check for duplicate invoice error
      if (error instanceof Error && error.message === 'DUPLICATE_INVOICE') {
        toast.error("This invoice number has already been submitted. Each invoice number can only be used once.");
        return;
      }
      
      if (error && typeof error === 'object' && 'message' in error) {
        const msg = (error as { message: string }).message.toLowerCase();
        if (msg.includes('storage') || msg.includes('upload') || msg.includes('file')) {
          toast.error(handleUploadError(error));
        } else {
          toast.error(handleError(error));
        }
      } else {
        toast.error(handleError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Instructions */}
      <div className="bg-muted p-4 rounded-lg">
        <p className="whitespace-pre-line text-sm">{t.instructions}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Job Date */}
        <div className="space-y-2">
          <Label>{t.jobDate} *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !jobDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {jobDate ? format(jobDate, "MM/dd/yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={jobDate}
                onSelect={setJobDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Invoice Number */}
        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">{t.invoiceNumber} *</Label>
          <Input
            id="invoiceNumber"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Client Full Name */}
      <div className="space-y-2">
        <Label htmlFor="clientFullName">{t.clientFullName} *</Label>
        <Input
          id="clientFullName"
          value={clientFullName}
          onChange={(e) => setClientFullName(e.target.value)}
          placeholder={t.clientFullNamePlaceholder}
          required
        />
      </div>

      {/* Crew Members */}
      <div className="space-y-4">
        <Label>{t.crewMember}</Label>
        <div className="grid gap-3 md:grid-cols-2">
          {crewMembers.map((member, index) => (
            <div key={index} className="space-y-1">
              <Label htmlFor={`crew-${index}`} className="text-sm text-muted-foreground">
                {t.crewMember} {index + 1} {index < 3 ? t.required : t.optional}
              </Label>
              <Input
                id={`crew-${index}`}
                value={member}
                onChange={(e) => handleCrewMemberChange(index, e.target.value)}
                required={index < 3}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Review URL */}
      <div className="space-y-2">
        <Label htmlFor="reviewUrl">{t.reviewUrl}</Label>
        <Input
          id="reviewUrl"
          type="url"
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder={t.reviewUrlPlaceholder}
        />
      </div>

      {/* Screenshot Upload */}
      <div className="space-y-2">
        <Label htmlFor="screenshot">{t.screenshotUpload} * (Max 5MB, JPEG/PNG/GIF/WebP)</Label>
        <Input
          id="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          required
        />
        {screenshotFile && (
          <p className="text-sm text-muted-foreground">{screenshotFile.name}</p>
        )}
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? t.submitting : t.submit}
      </Button>
    </form>
  );
};

export default ReviewBonusForm;
