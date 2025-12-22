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

interface AppealFormProps {
  type: "reimbursement" | "review";
  itemId: string;
  itemNumber: string;
  declineReason: string;
  onSuccess: () => void;
  onClose: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const AppealForm = ({ type, itemId, itemNumber, declineReason, onSuccess, onClose }: AppealFormProps) => {
  const [appealNote, setAppealNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

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
        const { error } = await supabase
          .from("reimbursements")
          .update({
            status: "appeal",
            appeal_note: appealNote.trim(),
            appeal_at: new Date().toISOString(),
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

          const { data: { publicUrl } } = supabase.storage
            .from("appeal-attachments")
            .getPublicUrl(fileName);

          await supabase.from("reimbursement_appeal_attachments").insert({
            reimbursement_id: itemId,
            file_url: publicUrl,
            file_name: file.name,
          });
        }
      } else {
        const { error } = await supabase
          .from("review_bonuses")
          .update({
            status: "appeal",
            appeal_note: appealNote.trim(),
            appeal_at: new Date().toISOString(),
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

          const { data: { publicUrl } } = supabase.storage
            .from("appeal-attachments")
            .getPublicUrl(fileName);

          await supabase.from("review_appeal_attachments").insert({
            review_bonus_id: itemId,
            file_url: publicUrl,
            file_name: file.name,
          });
        }
      }

      // Get mover info for notification
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const moverName = profileData ? `${profileData.first_name} ${profileData.last_name}` : "Unknown";

      // Send appeal notification to admins
      await supabase.functions.invoke("send-appeal-notification", {
        body: {
          type,
          moverName,
          referenceNumber: itemNumber,
          appealNote: appealNote.trim(),
        },
      });

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
      {declineReason && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertDescription className="text-destructive">
            <strong>Reason for Decline:</strong> {declineReason}
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>How Appeals Work:</strong>
          <ul className="list-disc ml-4 mt-2 space-y-1">
            <li>Explain why you believe the decline decision should be reconsidered</li>
            <li>Attach any supporting documents or images that support your case</li>
            <li>The admin team will review your appeal and make a final decision</li>
            <li>You will receive a notification once your appeal has been reviewed</li>
          </ul>
        </AlertDescription>
      </Alert>

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
            <Input
              id="appealAttachments"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("appealAttachments")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select Files
            </Button>
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