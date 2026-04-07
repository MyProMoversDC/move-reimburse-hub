
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, first_name, last_name, email, phone, nickname, use_nickname_in_chat, signup_status, birth_date)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    new.raw_user_meta_data->>'nickname',
    COALESCE((new.raw_user_meta_data->>'use_nickname_in_chat')::boolean, false),
    'pending',
    (new.raw_user_meta_data->>'birth_date')::date
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'selected_role', 'mover')::app_role);
  
  RETURN new;
END;
$function$;
