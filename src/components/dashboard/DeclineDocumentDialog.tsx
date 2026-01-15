import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface DeclineDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  documentType: string;
  language: "en" | "es" | "ru";
  isSubmitting?: boolean;
}

const translations = {
  en: {
    title: "Decline Document",
    description: (docType: string) => `You are about to decline the ${docType}. Please provide a reason.`,
    reasonLabel: "Decline Reason",
    reasonPlaceholder: "Enter the reason for declining this document...",
    cancel: "Cancel",
    confirm: "Decline Document",
    confirming: "Submitting...",
    required: "Reason is required",
    driversLicense: "Driver's License",
    medicalCard: "Medical Card",
  },
  es: {
    title: "Rechazar Documento",
    description: (docType: string) => `Está a punto de rechazar el/la ${docType}. Por favor proporcione una razón.`,
    reasonLabel: "Razón del Rechazo",
    reasonPlaceholder: "Ingrese la razón para rechazar este documento...",
    cancel: "Cancelar",
    confirm: "Rechazar Documento",
    confirming: "Enviando...",
    required: "La razón es requerida",
    driversLicense: "Licencia de Conducir",
    medicalCard: "Tarjeta Médica",
  },
  ru: {
    title: "Отклонить Документ",
    description: (docType: string) => `Вы собираетесь отклонить ${docType}. Пожалуйста, укажите причину.`,
    reasonLabel: "Причина Отклонения",
    reasonPlaceholder: "Введите причину отклонения этого документа...",
    cancel: "Отмена",
    confirm: "Отклонить Документ",
    confirming: "Отправка...",
    required: "Причина обязательна",
    driversLicense: "Водительское Удостоверение",
    medicalCard: "Медицинская Карта",
  },
};

const DeclineDocumentDialog = ({
  open,
  onOpenChange,
  onConfirm,
  documentType,
  language,
  isSubmitting = false,
}: DeclineDocumentDialogProps) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const t = translations[language];

  const getDocTypeLabel = () => {
    if (documentType === "drivers_license") return t.driversLicense;
    if (documentType === "medical_card") return t.medicalCard;
    return documentType;
  };

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(t.required);
      return;
    }
    setError("");
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t.description(getDocTypeLabel())}
          </p>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">{t.reasonLabel} *</Label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              placeholder={t.reasonPlaceholder}
              rows={4}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t.cancel}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? t.confirming : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeclineDocumentDialog;
