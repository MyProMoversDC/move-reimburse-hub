import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface EmailLogEntry {
  from_email: string;
  to_emails: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
  email_type: string;
  reference_id?: string;
  reference_type?: string;
  status: 'sent' | 'failed';
  error_message?: string;
  resend_id?: string;
}

export async function logEmail(entry: EmailLogEntry): Promise<void> {
  try {
    // Use service role key to bypass RLS for logging
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabaseAdmin
      .from('email_logs')
      .insert(entry);

    if (error) {
      console.error('Failed to log email:', error);
    } else {
      console.log('Email logged successfully:', entry.email_type, entry.subject);
    }
  } catch (err) {
    console.error('Error logging email:', err);
  }
}
