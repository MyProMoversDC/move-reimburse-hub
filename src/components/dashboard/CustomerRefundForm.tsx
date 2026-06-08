import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { useMapboxToken } from "@/hooks/useMapboxToken";

interface CustomerRefundFormProps {
  userId: string;
  language: string;
  onSubmitted?: () => void;
}

const translations: Record<string, Record<string, string>> = {
  en: {
    title: "Customer Refund Form",
    customerName: "Customer Name",
    reason: "Reimbursement Reason",
    requestDate: "Date of the Reimbursement Request",
    amount: "Dollar Amount ($)",
    paymentMethod: "Method of Reimbursement",
    paymentMethodOther: "Please specify the method",
    comments: "Comments (optional)",
    submit: "Submit",
    submitting: "Submitting...",
    success: "Customer refund form submitted successfully",
    required: "Please fill in all required fields",
    selectDate: "Select date",
    zelle: "Zelle",
    check: "Check",
    other: "Other",
    checkAddress: "Mailing Address for Check",
    checkAddressPlaceholder: "Enter mailing address",
    zellePhone: "Zelle Phone Number / Digits",
    zellePhonePlaceholder: "Enter Zelle phone number or digits",
  },
  ru: {
    title: "Форма возврата клиенту",
    customerName: "Имя клиента",
    reason: "Причина возврата",
    requestDate: "Дата запроса на возврат",
    amount: "Сумма ($)",
    paymentMethod: "Способ возврата",
    paymentMethodOther: "Укажите способ",
    comments: "Комментарии (необязательно)",
    submit: "Отправить",
    submitting: "Отправка...",
    success: "Форма возврата клиенту успешно отправлена",
    required: "Пожалуйста, заполните все обязательные поля",
    selectDate: "Выберите дату",
    zelle: "Zelle",
    check: "Чек",
    other: "Другое",
    checkAddress: "Почтовый адрес для чека",
    checkAddressPlaceholder: "Введите почтовый адрес",
    zellePhone: "Номер телефона / цифры Zelle",
    zellePhonePlaceholder: "Введите номер или цифры Zelle",
  },
  es: {
    title: "Formulario de Reembolso al Cliente",
    customerName: "Nombre del Cliente",
    reason: "Razón del Reembolso",
    requestDate: "Fecha de Solicitud de Reembolso",
    amount: "Monto en Dólares ($)",
    paymentMethod: "Método de Reembolso",
    paymentMethodOther: "Especifique el método",
    comments: "Comentarios (opcional)",
    submit: "Enviar",
    submitting: "Enviando...",
    success: "Formulario de reembolso al cliente enviado exitosamente",
    required: "Por favor complete todos los campos requeridos",
    selectDate: "Seleccionar fecha",
    zelle: "Zelle",
    check: "Cheque",
    other: "Otro",
    checkAddress: "Dirección postal para el cheque",
    checkAddressPlaceholder: "Ingrese la dirección postal",
    zellePhone: "Número de teléfono / dígitos de Zelle",
    zellePhonePlaceholder: "Ingrese número o dígitos de Zelle",
  },
};

const CustomerRefundForm = ({ userId, language, onSubmitted }: CustomerRefundFormProps) => {
  const t = translations[language] || translations.en;
  const [customerName, setCustomerName] = useState("");
  const [reason, setReason] = useState("");
  const [requestDate, setRequestDate] = useState<Date | undefined>();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethodOther, setPaymentMethodOther] = useState("");
  const [checkAddress, setCheckAddress] = useState("");
  const [zellePhone, setZellePhone] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { token: mapboxToken } = useMapboxToken();

  const handleSubmit = async () => {
    if (!customerName.trim() || !reason.trim() || !requestDate || !amount || !paymentMethod) {
      toast.error(t.required);
      return;
    }
    if (paymentMethod === "other" && !paymentMethodOther.trim()) {
      toast.error(t.required);
      return;
    }
    if (paymentMethod === "check" && !checkAddress.trim()) {
      toast.error(t.required);
      return;
    }
    if (paymentMethod === "zelle" && !zellePhone.trim()) {
      toast.error(t.required);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("customer_refunds" as any).insert({
        submitted_by: userId,
        customer_name: customerName.trim(),
        reimbursement_reason: reason.trim(),
        request_date: format(requestDate, "yyyy-MM-dd"),
        amount: parseFloat(amount),
        payment_method: paymentMethod === "other" ? paymentMethodOther.trim() : paymentMethod,
        payment_method_other: paymentMethod === "other" ? paymentMethodOther.trim() : null,
        check_address: paymentMethod === "check" ? checkAddress.trim() : null,
        zelle_phone: paymentMethod === "zelle" ? zellePhone.trim() : null,
        comments: comments.trim() || null,
      } as any);

      if (error) throw error;

      // Send notification email
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .single();
        
        const submitterName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";
        
        await supabase.functions.invoke("send-customer-refund-notification", {
          body: {
            customerName: customerName.trim(),
            reason: reason.trim(),
            requestDate: format(requestDate, "MM/dd/yyyy"),
            amount: parseFloat(amount),
            paymentMethod: paymentMethod === "other" ? paymentMethodOther.trim() : paymentMethod,
            checkAddress: paymentMethod === "check" ? checkAddress.trim() : null,
            zellePhone: paymentMethod === "zelle" ? zellePhone.trim() : null,
            comments: comments.trim() || null,
            submitterName,
          },
        });
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
      }

      toast.success(t.success);
      setCustomerName("");
      setReason("");
      setRequestDate(undefined);
      setAmount("");
      setPaymentMethod("");
      setPaymentMethodOther("");
      setComments("");
      onSubmitted?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t.customerName} *</Label>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t.reason} *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t.requestDate} *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !requestDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {requestDate ? format(requestDate, "MM/dd/yyyy") : t.selectDate}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={requestDate} onSelect={setRequestDate} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>{t.amount} *</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t.paymentMethod} *</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue placeholder={t.paymentMethod} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zelle">{t.zelle}</SelectItem>
              <SelectItem value="check">{t.check}</SelectItem>
              <SelectItem value="other">{t.other}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentMethod === "other" && (
          <div className="space-y-2">
            <Label>{t.paymentMethodOther} *</Label>
            <Input value={paymentMethodOther} onChange={(e) => setPaymentMethodOther(e.target.value)} />
          </div>
        )}

        <div className="space-y-2">
          <Label>{t.comments}</Label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? t.submitting : t.submit}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CustomerRefundForm;
