-- Einmal vollständig im SQL Editor des eigenen Projekts ausführen.
BEGIN;

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

COMMIT;