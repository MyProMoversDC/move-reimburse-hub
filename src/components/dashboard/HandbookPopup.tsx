import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { handbookTranslations, HandbookLanguage } from "@/lib/handbookTranslations";

interface Handbook {
  id: string;
  version: number;
  file_url: string;
  file_name: string;
  ai_change_summary: string | null;
}

interface HandbookPopupProps {
  userId: string;
  language: HandbookLanguage;
  onAcknowledge?: () => void;
}

const HandbookPopup = ({ userId, language, onAcknowledge }: HandbookPopupProps) => {
  const t = handbookTranslations[language];
  
  const [open, setOpen] = useState(false);
  const [handbook, setHandbook] = useState<Handbook | null>(null);
  const [hasRead, setHasRead] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkForUnacknowledgedHandbook();
  }, [userId]);

  const checkForUnacknowledgedHandbook = async () => {
    try {
      // Get the latest shared handbook
      const { data: latestHandbook, error: handbookError } = await supabase
        .from("handbooks")
        .select("*")
        .eq("is_shared", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (handbookError || !latestHandbook) return;

      // Check if user has acknowledged this version
      const { data: acknowledgment, error: ackError } = await supabase
        .from("handbook_acknowledgments")
        .select("id")
        .eq("user_id", userId)
        .eq("handbook_id", latestHandbook.id)
        .maybeSingle();

      if (ackError) {
        console.error("Error checking acknowledgment:", ackError);
        return;
      }

      // Show popup if not acknowledged
      if (!acknowledgment) {
        setHandbook(latestHandbook);
        setOpen(true);
      }
    } catch (error) {
      console.error("Error checking handbook:", error);
    }
  };

  const handleAcknowledge = async () => {
    if (!handbook || !hasRead) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("handbook_acknowledgments")
        .insert({
          user_id: userId,
          handbook_id: handbook.id,
        });

      if (error) throw error;

      setOpen(false);
      onAcknowledge?.();
    } catch (error) {
      console.error("Error acknowledging handbook:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (!handbook) return null;

  return (
    <>
      <AlertDialog open={open}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t.handbookPopupTitle}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-2">
                <p>{t.handbookPopupMessage}</p>
                
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <p className="font-medium">{handbook.file_name}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={handbook.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-1" />
                        {t.downloadHandbook}
                      </a>
                    </Button>
                    {handbook.ai_change_summary && (
                      <Button variant="outline" size="sm" onClick={() => setShowChanges(true)}>
                        <Eye className="h-4 w-4 mr-1" />
                        {t.viewChanges}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox
                    id="handbook-read"
                    checked={hasRead}
                    onCheckedChange={(checked) => setHasRead(checked === true)}
                  />
                  <label
                    htmlFor="handbook-read"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {t.iHaveReadHandbook}
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleAcknowledge}
              disabled={!hasRead || submitting}
            >
              {t.confirmRead}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showChanges} onOpenChange={setShowChanges}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.changesDetected}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap">
              {handbook.ai_change_summary}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HandbookPopup;
