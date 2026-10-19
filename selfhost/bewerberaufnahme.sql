-- EuroScent: einmal vollständig auf dem EIGENEN Backend ausführen.
BEGIN;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS city text;

CREATE TABLE IF NOT EXISTS public.applicant_workflows (
  application_id uuid PRIMARY KEY REFERENCES public.applications(id),
  user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id),
  template_id uuid NOT NULL REFERENCES public.contract_templates(id),
  template_version text NOT NULL,
  contract_id uuid UNIQUE NOT NULL REFERENCES public.employee_documents(id),
  accepted_by uuid NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  identity_status text NOT NULL DEFAULT 'not_submitted',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  id_front_path text,
  id_back_path text,
  bank_complete boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.applicant_workflows TO authenticated;
GRANT ALL ON public.applicant_workflows TO service_role;
ALTER TABLE public.applicant_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS applicant_workflow_read ON public.applicant_workflows;
CREATE POLICY applicant_workflow_read ON public.applicant_workflows FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.applicant_is_active(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT NOT EXISTS (SELECT 1 FROM public.applicant_workflows WHERE user_id = _user AND NOT active);
$$;
REVOKE ALL ON FUNCTION public.applicant_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applicant_is_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.applicant_activation_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.active := NEW.signed_at IS NOT NULL AND NEW.bank_complete AND NEW.identity_status = 'approved'
    AND EXISTS (SELECT 1 FROM public.applications WHERE id = NEW.application_id AND status = 'approved');
  IF NEW.identity_status NOT IN ('not_submitted','pending','approved','rejected') THEN RAISE EXCEPTION 'Invalid identity status'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS applicant_activation_refresh ON public.applicant_workflows;
CREATE TRIGGER applicant_activation_refresh BEFORE INSERT OR UPDATE ON public.applicant_workflows
FOR EACH ROW EXECUTE FUNCTION public.applicant_activation_refresh();

CREATE OR REPLACE FUNCTION public.applicant_finalize_acceptance(_application uuid, _user uuid, _template uuid, _start date, _salary numeric, _admin uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.applications; t public.contract_templates; doc uuid; body text; existing uuid; pair record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF NOT public.has_role(_admin,'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
  SELECT * INTO a FROM public.applications WHERE id = _application FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  SELECT contract_id INTO existing FROM public.applicant_workflows WHERE application_id = _application;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF a.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Application cannot be accepted'; END IF;
  IF _start IS NULL OR _salary IS NULL OR _salary < 0 OR _salary > 1000000 THEN RAISE EXCEPTION 'Invalid contract values'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user AND lower(email) = lower(a.email)) THEN RAISE EXCEPTION 'Account mismatch'; END IF;
  IF public.has_role(_user,'admin') THEN RAISE EXCEPTION 'Admin account cannot become applicant'; END IF;
  SELECT * INTO t FROM public.contract_templates WHERE id = _template AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active template required'; END IF;
  body := t.content;
  FOR pair IN SELECT * FROM (VALUES
    ('first_name',a.first_name),('vorname',a.first_name),('last_name',a.last_name),('nachname',a.last_name),
    ('full_name',a.first_name || ' ' || a.last_name),('name',a.first_name || ' ' || a.last_name),
    ('street',coalesce(a.street,'')),('strasse',coalesce(a.street,'')),('straße',coalesce(a.street,'')),
    ('postal_code',coalesce(a.postal_code,'')),('plz',coalesce(a.postal_code,'')),('city',coalesce(a.city,'')),('ort',coalesce(a.city,'')),
    ('startdatum',to_char(_start,'DD.MM.YYYY')),('start_date',to_char(_start,'DD.MM.YYYY')),('salary',_salary::text),('gehalt',_salary::text),
    ('employee_signature',''),('arbeitnehmer_unterschrift',''),('company_signature',''),('arbeitgeber_unterschrift','')
  ) AS replacements(key,value) LOOP
    body := regexp_replace(body, '\{\{\s*' || pair.key || '\s*\}\}', pair.value, 'gi');
  END LOOP;
  -- Remove unresolved placeholders, never silently reuse an employee's old signature.
  body := regexp_replace(body, '\{\{[^}]*\}\}', '', 'g');
  INSERT INTO public.employee_documents(user_id,document_type,title,content,contract_type,start_date,signature_data)
  VALUES (_user,'contract','EuroScent Arbeitsvertrag – ' || t.name,body,t.category,_start::text,NULL) RETURNING id INTO doc;
  UPDATE public.applications SET status='approved',employment_type=lower(t.category),reviewed_by=_admin,reviewed_at=now() WHERE id=_application;
  UPDATE public.profiles SET first_name=a.first_name,last_name=a.last_name,phone=a.phone,birth_date=a.birth_date,
    street=a.street,postal_code=a.postal_code,city=a.city,employment_type=lower(t.category),start_date=_start WHERE id=_user;
  INSERT INTO public.applicant_workflows(application_id,user_id,template_id,template_version,contract_id,accepted_by)
  VALUES (_application,_user,_template,t.version,doc,_admin);
  RETURN doc;
END $$;
REVOKE ALL ON FUNCTION public.applicant_finalize_acceptance(uuid,uuid,uuid,date,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.applicant_finalize_acceptance(uuid,uuid,uuid,date,numeric,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_applicant_workflows() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'application_id',w.application_id,'user_id',w.user_id,'first_name',a.first_name,'last_name',a.last_name,'email',a.email,
 'contract_id',w.contract_id,'contract_content',d.content,'signature_data',d.signature_data,'signed_at',w.signed_at,
 'bank_complete',w.bank_complete,'identity_status',w.identity_status,'rejection_reason',w.rejection_reason,
 'id_front_path',w.id_front_path,'id_back_path',w.id_back_path,'active',w.active
) ORDER BY w.accepted_at DESC),'[]'::jsonb)
FROM public.applicant_workflows w JOIN public.applications a ON a.id=w.application_id
JOIN public.employee_documents d ON d.id=w.contract_id
WHERE auth.uid() IS NOT NULL AND (w.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
$$;
REVOKE ALL ON FUNCTION public.get_applicant_workflows() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_applicant_workflows() TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_applicant_contract(_signature text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.applicant_workflows;
BEGIN
 SELECT * INTO w FROM public.applicant_workflows WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Applicant not found'; END IF;
 IF w.signed_at IS NOT NULL THEN RAISE EXCEPTION 'Already signed'; END IF;
 IF _signature IS NULL OR _signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' OR length(_signature) NOT BETWEEN 200 AND 500000 THEN RAISE EXCEPTION 'Invalid signature'; END IF;
 UPDATE public.employee_documents SET signature_data=_signature WHERE id=w.contract_id;
 UPDATE public.applicant_workflows SET signed_at=now() WHERE user_id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.save_applicant_bank(_holder text,_iban text,_bic text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized text := upper(regexp_replace(_iban,'\s','','g')); digits text; r integer := 0; i integer; w public.applicant_workflows;
BEGIN
 SELECT * INTO w FROM public.applicant_workflows WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR w.signed_at IS NULL THEN RAISE EXCEPTION 'Sign the contract first'; END IF;
 IF _holder IS NULL OR length(trim(_holder)) NOT BETWEEN 2 AND 150 OR normalized IS NULL OR normalized !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'
 OR _bic IS NULL OR upper(trim(_bic)) !~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$' THEN RAISE EXCEPTION 'Invalid bank details'; END IF;
 IF left(normalized,2)='DE' AND length(normalized)<>22 THEN RAISE EXCEPTION 'Invalid IBAN'; END IF;
 digits := substring(normalized FROM 5) || left(normalized,4);
 FOR i IN 65..90 LOOP digits := replace(digits,chr(i),(i-55)::text); END LOOP;
 FOR i IN 1..length(digits) LOOP r := (r*10 + substring(digits,i,1)::integer)%97; END LOOP;
 IF r <> 1 THEN RAISE EXCEPTION 'Invalid IBAN checksum'; END IF;
 UPDATE public.profiles SET account_holder=trim(_holder),iban=normalized,bic=upper(trim(_bic)) WHERE id=auth.uid();
 UPDATE public.applicant_workflows SET bank_complete=true WHERE user_id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.submit_applicant_identity(_front text,_back text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,storage AS $$
DECLARE w public.applicant_workflows; prefix text := auth.uid()::text || '/applicant/';
BEGIN
 SELECT * INTO w FROM public.applicant_workflows WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR w.signed_at IS NULL OR NOT w.bank_complete THEN RAISE EXCEPTION 'Complete contract and bank details first'; END IF;
 IF w.identity_status IN ('pending','approved') THEN RAISE EXCEPTION 'Identity already submitted'; END IF;
 IF _front IS NULL OR _back IS NULL OR _front=_back OR left(_front,length(prefix))<>prefix OR left(_back,length(prefix))<>prefix
 OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='verification-documents' AND name=_front)
 OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='verification-documents' AND name=_back) THEN RAISE EXCEPTION 'Both identity images required'; END IF;
 UPDATE public.applicant_workflows SET identity_status='pending',id_front_path=_front,id_back_path=_back,
 rejection_reason=NULL,reviewed_at=NULL,reviewed_by=NULL WHERE user_id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.review_applicant_identity(_user uuid,_approve boolean,_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF _approve IS NULL THEN RAISE EXCEPTION 'Decision required'; END IF;
 IF NOT _approve AND (_reason IS NULL OR length(trim(_reason)) NOT BETWEEN 3 AND 1000) THEN RAISE EXCEPTION 'Rejection reason required'; END IF;
 UPDATE public.applicant_workflows SET identity_status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
 rejection_reason=CASE WHEN _approve THEN NULL ELSE trim(_reason) END,reviewed_by=auth.uid(),reviewed_at=now()
 WHERE user_id=_user AND identity_status='pending' AND id_front_path IS NOT NULL AND id_back_path IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'No pending identity submission'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.sign_applicant_contract(text),public.save_applicant_bank(text,text,text),public.submit_applicant_identity(text,text),public.review_applicant_identity(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sign_applicant_contract(text),public.save_applicant_bank(text,text,text),public.submit_applicant_identity(text,text),public.review_applicant_identity(uuid,boolean,text) TO authenticated;

-- Protect the frozen applicant contract against broad legacy document-update policies.
CREATE OR REPLACE FUNCTION public.protect_applicant_document() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.applicant_workflows WHERE contract_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Accepted contract cannot be deleted'; END IF;
  IF NEW.content IS DISTINCT FROM OLD.content OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.document_type IS DISTINCT FROM OLD.document_type
   OR NEW.contract_type IS DISTINCT FROM OLD.contract_type OR NEW.start_date IS DISTINCT FROM OLD.start_date THEN RAISE EXCEPTION 'Accepted contract is immutable'; END IF;
  IF NEW.signature_data IS DISTINCT FROM OLD.signature_data AND current_user IN ('authenticated','anon','authenticator') THEN RAISE EXCEPTION 'Use contract signing'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_applicant_document ON public.employee_documents;
CREATE TRIGGER protect_applicant_document BEFORE UPDATE OR DELETE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.protect_applicant_document();

-- Direct profile edits cannot bypass onboarding or erase completed bank details.
CREATE OR REPLACE FUNCTION public.protect_applicant_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon','authenticator') AND NOT public.has_role(auth.uid(),'admin') THEN
  IF NEW.verified IS DISTINCT FROM OLD.verified OR NEW.resource_assignment_approved IS DISTINCT FROM OLD.resource_assignment_approved THEN RAISE EXCEPTION 'Admin status fields are protected'; END IF;
  IF EXISTS (SELECT 1 FROM public.applicant_workflows WHERE user_id=OLD.id) AND
   (NEW.iban IS DISTINCT FROM OLD.iban OR NEW.bic IS DISTINCT FROM OLD.bic OR NEW.account_holder IS DISTINCT FROM OLD.account_holder) THEN RAISE EXCEPTION 'Use protected bank form'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_applicant_profile ON public.profiles;
CREATE TRIGGER protect_applicant_profile BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_applicant_profile();

DROP POLICY IF EXISTS applicant_task_access ON public.tasks;
CREATE POLICY applicant_task_access ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.applicant_is_active(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.applicant_is_active(auth.uid()));
DROP POLICY IF EXISTS applicant_submission_access ON public.task_submissions;
CREATE POLICY applicant_submission_access ON public.task_submissions AS RESTRICTIVE FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.applicant_is_active(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.applicant_is_active(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_applicant_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.assigned_to IS NOT NULL AND (TG_OP='INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
 AND NOT public.applicant_is_active(NEW.assigned_to) THEN RAISE EXCEPTION 'Mitarbeiter noch nicht aktiv: Vertrag, Bankdaten und Identitätsprüfung abschließen'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_applicant_assignment ON public.tasks;
CREATE TRIGGER protect_applicant_assignment BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.protect_applicant_assignment();

DROP POLICY IF EXISTS applicant_identity_read ON storage.objects;
CREATE POLICY applicant_identity_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='verification-documents' AND (name LIKE auth.uid()::text || '/applicant/%' OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS applicant_identity_insert ON storage.objects;
CREATE POLICY applicant_identity_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='verification-documents' AND name LIKE auth.uid()::text || '/applicant/%'
 AND EXISTS(SELECT 1 FROM public.applicant_workflows WHERE user_id=auth.uid() AND signed_at IS NOT NULL AND bank_complete AND identity_status IN ('not_submitted','rejected')));
-- Restrict legacy policies too: applicant images cannot be updated/deleted after submission.
DROP POLICY IF EXISTS applicant_identity_guard ON storage.objects;
CREATE POLICY applicant_identity_guard ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (name NOT LIKE '%/applicant/%' OR (bucket_id='verification-documents' AND (name LIKE auth.uid()::text || '/applicant/%' OR public.has_role(auth.uid(),'admin'))))
WITH CHECK (name NOT LIKE '%/applicant/%' OR (bucket_id='verification-documents' AND name LIKE auth.uid()::text || '/applicant/%'
 AND EXISTS(SELECT 1 FROM public.applicant_workflows WHERE user_id=auth.uid() AND identity_status IN ('not_submitted','rejected'))));
COMMIT;