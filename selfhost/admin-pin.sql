-- EuroScent: Admin-PIN statt PGP-PIN. Einmal komplett im Supabase SQL Editor ausführen.
-- Der PIN wird nur als sicherer Hash gespeichert (nicht im Klartext).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.admin_pin (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_pin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_pin FROM anon, authenticated;
GRANT ALL ON public.admin_pin TO service_role;

-- Start-PIN (Hash)
INSERT INTO public.admin_pin (id, pin_hash)
VALUES (true, '$2a$10$ILSjyw29MUPeCP.3yUASmuMjCCMCSNhd7EOpn2ZUn05SlbaI5F6vy')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_admin_pin(_pin text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RETURN false; END IF;
  SELECT pin_hash INTO h FROM public.admin_pin WHERE id;
  RETURN h IS NOT NULL AND h = crypt(_pin, h);
END $$;

CREATE OR REPLACE FUNCTION public.change_admin_pin(_old_pin text, _new_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur Admins'; END IF;
  IF NOT public.verify_admin_pin(_old_pin) THEN RAISE EXCEPTION 'Aktueller PIN ist falsch'; END IF;
  IF _new_pin !~ '^[0-9]{4,20}$' THEN RAISE EXCEPTION 'Neuer PIN: 4-20 Ziffern'; END IF;
  UPDATE public.admin_pin SET pin_hash = crypt(_new_pin, gen_salt('bf')), updated_at = now() WHERE id;
END $$;

REVOKE ALL ON FUNCTION public.verify_admin_pin(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.change_admin_pin(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_admin_pin(text, text) TO authenticated;
