-- EPP Datenbank-Schema für eigenes Supabase. Einmalig im SQL Editor ausführen.
CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pg_net; CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'employee'
);


--
-- Name: _get_pgp_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._get_pgp_key() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'vault', 'extensions'
    AS $$ SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pgp_master_key' LIMIT 1 $$;


--
-- Name: assign_missing_mentors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_missing_mentors() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  updated_count INTEGER := 0;
  profile_record RECORD;
  random_mentor_id UUID;
BEGIN
  -- Loop through profiles without mentors
  FOR profile_record IN 
    SELECT id FROM public.profiles WHERE mentor_id IS NULL
  LOOP
    -- Get a random mentor
    SELECT id INTO random_mentor_id
    FROM public.virtual_employees
    WHERE is_active = true
    ORDER BY random()
    LIMIT 1;
    
    IF random_mentor_id IS NOT NULL THEN
      UPDATE public.profiles
      SET mentor_id = random_mentor_id
      WHERE id = profile_record.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN updated_count;
END;
$$;


--
-- Name: auto_assign_mentor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_mentor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  random_mentor_id UUID;
BEGIN
  -- Only assign mentor if mentor_id is not already set
  IF NEW.mentor_id IS NULL THEN
    -- Select a random active KYC virtual employee as mentor
    SELECT id INTO random_mentor_id
    FROM public.virtual_employees
    WHERE is_active = true
      AND (
        LOWER(job_title) LIKE '%kyc%' 
        OR LOWER(department) LIKE '%kyc%'
        OR LOWER(department) LIKE '%compliance%'
        OR LOWER(job_title) LIKE '%compliance%'
      )
    ORDER BY random()
    LIMIT 1;
    
    -- Assign the mentor if found
    IF random_mentor_id IS NOT NULL THEN
      NEW.mentor_id := random_mentor_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: auto_assign_mentor_on_verification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_mentor_on_verification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  random_mentor_id UUID;
BEGIN
  -- Only trigger when verified changes from false to true and no mentor assigned yet
  IF OLD.verified = false AND NEW.verified = true AND NEW.mentor_id IS NULL THEN
    -- Select a random active KYC virtual employee
    SELECT id INTO random_mentor_id
    FROM virtual_employees
    WHERE is_active = true
      AND (
        LOWER(job_title) LIKE '%kyc%' 
        OR LOWER(department) LIKE '%kyc%'
        OR LOWER(department) LIKE '%compliance%'
      )
    ORDER BY random()
    LIMIT 1;
    
    -- If we found a KYC mentor, assign them
    IF random_mentor_id IS NOT NULL THEN
      NEW.mentor_id := random_mentor_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_brute_force(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_brute_force(_identifier text, _action text, _window_minutes integer DEFAULT 15, _max_attempts integer DEFAULT 5) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (
    SELECT count(*)
    FROM public.security_events
    WHERE (email = _identifier OR ip_address = _identifier)
      AND event_type = _action
      AND created_at > now() - (_window_minutes || ' minutes')::interval
  ) >= _max_attempts;
$$;


--
-- Name: cleanup_expired_telegram_id_map(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_telegram_id_map() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.telegram_id_map WHERE expires_at < now();
END;
$$;


--
-- Name: cleanup_expired_telegram_replies(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_telegram_replies() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.telegram_pending_replies
  WHERE expires_at < now();
END;
$$;


--
-- Name: cleanup_task_submissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_task_submissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- On DELETE: Don't delete submissions anymore - FK SET NULL handles it
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  -- On UPDATE: If assigned_to changes, delete submissions for the old employee
  IF TG_OP = 'UPDATE' THEN
    IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL THEN
      DELETE FROM public.task_submissions 
      WHERE task_id = NEW.id AND employee_id = OLD.assigned_to;
    ELSIF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NOT NULL AND OLD.assigned_to != NEW.assigned_to THEN
      DELETE FROM public.task_submissions 
      WHERE task_id = NEW.id AND employee_id = OLD.assigned_to;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;


--
-- Name: decrypt_sensitive(bytea); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_sensitive(_cipher bytea) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE v_key text; v_role text;
BEGIN
  IF _cipher IS NULL THEN RETURN NULL; END IF;
  v_role := current_setting('request.jwt.claim.role', true);
  IF v_role = 'service_role' OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    v_key := public._get_pgp_key();
    BEGIN
      RETURN extensions.pgp_sym_decrypt(_cipher, v_key);
    EXCEPTION WHEN OTHERS THEN RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END $$;


--
-- Name: encrypt_sensitive(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_sensitive(_plain text) RETURNS bytea
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE v_key text;
BEGIN
  IF _plain IS NULL THEN RETURN NULL; END IF;
  v_key := public._get_pgp_key();
  RETURN extensions.pgp_sym_encrypt(_plain, v_key);
END $$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_year INTEGER;
  invoice_count INTEGER;
  new_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT COUNT(*) + 1 INTO invoice_count
  FROM public.freelancer_invoices
  WHERE EXTRACT(YEAR FROM created_at) = current_year;
  
  new_number := 'FL-' || current_year || '-' || LPAD(invoice_count::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$;


--
-- Name: get_security_stats(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_security_stats(_hours integer DEFAULT 24) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_events', count(*),
    'critical_events', count(*) FILTER (WHERE severity = 'critical'),
    'warning_events', count(*) FILTER (WHERE severity = 'warning'),
    'login_failures', count(*) FILTER (WHERE event_type = 'login_failure'),
    'login_successes', count(*) FILTER (WHERE event_type = 'login_success'),
    'unique_ips', count(DISTINCT ip_address),
    'unique_users', count(DISTINCT user_id),
    'unresolved', count(*) FILTER (WHERE resolved = false AND severity != 'info')
  ) INTO result
  FROM public.security_events
  WHERE created_at > now() - (_hours || ' hours')::interval;
  
  RETURN result;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    first_name,
    last_name,
    birth_date,
    phone,
    street,
    postal_code,
    city,
    nationality,
    employment_type,
    salutation
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    (NEW.raw_user_meta_data->>'birth_date')::date,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'street_and_number',
    NEW.raw_user_meta_data->>'zip_code',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'nationality',
    NEW.raw_user_meta_data->>'contract_type',
    NEW.raw_user_meta_data->>'salutation'
  );

  IF NEW.raw_user_meta_data->>'company' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: notify_admin_on_user_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admin_on_user_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Nur wenn die Nachricht vom User kommt (nicht assistant/admin)
  IF NEW.role = 'user' THEN
    -- Finde alle Admins und erstelle für jeden eine Notification
    INSERT INTO admin_notifications (admin_id, message, type, reference_id, user_id)
    SELECT 
      ur.user_id,
      'Neue Nachricht von ' || COALESCE(p.first_name || ' ' || p.last_name, 'einem Mitarbeiter'),
      'new_chat_message',
      NEW.id,
      NEW.user_id
    FROM user_roles ur
    LEFT JOIN profiles p ON p.id = NEW.user_id
    WHERE ur.role = 'admin';
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: notify_telegram_on_chat_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_telegram_on_chat_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  supabase_url TEXT;
BEGIN
  -- Only trigger for new user messages (not admin/assistant)
  IF NEW.role = 'user' THEN
    -- Get Supabase URL from environment or use hardcoded project URL
    supabase_url := 'https://qljjcyjdpqwfeesmfdvl.supabase.co';
    
    -- Make async HTTP request to telegram-chat-forward function
    -- Note: This will be fire-and-forget since we can't await in triggers
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/telegram-chat-forward',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'messageId', NEW.id,
        'userId', NEW.user_id,
        'message', NEW.message,
        'virtualEmployeeId', NEW.virtual_employee_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: prevent_employee_task_self_approval(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_employee_task_self_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.role() = 'service_role' or public.has_role(auth.uid(), 'admin'::app_role) then
    return new;
  end if;

  if auth.uid() = old.employee_id then
    if new.status in ('approved', 'completed', 'kyc_completed')
       and new.status is distinct from old.status then
      raise exception 'Employees cannot approve or complete their own task submissions';
    end if;

    if new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'Employees cannot change task review fields';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: sync_template_to_assigned_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_template_to_assigned_tasks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only trigger for template updates (assigned_to IS NULL)
  IF NEW.assigned_to IS NULL THEN
    -- Update all assigned tasks that reference this template
    UPDATE public.tasks
    SET
      title = NEW.title,
      description = NEW.description,
      image_url = NEW.image_url,
      images = NEW.images,
      logo_url = NEW.logo_url,
      primary_color = NEW.primary_color,
      secondary_color = NEW.secondary_color,
      accent_color = NEW.accent_color,
      branding_url = NEW.branding_url,
      steps = NEW.steps,
      tags = NEW.tags,
      priority = NEW.priority,
      estimated_hours = NEW.estimated_hours,
      compensation_amount = NEW.compensation_amount,
      google_play_url = NEW.google_play_url,
      apple_store_url = NEW.apple_store_url,
      email_required = NEW.email_required,
      is_starter_job = NEW.is_starter_job,
      task_type = NEW.task_type,
      attachments = NEW.attachments,
      category = NEW.category,
      updated_at = now()
    WHERE
      template_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: trg_encrypt_chat_messages(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_encrypt_chat_messages() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.message_enc := public.encrypt_sensitive(NEW.message);
  NEW.subject_enc := public.encrypt_sensitive(NEW.subject);
  RETURN NEW;
END $$;


--
-- Name: trg_encrypt_email_forwards(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_encrypt_email_forwards() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.subject_enc := public.encrypt_sensitive(NEW.subject);
  NEW.sender_enc := public.encrypt_sensitive(NEW.sender);
  NEW.body_enc := public.encrypt_sensitive(NEW.body);
  NEW.code_extracted_enc := public.encrypt_sensitive(NEW.code_extracted);
  NEW.link_extracted_enc := public.encrypt_sensitive(NEW.link_extracted);
  RETURN NEW;
END $$;


--
-- Name: trg_encrypt_profiles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_encrypt_profiles() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.birth_date_enc := public.encrypt_sensitive(NEW.birth_date::text);
  NEW.place_of_birth_enc := public.encrypt_sensitive(NEW.place_of_birth);
  NEW.nationality_enc := public.encrypt_sensitive(NEW.nationality);
  NEW.tax_id_enc := public.encrypt_sensitive(NEW.tax_id);
  NEW.social_security_number_enc := public.encrypt_sensitive(NEW.social_security_number);
  NEW.health_insurance_enc := public.encrypt_sensitive(NEW.health_insurance);
  NEW.iban_enc := public.encrypt_sensitive(NEW.iban);
  NEW.bic_enc := public.encrypt_sensitive(NEW.bic);
  NEW.account_holder_enc := public.encrypt_sensitive(NEW.account_holder);
  NEW.street_enc := public.encrypt_sensitive(NEW.street);
  NEW.postal_code_enc := public.encrypt_sensitive(NEW.postal_code);
  NEW.city_enc := public.encrypt_sensitive(NEW.city);
  NEW.alt_street_enc := public.encrypt_sensitive(NEW.alt_street);
  NEW.alt_postal_code_enc := public.encrypt_sensitive(NEW.alt_postal_code);
  NEW.alt_city_enc := public.encrypt_sensitive(NEW.alt_city);
  NEW.phone_enc := public.encrypt_sensitive(NEW.phone);
  RETURN NEW;
END $$;


--
-- Name: trg_encrypt_received_emails(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_encrypt_received_emails() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.subject_enc := public.encrypt_sensitive(NEW.subject);
  NEW.body_text_enc := public.encrypt_sensitive(NEW.body_text);
  NEW.body_html_enc := public.encrypt_sensitive(NEW.body_html);
  NEW.from_address_enc := public.encrypt_sensitive(NEW.from_address);
  NEW.to_address_enc := public.encrypt_sensitive(NEW.to_address);
  NEW.raw_email_enc := public.encrypt_sensitive(NEW.raw_email);
  RETURN NEW;
END $$;


--
-- Name: trg_encrypt_verification_uploads(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_encrypt_verification_uploads() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.extracted_surname_enc := public.encrypt_sensitive(NEW.extracted_surname);
  NEW.extracted_given_names_enc := public.encrypt_sensitive(NEW.extracted_given_names);
  NEW.extracted_date_of_birth_enc := public.encrypt_sensitive(NEW.extracted_date_of_birth::text);
  NEW.extracted_nationality_enc := public.encrypt_sensitive(NEW.extracted_nationality);
  NEW.extracted_place_of_birth_enc := public.encrypt_sensitive(NEW.extracted_place_of_birth);
  NEW.extracted_expiry_date_enc := public.encrypt_sensitive(NEW.extracted_expiry_date::text);
  NEW.base64_content_enc := public.encrypt_sensitive(NEW.base64_content);
  NEW.ai_reason_enc := public.encrypt_sensitive(NEW.ai_reason);
  RETURN NEW;
END $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid,
    submission_id uuid,
    activity_type text NOT NULL,
    step_index integer,
    step_title text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    message text NOT NULL,
    type text NOT NULL,
    reference_id uuid,
    user_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_presence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    is_online boolean DEFAULT true NOT NULL
);


--
-- Name: agent_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    source text DEFAULT 'clodebot'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    preferred_domain_id uuid,
    auto_send_email boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    birth_date date,
    resume_path text,
    employment_type text,
    meeting_requested_at timestamp with time zone,
    coupon_sent boolean DEFAULT false NOT NULL,
    coupon_sent_at timestamp with time zone,
    coupon_code text,
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['new'::text, 'pending'::text, 'submitted'::text, 'contacted'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT valid_employment_type CHECK ((employment_type = ANY (ARRAY['minijob'::text, 'teilzeit'::text, 'vollzeit'::text, 'freelancer'::text])))
);


--
-- Name: business_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    day_of_week integer NOT NULL,
    open_time time without time zone NOT NULL,
    close_time time without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    role text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    replied_by uuid,
    replied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    virtual_employee_id uuid,
    subject text,
    message_enc bytea,
    subject_enc bytea,
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'admin'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    website_url text,
    logo_url text,
    primary_color text DEFAULT '#000000'::text,
    secondary_color text DEFAULT '#ffffff'::text,
    accent_color text DEFAULT '#3b82f6'::text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_contact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_contact (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    main_email text,
    support_email text,
    main_phone text,
    support_phone text,
    street_address text,
    postal_code text,
    city text,
    country text DEFAULT 'Deutschland'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_name text,
    website_name text,
    website_url text,
    trade_register_number text,
    register_court text,
    vat_id text,
    managing_director text,
    content_responsible text,
    legal_form text DEFAULT 'GmbH'::text,
    data_protection_officer text,
    data_protection_email text,
    logo_url text,
    favicon_url text,
    primary_color text DEFAULT '#000000'::text,
    secondary_color text DEFAULT '#ffffff'::text,
    accent_color text DEFAULT '#3b82f6'::text,
    meeting_booking_url text
);


--
-- Name: company_signature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_signature (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    signature_data text NOT NULL,
    signer_name text NOT NULL,
    signer_title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contract_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    version text DEFAULT 'v1'::text NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_salary numeric
);


--
-- Name: email_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_address text NOT NULL,
    imap_password text NOT NULL,
    imap_host text DEFAULT 'outlook.office365.com'::text NOT NULL,
    imap_port integer DEFAULT 993 NOT NULL,
    assigned_to uuid,
    status text DEFAULT 'available'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    provider text DEFAULT 'manual'::text,
    CONSTRAINT email_accounts_status_check CHECK ((status = ANY (ARRAY['available'::text, 'assigned'::text, 'inactive'::text])))
);


--
-- Name: email_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_catch_all boolean DEFAULT true NOT NULL,
    cloudflare_zone_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_forwards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_forwards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_account_id uuid,
    task_id uuid,
    user_id uuid,
    subject text,
    sender text,
    body text,
    received_at timestamp with time zone,
    code_extracted text,
    link_extracted text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_enc bytea,
    sender_enc bytea,
    body_enc bytea,
    code_extracted_enc bytea,
    link_extracted_enc bytea
);


--
-- Name: email_send_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    recipient_company text,
    subject text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delay_enabled boolean DEFAULT false,
    delay_hours integer DEFAULT 2,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_settings_delay_hours_check CHECK (((delay_hours >= 1) AND (delay_hours <= 168)))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    content text NOT NULL,
    sender_name text,
    sender_email text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    document_type text NOT NULL,
    title text NOT NULL,
    description text,
    file_url text,
    signature_data text,
    contract_type text,
    start_date text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content text,
    is_read boolean DEFAULT false NOT NULL
);


--
-- Name: employee_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    created_by uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_questionnaire; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_questionnaire (
    user_id uuid NOT NULL,
    interests text[] DEFAULT '{}'::text[] NOT NULL,
    top_interests text[] DEFAULT '{}'::text[] NOT NULL,
    experience jsonb DEFAULT '{}'::jsonb NOT NULL,
    preferred_activities text[] DEFAULT '{}'::text[] NOT NULL,
    task_preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    languages jsonb DEFAULT '[]'::jsonb NOT NULL,
    motivation_text text,
    interest_topics text,
    avoid_topics text,
    equipment text[] DEFAULT '{}'::text[] NOT NULL,
    career_goals text[] DEFAULT '{}'::text[] NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faq_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    keywords text[] NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: freelancer_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freelancer_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    task_title text NOT NULL,
    hours_worked numeric DEFAULT 1 NOT NULL,
    hourly_rate numeric DEFAULT 55 NOT NULL,
    gross_amount numeric NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payout_status text DEFAULT 'none'::text NOT NULL,
    payout_requested_at timestamp with time zone,
    payout_approved_at timestamp with time zone,
    payout_approved_by uuid,
    payout_barcode text,
    payout_redeemed_at timestamp with time zone,
    payout_notes text,
    payout_image_url text,
    payout_expires_at timestamp with time zone,
    bonus_amount numeric DEFAULT 0 NOT NULL,
    bonus_breakdown jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT freelancer_invoices_payout_status_check CHECK ((payout_status = ANY (ARRAY['none'::text, 'requested'::text, 'approved'::text, 'redeemed'::text, 'rejected'::text]))),
    CONSTRAINT freelancer_invoices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: generated_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    local_part text NOT NULL,
    full_address text NOT NULL,
    task_id uuid,
    submission_id uuid,
    user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    notes text
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    new_tasks boolean DEFAULT true NOT NULL,
    demo_data_approved boolean DEFAULT true NOT NULL,
    inbox_codes boolean DEFAULT true NOT NULL,
    payouts boolean DEFAULT true NOT NULL,
    chat_messages boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payroll; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    gross_salary numeric(10,2) NOT NULL,
    working_hours numeric(5,2) DEFAULT 0,
    hourly_rate numeric(10,2),
    tax_deduction numeric(10,2) DEFAULT 0,
    social_security numeric(10,2) DEFAULT 0,
    health_insurance numeric(10,2) DEFAULT 0,
    other_deductions numeric(10,2) DEFAULT 0,
    net_salary numeric(10,2) NOT NULL,
    payment_date date,
    notes text,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT payroll_year_check CHECK ((year >= 2020))
);


--
-- Name: phone_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number text NOT NULL,
    provider text,
    monthly_cost numeric(10,2),
    assigned_to uuid,
    status text DEFAULT 'available'::text NOT NULL,
    rented_since date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    country text,
    rental_duration_days integer,
    setup_fee numeric(10,2),
    available_numbers integer DEFAULT 0,
    number_type text,
    service_name text,
    rent_type text DEFAULT 'full_number'::text,
    nect_link text,
    CONSTRAINT phone_numbers_number_type_check CHECK ((number_type = ANY (ARRAY['local'::text, 'mobile'::text, 'toll-free'::text, 'national'::text]))),
    CONSTRAINT phone_numbers_rent_type_check CHECK ((rent_type = ANY (ARRAY['full_number'::text, 'service'::text]))),
    CONSTRAINT phone_numbers_status_check CHECK ((status = ANY (ARRAY['available'::text, 'assigned'::text, 'inactive'::text])))
);


--
-- Name: product_test_participations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_test_participations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    step_id text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    started_at timestamp with time zone,
    review_available_at timestamp with time zone,
    completed_at timestamp with time zone,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    verification_requested_at timestamp with time zone,
    birth_date date,
    tax_id text,
    social_security_number text,
    iban text,
    employment_type text,
    nationality text,
    street text,
    postal_code text,
    city text,
    account_holder text,
    bic text,
    health_insurance text,
    marital_status text,
    tax_class integer,
    federal_state text,
    children_count integer DEFAULT 0,
    church_tax_liable boolean DEFAULT true,
    signature_data text,
    mentor_id uuid,
    start_date date,
    avatar_url text,
    verification_method text,
    admin_notes text,
    telegram_message_ids jsonb,
    place_of_birth text,
    telegram_notifications_enabled boolean DEFAULT true NOT NULL,
    alt_street text,
    alt_postal_code text,
    alt_city text,
    salutation text,
    country_of_birth text,
    nect_link text,
    resource_assignment_approved boolean DEFAULT false NOT NULL,
    nect_section_visible boolean DEFAULT true NOT NULL,
    questionnaire_completed boolean DEFAULT false NOT NULL,
    contract_company_override jsonb,
    birth_date_enc bytea,
    place_of_birth_enc bytea,
    nationality_enc bytea,
    tax_id_enc bytea,
    social_security_number_enc bytea,
    health_insurance_enc bytea,
    iban_enc bytea,
    bic_enc bytea,
    account_holder_enc bytea,
    street_enc bytea,
    postal_code_enc bytea,
    city_enc bytea,
    alt_street_enc bytea,
    alt_postal_code_enc bytea,
    alt_city_enc bytea,
    phone_enc bytea,
    CONSTRAINT profiles_tax_class_check CHECK (((tax_class >= 1) AND (tax_class <= 6)))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: received_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.received_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid,
    to_address text NOT NULL,
    from_address text NOT NULL,
    subject text,
    body_text text,
    body_html text,
    headers jsonb,
    raw_email text,
    task_id uuid,
    submission_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_enc bytea,
    body_text_enc bytea,
    body_html_enc bytea,
    from_address_enc bytea,
    to_address_enc bytea,
    raw_email_enc bytea
);


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    user_id uuid,
    email text,
    ip_address text,
    user_agent text,
    country text,
    city text,
    device_fingerprint text,
    metadata jsonb DEFAULT '{}'::jsonb,
    resolved boolean DEFAULT false NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sms_forwards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_forwards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid,
    phone_number text NOT NULL,
    verification_code text NOT NULL,
    anosim_response jsonb,
    status text DEFAULT 'forwarded'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_completion_emails_sent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_completion_emails_sent (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    template_id uuid,
    recipient_email text NOT NULL,
    recipient_name text,
    subject text NOT NULL,
    content text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_by uuid
);


--
-- Name: task_completion_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_completion_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    subject text DEFAULT 'Auftrag erfolgreich abgeschlossen'::text NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    sender_email text DEFAULT 'info@payexpert-hr.com'::text,
    sender_name text DEFAULT 'PayExpert'::text
);


--
-- Name: task_email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    email_type text NOT NULL,
    subject text NOT NULL,
    content text NOT NULL,
    sender_email text,
    sender_name text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT task_email_templates_email_type_check CHECK ((email_type = ANY (ARRAY['opening'::text, 'completion'::text])))
);


--
-- Name: task_file_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_file_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid NOT NULL,
    step_id text NOT NULL,
    file_name text NOT NULL,
    base64_content text NOT NULL,
    file_size bigint NOT NULL,
    mime_type text NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_path text
);


--
-- Name: task_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    step_responses jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_data jsonb,
    checklist_completed boolean DEFAULT false,
    checklist_data jsonb
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'pending'::text,
    tags text[] DEFAULT '{}'::text[],
    assigned_to uuid,
    created_by uuid NOT NULL,
    due_date timestamp with time zone,
    estimated_hours numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb,
    task_type text,
    compensation_amount numeric,
    google_play_url text,
    apple_store_url text,
    is_starter_job boolean DEFAULT false,
    attachments jsonb DEFAULT '[]'::jsonb,
    email_required boolean DEFAULT false,
    email_account_id uuid,
    client_id uuid,
    image_url text,
    branding_url text,
    primary_color text,
    secondary_color text,
    accent_color text,
    logo_url text,
    images jsonb DEFAULT '[]'::jsonb,
    template_id uuid,
    send_opening_email boolean DEFAULT false NOT NULL,
    send_completion_email boolean DEFAULT false NOT NULL,
    category text DEFAULT 'sonstiges'::text NOT NULL,
    deadline_days integer DEFAULT 3 NOT NULL,
    default_info_text text
);


--
-- Name: telegram_id_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_id_map (
    short_id text NOT NULL,
    entity text NOT NULL,
    full_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '1 day'::interval) NOT NULL,
    short_id_enc bytea,
    entity_enc bytea,
    CONSTRAINT telegram_id_map_entity_check CHECK ((entity = ANY (ARRAY['profile'::text, 'virtual_employee'::text, 'chat_message'::text])))
);


--
-- Name: telegram_message_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_message_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id bigint NOT NULL,
    message_id bigint NOT NULL,
    scope text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '1 day'::interval) NOT NULL,
    scope_enc bytea
);


--
-- Name: telegram_monitoring; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_monitoring (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telegram_pending_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_pending_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id bigint NOT NULL,
    target_user_id uuid NOT NULL,
    persona_id text NOT NULL,
    original_message_id text NOT NULL,
    prompt_message_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:05:00'::interval) NOT NULL,
    original_message_id_enc bytea,
    persona_id_enc bytea
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_chat_messages_decrypted; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_chat_messages_decrypted WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    virtual_employee_id,
    role,
    is_read,
    replied_by,
    replied_at,
    created_at,
    public.decrypt_sensitive(message_enc) AS message,
    public.decrypt_sensitive(subject_enc) AS subject
   FROM public.chat_messages;


--
-- Name: v_email_forwards_decrypted; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_email_forwards_decrypted WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    email_account_id,
    task_id,
    received_at,
    created_at,
    public.decrypt_sensitive(subject_enc) AS subject,
    public.decrypt_sensitive(sender_enc) AS sender,
    public.decrypt_sensitive(body_enc) AS body,
    public.decrypt_sensitive(code_extracted_enc) AS code_extracted,
    public.decrypt_sensitive(link_extracted_enc) AS link_extracted
   FROM public.email_forwards;


--
-- Name: v_profiles_decrypted; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_profiles_decrypted WITH (security_invoker='true') AS
 SELECT id,
    email,
    first_name,
    last_name,
    salutation,
    verified,
    verification_method,
    created_at,
    updated_at,
    mentor_id,
    employment_type,
    country_of_birth,
    tax_class,
    marital_status,
    children_count,
    church_tax_liable,
    federal_state,
    start_date,
    signature_data,
    avatar_url,
    (public.decrypt_sensitive(birth_date_enc))::date AS birth_date,
    public.decrypt_sensitive(place_of_birth_enc) AS place_of_birth,
    public.decrypt_sensitive(nationality_enc) AS nationality,
    public.decrypt_sensitive(tax_id_enc) AS tax_id,
    public.decrypt_sensitive(social_security_number_enc) AS social_security_number,
    public.decrypt_sensitive(health_insurance_enc) AS health_insurance,
    public.decrypt_sensitive(iban_enc) AS iban,
    public.decrypt_sensitive(bic_enc) AS bic,
    public.decrypt_sensitive(account_holder_enc) AS account_holder,
    public.decrypt_sensitive(street_enc) AS street,
    public.decrypt_sensitive(postal_code_enc) AS postal_code,
    public.decrypt_sensitive(city_enc) AS city,
    public.decrypt_sensitive(alt_street_enc) AS alt_street,
    public.decrypt_sensitive(alt_postal_code_enc) AS alt_postal_code,
    public.decrypt_sensitive(alt_city_enc) AS alt_city,
    public.decrypt_sensitive(phone_enc) AS phone
   FROM public.profiles;


--
-- Name: v_received_emails_decrypted; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_received_emails_decrypted WITH (security_invoker='true') AS
 SELECT id,
    domain_id,
    task_id,
    submission_id,
    is_read,
    received_at,
    created_at,
    headers,
    public.decrypt_sensitive(subject_enc) AS subject,
    public.decrypt_sensitive(body_text_enc) AS body_text,
    public.decrypt_sensitive(body_html_enc) AS body_html,
    public.decrypt_sensitive(from_address_enc) AS from_address,
    public.decrypt_sensitive(to_address_enc) AS to_address
   FROM public.received_emails;


--
-- Name: verification_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    document_type text NOT NULL,
    file_path text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    base64_content text,
    file_size integer,
    mime_type text,
    extracted_surname text,
    extracted_given_names text,
    extracted_date_of_birth text,
    extracted_nationality text,
    extracted_place_of_birth text,
    extracted_expiry_date text,
    ai_confidence text,
    ai_reason text,
    extracted_surname_enc bytea,
    extracted_given_names_enc bytea,
    extracted_date_of_birth_enc bytea,
    extracted_nationality_enc bytea,
    extracted_place_of_birth_enc bytea,
    extracted_expiry_date_enc bytea,
    base64_content_enc bytea,
    ai_reason_enc bytea
);


--
-- Name: v_verification_uploads_decrypted; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_verification_uploads_decrypted WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    document_type,
    file_path,
    uploaded_at,
    file_size,
    mime_type,
    ai_confidence,
    public.decrypt_sensitive(extracted_surname_enc) AS extracted_surname,
    public.decrypt_sensitive(extracted_given_names_enc) AS extracted_given_names,
    (public.decrypt_sensitive(extracted_date_of_birth_enc))::date AS extracted_date_of_birth,
    public.decrypt_sensitive(extracted_nationality_enc) AS extracted_nationality,
    public.decrypt_sensitive(extracted_place_of_birth_enc) AS extracted_place_of_birth,
    (public.decrypt_sensitive(extracted_expiry_date_enc))::date AS extracted_expiry_date,
    public.decrypt_sensitive(base64_content_enc) AS base64_content,
    public.decrypt_sensitive(ai_reason_enc) AS ai_reason
   FROM public.verification_uploads;


--
-- Name: virtual_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.virtual_employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    department text NOT NULL,
    job_title text NOT NULL,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vmos_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vmos_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cloud_phone_id text NOT NULL,
    cloud_phone_name text,
    equipment_model text,
    android_version text,
    imei text,
    phone_number text,
    ip_address text,
    status text DEFAULT 'available'::text,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    last_synced_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: admin_presence admin_presence_admin_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_presence
    ADD CONSTRAINT admin_presence_admin_id_key UNIQUE (admin_id);


--
-- Name: admin_presence admin_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_presence
    ADD CONSTRAINT admin_presence_pkey PRIMARY KEY (id);


--
-- Name: agent_activity_log agent_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_activity_log
    ADD CONSTRAINT agent_activity_log_pkey PRIMARY KEY (id);


--
-- Name: agent_settings agent_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: business_hours business_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_contact company_contact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_contact
    ADD CONSTRAINT company_contact_pkey PRIMARY KEY (id);


--
-- Name: company_signature company_signature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_signature
    ADD CONSTRAINT company_signature_pkey PRIMARY KEY (id);


--
-- Name: contract_templates contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);


--
-- Name: email_accounts email_accounts_email_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_email_address_key UNIQUE (email_address);


--
-- Name: email_accounts email_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_pkey PRIMARY KEY (id);


--
-- Name: email_domains email_domains_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_domains
    ADD CONSTRAINT email_domains_domain_key UNIQUE (domain);


--
-- Name: email_domains email_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_domains
    ADD CONSTRAINT email_domains_pkey PRIMARY KEY (id);


--
-- Name: email_forwards email_forwards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwards
    ADD CONSTRAINT email_forwards_pkey PRIMARY KEY (id);


--
-- Name: email_send_logs email_send_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_logs
    ADD CONSTRAINT email_send_logs_pkey PRIMARY KEY (id);


--
-- Name: email_settings email_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_settings
    ADD CONSTRAINT email_settings_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_notes employee_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_notes
    ADD CONSTRAINT employee_notes_pkey PRIMARY KEY (id);


--
-- Name: employee_questionnaire employee_questionnaire_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_questionnaire
    ADD CONSTRAINT employee_questionnaire_pkey PRIMARY KEY (user_id);


--
-- Name: faq_responses faq_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_responses
    ADD CONSTRAINT faq_responses_pkey PRIMARY KEY (id);


--
-- Name: freelancer_invoices freelancer_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freelancer_invoices
    ADD CONSTRAINT freelancer_invoices_pkey PRIMARY KEY (id);


--
-- Name: freelancer_invoices freelancer_invoices_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freelancer_invoices
    ADD CONSTRAINT freelancer_invoices_submission_id_key UNIQUE (submission_id);


--
-- Name: generated_emails generated_emails_domain_id_local_part_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_emails
    ADD CONSTRAINT generated_emails_domain_id_local_part_key UNIQUE (domain_id, local_part);


--
-- Name: generated_emails generated_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_emails
    ADD CONSTRAINT generated_emails_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_user_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_user_id_month_year_key UNIQUE (user_id, month, year);


--
-- Name: phone_numbers phone_numbers_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_phone_number_key UNIQUE (phone_number);


--
-- Name: phone_numbers phone_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_pkey PRIMARY KEY (id);


--
-- Name: product_test_participations product_test_participations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_test_participations
    ADD CONSTRAINT product_test_participations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: received_emails received_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_emails
    ADD CONSTRAINT received_emails_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: sms_forwards sms_forwards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_forwards
    ADD CONSTRAINT sms_forwards_pkey PRIMARY KEY (id);


--
-- Name: task_completion_emails_sent task_completion_emails_sent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_emails_sent
    ADD CONSTRAINT task_completion_emails_sent_pkey PRIMARY KEY (id);


--
-- Name: task_completion_emails_sent task_completion_emails_sent_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_emails_sent
    ADD CONSTRAINT task_completion_emails_sent_submission_id_key UNIQUE (submission_id);


--
-- Name: task_completion_templates task_completion_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_templates
    ADD CONSTRAINT task_completion_templates_pkey PRIMARY KEY (id);


--
-- Name: task_completion_templates task_completion_templates_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_templates
    ADD CONSTRAINT task_completion_templates_task_id_key UNIQUE (task_id);


--
-- Name: task_email_templates task_email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_email_templates
    ADD CONSTRAINT task_email_templates_pkey PRIMARY KEY (id);


--
-- Name: task_email_templates task_email_templates_task_id_email_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_email_templates
    ADD CONSTRAINT task_email_templates_task_id_email_type_key UNIQUE (task_id, email_type);


--
-- Name: task_file_uploads task_file_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_file_uploads
    ADD CONSTRAINT task_file_uploads_pkey PRIMARY KEY (id);


--
-- Name: task_submissions task_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT task_submissions_pkey PRIMARY KEY (id);


--
-- Name: task_submissions task_submissions_task_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT task_submissions_task_id_employee_id_key UNIQUE (task_id, employee_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telegram_id_map telegram_id_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_id_map
    ADD CONSTRAINT telegram_id_map_pkey PRIMARY KEY (short_id);


--
-- Name: telegram_message_registry telegram_message_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_message_registry
    ADD CONSTRAINT telegram_message_registry_pkey PRIMARY KEY (id);


--
-- Name: telegram_monitoring telegram_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_monitoring
    ADD CONSTRAINT telegram_monitoring_pkey PRIMARY KEY (id);


--
-- Name: telegram_pending_replies telegram_pending_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_pending_replies
    ADD CONSTRAINT telegram_pending_replies_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: verification_uploads verification_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_uploads
    ADD CONSTRAINT verification_uploads_pkey PRIMARY KEY (id);


--
-- Name: virtual_employees virtual_employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_employees
    ADD CONSTRAINT virtual_employees_email_key UNIQUE (email);


--
-- Name: virtual_employees virtual_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.virtual_employees
    ADD CONSTRAINT virtual_employees_pkey PRIMARY KEY (id);


--
-- Name: vmos_devices vmos_devices_cloud_phone_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vmos_devices
    ADD CONSTRAINT vmos_devices_cloud_phone_id_key UNIQUE (cloud_phone_id);


--
-- Name: vmos_devices vmos_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vmos_devices
    ADD CONSTRAINT vmos_devices_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_task_id ON public.activity_logs USING btree (task_id);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_admin_notifications_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_admin_id ON public.admin_notifications USING btree (admin_id);


--
-- Name: idx_admin_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_is_read ON public.admin_notifications USING btree (is_read);


--
-- Name: idx_applications_unique_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_applications_unique_email_active ON public.applications USING btree (email) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at DESC);


--
-- Name: idx_chat_messages_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_is_read ON public.chat_messages USING btree (is_read) WHERE (is_read = false);


--
-- Name: idx_chat_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_user_id ON public.chat_messages USING btree (user_id);


--
-- Name: idx_chat_messages_virtual_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_virtual_employee ON public.chat_messages USING btree (virtual_employee_id);


--
-- Name: idx_freelancer_invoices_payout_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freelancer_invoices_payout_status ON public.freelancer_invoices USING btree (payout_status) WHERE (payout_status = ANY (ARRAY['requested'::text, 'approved'::text]));


--
-- Name: idx_freelancer_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freelancer_invoices_status ON public.freelancer_invoices USING btree (status);


--
-- Name: idx_freelancer_invoices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_freelancer_invoices_user_id ON public.freelancer_invoices USING btree (user_id);


--
-- Name: idx_generated_emails_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_emails_domain ON public.generated_emails USING btree (domain_id);


--
-- Name: idx_generated_emails_full_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_emails_full_address ON public.generated_emails USING btree (full_address);


--
-- Name: idx_generated_emails_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_emails_task ON public.generated_emails USING btree (task_id);


--
-- Name: idx_payroll_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_user_date ON public.payroll USING btree (user_id, year, month);


--
-- Name: idx_profiles_mentor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_mentor_id ON public.profiles USING btree (mentor_id);


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_received_emails_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_emails_domain ON public.received_emails USING btree (domain_id);


--
-- Name: idx_received_emails_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_emails_received_at ON public.received_emails USING btree (received_at DESC);


--
-- Name: idx_received_emails_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_emails_task ON public.received_emails USING btree (task_id);


--
-- Name: idx_received_emails_to_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_emails_to_address ON public.received_emails USING btree (to_address);


--
-- Name: idx_security_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_created_at ON public.security_events USING btree (created_at DESC);


--
-- Name: idx_security_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_event_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_events_severity ON public.security_events USING btree (severity);


--
-- Name: idx_sms_forwards_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_forwards_created_at ON public.sms_forwards USING btree (created_at DESC);


--
-- Name: idx_sms_forwards_submission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_forwards_submission_id ON public.sms_forwards USING btree (submission_id);


--
-- Name: idx_task_file_uploads_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_file_uploads_step ON public.task_file_uploads USING btree (step_id);


--
-- Name: idx_task_file_uploads_user_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_file_uploads_user_task ON public.task_file_uploads USING btree (user_id, task_id);


--
-- Name: idx_tasks_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_client_id ON public.tasks USING btree (client_id);


--
-- Name: idx_tasks_unique_template_title; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tasks_unique_template_title ON public.tasks USING btree (title) WHERE (assigned_to IS NULL);


--
-- Name: idx_telegram_monitoring_chat_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_telegram_monitoring_chat_active ON public.telegram_monitoring USING btree (chat_id) WHERE (is_active = true);


--
-- Name: idx_telegram_pending_replies_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_pending_replies_chat ON public.telegram_pending_replies USING btree (chat_id);


--
-- Name: product_test_participations_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_test_participations_unique_idx ON public.product_test_participations USING btree (task_id, user_id, step_id);


--
-- Name: telegram_id_map_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telegram_id_map_entity_idx ON public.telegram_id_map USING btree (entity);


--
-- Name: telegram_id_map_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telegram_id_map_expires_at_idx ON public.telegram_id_map USING btree (expires_at);


--
-- Name: telegram_message_registry_scope_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telegram_message_registry_scope_chat ON public.telegram_message_registry USING btree (scope, chat_id);


--
-- Name: telegram_message_registry_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX telegram_message_registry_unique ON public.telegram_message_registry USING btree (chat_id, message_id, scope);


--
-- Name: uniq_user_roles_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_user_roles_user_role ON public.user_roles USING btree (user_id, role);


--
-- Name: profiles on_employee_verified; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_employee_verified BEFORE UPDATE OF verified ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_assign_mentor_on_verification();


--
-- Name: chat_messages on_new_user_chat_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_user_chat_message AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_user_message();


--
-- Name: profiles on_profile_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: task_submissions prevent_employee_task_self_approval_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_employee_task_self_approval_trigger BEFORE UPDATE ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.prevent_employee_task_self_approval();


--
-- Name: employee_questionnaire set_questionnaire_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_questionnaire_updated_at BEFORE UPDATE ON public.employee_questionnaire FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: chat_messages trg_encrypt_chat_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encrypt_chat_messages BEFORE INSERT OR UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_chat_messages();


--
-- Name: email_forwards trg_encrypt_email_forwards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encrypt_email_forwards BEFORE INSERT OR UPDATE ON public.email_forwards FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_email_forwards();


--
-- Name: profiles trg_encrypt_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encrypt_profiles BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_profiles();


--
-- Name: received_emails trg_encrypt_received_emails; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encrypt_received_emails BEFORE INSERT OR UPDATE ON public.received_emails FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_received_emails();


--
-- Name: verification_uploads trg_encrypt_verification_uploads; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_encrypt_verification_uploads BEFORE INSERT OR UPDATE ON public.verification_uploads FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_verification_uploads();


--
-- Name: profiles trigger_auto_assign_mentor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_mentor BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.auto_assign_mentor();


--
-- Name: tasks trigger_cleanup_task_submissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cleanup_task_submissions BEFORE DELETE OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.cleanup_task_submissions();


--
-- Name: tasks trigger_sync_template_to_assigned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_template_to_assigned AFTER UPDATE ON public.tasks FOR EACH ROW WHEN (((old.assigned_to IS NULL) AND (new.assigned_to IS NULL))) EXECUTE FUNCTION public.sync_template_to_assigned_tasks();


--
-- Name: chat_messages trigger_telegram_chat_forward; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_telegram_chat_forward AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.notify_telegram_on_chat_message();


--
-- Name: agent_settings update_agent_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agent_settings_updated_at BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: business_hours update_business_hours_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_business_hours_updated_at BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_contact update_company_contact_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_contact_updated_at BEFORE UPDATE ON public.company_contact FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: company_signature update_company_signature_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_signature_updated_at BEFORE UPDATE ON public.company_signature FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: contract_templates update_contract_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON public.contract_templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: email_accounts update_email_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: email_domains update_email_domains_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_domains_updated_at BEFORE UPDATE ON public.email_domains FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: email_settings update_email_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_settings_updated_at BEFORE UPDATE ON public.email_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employee_documents update_employee_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_employee_documents_updated_at BEFORE UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: faq_responses update_faq_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_faq_responses_updated_at BEFORE UPDATE ON public.faq_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: freelancer_invoices update_freelancer_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_freelancer_invoices_updated_at BEFORE UPDATE ON public.freelancer_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payroll update_payroll_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: phone_numbers update_phone_numbers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON public.phone_numbers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_test_participations update_product_test_participations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_test_participations_updated_at BEFORE UPDATE ON public.product_test_participations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: task_completion_templates update_task_completion_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_task_completion_templates_updated_at BEFORE UPDATE ON public.task_completion_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: task_email_templates update_task_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_task_email_templates_updated_at BEFORE UPDATE ON public.task_email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: task_submissions update_task_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_task_submissions_updated_at BEFORE UPDATE ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: virtual_employees update_virtual_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_virtual_employees_updated_at BEFORE UPDATE ON public.virtual_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vmos_devices update_vmos_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vmos_devices_updated_at BEFORE UPDATE ON public.vmos_devices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: activity_logs activity_logs_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: admin_notifications admin_notifications_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id);


--
-- Name: agent_activity_log agent_activity_log_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_activity_log
    ADD CONSTRAINT agent_activity_log_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE SET NULL;


--
-- Name: agent_settings agent_settings_preferred_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_preferred_domain_id_fkey FOREIGN KEY (preferred_domain_id) REFERENCES public.email_domains(id) ON DELETE SET NULL;


--
-- Name: applications applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: chat_messages chat_messages_replied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_virtual_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_virtual_employee_id_fkey FOREIGN KEY (virtual_employee_id) REFERENCES public.virtual_employees(id);


--
-- Name: email_accounts email_accounts_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_accounts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_forwards email_forwards_email_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwards
    ADD CONSTRAINT email_forwards_email_account_id_fkey FOREIGN KEY (email_account_id) REFERENCES public.email_accounts(id) ON DELETE CASCADE;


--
-- Name: email_forwards email_forwards_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwards
    ADD CONSTRAINT email_forwards_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: email_forwards email_forwards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwards
    ADD CONSTRAINT email_forwards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: employee_documents employee_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: employee_questionnaire employee_questionnaire_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_questionnaire
    ADD CONSTRAINT employee_questionnaire_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: freelancer_invoices freelancer_invoices_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freelancer_invoices
    ADD CONSTRAINT freelancer_invoices_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE CASCADE;


--
-- Name: freelancer_invoices freelancer_invoices_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freelancer_invoices
    ADD CONSTRAINT freelancer_invoices_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: freelancer_invoices freelancer_invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freelancer_invoices
    ADD CONSTRAINT freelancer_invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: generated_emails generated_emails_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_emails
    ADD CONSTRAINT generated_emails_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.email_domains(id) ON DELETE CASCADE;


--
-- Name: generated_emails generated_emails_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_emails
    ADD CONSTRAINT generated_emails_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE SET NULL;


--
-- Name: generated_emails generated_emails_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_emails
    ADD CONSTRAINT generated_emails_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: generated_emails generated_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_emails
    ADD CONSTRAINT generated_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: phone_numbers phone_numbers_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: product_test_participations product_test_participations_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_test_participations
    ADD CONSTRAINT product_test_participations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE CASCADE;


--
-- Name: product_test_participations product_test_participations_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_test_participations
    ADD CONSTRAINT product_test_participations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: product_test_participations product_test_participations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_test_participations
    ADD CONSTRAINT product_test_participations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_mentor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_mentor_id_fkey FOREIGN KEY (mentor_id) REFERENCES public.virtual_employees(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: received_emails received_emails_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_emails
    ADD CONSTRAINT received_emails_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.email_domains(id) ON DELETE CASCADE;


--
-- Name: received_emails received_emails_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_emails
    ADD CONSTRAINT received_emails_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE SET NULL;


--
-- Name: received_emails received_emails_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_emails
    ADD CONSTRAINT received_emails_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: sms_forwards sms_forwards_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_forwards
    ADD CONSTRAINT sms_forwards_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE CASCADE;


--
-- Name: task_completion_emails_sent task_completion_emails_sent_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_emails_sent
    ADD CONSTRAINT task_completion_emails_sent_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id);


--
-- Name: task_completion_emails_sent task_completion_emails_sent_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_emails_sent
    ADD CONSTRAINT task_completion_emails_sent_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id) ON DELETE CASCADE;


--
-- Name: task_completion_emails_sent task_completion_emails_sent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_emails_sent
    ADD CONSTRAINT task_completion_emails_sent_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.task_completion_templates(id) ON DELETE SET NULL;


--
-- Name: task_completion_templates task_completion_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_templates
    ADD CONSTRAINT task_completion_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: task_completion_templates task_completion_templates_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_completion_templates
    ADD CONSTRAINT task_completion_templates_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_email_templates task_email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_email_templates
    ADD CONSTRAINT task_email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: task_email_templates task_email_templates_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_email_templates
    ADD CONSTRAINT task_email_templates_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_file_uploads task_file_uploads_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_file_uploads
    ADD CONSTRAINT task_file_uploads_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_submissions task_submissions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT task_submissions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: task_submissions task_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT task_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: task_submissions task_submissions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_submissions
    ADD CONSTRAINT task_submissions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_email_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_email_account_id_fkey FOREIGN KEY (email_account_id) REFERENCES public.email_accounts(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: telegram_pending_replies telegram_pending_replies_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_pending_replies
    ADD CONSTRAINT telegram_pending_replies_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vmos_devices vmos_devices_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vmos_devices
    ADD CONSTRAINT vmos_devices_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: applications Admins can delete applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete applications" ON public.applications FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employee_documents Admins can delete documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete documents" ON public.employee_documents FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_domains Admins can delete domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete domains" ON public.email_domains FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: generated_emails Admins can delete generated emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete generated emails" ON public.generated_emails FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_messages Admins can delete messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete messages" ON public.chat_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: employee_notes Admins can delete own employee notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete own employee notes" ON public.employee_notes FOR DELETE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (auth.uid() = created_by)));


--
-- Name: admin_notifications Admins can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete own notifications" ON public.admin_notifications FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can delete profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: received_emails Admins can delete received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete received emails" ON public.received_emails FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: verification_uploads Admins can delete verification uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete verification uploads" ON public.verification_uploads FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_domains Admins can insert domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert domains" ON public.email_domains FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_settings Admins can insert email settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert email settings" ON public.email_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: faq_responses Admins can manage FAQs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage FAQs" ON public.faq_responses USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_settings Admins can manage agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage agent settings" ON public.agent_settings USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: vmos_devices Admins can manage all VMOS devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all VMOS devices" ON public.vmos_devices USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: freelancer_invoices Admins can manage all freelancer invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all freelancer invoices" ON public.freelancer_invoices USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payroll Admins can manage all payroll; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all payroll" ON public.payroll USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_submissions Admins can manage all task submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all task submissions" ON public.task_submissions USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: tasks Admins can manage all tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all tasks" ON public.tasks USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: business_hours Admins can manage business hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage business hours" ON public.business_hours USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: clients Admins can manage clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage clients" ON public.clients USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: company_contact Admins can manage company contact; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage company contact" ON public.company_contact USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: company_signature Admins can manage company signature; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage company signature" ON public.company_signature USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_completion_emails_sent Admins can manage completion emails sent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage completion emails sent" ON public.task_completion_emails_sent USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: contract_templates Admins can manage contract templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage contract templates" ON public.contract_templates USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_accounts Admins can manage email accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage email accounts" ON public.email_accounts USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_forwards Admins can manage email forwards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage email forwards" ON public.email_forwards USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_send_logs Admins can manage email send logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage email send logs" ON public.email_send_logs USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates Admins can manage email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage email templates" ON public.email_templates USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_presence Admins can manage own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage own presence" ON public.admin_presence USING ((auth.uid() = admin_id)) WITH CHECK ((auth.uid() = admin_id));


--
-- Name: phone_numbers Admins can manage phone numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage phone numbers" ON public.phone_numbers TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: security_events Admins can manage security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage security events" ON public.security_events TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_completion_templates Admins can manage task completion templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage task completion templates" ON public.task_completion_templates USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: task_email_templates Admins can manage task email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage task email templates" ON public.task_email_templates TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: virtual_employees Admins can manage virtual employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage virtual employees" ON public.virtual_employees USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: push_subscriptions Admins can read all push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all push subscriptions" ON public.push_subscriptions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: received_emails Admins can read all received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all received emails" ON public.received_emails FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: applications Admins can update applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update applications" ON public.applications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employee_documents Admins can update documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update documents" ON public.employee_documents FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_domains Admins can update domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update domains" ON public.email_domains FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_settings Admins can update email settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update email settings" ON public.email_settings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: generated_emails Admins can update generated emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update generated emails" ON public.generated_emails FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_messages Admins can update messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update messages" ON public.chat_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: employee_notes Admins can update own employee notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update own employee notes" ON public.employee_notes FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) AND (auth.uid() = created_by)));


--
-- Name: admin_notifications Admins can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update own notifications" ON public.admin_notifications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_test_participations Admins can update product test participations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update product test participations" ON public.product_test_participations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: received_emails Admins can update received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update received emails" ON public.received_emails FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_activity_log Admins can view agent logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view agent logs" ON public.agent_activity_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: applications Admins can view all applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all applications" ON public.applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employee_documents Admins can view all documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all documents" ON public.employee_documents FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_domains Admins can view all domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all domains" ON public.email_domains FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employee_notes Admins can view all employee notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all employee notes" ON public.employee_notes FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: generated_emails Admins can view all generated emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all generated emails" ON public.generated_emails FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_messages Admins can view all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all messages" ON public.chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: received_emails Admins can view all received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all received emails" ON public.received_emails FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: task_file_uploads Admins can view all task files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all task files" ON public.task_file_uploads FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: verification_uploads Admins can view all uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all uploads" ON public.verification_uploads FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_settings Admins can view email settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view email settings" ON public.email_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: admin_notifications Admins can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view own notifications" ON public.admin_notifications FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: activity_logs Admins können alle Activity-Logs sehen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins können alle Activity-Logs sehen" ON public.activity_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: sms_forwards Admins können alle SMS-Forwards sehen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins können alle SMS-Forwards sehen" ON public.sms_forwards FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: company_contact Anyone can view company contact; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view company contact" ON public.company_contact FOR SELECT TO authenticated, anon USING (true);


--
-- Name: company_signature Authenticated can view company signature; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can view company signature" ON public.company_signature FOR SELECT TO authenticated USING (true);


--
-- Name: virtual_employees Authenticated users can view active virtual employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view active virtual employees" ON public.virtual_employees FOR SELECT USING ((is_active = true));


--
-- Name: employee_documents Employees can delete own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can delete own documents" ON public.employee_documents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: task_submissions Employees can insert own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can insert own submissions" ON public.task_submissions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = employee_id));


--
-- Name: received_emails Employees can read emails addressed to them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can read emails addressed to them" ON public.received_emails FOR SELECT USING ((to_address = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: received_emails Employees can read their submission emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can read their submission emails" ON public.received_emails FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.task_submissions ts
  WHERE ((ts.id = received_emails.submission_id) AND (ts.employee_id = auth.uid())))) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: received_emails Employees can update emails addressed to them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update emails addressed to them" ON public.received_emails FOR UPDATE USING ((to_address = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: employee_documents Employees can update own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update own documents" ON public.employee_documents FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: task_submissions Employees can update own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update own submissions" ON public.task_submissions FOR UPDATE USING ((auth.uid() = employee_id));


--
-- Name: received_emails Employees can update their emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can update their emails" ON public.received_emails FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.task_submissions ts
  WHERE ((ts.id = received_emails.submission_id) AND (ts.employee_id = auth.uid())))));


--
-- Name: vmos_devices Employees can view assigned devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view assigned devices" ON public.vmos_devices FOR SELECT USING ((auth.uid() = assigned_to));


--
-- Name: phone_numbers Employees can view assigned phone numbers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view assigned phone numbers" ON public.phone_numbers FOR SELECT TO authenticated USING ((auth.uid() = assigned_to));


--
-- Name: tasks Employees can view assigned tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view assigned tasks" ON public.tasks FOR SELECT USING ((auth.uid() = assigned_to));


--
-- Name: clients Employees can view clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view clients" ON public.clients FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE (user_roles.user_id = auth.uid()))));


--
-- Name: email_accounts Employees can view own assigned email account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own assigned email account" ON public.email_accounts FOR SELECT TO authenticated USING ((auth.uid() = assigned_to));


--
-- Name: employee_documents Employees can view own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own documents" ON public.employee_documents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: payroll Employees can view own payroll; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own payroll" ON public.payroll FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: task_submissions Employees can view own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view own submissions" ON public.task_submissions FOR SELECT USING ((auth.uid() = employee_id));


--
-- Name: faq_responses Everyone can view active FAQs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active FAQs" ON public.faq_responses FOR SELECT USING ((is_active = true));


--
-- Name: freelancer_invoices Freelancers can request payout; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Freelancers can request payout" ON public.freelancer_invoices FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: freelancer_invoices Freelancers can view own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Freelancers can view own invoices" ON public.freelancer_invoices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: telegram_id_map No direct access to telegram_id_map; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct access to telegram_id_map" ON public.telegram_id_map USING (false) WITH CHECK (false);


--
-- Name: agent_activity_log Service role can manage agent logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage agent logs" ON public.agent_activity_log USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: telegram_pending_replies Service role can manage pending replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage pending replies" ON public.telegram_pending_replies USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: security_events Service role can manage security events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage security events" ON public.security_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: telegram_message_registry Service role can manage telegram message registry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage telegram message registry" ON public.telegram_message_registry USING ((current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text)) WITH CHECK ((current_setting('request.jwt.claim.role'::text, true) = 'service_role'::text));


--
-- Name: telegram_monitoring Service role can manage telegram monitoring; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage telegram monitoring" ON public.telegram_monitoring USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: agent_settings Service role can read agent settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read agent settings" ON public.agent_settings FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: product_test_participations Users can create own product test participations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own product test participations" ON public.product_test_participations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: employee_documents Users can delete own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own documents" ON public.employee_documents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: verification_uploads Users can delete own verification uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own verification uploads" ON public.verification_uploads FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: task_file_uploads Users can delete their own task files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own task files" ON public.task_file_uploads FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: verification_uploads Users can insert own uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own uploads" ON public.verification_uploads FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: verification_uploads Users can insert own verification uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own verification uploads" ON public.verification_uploads FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: verification_uploads Users can update own verification uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own verification uploads" ON public.verification_uploads FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: task_file_uploads Users can upload their own task files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upload their own task files" ON public.task_file_uploads FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_messages Users can view messages they sent to virtual employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages they sent to virtual employees" ON public.chat_messages FOR SELECT USING (((auth.uid() = user_id) AND (virtual_employee_id IS NOT NULL)));


--
-- Name: employee_documents Users can view own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own documents" ON public.employee_documents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: generated_emails Users can view own generated emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own generated emails" ON public.generated_emails FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: product_test_participations Users can view own product test participations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own product test participations" ON public.product_test_participations FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: verification_uploads Users can view own uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own uploads" ON public.verification_uploads FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: verification_uploads Users can view own verification uploads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own verification uploads" ON public.verification_uploads FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: email_forwards Users can view their own email forwards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own email forwards" ON public.email_forwards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_messages Users can view their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own messages" ON public.chat_messages FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: task_file_uploads Users can view their own task files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own task files" ON public.task_file_uploads FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: employee_questionnaire Users manage own questionnaire; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own questionnaire" ON public.employee_questionnaire USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: notification_preferences Users manage their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own notification preferences" ON public.notification_preferences USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users manage their own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage their own push subscriptions" ON public.push_subscriptions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: applications admins_insert_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_insert_applications ON public.applications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: employee_notes admins_insert_employee_notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_insert_employee_notes ON public.employee_notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: generated_emails admins_insert_generated_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_insert_generated_emails ON public.generated_emails FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contract_templates admins_view_contract_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_view_contract_templates ON public.contract_templates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_templates anyone_can_view_active_contract_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_can_view_active_contract_templates ON public.contract_templates FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs authenticated_insert_activity_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_insert_activity_logs ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: business_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: company_contact; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_contact ENABLE ROW LEVEL SECURITY;

--
-- Name: company_signature; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_signature ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: email_forwards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_forwards ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: email_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_questionnaire; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_questionnaire ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notifications employees_can_notify_admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_can_notify_admins ON public.admin_notifications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: received_emails employees_insert_general_confirmations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_insert_general_confirmations ON public.received_emails FOR INSERT TO authenticated WITH CHECK (((submission_id IS NULL) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid())))));


--
-- Name: received_emails employees_insert_replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_insert_replies ON public.received_emails FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.task_submissions ts
  WHERE ((ts.id = received_emails.submission_id) AND (ts.employee_id = auth.uid())))));


--
-- Name: faq_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faq_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: freelancer_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.freelancer_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: generated_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generated_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

--
-- Name: phone_numbers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: product_test_participations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_test_participations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: applications public_submit_applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_submit_applications ON public.applications FOR INSERT TO authenticated, anon WITH CHECK (((status = 'pending'::text) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL)));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: received_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_forwards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_forwards ENABLE ROW LEVEL SECURITY;

--
-- Name: task_completion_emails_sent; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_completion_emails_sent ENABLE ROW LEVEL SECURITY;

--
-- Name: task_completion_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_completion_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: task_email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: task_file_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_file_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: task_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_id_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_id_map ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_message_registry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_message_registry ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_monitoring; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_monitoring ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_pending_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_pending_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents users_insert_own_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_own_documents ON public.employee_documents FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_messages users_insert_own_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_own_messages ON public.chat_messages FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles users_insert_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_own_profile ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: verification_uploads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.verification_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: virtual_employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.virtual_employees ENABLE ROW LEVEL SECURITY;

--
-- Name: vmos_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vmos_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _get_pgp_key(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._get_pgp_key() TO anon;
GRANT ALL ON FUNCTION public._get_pgp_key() TO authenticated;
GRANT ALL ON FUNCTION public._get_pgp_key() TO service_role;


--
-- Name: FUNCTION assign_missing_mentors(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.assign_missing_mentors() TO anon;
GRANT ALL ON FUNCTION public.assign_missing_mentors() TO authenticated;
GRANT ALL ON FUNCTION public.assign_missing_mentors() TO service_role;


--
-- Name: FUNCTION auto_assign_mentor(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_assign_mentor() TO anon;
GRANT ALL ON FUNCTION public.auto_assign_mentor() TO authenticated;
GRANT ALL ON FUNCTION public.auto_assign_mentor() TO service_role;


--
-- Name: FUNCTION auto_assign_mentor_on_verification(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.auto_assign_mentor_on_verification() TO anon;
GRANT ALL ON FUNCTION public.auto_assign_mentor_on_verification() TO authenticated;
GRANT ALL ON FUNCTION public.auto_assign_mentor_on_verification() TO service_role;


--
-- Name: FUNCTION check_brute_force(_identifier text, _action text, _window_minutes integer, _max_attempts integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_brute_force(_identifier text, _action text, _window_minutes integer, _max_attempts integer) TO anon;
GRANT ALL ON FUNCTION public.check_brute_force(_identifier text, _action text, _window_minutes integer, _max_attempts integer) TO authenticated;
GRANT ALL ON FUNCTION public.check_brute_force(_identifier text, _action text, _window_minutes integer, _max_attempts integer) TO service_role;


--
-- Name: FUNCTION cleanup_expired_telegram_id_map(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_expired_telegram_id_map() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_telegram_id_map() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_telegram_id_map() TO service_role;


--
-- Name: FUNCTION cleanup_expired_telegram_replies(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_expired_telegram_replies() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_telegram_replies() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_telegram_replies() TO service_role;


--
-- Name: FUNCTION cleanup_task_submissions(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_task_submissions() TO anon;
GRANT ALL ON FUNCTION public.cleanup_task_submissions() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_task_submissions() TO service_role;


--
-- Name: FUNCTION decrypt_sensitive(_cipher bytea); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.decrypt_sensitive(_cipher bytea) TO anon;
GRANT ALL ON FUNCTION public.decrypt_sensitive(_cipher bytea) TO authenticated;
GRANT ALL ON FUNCTION public.decrypt_sensitive(_cipher bytea) TO service_role;


--
-- Name: FUNCTION encrypt_sensitive(_plain text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.encrypt_sensitive(_plain text) TO anon;
GRANT ALL ON FUNCTION public.encrypt_sensitive(_plain text) TO authenticated;
GRANT ALL ON FUNCTION public.encrypt_sensitive(_plain text) TO service_role;


--
-- Name: FUNCTION generate_invoice_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_invoice_number() TO anon;
GRANT ALL ON FUNCTION public.generate_invoice_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_invoice_number() TO service_role;


--
-- Name: FUNCTION get_security_stats(_hours integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_security_stats(_hours integer) TO anon;
GRANT ALL ON FUNCTION public.get_security_stats(_hours integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_security_stats(_hours integer) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_updated_at() TO anon;
GRANT ALL ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION notify_admin_on_user_message(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_admin_on_user_message() TO anon;
GRANT ALL ON FUNCTION public.notify_admin_on_user_message() TO authenticated;
GRANT ALL ON FUNCTION public.notify_admin_on_user_message() TO service_role;


--
-- Name: FUNCTION notify_telegram_on_chat_message(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_telegram_on_chat_message() TO anon;
GRANT ALL ON FUNCTION public.notify_telegram_on_chat_message() TO authenticated;
GRANT ALL ON FUNCTION public.notify_telegram_on_chat_message() TO service_role;


--
-- Name: FUNCTION prevent_employee_task_self_approval(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_employee_task_self_approval() TO anon;
GRANT ALL ON FUNCTION public.prevent_employee_task_self_approval() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_employee_task_self_approval() TO service_role;


--
-- Name: FUNCTION sync_template_to_assigned_tasks(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_template_to_assigned_tasks() TO anon;
GRANT ALL ON FUNCTION public.sync_template_to_assigned_tasks() TO authenticated;
GRANT ALL ON FUNCTION public.sync_template_to_assigned_tasks() TO service_role;


--
-- Name: FUNCTION trg_encrypt_chat_messages(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_encrypt_chat_messages() TO anon;
GRANT ALL ON FUNCTION public.trg_encrypt_chat_messages() TO authenticated;
GRANT ALL ON FUNCTION public.trg_encrypt_chat_messages() TO service_role;


--
-- Name: FUNCTION trg_encrypt_email_forwards(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_encrypt_email_forwards() TO anon;
GRANT ALL ON FUNCTION public.trg_encrypt_email_forwards() TO authenticated;
GRANT ALL ON FUNCTION public.trg_encrypt_email_forwards() TO service_role;


--
-- Name: FUNCTION trg_encrypt_profiles(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_encrypt_profiles() TO anon;
GRANT ALL ON FUNCTION public.trg_encrypt_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.trg_encrypt_profiles() TO service_role;


--
-- Name: FUNCTION trg_encrypt_received_emails(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_encrypt_received_emails() TO anon;
GRANT ALL ON FUNCTION public.trg_encrypt_received_emails() TO authenticated;
GRANT ALL ON FUNCTION public.trg_encrypt_received_emails() TO service_role;


--
-- Name: FUNCTION trg_encrypt_verification_uploads(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_encrypt_verification_uploads() TO anon;
GRANT ALL ON FUNCTION public.trg_encrypt_verification_uploads() TO authenticated;
GRANT ALL ON FUNCTION public.trg_encrypt_verification_uploads() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE admin_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_notifications TO anon;
GRANT ALL ON TABLE public.admin_notifications TO authenticated;
GRANT ALL ON TABLE public.admin_notifications TO service_role;


--
-- Name: TABLE admin_presence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_presence TO anon;
GRANT ALL ON TABLE public.admin_presence TO authenticated;
GRANT ALL ON TABLE public.admin_presence TO service_role;


--
-- Name: TABLE agent_activity_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_activity_log TO anon;
GRANT ALL ON TABLE public.agent_activity_log TO authenticated;
GRANT ALL ON TABLE public.agent_activity_log TO service_role;


--
-- Name: TABLE agent_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_settings TO anon;
GRANT ALL ON TABLE public.agent_settings TO authenticated;
GRANT ALL ON TABLE public.agent_settings TO service_role;


--
-- Name: TABLE applications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.applications TO anon;
GRANT ALL ON TABLE public.applications TO authenticated;
GRANT ALL ON TABLE public.applications TO service_role;


--
-- Name: TABLE business_hours; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.business_hours TO anon;
GRANT ALL ON TABLE public.business_hours TO authenticated;
GRANT ALL ON TABLE public.business_hours TO service_role;


--
-- Name: TABLE chat_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE company_contact; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_contact TO anon;
GRANT ALL ON TABLE public.company_contact TO authenticated;
GRANT ALL ON TABLE public.company_contact TO service_role;


--
-- Name: TABLE company_signature; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.company_signature TO anon;
GRANT ALL ON TABLE public.company_signature TO authenticated;
GRANT ALL ON TABLE public.company_signature TO service_role;


--
-- Name: TABLE contract_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contract_templates TO anon;
GRANT ALL ON TABLE public.contract_templates TO authenticated;
GRANT ALL ON TABLE public.contract_templates TO service_role;


--
-- Name: TABLE email_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_accounts TO anon;
GRANT ALL ON TABLE public.email_accounts TO authenticated;
GRANT ALL ON TABLE public.email_accounts TO service_role;


--
-- Name: TABLE email_domains; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_domains TO anon;
GRANT ALL ON TABLE public.email_domains TO authenticated;
GRANT ALL ON TABLE public.email_domains TO service_role;


--
-- Name: TABLE email_forwards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_forwards TO anon;
GRANT ALL ON TABLE public.email_forwards TO authenticated;
GRANT ALL ON TABLE public.email_forwards TO service_role;


--
-- Name: TABLE email_send_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_send_logs TO anon;
GRANT ALL ON TABLE public.email_send_logs TO authenticated;
GRANT ALL ON TABLE public.email_send_logs TO service_role;


--
-- Name: TABLE email_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_settings TO anon;
GRANT ALL ON TABLE public.email_settings TO authenticated;
GRANT ALL ON TABLE public.email_settings TO service_role;


--
-- Name: TABLE email_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_templates TO anon;
GRANT ALL ON TABLE public.email_templates TO authenticated;
GRANT ALL ON TABLE public.email_templates TO service_role;


--
-- Name: TABLE employee_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_documents TO anon;
GRANT ALL ON TABLE public.employee_documents TO authenticated;
GRANT ALL ON TABLE public.employee_documents TO service_role;


--
-- Name: TABLE employee_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_notes TO anon;
GRANT ALL ON TABLE public.employee_notes TO authenticated;
GRANT ALL ON TABLE public.employee_notes TO service_role;


--
-- Name: TABLE employee_questionnaire; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employee_questionnaire TO anon;
GRANT ALL ON TABLE public.employee_questionnaire TO authenticated;
GRANT ALL ON TABLE public.employee_questionnaire TO service_role;


--
-- Name: TABLE faq_responses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.faq_responses TO anon;
GRANT ALL ON TABLE public.faq_responses TO authenticated;
GRANT ALL ON TABLE public.faq_responses TO service_role;


--
-- Name: TABLE freelancer_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.freelancer_invoices TO anon;
GRANT ALL ON TABLE public.freelancer_invoices TO authenticated;
GRANT ALL ON TABLE public.freelancer_invoices TO service_role;


--
-- Name: TABLE generated_emails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.generated_emails TO anon;
GRANT ALL ON TABLE public.generated_emails TO authenticated;
GRANT ALL ON TABLE public.generated_emails TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE payroll; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payroll TO anon;
GRANT ALL ON TABLE public.payroll TO authenticated;
GRANT ALL ON TABLE public.payroll TO service_role;


--
-- Name: TABLE phone_numbers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.phone_numbers TO anon;
GRANT ALL ON TABLE public.phone_numbers TO authenticated;
GRANT ALL ON TABLE public.phone_numbers TO service_role;


--
-- Name: TABLE product_test_participations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_test_participations TO anon;
GRANT ALL ON TABLE public.product_test_participations TO authenticated;
GRANT ALL ON TABLE public.product_test_participations TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE received_emails; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.received_emails TO anon;
GRANT ALL ON TABLE public.received_emails TO authenticated;
GRANT ALL ON TABLE public.received_emails TO service_role;


--
-- Name: TABLE security_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.security_events TO anon;
GRANT ALL ON TABLE public.security_events TO authenticated;
GRANT ALL ON TABLE public.security_events TO service_role;


--
-- Name: TABLE sms_forwards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sms_forwards TO anon;
GRANT ALL ON TABLE public.sms_forwards TO authenticated;
GRANT ALL ON TABLE public.sms_forwards TO service_role;


--
-- Name: TABLE task_completion_emails_sent; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_completion_emails_sent TO anon;
GRANT ALL ON TABLE public.task_completion_emails_sent TO authenticated;
GRANT ALL ON TABLE public.task_completion_emails_sent TO service_role;


--
-- Name: TABLE task_completion_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_completion_templates TO anon;
GRANT ALL ON TABLE public.task_completion_templates TO authenticated;
GRANT ALL ON TABLE public.task_completion_templates TO service_role;


--
-- Name: TABLE task_email_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_email_templates TO anon;
GRANT ALL ON TABLE public.task_email_templates TO authenticated;
GRANT ALL ON TABLE public.task_email_templates TO service_role;


--
-- Name: TABLE task_file_uploads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_file_uploads TO anon;
GRANT ALL ON TABLE public.task_file_uploads TO authenticated;
GRANT ALL ON TABLE public.task_file_uploads TO service_role;


--
-- Name: TABLE task_submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_submissions TO anon;
GRANT ALL ON TABLE public.task_submissions TO authenticated;
GRANT ALL ON TABLE public.task_submissions TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: TABLE telegram_id_map; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_id_map TO anon;
GRANT ALL ON TABLE public.telegram_id_map TO authenticated;
GRANT ALL ON TABLE public.telegram_id_map TO service_role;


--
-- Name: TABLE telegram_message_registry; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_message_registry TO anon;
GRANT ALL ON TABLE public.telegram_message_registry TO authenticated;
GRANT ALL ON TABLE public.telegram_message_registry TO service_role;


--
-- Name: TABLE telegram_monitoring; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_monitoring TO anon;
GRANT ALL ON TABLE public.telegram_monitoring TO authenticated;
GRANT ALL ON TABLE public.telegram_monitoring TO service_role;


--
-- Name: TABLE telegram_pending_replies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_pending_replies TO anon;
GRANT ALL ON TABLE public.telegram_pending_replies TO authenticated;
GRANT ALL ON TABLE public.telegram_pending_replies TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE v_chat_messages_decrypted; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_chat_messages_decrypted TO anon;
GRANT ALL ON TABLE public.v_chat_messages_decrypted TO authenticated;
GRANT ALL ON TABLE public.v_chat_messages_decrypted TO service_role;


--
-- Name: TABLE v_email_forwards_decrypted; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_email_forwards_decrypted TO anon;
GRANT ALL ON TABLE public.v_email_forwards_decrypted TO authenticated;
GRANT ALL ON TABLE public.v_email_forwards_decrypted TO service_role;


--
-- Name: TABLE v_profiles_decrypted; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_profiles_decrypted TO anon;
GRANT ALL ON TABLE public.v_profiles_decrypted TO authenticated;
GRANT ALL ON TABLE public.v_profiles_decrypted TO service_role;


--
-- Name: TABLE v_received_emails_decrypted; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_received_emails_decrypted TO anon;
GRANT ALL ON TABLE public.v_received_emails_decrypted TO authenticated;
GRANT ALL ON TABLE public.v_received_emails_decrypted TO service_role;


--
-- Name: TABLE verification_uploads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.verification_uploads TO anon;
GRANT ALL ON TABLE public.verification_uploads TO authenticated;
GRANT ALL ON TABLE public.verification_uploads TO service_role;


--
-- Name: TABLE v_verification_uploads_decrypted; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.v_verification_uploads_decrypted TO anon;
GRANT ALL ON TABLE public.v_verification_uploads_decrypted TO authenticated;
GRANT ALL ON TABLE public.v_verification_uploads_decrypted TO service_role;


--
-- Name: TABLE virtual_employees; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.virtual_employees TO anon;
GRANT ALL ON TABLE public.virtual_employees TO authenticated;
GRANT ALL ON TABLE public.virtual_employees TO service_role;


--
-- Name: TABLE vmos_devices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vmos_devices TO anon;
GRANT ALL ON TABLE public.vmos_devices TO authenticated;
GRANT ALL ON TABLE public.vmos_devices TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--



-- Trigger: Profil bei neuer Registrierung anlegen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Speicher-Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-documents', 'verification-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-uploads', 'kyc-uploads', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('applications', 'applications', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('task-files', 'task-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payout-barcodes', 'payout-barcodes', true) ON CONFLICT (id) DO NOTHING;

-- Speicher-Regeln
SELECT pg_catalog.set_config('search_path', 'public, extensions', false);
CREATE POLICY "Admins can delete kyc documents" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can delete all task files" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'task-files'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "Admins can delete branding files" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'branding'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY verification_select_own_or_admin ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-documents'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY "Admins can delete payout barcode images" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'payout-barcodes'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can read all verification docs" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-documents'::text) AND (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = 'admin'::app_role))))));
CREATE POLICY "Admins can read application files" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'applications'::text) AND (auth.role() = 'authenticated'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can update all kyc documents" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can update branding files" ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'branding'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "Admins can update payout barcode images" ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'payout-barcodes'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can upload any kyc documents" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'kyc-uploads'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can upload branding files" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'branding'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "Admins can upload payout barcode images" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'payout-barcodes'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can view all kyc documents" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can view all kyc uploads" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins can view all task files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'task-files'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))))));
CREATE POLICY "Admins can view all verification documents" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-documents'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Allow authenticated deletes from applications bucket" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'applications'::text));
CREATE POLICY "Allow authenticated deletes from kyc-uploads" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Allow authenticated updates to applications bucket" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'applications'::text));
CREATE POLICY "Allow authenticated updates to kyc-uploads" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'kyc-uploads'::text)) WITH CHECK ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Allow authenticated uploads to kyc-uploads" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Allow public reads from applications bucket" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'applications'::text));
CREATE POLICY "Allow public reads from kyc-uploads" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Allow public uploads to applications bucket" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK ((bucket_id = 'applications'::text));
CREATE POLICY "Anyone can upload application files" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK ((bucket_id = 'applications'::text));
CREATE POLICY "Anyone can upload resumes" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'applications'::text) AND ((storage.foldername(name))[1] = 'resumes'::text)));
CREATE POLICY "Authenticated users can delete from kyc-uploads" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Authenticated users can delete verification docs" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'verification-docs'::text));
CREATE POLICY "Authenticated users can update kyc-uploads" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Authenticated users can upload task files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'task-files'::text));
CREATE POLICY "Authenticated users can upload to kyc-uploads" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Authenticated users can upload verification docs" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'verification-docs'::text));
CREATE POLICY "Authenticated users can view kyc-uploads" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'kyc-uploads'::text));
CREATE POLICY "Authenticated users can view verification docs" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'verification-docs'::text));
CREATE POLICY "Avatars are publicly accessible" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Branding files are publicly accessible" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'branding'::text));
CREATE POLICY "Public can view payout barcode images" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'payout-barcodes'::text));
CREATE POLICY "Users can delete own task files" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'task-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can delete own uploads" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can delete own verification documents" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can delete their own avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can delete their own task files" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'task-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can read own verification documents" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can read their own verification docs" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can update own verification documents" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]))) WITH CHECK (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can update their own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can update their own kyc documents" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can update their own verification docs" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can upload own verification documents" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can upload task files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'task-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can upload their own avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can upload their own kyc documents" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'kyc-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can upload their own verification docs" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can upload their own verification documents" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'verification-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can upload to own folder" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'kyc-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can view own task files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'task-files'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Users can view own uploads" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can view resumes" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'applications'::text) AND ((storage.foldername(name))[1] = 'resumes'::text)));
CREATE POLICY "Users can view their own kyc documents" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'kyc-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can view their own task files" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'task-files'::text));
CREATE POLICY "Users can view their own verification documents" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'verification-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY public_upload_application_files ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK ((bucket_id = 'applications'::text));
CREATE POLICY verification_insert_own ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'verification-documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
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
