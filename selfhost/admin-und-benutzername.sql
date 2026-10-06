-- 1) Benutzernamen-Login ermöglichen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.get_login_email(_username text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM public.profiles WHERE lower(username) = lower(trim(_username)) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;

-- 2) Admin-Konto anlegen  (PASSWORT_HIER durch Ihr Passwort ersetzen)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'office@euroscent.de';
  IF uid IS NULL THEN
    uid := gen_random_uuid();
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'office@euroscent.de', crypt('PASSWORT_HIER', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'office@euroscent.de', 'email_verified', true),
      'email', now(), now(), now());
  END IF;
  INSERT INTO public.profiles (id, email) VALUES (uid, 'office@euroscent.de') ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET username = 'office' WHERE id = uid;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
END $$;
