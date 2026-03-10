import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { z } from "zod";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError, handleUploadError } from "@/lib/errorHandler";
import { X, AlertCircle, AlertTriangle } from "lucide-react";

// File validation constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const reimbursementSchema = z.object({
  moverFullName: z.string().trim().min(1, "Mover full name is required").max(200),
  jobNumber: z.string().trim().min(1, "Job number is required").max(50),
  truckNumber: z.string().trim().min(1, "Truck number is required").max(50),
  customerName: z.string().trim().min(1, "Customer name is required").max(200),
  totalReimbursement: z.number().min(0.01, "Total reimbursement must be greater than 0"),
  zelleInfo: z.string().trim().min(1, "Zelle payment info is required").max(200),
  gasExpenses: z.number().min(0).optional(),
  roadExpenses: z.number().min(0).optional(),
  hotelExpenses: z.number().min(0).optional(),
  otherExpenses: z.number().min(0).optional(),
});

interface ReimbursementFormProps {
  userId: string;
  onSuccess: () => void;
  onCancel?: () => void;
  language: DashboardLanguage;
}

const ReimbursementForm = ({ userId, onSuccess, onCancel, language }: ReimbursementFormProps) => {
  const [loading, setLoading] = useState(false);
  const t = dashboardTranslations[language];
  const [moverFullName, setMoverFullName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [truckNumber, setTruckNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [totalReimbursement, setTotalReimbursement] = useState("");
  const [zelleInfo, setZelleInfo] = useState("");
  const [gasExpenses, setGasExpenses] = useState("");
  const [roadExpenses, setRoadExpenses] = useState("");
  const [hotelExpenses, setHotelExpenses] = useState("");
  const [otherExpenses, setOtherExpenses] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  // Auto-pull mover name from profile
  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();
      
      if (data) {
        setMoverFullName(`${data.first_name} ${data.last_name}`);
      }
    };
    fetchProfile();
  }, [userId]);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large (max 5MB)`;
    }
    if (!VALID_FILE_TYPES.includes(file.type)) {
      return `File "${file.name}" has invalid type. Please use JPEG, PNG, GIF, or WebP.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles: File[] = [];
      
      for (const file of files) {
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

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 100);
  };

  const formDescription = {
    en: "Use this form to request reimbursement for work-related expenses. Please attach all relevant receipts and provide accurate information.",
    es: "Utilice este formulario para solicitar reembolso de gastos relacionados con el trabajo. Por favor adjunte todos los recibos relevantes y proporcione información precisa.",
    ru: "Используйте эту форму для запроса возмещения расходов, связанных с работой. Пожалуйста, прикрепите все соответствующие квитанции и предоставьте точную информацию."
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate attachments are provided
    if (attachmentFiles.length === 0) {
      toast.error("Please attach at least one receipt image");
      return;
    }

    try {
      const validated = reimbursementSchema.parse({
        moverFullName: moverFullName.trim(),
        jobNumber: jobNumber.trim(),
        truckNumber: truckNumber.trim(),
        customerName: customerName.trim(),
        totalReimbursement: parseFloat(totalReimbursement),
        zelleInfo: zelleInfo.trim(),
        gasExpenses: gasExpenses ? parseFloat(gasExpenses) : undefined,
        roadExpenses: roadExpenses ? parseFloat(roadExpenses) : undefined,
        hotelExpenses: hotelExpenses ? parseFloat(hotelExpenses) : undefined,
        otherExpenses: otherExpenses ? parseFloat(otherExpenses) : undefined,
      });

      setLoading(true);

      // Insert reimbursement
      const { data: reimbursement, error: reimbursementError } = await supabase
        .from("reimbursements")
        .insert({
          mover_id: userId,
          mover_full_name: validated.moverFullName,
          job_number: validated.jobNumber,
          truck_number: validated.truckNumber,
          customer_name: validated.customerName,
          gas_expenses: validated.gasExpenses || 0,
          road_expenses: validated.roadExpenses || 0,
          hotel_expenses: validated.hotelExpenses || 0,
          other_expenses: validated.otherExpenses || 0,
          total_expenses: validated.totalReimbursement,
          zelle_info: validated.zelleInfo,
        })
        .select()
        .single();

      if (reimbursementError) throw reimbursementError;

      // Upload attachments
      for (const file of attachmentFiles) {
        const safeFilename = sanitizeFilename(file.name);
        const fileName = `${userId}/${reimbursement.id}/${Date.now()}_${safeFilename}`;

        const { error: uploadError } = await supabase.storage
          .from("reimbursement-attachments")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save attachment record
        const { error: attachmentError } = await supabase
          .from("reimbursement_attachments")
          .insert({
            reimbursement_id: reimbursement.id,
            file_url: `reimbursement-attachments/${fileName}`,
            file_name: file.name,
          });

        if (attachmentError) throw attachmentError;
      }

      // Send notification email
      try {
        const { error: notifError } = await supabase.functions.invoke("send-reimbursement-notification", {
          body: {
            reimbursementNumber: String(reimbursement.reimbursement_number).padStart(5, "0"),
            moverFullName: validated.moverFullName,
            jobNumber: validated.jobNumber,
            truckNumber: validated.truckNumber,
            customerName: validated.customerName,
            gasExpenses: validated.gasExpenses || 0,
            roadExpenses: validated.roadExpenses || 0,
            hotelExpenses: validated.hotelExpenses || 0,
            otherExpenses: validated.otherExpenses || 0,
            totalExpenses: validated.totalReimbursement,
            zelleInfo: validated.zelleInfo,
            attachmentCount: attachmentFiles.length,
          },
        });
        if (notifError) {
          console.error("Notification email error:", notifError);
        }
      } catch (notifError) {
        console.error("Failed to send notification email:", notifError);
      }

      toast.success(t.requestSubmitted);
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error && typeof error === 'object' && 'message' in error) {
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
      {/* Form Description */}
      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 p-4 rounded-lg border-2 border-blue-400 dark:border-blue-500 shadow-md">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{formDescription[language]}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="moverFullName">Mover 1 Full Name *</Label>
          <Input
            id="moverFullName"
            value={moverFullName}
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobNumber">Job # *</Label>
          <Input
            id="jobNumber"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="truckNumber">Truck # *</Label>
          <Input
            id="truckNumber"
            value={truckNumber}
            onChange={(e) => setTruckNumber(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name *</Label>
          <Input
            id="customerName"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gasExpenses">Gas Expenses ($)</Label>
          <Input
            id="gasExpenses"
            type="number"
            step="0.01"
            min="0"
            value={gasExpenses}
            onChange={(e) => setGasExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="roadExpenses">Road (Tolls) Expenses ($)</Label>
          <Input
            id="roadExpenses"
            type="number"
            step="0.01"
            min="0"
            value={roadExpenses}
            onChange={(e) => setRoadExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hotelExpenses">Hotel Expenses ($)</Label>
          <Input
            id="hotelExpenses"
            type="number"
            step="0.01"
            min="0"
            value={hotelExpenses}
            onChange={(e) => setHotelExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="otherExpenses">Other Expenses ($)</Label>
          <Input
            id="otherExpenses"
            type="number"
            step="0.01"
            min="0"
            value={otherExpenses}
            onChange={(e) => setOtherExpenses(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="totalReimbursement">Total Requested Reimbursement ($) Amount *</Label>
          <Input
            id="totalReimbursement"
            type="number"
            step="0.01"
            min="0.01"
            value={totalReimbursement}
            onChange={(e) => setTotalReimbursement(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="zelleInfo">Zelle Payment Info (Email or Phone) *</Label>
        <Input
          id="zelleInfo"
          value={zelleInfo}
          onChange={(e) => setZelleInfo(e.target.value)}
          placeholder="email@example.com or phone number"
          required
        />
      </div>

      {/* Receipt Attachments */}
      <div className="space-y-2">
        <Label>Receipt Images * (Max 5MB each, JPEG/PNG/GIF/WebP)</Label>
        <div className="relative">
          <input
            id="attachments"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full pointer-events-none"
          >
            {language === 'en' ? "Select Receipt Images" : language === 'es' ? "Seleccionar imágenes de recibos" : "Выбрать изображения квитанций"}
          </Button>
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
        
        {attachmentFiles.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {language === 'en' ? "No files selected" : language === 'es' ? "No hay archivos seleccionados" : "Файлы не выбраны"}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting..." : "Submit Reimbursement"}
      </Button>
      
      {onCancel && (
        <Button 
          type="button" 
          variant="outline" 
          className="w-full md:hidden mt-2" 
          onClick={onCancel}
        >
          {language === 'en' ? 'Cancel' : language === 'es' ? 'Cancelar' : 'Отмена'}
        </Button>
      )}
    </form>
  );
};

export default ReimbursementForm;
