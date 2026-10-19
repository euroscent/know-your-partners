-- Einmal vollständig im SQL Editor des eigenen Projekts ausführen.
BEGIN;

GRANT SELECT,INSERT,UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS euroscent_chat_admin_insert ON public.chat_messages;
CREATE POLICY euroscent_chat_admin_insert ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK(public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS euroscent_chat_employee_read_update ON public.chat_messages;
CREATE POLICY euroscent_chat_employee_read_update ON public.chat_messages FOR UPDATE TO authenticated
USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
DROP POLICY IF EXISTS euroscent_chat_insert_guard ON public.chat_messages;
CREATE POLICY euroscent_chat_insert_guard ON public.chat_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(public.has_role(auth.uid(),'admin') OR (user_id=auth.uid() AND role='user'));
CREATE OR REPLACE FUNCTION public.protect_employee_chat_updates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon','authenticator') AND NOT public.has_role(auth.uid(),'admin') THEN
  IF OLD.user_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)-ARRAY['is_read','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['is_read','updated_at']) THEN
   RAISE EXCEPTION 'Employees can only change read status on their own conversations';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_employee_chat_updates ON public.chat_messages;
CREATE TRIGGER protect_employee_chat_updates BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.protect_employee_chat_updates();

UPDATE public.company_contact
SET company_name = 'EuroScent GmbH', website_name = 'EuroScent',
    street_address = 'Königsallee 89', postal_code = '40212', city = 'Düsseldorf',
    country = 'Deutschland', managing_director = 'Rolf Erwin Ruhfus',
    register_court = 'Amtsgericht Düsseldorf', trade_register_number = 'HRB 69139',
    vat_id = 'DE152885038', main_email = 'office@euroscent.de',
    support_email = 'office@euroscent.de', updated_at = now();

INSERT INTO public.company_contact
  (company_name, website_name, street_address, postal_code, city, country,
   managing_director, register_court, trade_register_number, vat_id, main_email, support_email)
SELECT 'EuroScent GmbH', 'EuroScent', 'Königsallee 89', '40212', 'Düsseldorf', 'Deutschland',
       'Rolf Erwin Ruhfus', 'Amtsgericht Düsseldorf', 'HRB 69139', 'DE152885038',
       'office@euroscent.de', 'office@euroscent.de'
WHERE NOT EXISTS (SELECT 1 FROM public.company_contact);

-- Admin und Mitarbeiter bekommen neue Nachrichten direkt; bestehende RLS bleibt erhalten.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- Alte Absenderangaben in gespeicherten Mailvorlagen auf EuroScent umstellen.
UPDATE public.task_email_templates
SET sender_email = 'office@euroscent.de', sender_name = 'EuroScent', updated_at = now()
WHERE sender_email LIKE '%payexpert%' OR sender_name LIKE '%PayExpert%';

COMMIT;