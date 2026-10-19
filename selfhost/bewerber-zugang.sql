-- Run after bewerberaufnahme.sql. Passwords stay exclusively in Auth.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles(lower(username));
CREATE TABLE IF NOT EXISTS public.applicant_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id uuid UNIQUE NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.applicant_accounts TO service_role;
REVOKE ALL ON public.applicant_accounts FROM anon,authenticated;
ALTER TABLE public.applicant_accounts ENABLE ROW LEVEL SECURITY;
-- No browser policies: only the server may register or unlock these identities.
CREATE OR REPLACE FUNCTION public.applicant_is_active(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.applicant_accounts WHERE user_id=_user)
 THEN EXISTS(SELECT 1 FROM public.applicant_accounts a JOIN public.applicant_workflows w ON w.user_id=a.user_id
 JOIN public.applications p ON p.id=a.application_id WHERE a.user_id=_user AND a.accepted_at IS NOT NULL AND w.active AND p.status='approved')
 ELSE NOT EXISTS(SELECT 1 FROM public.applicant_workflows WHERE user_id=_user AND NOT active) END;
$$;
REVOKE ALL ON FUNCTION public.applicant_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applicant_is_active(uuid) TO authenticated,service_role;
-- Stop legacy anonymous email lookup; username/password resolution now happens in applicant-api.
DO $$ BEGIN
 IF to_regprocedure('public.get_login_email(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.get_login_email(text) FROM PUBLIC,anon,authenticated';
 END IF;
END $$;
COMMIT;