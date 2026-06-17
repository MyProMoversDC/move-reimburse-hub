
-- Enable pg_net for HTTP calls from DB triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Device tokens table
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own device tokens"
  ON public.device_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);

CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generic trigger: any insert into mover_notifications dispatches a push
CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM extensions.http_post(
    url := 'https://qunbwlsgjrhayeqhgyce.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object(
      'source', 'mover_notifications',
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'data', jsonb_build_object(
        'reference_type', NEW.reference_type,
        'reference_id', NEW.reference_id,
        'notification_type', NEW.notification_type
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_mover_notification ON public.mover_notifications;
CREATE TRIGGER trg_push_on_mover_notification
  AFTER INSERT ON public.mover_notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_on_notification();

-- Chat messages: push to other participants
CREATE OR REPLACE FUNCTION public.dispatch_push_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipient RECORD;
  v_sender_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')),''), 'New message')
    INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  FOR v_recipient IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
  LOOP
    PERFORM extensions.http_post(
      url := 'https://qunbwlsgjrhayeqhgyce.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
        'source','chat_messages',
        'user_id', v_recipient.user_id,
        'title', v_sender_name,
        'body', COALESCE(NEW.content,'New message'),
        'data', jsonb_build_object(
          'reference_type','chat',
          'reference_id', NEW.conversation_id,
          'message_id', NEW.id
        )
      )
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_chat_message ON public.chat_messages;
CREATE TRIGGER trg_push_on_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_on_chat_message();
