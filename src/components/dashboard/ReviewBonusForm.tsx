import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarWithClose } from "@/components/ui/calendar-with-close";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reviewBonusTranslations, ReviewBonusLanguage } from "@/lib/reviewBonusTranslations";
import { handleError } from "@/lib/errorHandler";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [clientFullName, setClientFullName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [crewMembers, setCrewMembers] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [reviewUrl, setReviewUrl] = useState("");
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateAlertMessage, setDuplicateAlertMessage] = useState("");

  const handleCrewMemberChange = (index: number, value: string) => {
    const newCrewMembers = [...crewMembers];
    newCrewMembers[index] = value;
    setCrewMembers(newCrewMembers);
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

    if (!reviewUrl.trim()) {
      toast.error("Review URL is required");
      return;
    }

    // Check for duplicate invoice number
    const { data: existingInvoice, error: invoiceCheckError } = await supabase
      .from("review_bonuses")
      .select("id")
      .eq("invoice_number", invoiceNumber.trim())
      .maybeSingle();

    if (invoiceCheckError) {
      console.error("Error checking invoice number:", invoiceCheckError);
      toast.error("Failed to validate invoice number. Please try again.");
      return;
    }

    if (existingInvoice) {
      setDuplicateAlertMessage(
        language === 'en' 
          ? "This Invoice Number has already been submitted. Each invoice number can only be used once. Please check the invoice number and try again."
          : language === 'es'
          ? "Este número de factura ya ha sido enviado. Cada número de factura solo se puede usar una vez. Por favor verifique el número de factura e intente nuevamente."
          : "Этот номер счета уже был отправлен. Каждый номер счета можно использовать только один раз. Пожалуйста, проверьте номер счета и попробуйте снова."
      );
      setShowDuplicateAlert(true);
      return;
    }

    // Check for duplicate URL
    const { data: existingUrl, error: urlCheckError } = await supabase
      .from("review_bonuses")
      .select("id")
      .eq("review_url", reviewUrl.trim())
      .maybeSingle();

    if (urlCheckError) {
      console.error("Error checking review URL:", urlCheckError);
      toast.error("Failed to validate review URL. Please try again.");
      return;
    }

    if (existingUrl) {
      setDuplicateAlertMessage(
        language === 'en' 
          ? "This Review URL has already been submitted. Each review URL can only be used once. Please check the URL and try again."
          : language === 'es'
          ? "Esta URL de reseña ya ha sido enviada. Cada URL de reseña solo se puede usar una vez. Por favor verifique la URL e intente nuevamente."
          : "Эта ссылка на отзыв уже была отправлена. Каждую ссылку можно использовать только один раз. Пожалуйста, проверьте ссылку и попробуйте снова."
      );
      setShowDuplicateAlert(true);
      return;
    }

    // Only first 2 crew members are required
    if (!crewMembers[0].trim() || !crewMembers[1].trim()) {
      toast.error("First 2 crew members are required");
      return;
    }

    setLoading(true);

    try {
      const reviewMonth = format(jobDate, "yyyy-MM");

      // Insert review bonus record with placeholder screenshot URL
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
          crew_member_3: crewMembers[2].trim() || null,
          crew_member_4: crewMembers[3].trim() || null,
          crew_member_5: crewMembers[4].trim() || null,
          crew_member_6: crewMembers[5].trim() || null,
          crew_member_7: crewMembers[6].trim() || null,
          crew_member_8: crewMembers[7].trim() || null,
          review_url: reviewUrl.trim(),
          screenshot_url: "no-screenshot",
          review_month: reviewMonth,
        });

      if (insertError) {
        // Check if it's a unique constraint violation
        if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          setDuplicateAlertMessage(
            language === 'en' 
              ? "This submission contains a duplicate Invoice Number or Review URL that has already been submitted."
              : language === 'es'
              ? "Esta presentación contiene un número de factura o URL de reseña duplicado que ya ha sido enviado."
              : "Эта заявка содержит дублирующийся номер счета или ссылку на отзыв, которые уже были отправлены."
          );
          setShowDuplicateAlert(true);
          return;
        }
        throw insertError;
      }

      toast.success(t.successMessage);
      onSuccess();
    } catch (error: unknown) {
      console.error("Error submitting review:", error);
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Description */}
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Submit this form after a customer leaves a review for your service. Include all crew members who participated in the job. Each approved review qualifies crew members for a potential bonus. Note: Each invoice number and review URL can only be submitted once.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-muted p-4 rounded-lg">
          <p className="whitespace-pre-line text-sm">{t.instructions}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Job Date */}
          <div className="space-y-2">
            <Label>{t.jobDate} *</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
                <CalendarWithClose
                  mode="single"
                  selected={jobDate}
                  onDateSelect={setJobDate}
                  onClose={() => setDatePickerOpen(false)}
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
                  {t.crewMember} {index + 1} {index < 2 ? t.required : t.optional}
                </Label>
                <Input
                  id={`crew-${index}`}
                  value={member}
                  onChange={(e) => handleCrewMemberChange(index, e.target.value)}
                  required={index < 2}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Review URL */}
        <div className="space-y-2">
          <Label htmlFor="reviewUrl">{t.reviewUrl} *</Label>
          <Input
            id="reviewUrl"
            type="url"
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder={t.reviewUrlPlaceholder}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t.submitting : t.submit}
        </Button>
      </form>

      {/* Duplicate Alert Dialog */}
      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {language === 'en' ? "Duplicate Submission Detected" : language === 'es' ? "Envío duplicado detectado" : "Обнаружена дублирующаяся заявка"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {duplicateAlertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicateAlert(false)}>
              {language === 'en' ? "Understood" : language === 'es' ? "Entendido" : "Понятно"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReviewBonusForm;
