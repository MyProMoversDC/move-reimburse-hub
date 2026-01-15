import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeclineRequest {
  userId: string;
  documentType: string;
  declineReason: string;
  moverEmail: string;
  moverName: string;
  language: "en" | "es" | "ru";
}

const translations = {
  en: {
    subject: "Document Declined - Action Required",
    greeting: (name: string) => `Dear ${name},`,
    body: (docType: string, reason: string) => 
      `Your ${docType} document has been declined by HR for the following reason:\n\n"${reason}"\n\nPlease review and re-upload the correct document in your account settings.`,
    footer: "Thank you,\nMyProMovers HR Team"
  },
  es: {
    subject: "Documento Rechazado - Acción Requerida",
    greeting: (name: string) => `Estimado/a ${name},`,
    body: (docType: string, reason: string) => 
      `Su documento de ${docType} ha sido rechazado por RH por la siguiente razón:\n\n"${reason}"\n\nPor favor revise y vuelva a subir el documento correcto en la configuración de su cuenta.`,
    footer: "Gracias,\nEquipo de RH de MyProMovers"
  },
  ru: {
    subject: "Документ Отклонен - Требуется Действие",
    greeting: (name: string) => `Уважаемый/ая ${name},`,
    body: (docType: string, reason: string) => 
      `Ваш документ ${docType} был отклонен HR по следующей причине:\n\n"${reason}"\n\nПожалуйста, проверьте и загрузите правильный документ в настройках вашей учетной записи.`,
    footer: "Спасибо,\nКоманда HR MyProMovers"
  }
};

const docTypeTranslations = {
  en: {
    "drivers_license": "Driver's License",
    "medical_card": "Medical Card"
  },
  es: {
    "drivers_license": "Licencia de Conducir",
    "medical_card": "Tarjeta Médica"
  },
  ru: {
    "drivers_license": "Водительское Удостоверение",
    "medical_card": "Медицинская Карта"
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, documentType, declineReason, moverEmail, moverName, language }: DeclineRequest = await req.json();

    const t = translations[language] || translations.en;
    const docTypes = docTypeTranslations[language] || docTypeTranslations.en;
    const docTypeLabel = docTypes[documentType as keyof typeof docTypes] || documentType;

    const emailContent = `${t.greeting(moverName)}\n\n${t.body(docTypeLabel, declineReason)}\n\n${t.footer}`;

    // Send email
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "notifications@mypromoversreimbursements.com",
        to: [moverEmail],
        subject: t.subject,
        text: emailContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    // Create mover notification
    const notificationTitle = {
      en: "Document Declined",
      es: "Documento Rechazado",
      ru: "Документ Отклонен"
    }[language] || "Document Declined";

    const notificationMessage = {
      en: `Your ${docTypeLabel} was declined: ${declineReason}`,
      es: `Su ${docTypeLabel} fue rechazado: ${declineReason}`,
      ru: `Ваш ${docTypeLabel} был отклонен: ${declineReason}`
    }[language] || `Your ${docTypeLabel} was declined: ${declineReason}`;

    await supabase.from("mover_notifications").insert({
      user_id: userId,
      title: notificationTitle,
      message: notificationMessage,
      notification_type: "document_declined",
      reference_type: "document_review",
      reference_id: documentType,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending document decline notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
