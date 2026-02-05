import { useState, useEffect, useRef } from "react";
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
import { FileText, Loader2, PenLine } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { SignaturePad, SignaturePadRef } from "@/components/ui/signature-pad";

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
    signatureRequired: "Your signature is required below",
    sign: "Submit Signature",
    signing: "Signing...",
    clearSignature: "Clear Signature",
    signatureEmpty: "Please provide your signature before submitting",
    clickToSign: "Click here to sign",
    tapToSign: "Tap here to sign",
  },
  es: {
    title: "Términos y Condiciones",
    disclaimer: (name: string) => `Estimado/a ${name}, su contrato con ABC Movers ha sido terminado. Por favor estudie y firme un contrato con XYZ Movers.`,
    message: "Por favor lea y firme el siguiente documento de términos y condiciones antes de continuar.",
    signatureRequired: "Se requiere su firma abajo",
    sign: "Enviar Firma",
    signing: "Firmando...",
    clearSignature: "Borrar Firma",
    signatureEmpty: "Por favor proporcione su firma antes de enviar",
    clickToSign: "Haga clic aquí para firmar",
    tapToSign: "Toque aquí para firmar",
  },
  ru: {
    title: "Условия и Положения",
    disclaimer: (name: string) => `Уважаемый/ая ${name}, ваш контракт с ABC Movers был расторгнут. Пожалуйста, ознакомьтесь и подпишите контракт с XYZ Movers.`,
    message: "Пожалуйста, прочитайте и подпишите следующий документ с условиями и положениями перед продолжением.",
    signatureRequired: "Требуется ваша подпись ниже",
    sign: "Отправить Подпись",
    signing: "Подписание...",
    clearSignature: "Очистить Подпись",
    signatureEmpty: "Пожалуйста, поставьте подпись перед отправкой",
    clickToSign: "Нажмите здесь, чтобы подписать",
    tapToSign: "Нажмите здесь, чтобы подписать",
  },
};

const SIGNATURE_PLACEHOLDER = "{{SIGNATURE}}";
const DATE_PLACEHOLDER = "{{DATE}}";
const MOVER_NAME_PLACEHOLDER = "{{MOVER_NAME}}";

const ConsentDocumentPopup = ({ userId, language, onComplete }: ConsentDocumentPopupProps) => {
  const t = translations[language];
  
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<ConsentDocument | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moverName, setMoverName] = useState<string>("");
  const [moverFullName, setMoverFullName] = useState<string>("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isHtmlTemplate, setIsHtmlTemplate] = useState(false);
  const signaturePadRef = useRef<SignaturePadRef>(null);

  useEffect(() => {
    const fetchMoverName = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      
      if (data?.first_name) {
        setMoverName(data.first_name);
        setMoverFullName(`${data.first_name} ${data.last_name || ""}`);
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
                // Check if it's an HTML template with placeholders
                if (text.includes(SIGNATURE_PLACEHOLDER)) {
                  setIsHtmlTemplate(true);
                }
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

  const handleSignatureComplete = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setShowSignaturePad(false);
  };

  const generateSignedHtml = (templateHtml: string, signatureUrl: string): string => {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return templateHtml
      .replace(SIGNATURE_PLACEHOLDER, `<img src="${signatureUrl}" style="max-height:80px; display:inline-block;" alt="Signature"/>`)
      .replace(new RegExp(DATE_PLACEHOLDER, 'g'), currentDate)
      .replace(new RegExp(MOVER_NAME_PLACEHOLDER, 'g'), moverFullName);
  };

  const renderDocumentWithSignatureZone = () => {
    if (!documentContent) return null;

    // Replace placeholders in the HTML for display
    let displayHtml = documentContent;
    
    // Replace mover name placeholder
    displayHtml = displayHtml.replace(new RegExp(MOVER_NAME_PLACEHOLDER, 'g'), moverFullName);
    
    // Replace date placeholder with current date
    const currentDate = new Date().toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    displayHtml = displayHtml.replace(new RegExp(DATE_PLACEHOLDER, 'g'), currentDate);
    
    // Replace signature placeholder with interactive zone or signature image
    if (signatureDataUrl) {
      displayHtml = displayHtml.replace(
        SIGNATURE_PLACEHOLDER, 
        `<div class="signature-display" style="display:inline-block; min-width:200px;">
          <img src="${signatureDataUrl}" style="max-height:80px; display:block;" alt="Your Signature"/>
        </div>`
      );
    } else {
      // Create a placeholder for the signature zone that we'll replace with a React component
      displayHtml = displayHtml.replace(
        SIGNATURE_PLACEHOLDER, 
        `<div id="signature-zone-placeholder" class="signature-zone"></div>`
      );
    }
    
    return displayHtml;
  };

  const handleSign = async () => {
    if (!document) return;

    // For HTML templates, check if signature is in the document
    // For non-HTML, check the separate signature pad
    const signature = signatureDataUrl || signaturePadRef.current?.getSignatureDataUrl();
    if (!signature) {
      toast.error(t.signatureEmpty);
      return;
    }

    setSubmitting(true);
    try {
      // Get mover profile for email notifications
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .single();

      const fullName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown Mover";
      const moverEmail = profile?.email || "";
      const signedAt = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

      // Generate the signed HTML content if it's an HTML template
      let signedHtmlContent: string | null = null;
      if (isHtmlTemplate && documentContent) {
        signedHtmlContent = generateSignedHtml(documentContent, signature);
      }

      // Insert acknowledgment
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

      // Store the signed consent document with signature and HTML content
      const { error: signedDocError } = await supabase
        .from("signed_consent_documents")
        .insert({
          user_id: userId,
          consent_document_id: document.id,
          signature_url: signature,
          mover_name: fullName,
          document_name: document.file_name,
          signed_html_content: signedHtmlContent,
        });

      if (signedDocError) {
        console.error("Error storing signed document:", signedDocError);
        // Don't fail the signing process if storing fails
      }

      // Send notification email to mover with the consent document attached
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

      // Send admin notification email to Daniel@
      try {
        await supabase.functions.invoke('send-consent-admin-notification', {
          body: {
            moverName: fullName,
            moverEmail: moverEmail,
            documentName: document.file_name,
            signedAt: signedAt,
          },
        });
      } catch (adminEmailError) {
        console.error("Error sending admin consent notification email:", adminEmailError);
        // Don't fail the signing process if email fails
      }

      setOpen(false);
      setDocument(null);
      setSignatureDataUrl(null);
      
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

        {/* Document Viewer - Responsive height with mobile scroll */}
        <div className="flex-1 min-h-0 my-3 sm:my-4 overflow-hidden">
          <ScrollArea className="h-full max-h-[40vh] sm:max-h-[50vh]">
            <div className="h-full border rounded-lg overflow-hidden bg-white dark:bg-muted/30">
              {isHtmlTemplate && documentContent ? (
                // Render HTML template with inline signature zone
                <div className="p-3 sm:p-4">
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none [&_.signature-zone]:my-2"
                    dangerouslySetInnerHTML={{ __html: renderDocumentWithSignatureZone() || '' }}
                  />
                  {/* Signature Zone - Click to Sign */}
                  {!signatureDataUrl && (
                    <div 
                      className="inline-flex items-center justify-center gap-2 min-w-[250px] min-h-[80px] border-2 border-dashed border-primary/50 rounded-lg bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setShowSignaturePad(true)}
                    >
                      <PenLine className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {t.clickToSign}
                      </span>
                    </div>
                  )}
                </div>
              ) : documentContent ? (
                <div 
                  className="p-3 sm:p-4 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: documentContent }}
                />
              ) : isPdf ? (
                // For PDFs on mobile, provide a link since PDF viewers don't work well in iframes
                <div className="flex flex-col h-full">
                  <div className="sm:hidden p-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {language === 'en' ? 'Tap below to view the document:' : 
                       language === 'es' ? 'Toque abajo para ver el documento:' :
                       'Нажмите ниже, чтобы просмотреть документ:'}
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open(document.file_url, '_blank')}
                      className="w-full"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {language === 'en' ? 'Open Document' : 
                       language === 'es' ? 'Abrir Documento' :
                       'Открыть Документ'}
                    </Button>
                  </div>
                  <object
                    data={document.file_url}
                    type="application/pdf"
                    className="hidden sm:block w-full h-full min-h-[300px]"
                  >
                    <iframe
                      src={`${document.file_url}#toolbar=0`}
                      className="w-full h-full min-h-[300px]"
                      title="Terms and Conditions"
                    />
                  </object>
                </div>
              ) : (
                <iframe
                  src={document.file_url}
                  className="w-full h-full min-h-[200px] sm:min-h-[300px]"
                  title="Terms and Conditions"
                />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Signature Section - Only show for non-HTML templates */}
        {!isHtmlTemplate && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium text-center text-muted-foreground">
              {t.signatureRequired}
            </p>
            <SignaturePad
              ref={signaturePadRef}
              onSign={setSignatureDataUrl}
              onClear={() => setSignatureDataUrl(null)}
              clearLabel={t.clearSignature}
              height={120}
            />
          </div>
        )}

        {/* Signature Pad Modal for HTML templates */}
        {isHtmlTemplate && showSignaturePad && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg p-4 w-[90vw] max-w-md space-y-4">
              <h3 className="text-lg font-semibold text-center">{t.signatureRequired}</h3>
              <SignaturePad
                ref={signaturePadRef}
                onSign={handleSignatureComplete}
                onClear={() => setSignatureDataUrl(null)}
                clearLabel={t.clearSignature}
                height={150}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSignaturePad(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    const sig = signaturePadRef.current?.getSignatureDataUrl();
                    if (sig) {
                      handleSignatureComplete(sig);
                    }
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter className="mt-3 sm:mt-4">
          <Button
            onClick={handleSign}
            disabled={!signatureDataUrl || submitting}
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
