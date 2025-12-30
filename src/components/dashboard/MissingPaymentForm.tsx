import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarWithClose } from "@/components/ui/calendar-with-close";
import { CalendarIcon, Loader2, Upload, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";

interface MissingPaymentFormProps {
  userId: string;
  onSuccess: () => void;
  language: DashboardLanguage;
}

type MissingType = "missing_hours" | "missing_flat_rate";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const MissingPaymentForm = ({ userId, onSuccess, language }: MissingPaymentFormProps) => {
  const t = missingPaymentTranslations[language];
  
  const [loading, setLoading] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [discrepancyDate, setDiscrepancyDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [missingType, setMissingType] = useState<MissingType | "">("");
  const [missingValue, setMissingValue] = useState("");
  const [discrepancyDetails, setDiscrepancyDetails] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  // Auto-pull applicant name from profile
  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();
      
      if (data) {
        setApplicantName(`${data.first_name} ${data.last_name}`);
      }
    };
    fetchProfile();
  }, [userId]);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large (max 10MB)`;
    }
    if (!VALID_FILE_TYPES.includes(file.type)) {
      return `File "${file.name}" is not a valid type. Please use JPEG, PNG, GIF, WebP, or PDF.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      
      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          toast.error(error);
        } else {
          validFiles.push(file);
        }
      }
      
      setAttachmentFiles((prev) => [...prev, ...validFiles]);
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    if (!missingType) {
      toast.error(t.errorMissingType || "Please select either Missing Hours or Missing Flat Rate");
      return;
    }
    if (!missingValue.trim()) {
      toast.error(t.errorMissingAmount);
      return;
    }
    if (!discrepancyDetails.trim()) {
      toast.error(t.errorDiscrepancyDetails);
      return;
    }

    setLoading(true);
    try {
      const discrepancyTypes = [missingType === "missing_hours" ? "missing_hours" : "other"];
      const missingAmount = missingType === "missing_hours" 
        ? `${missingValue} hours` 
        : `$${missingValue}`;

      const { error } = await supabase.from("missing_payments").insert({
        mover_id: userId,
        mover_full_name: applicantName.trim(),
        customer_name: customerName.trim(),
        job_number: jobNumber.trim(),
        discrepancy_date: format(discrepancyDate, "yyyy-MM-dd"),
        discrepancy_types: discrepancyTypes as any,
        discrepancy_details: discrepancyDetails.trim(),
        missing_amount: missingAmount,
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

  const formDescription = {
    en: "Use this form to report any discrepancies in your pay. Please provide as much detail as possible to help us review your request quickly.",
    es: "Utilice este formulario para informar cualquier discrepancia en su pago. Proporcione la mayor cantidad de detalles posible para ayudarnos a revisar su solicitud rápidamente.",
    ru: "Используйте эту форму для сообщения о любых расхождениях в вашей оплате. Пожалуйста, предоставьте как можно больше деталей, чтобы мы могли быстро рассмотреть ваш запрос."
  };

  const descriptionDisclaimer = {
    en: "⚠️ Important: The description must be as detailed as possible, otherwise, the request might be declined due to inadequate information.",
    es: "⚠️ Importante: La descripción debe ser lo más detallada posible, de lo contrario, la solicitud podría ser rechazada debido a información insuficiente.",
    ru: "⚠️ Важно: Описание должно быть максимально подробным, иначе запрос может быть отклонен из-за недостаточной информации."
  };

  const missingTypeLabels = {
    en: { hours: "Missing Hours", flatRate: "Missing Flat Rate" },
    es: { hours: "Horas Faltantes", flatRate: "Tarifa Fija Faltante" },
    ru: { hours: "Недостающие часы", flatRate: "Недостающая фиксированная ставка" }
  };

  const selectTypeLabel = {
    en: "Please select either hours or flat rate that you are missing and let us know how much exactly you are missing *",
    es: "Por favor seleccione ya sea horas o tarifa fija que le falta e indíquenos exactamente cuánto le falta *",
    ru: "Пожалуйста, выберите недостающие часы или фиксированную ставку и укажите точную сумму *"
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Description */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{formDescription[language]}</AlertDescription>
      </Alert>

      {/* Applicant Name - Auto-pulled */}
      <div className="space-y-2">
        <Label>{t.applicantName || "Applicant Name"}</Label>
        <Input
          value={applicantName}
          disabled
          className="bg-muted"
        />
      </div>

      {/* Missing Type Selection */}
      <div className="space-y-2">
        <Label>{selectTypeLabel[language]}</Label>
        <RadioGroup
          value={missingType}
          onValueChange={(value) => {
            setMissingType(value as MissingType);
            setMissingValue("");
          }}
          className="flex flex-col space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="missing_hours" id="missing_hours" />
            <Label htmlFor="missing_hours" className="font-normal cursor-pointer">
              {missingTypeLabels[language].hours}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="missing_flat_rate" id="missing_flat_rate" />
            <Label htmlFor="missing_flat_rate" className="font-normal cursor-pointer">
              {missingTypeLabels[language].flatRate}
            </Label>
          </div>
        </RadioGroup>
        
        {missingType && (
          <div className="mt-3">
            <Label htmlFor="missingValue">
              {missingType === "missing_hours" 
                ? (language === 'en' ? "Number of hours missing *" : language === 'es' ? "Número de horas faltantes *" : "Количество недостающих часов *")
                : (language === 'en' ? "Flat rate amount missing ($) *" : language === 'es' ? "Monto de tarifa fija faltante ($) *" : "Недостающая сумма фиксированной ставки ($) *")
              }
            </Label>
            <Input
              id="missingValue"
              type="number"
              step={missingType === "missing_hours" ? "0.5" : "0.01"}
              min="0"
              value={missingValue}
              onChange={(e) => setMissingValue(e.target.value)}
              placeholder={missingType === "missing_hours" ? "e.g., 3" : "e.g., 150"}
              required
            />
          </div>
        )}
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
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
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
            <CalendarWithClose
              mode="single"
              selected={discrepancyDate}
              onDateSelect={setDiscrepancyDate}
              onClose={() => setDatePickerOpen(false)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
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
        <Label htmlFor="discrepancyDetails">
          {t.discrepancyDetailsQuestion} *
        </Label>
        <Alert className="mb-2 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {descriptionDisclaimer[language]}
          </AlertDescription>
        </Alert>
        <Textarea
          id="discrepancyDetails"
          value={discrepancyDetails}
          onChange={(e) => setDiscrepancyDetails(e.target.value)}
          placeholder={t.discrepancyDetailsPlaceholder}
          rows={5}
          required
        />
      </div>

      {/* Attachments Section */}
      <div className="space-y-2">
        <Label>{language === 'en' ? "Attachments (Optional)" : language === 'es' ? "Archivos adjuntos (Opcional)" : "Вложения (Необязательно)"}</Label>
        <p className="text-sm text-muted-foreground">
          {language === 'en' ? "Max 10MB each, JPEG/PNG/GIF/WebP/PDF" : language === 'es' ? "Máx 10MB cada uno, JPEG/PNG/GIF/WebP/PDF" : "Макс 10МБ каждый, JPEG/PNG/GIF/WebP/PDF"}
        </p>
        <div className="flex items-center gap-2">
          <Input
            id="missingPaymentAttachments"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById("missingPaymentAttachments")?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {language === 'en' ? "Select Files" : language === 'es' ? "Seleccionar archivos" : "Выбрать файлы"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {attachmentFiles.length} {language === 'en' ? "file(s) selected" : language === 'es' ? "archivo(s) seleccionado(s)" : "файл(ов) выбрано"}
          </span>
        </div>

        {attachmentFiles.length > 0 && (
          <div className="space-y-2 mt-2">
            {attachmentFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-muted rounded"
              >
                <span className="text-sm truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? t.submitting : t.submitButton}
      </Button>
    </form>
  );
};

export default MissingPaymentForm;
