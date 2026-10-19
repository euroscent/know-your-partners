-- EuroScent: Arbeitern den Lesezugriff auf aktive Vertragsvorlagen geben
-- Im Supabase SQL Editor komplett einfuegen und einmal ausfuehren (Run).
-- Noetig, damit der Arbeitsvertrag beim Oeffnen von "Dokumente" mit der
-- EuroScent-Vorlage erzeugt wird und nicht mit dem einfachen Ersatztext.

BEGIN;

DROP POLICY IF EXISTS "Authenticated can view active contract templates" ON public.contract_templates;

CREATE POLICY "Authenticated can view active contract templates" ON public.contract_templates
  FOR SELECT TO authenticated
  USING (is_active = true);

COMMIT;
