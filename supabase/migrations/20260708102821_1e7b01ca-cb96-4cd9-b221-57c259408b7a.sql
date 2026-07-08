
-- Fix: dispatch_push_on_notification / dispatch_push_on_chat_message
-- Root cause: `extensions.http_post` does not exist in this database; the real function
-- lives in schema `net` (pg_net). The previous `EXCEPTION WHEN OTHERS THEN RETURN NEW`
-- swallowed the resulting "function does not exist" error, so NO push HTTP requests
-- were ever enqueued for either chat messages or mover_notifications.
--
-- This migration:
--   1. Rewrites both functions to call `net.http_post(...)` (correct schema).
--   2. Preserves URL, headers, and payload exactly as before.
--   3. Replaces the blanket exception swallow with RAISE WARNING so future failures
--      appear in Postgres logs instead of being silently dropped.
--   4. Leaves triggers, tables, RLS, and application code untouched.
--
-- send-push-notification is deployed with verify_jwt = false (see supabase/config.toml),
-- so no Authorization header is required from the trigger — behavior is preserved.

CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
BEGIN
  PERFORM net.http_post(
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
  RAISE WARNING 'dispatch_push_on_notification failed for notification %: % (%).',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_push_on_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
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
      v_pattern := '(^|[^[:alnum:]_])@'
                   || regexp_replace(v_display, '([.()\[\]{}\\+*?|^$])', '\\\1', 'g')
                   || '($|[^[:alnum:]_])';
      v_is_mentioned := COALESCE(NEW.content,'') ~* v_pattern;
    END IF;

    IF v_recipient.mode = 'mentions' AND NOT v_is_mentioned THEN CONTINUE; END IF;

    BEGIN
      PERFORM net.http_post(
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
    EXCEPTION WHEN OTHERS THEN
      -- Log per-recipient failures but keep processing the remaining recipients
      RAISE WARNING 'dispatch_push_on_chat_message failed for message % recipient %: % (%).',
        NEW.id, v_recipient.user_id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
  RETURN NEW;
END;
$function$;
