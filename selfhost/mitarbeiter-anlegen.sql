-- EuroScent: Admins können Mitarbeiterkonten (Benutzername + Passwort) direkt in der App anlegen.
-- Einmal komplett im Supabase SQL Editor ausführen.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.admin_create_employee(
  _username text,
  _password text,
  _first_name text DEFAULT NULL,
  _last_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _role public.app_role DEFAULT 'employee'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  uid uuid := gen_random_uuid();
  uname text := lower(trim(_username));
  mail text := lower(trim(coalesce(nullif(_email, ''), lower(trim(_username)) || '@euroscent.local')));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur Admins dürfen Konten anlegen';
  END IF;
  IF uname !~ '^[a-z0-9._-]{3,32}$' THEN
    RAISE EXCEPTION 'Benutzername ungültig (3-32 Zeichen: a-z, 0-9, . _ -)';
  END IF;
  IF length(_password) < 8 THEN
    RAISE EXCEPTION 'Passwort muss mindestens 8 Zeichen haben';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = uname) THEN
    RAISE EXCEPTION 'Benutzername ist bereits vergeben';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = mail) THEN
    RAISE EXCEPTION 'E-Mail ist bereits vergeben';
  END IF;

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, crypt(_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('first_name', _first_name, 'last_name', _last_name),
    now(), now(), '', '', '', '');

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
    'email', now(), now(), now());

  INSERT INTO public.profiles (id, email) VALUES (uid, mail) ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles
     SET username = uname, first_name = _first_name, last_name = _last_name
   WHERE id = uid;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, _role) ON CONFLICT DO NOTHING;
  RETURN uid;
END $$;

REVOKE ALL ON FUNCTION public.admin_create_employee(text, text, text, text, text, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_employee(text, text, text, text, text, public.app_role) TO authenticated;
