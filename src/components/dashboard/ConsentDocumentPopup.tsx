import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ConsentDocument {
  id: string;
  file_name: string;
  file_url: string;
  version: number;
}

interface ConsentDocumentPopupProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
  onComplete: () => void;
}

const translations = {
  en: {
    title: "Terms and Conditions",
    disclaimer: (name: string) => `Dear ${name}, your contract with ABC Movers has been terminated. Please study and sign a contract with XYZ Movers.`,
    message: "Please read and sign the following terms and conditions document before continuing.",
    iAgree: "I have read and agree to the terms and conditions",
    sign: "Sign Document",
    signing: "Signing...",
  },
  es: {
    title: "Términos y Condiciones",
    disclaimer: (name: string) => `Estimado/a ${name}, su contrato con ABC Movers ha sido terminado. Por favor estudie y firme un contrato con XYZ Movers.`,
    message: "Por favor lea y firme el siguiente documento de términos y condiciones antes de continuar.",
    iAgree: "He leído y acepto los términos y condiciones",
    sign: "Firmar Documento",
    signing: "Firmando...",
  },
  ru: {
    title: "Условия и Положения",
    disclaimer: (name: string) => `Уважаемый/ая ${name}, ваш контракт с ABC Movers был расторгнут. Пожалуйста, ознакомьтесь и подпишите контракт с XYZ Movers.`,
    message: "Пожалуйста, прочитайте и подпишите следующий документ с условиями и положениями перед продолжением.",
    iAgree: "Я прочитал и согласен с условиями и положениями",
    sign: "Подписать Документ",
    signing: "Подписание...",
  },
};

const ConsentDocumentPopup = ({ userId, language, onComplete }: ConsentDocumentPopupProps) => {
  const t = translations[language];
  
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<ConsentDocument | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moverName, setMoverName] = useState<string>("");

  useEffect(() => {
    const fetchMoverName = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", userId)
        .maybeSingle();
      
      if (data?.first_name) {
        setMoverName(data.first_name);
      }
    };
    
    fetchMoverName();
    checkForUnacknowledgedConsent();
  }, [userId]);

  const checkForUnacknowledgedConsent = async () => {
    try {
      // Get the active consent document
      const { data: activeDocument, error: docError } = await supabase
        .from("consent_documents")
        .select("*")
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (docError || !activeDocument) {
        setLoading(false);
        onComplete(); // No consent document to sign, proceed
        return;
      }

      // Check if user has already acknowledged this version
      const { data: acknowledgment, error: ackError } = await supabase
        .from("consent_acknowledgments")
        .select("id")
        .eq("user_id", userId)
        .eq("consent_document_id", activeDocument.id)
        .maybeSingle();

      if (ackError) {
        console.error("Error checking consent acknowledgment:", ackError);
        setLoading(false);
        onComplete();
        return;
      }

      // Show popup if not acknowledged
      if (!acknowledgment) {
        setDocument(activeDocument);
        // Try to fetch document content if it's a text-based file
        if (activeDocument.file_url) {
          try {
            const response = await fetch(activeDocument.file_url);
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              if (contentType?.includes('text') || contentType?.includes('html')) {
                const text = await response.text();
                setDocumentContent(text);
              }
            }
          } catch {
            // Fallback to iframe display
          }
        }
        setOpen(true);
      } else {
        onComplete(); // Already signed, proceed
      }
      setLoading(false);
    } catch (error) {
      console.error("Error checking consent document:", error);
      setLoading(false);
      onComplete();
    }
  };

  const handleSign = async () => {
    if (!document || !hasAgreed) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("consent_acknowledgments")
        .insert({
          user_id: userId,
          consent_document_id: document.id,
        });

      if (error) {
        console.error("Error signing consent document:", error);
        toast.error(language === 'en' ? 'Failed to sign. Please try again.' : 
                    language === 'es' ? 'Error al firmar. Por favor intente de nuevo.' :
                    'Не удалось подписать. Попробуйте еще раз.');
        return;
      }

      // Send notification email with the consent document attached
      try {
        await supabase.functions.invoke('send-consent-notification', {
          body: {
            userId,
            documentUrl: document.file_url,
            documentName: document.file_name,
          },
        });
      } catch (emailError) {
        console.error("Error sending consent notification email:", emailError);
        // Don't fail the signing process if email fails
      }

      setOpen(false);
      setDocument(null);
      setHasAgreed(false);
      
      toast.success(language === 'en' ? 'Document signed successfully!' : 
                    language === 'es' ? '¡Documento firmado exitosamente!' :
                    'Документ успешно подписан!');
      
      onComplete();
    } catch (error) {
      console.error("Error signing consent document:", error);
      toast.error(language === 'en' ? 'An error occurred. Please try again.' : 
                  language === 'es' ? 'Ocurrió un error. Por favor intente de nuevo.' :
                  'Произошла ошибка. Попробуйте еще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !document || !open) return null;

  const isPdf = document.file_url?.toLowerCase().endsWith('.pdf');

  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-4xl w-[95vw] max-h-[95vh] h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            {t.title}
          </AlertDialogTitle>
          
          {/* Contract termination disclaimer */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 sm:p-4">
            <p className="text-amber-800 dark:text-amber-200 font-medium text-xs sm:text-sm">
              {t.disclaimer(moverName || "Mover")}
            </p>
          </div>
          
          <AlertDialogDescription className="text-xs sm:text-sm">
            {t.message}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Document Viewer - Responsive height */}
        <div className="flex-1 min-h-0 my-3 sm:my-4 overflow-hidden">
          <div className="h-full border rounded-lg overflow-hidden bg-muted/30">
            {documentContent ? (
              <ScrollArea className="h-full">
                <div 
                  className="p-3 sm:p-4 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: documentContent }}
                />
              </ScrollArea>
            ) : isPdf ? (
              // For PDFs, use object tag which works better on mobile
              <object
                data={document.file_url}
                type="application/pdf"
                className="w-full h-full min-h-[300px] sm:min-h-[400px]"
              >
                <iframe
                  src={`${document.file_url}#toolbar=0`}
                  className="w-full h-full min-h-[300px] sm:min-h-[400px]"
                  title="Terms and Conditions"
                />
              </object>
            ) : (
              <iframe
                src={document.file_url}
                className="w-full h-full min-h-[300px] sm:min-h-[400px]"
                title="Terms and Conditions"
              />
            )}
          </div>
        </div>

        {/* Agreement checkbox */}
        <div className="flex items-start space-x-3 pt-2 border-t">
          <Checkbox
            id="consent-agree"
            checked={hasAgreed}
            onCheckedChange={(checked) => setHasAgreed(checked === true)}
            className="mt-0.5"
          />
          <label
            htmlFor="consent-agree"
            className="text-xs sm:text-sm font-medium leading-tight cursor-pointer"
          >
            {t.iAgree}
          </label>
        </div>

        <AlertDialogFooter className="mt-3 sm:mt-4">
          <Button
            onClick={handleSign}
            disabled={!hasAgreed || submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t.signing}
              </>
            ) : (
              t.sign
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConsentDocumentPopup;
