
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chat_notification_mode text NOT NULL DEFAULT 'all'
    CHECK (chat_notification_mode IN ('all','mentions'));

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS active_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_device text;

CREATE INDEX IF NOT EXISTS idx_conv_participants_active_viewed_at
  ON public.conversation_participants(conversation_id, active_viewed_at);

CREATE OR REPLACE FUNCTION public.dispatch_push_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipient RECORD;
  v_sender_name TEXT;
  v_body TEXT;
  v_collapse TEXT;
  v_is_mentioned BOOLEAN;
  v_display TEXT;
  v_pattern TEXT;
BEGIN
  SELECT CASE
           WHEN COALESCE(use_nickname_in_chat,false) AND COALESCE(NULLIF(TRIM(nickname),''),'') <> ''
             THEN TRIM(nickname)
           ELSE COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')),''),'New message')
         END
    INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  v_body := LEFT(COALESCE(NEW.content,'New message'), 140);
  v_collapse := 'chat:' || NEW.conversation_id::text;

  FOR v_recipient IN
    SELECT cp.user_id,
           p.chat_notification_mode AS mode,
           CASE
             WHEN COALESCE(p.use_nickname_in_chat,false) AND COALESCE(NULLIF(TRIM(p.nickname),''),'') <> ''
               THEN TRIM(p.nickname)
             ELSE TRIM(p.first_name || ' ' || COALESCE(p.last_name,''))
           END AS display_name,
           (cp.active_viewed_at IS NOT NULL
              AND cp.active_viewed_at > now() - interval '45 seconds') AS actively_viewing
    FROM public.conversation_participants cp
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
  LOOP
    IF v_recipient.actively_viewing THEN CONTINUE; END IF;

    v_display := COALESCE(NULLIF(v_recipient.display_name,''),'');
    IF v_display = '' THEN
      v_is_mentioned := FALSE;
    ELSE
      -- Escape regex metacharacters in the display name, then require a non-word boundary on both sides of @Name
      v_pattern := '(^|[^[:alnum:]_])@'
                   || regexp_replace(v_display, '([.()\[\]{}\\+*?|^$])', '\\\1', 'g')
                   || '($|[^[:alnum:]_])';
      v_is_mentioned := COALESCE(NEW.content,'') ~* v_pattern;
    END IF;

    IF v_recipient.mode = 'mentions' AND NOT v_is_mentioned THEN CONTINUE; END IF;

    PERFORM extensions.http_post(
      url := 'https://qunbwlsgjrhayeqhgyce.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
        'source','chat_messages',
        'user_id', v_recipient.user_id,
        'title', v_sender_name,
        'body', v_body,
        'android_collapse_key', v_collapse,
        'apns_thread_id', v_collapse,
        'data', jsonb_build_object(
          'reference_type','chat',
          'reference_id', NEW.conversation_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'notification_type','chat_message',
          'mentioned', v_is_mentioned::text
        )
      )
    );
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
