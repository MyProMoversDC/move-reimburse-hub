import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MoverTranslateButton } from "./MoverTranslateButton";
import { useTargetTranslation } from "@/hooks/useTargetTranslation";

interface AppealFormProps {
  type: "reimbursement" | "review" | "missing_payment";
  itemId: string;
  itemNumber: string;
  declineReason: string;
  onSuccess: () => void;
  onClose: () => void;
  isFinalAppeal?: boolean;
  language?: 'en' | 'es' | 'ru';
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const AppealForm = ({ type, itemId, itemNumber, declineReason, onSuccess, onClose, isFinalAppeal = false, language = 'en' }: AppealFormProps) => {
  const [appealNote, setAppealNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Translation state
  const [translatedDeclineReason, setTranslatedDeclineReason] = useState<string | null>(null);
  const [translatedToLang, setTranslatedToLang] = useState<'es' | 'ru' | null>(null);
  const { translateTexts, isTranslating } = useTargetTranslation();

  const handleTranslateDeclineReason = async (targetLang: 'es' | 'ru') => {
    if (!declineReason) return;
    const results = await translateTexts([declineReason], targetLang);
    if (results[0]) {
      setTranslatedDeclineReason(results[0]);
      setTranslatedToLang(targetLang);
    }
  };

  const handleShowOriginalDeclineReason = () => {
    setTranslatedDeclineReason(null);
    setTranslatedToLang(null);
  };

  const finalAppealWarning = {
    en: "⚠️ This is your FINAL appeal. Be very careful and detailed in your explanation. If declined, there will be no further opportunities to appeal.",
    es: "⚠️ Esta es su apelación FINAL. Sea muy cuidadoso y detallado en su explicación. Si es rechazada, no habrá más oportunidades de apelar.",
    ru: "⚠️ Это ваша ФИНАЛЬНАЯ апелляция. Будьте очень внимательны и детальны в своём объяснении. В случае отклонения, дальнейшие апелляции будут невозможны."
  };

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
      
      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!appealNote.trim()) {
      toast.error("Please provide a reason for your appeal");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update the item status to appeal
      if (type === "reimbursement") {
        // First get current appeal count
        const { data: currentReimb } = await supabase
          .from("reimbursements")
          .select("appeal_count")
          .eq("id", itemId)
          .maybeSingle();
        
        const newAppealCount = (currentReimb?.appeal_count || 0) + 1;
        
        const { error } = await supabase
          .from("reimbursements")
          .update({
            status: "appeal",
            appeal_note: appealNote.trim(),
            appeal_at: new Date().toISOString(),
            appeal_count: newAppealCount,
          })
          .eq("id", itemId);
        
        if (error) throw error;

        // Upload appeal attachments
        for (const file of files) {
          const safeFilename = sanitizeFilename(file.name);
          const fileName = `${user.id}/${itemId}/${Date.now()}_${safeFilename}`;

          const { error: uploadError } = await supabase.storage
            .from("appeal-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Store the file path, not the public URL (bucket is private)
          await supabase.from("reimbursement_appeal_attachments").insert({
            reimbursement_id: itemId,
            file_url: fileName,
            file_name: file.name,
          });
        }
      } else if (type === "review") {
        // First get current appeal count
        const { data: currentReview } = await supabase
          .from("review_bonuses")
          .select("appeal_count")
          .eq("id", itemId)
          .maybeSingle();
        
        const newAppealCount = (currentReview?.appeal_count || 0) + 1;
        
        const { error } = await supabase
          .from("review_bonuses")
          .update({
            status: "appeal",
            appeal_note: appealNote.trim(),
            appeal_at: new Date().toISOString(),
            appeal_count: newAppealCount,
          })
          .eq("id", itemId);
        
        if (error) throw error;

        // Create appeal history record
        const { data: historyRecord, error: historyError } = await supabase
          .from("review_bonus_appeal_history")
          .insert({
            review_bonus_id: itemId,
            appeal_number: newAppealCount,
            appeal_note: appealNote.trim(),
            appeal_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (historyError) {
          console.error("Error creating appeal history:", historyError);
        }

        // Upload appeal attachments with link to history
        for (const file of files) {
          const safeFilename = sanitizeFilename(file.name);
          const fileName = `${user.id}/${itemId}/${Date.now()}_${safeFilename}`;

          const { error: uploadError } = await supabase.storage
            .from("appeal-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Store the file path with link to appeal history
          await supabase.from("review_appeal_attachments").insert({
            review_bonus_id: itemId,
            file_url: fileName,
            file_name: file.name,
            appeal_history_id: historyRecord?.id || null,
          });
        }
      } else if (type === "missing_payment") {
        const { error } = await supabase
          .from("missing_payments")
          .update({
            status: "appeal",
            appeal_note: appealNote.trim(),
            appeal_at: new Date().toISOString(),
          })
          .eq("id", itemId);
        
        if (error) throw error;
      }

      // Get mover info for notification
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const moverName = profileData ? `${profileData.first_name} ${profileData.last_name}` : "Unknown";

      // Send appeal notification to admins
      try {
        const { error: notifError } = await supabase.functions.invoke("send-appeal-notification", {
          body: {
            type,
            moverName,
            referenceNumber: itemNumber,
            appealNote: appealNote.trim(),
          },
        });
        if (notifError) {
          console.error("Appeal notification error:", notifError);
        }
      } catch (notifError) {
        console.error("Failed to send appeal notification:", notifError);
      }

      toast.success("Appeal submitted successfully!");
      onSuccess();
    } catch (error: any) {
      console.error("Error submitting appeal:", error);
      toast.error(error.message || "Failed to submit appeal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isFinalAppeal && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertDescription className="text-red-600 font-semibold">
            {finalAppealWarning[language]}
          </AlertDescription>
        </Alert>
      )}

      {declineReason && (
        <div className="space-y-2">
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertDescription className="text-destructive">
              <strong>Reason for Decline:</strong> {translatedDeclineReason || declineReason}
              {translatedToLang && (
                <span className="block text-xs italic mt-1">
                  Translated to {translatedToLang === 'es' ? 'Español' : 'Русский'}
                </span>
              )}
            </AlertDescription>
          </Alert>
          <MoverTranslateButton
            onTranslate={handleTranslateDeclineReason}
            onShowOriginal={handleShowOriginalDeclineReason}
            isTranslating={isTranslating}
            isTranslated={!!translatedDeclineReason}
            translatedToLang={translatedToLang}
          />
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 p-4 rounded-lg border-2 border-blue-400 dark:border-blue-500 shadow-md">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
            <strong>How Appeals Work:</strong>
            <ul className="list-disc ml-4 mt-2 space-y-1">
              <li>Explain why you believe the decline decision should be reconsidered</li>
              <li>Attach any supporting documents or images that support your case</li>
              <li>The admin team will review your appeal and make a final decision</li>
              <li>You will receive a notification once your appeal has been reviewed</li>
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appealNote">Reason for Appeal *</Label>
          <Textarea
            id="appealNote"
            value={appealNote}
            onChange={(e) => setAppealNote(e.target.value)}
            placeholder="Please explain why you believe this decision should be reconsidered..."
            rows={5}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="appealAttachments">Supporting Documents (Optional)</Label>
          <p className="text-sm text-muted-foreground">Max 10MB each, JPEG/PNG/GIF/WebP/PDF</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                id="appealAttachments"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <Button
                type="button"
                variant="outline"
                className="pointer-events-none"
              >
                <Upload className="h-4 w-4 mr-2" />
                Select Files
              </Button>
            </div>
            <span className="text-sm text-muted-foreground">
              {files.length} file(s) selected
            </span>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 mt-2">
              {files.map((file, index) => (
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

        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Submitting..." : "Submit Appeal"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AppealForm;