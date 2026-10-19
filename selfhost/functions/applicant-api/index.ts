import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const applicationSchema = z.object({
  first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255), phone: z.string().trim().min(5).max(40),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), street: z.string().trim().min(3).max(200),
  postal_code: z.string().trim().min(2).max(20), city: z.string().trim().min(2).max(100),
  employment_type: z.enum(['minijob','teilzeit','vollzeit','freelancer']), message: z.string().max(3000).default(''),
  website: z.string().max(0).optional(),
  resume: z.string().max(7000000).regex(/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/).optional(),
});
const acceptSchema = z.object({ application_id: z.string().uuid(), template_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), salary: z.number().min(0).max(1000000),
  origin: z.string().url(),
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' },405);
  const admin = createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',{ auth: { persistSession:false } });
  try {
    if (Number(req.headers.get('content-length') || '0') > 7500000) return respond({ error:'File too large' },413);
    const body = await req.json();
    if (body.action === 'submit') {
      const parsed = applicationSchema.safeParse(body.application);
      if (!parsed.success) return respond({ error: 'Bitte alle Pflichtfelder prüfen / Check required fields' },400);
      const { resume, website, ...application } = parsed.data;
      const date = new Date(application.birth_date + 'T00:00:00Z');
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==application.birth_date || date >= new Date()) return respond({ error:'Invalid birth date' },400);
      const ip = req.headers.get('cf-connecting-ip') || 'unknown';
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
      const key = Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
      const { data: allowed, error: limitError } = await admin.rpc('applicant_submission_allowed',{ _key:key });
      if (limitError || !allowed) return respond({ error:'Bitte später erneut versuchen / Please try again later' },429);
      // A shared ceiling prevents rotated/spoofed client headers from bypassing all limits.
      const globalDigest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode('applicant-global-limit'));
      const globalKey = Array.from(new Uint8Array(globalDigest)).map(x=>x.toString(16).padStart(2,'0')).join('');
      const {data:globalAllowed,error:globalError}=await admin.rpc('applicant_global_submission_allowed',{_key:globalKey});
      if(globalError || !globalAllowed) return respond({error:'Bitte später erneut versuchen / Please try again later'},429);
      let path: string | null = null;
      if (resume) {
        const bytes = Uint8Array.from(atob(resume.split(',')[1]), c=>c.charCodeAt(0));
        if (bytes.length > 5*1024*1024 || new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') return respond({ error:'Only PDF up to 5 MB' },400);
        path = `applications/${crypto.randomUUID()}.pdf`;
        const { error } = await admin.storage.from('verification-documents').upload(path,bytes,{ contentType:'application/pdf' });
        if (error) throw error;
      }
      const { error } = await admin.from('applications').insert({ ...application,email:application.email.toLowerCase(),status:'pending',resume_path:path });
      if (error) {
        if (path) await admin.storage.from('verification-documents').remove([path]);
        throw error;
      }
      return respond({ success:true });
    }
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if (!jwt) return respond({ error:'Sign in required' },401);
    const { data:{ user },error:authError } = await admin.auth.getUser(jwt);
    if (authError || !user) return respond({ error:'Sign in required' },401);
    const { data:role } = await admin.from('user_roles').select('role').eq('user_id',user.id).eq('role','admin').maybeSingle();
    if (!role) return respond({ error:'Admin required' },403);
    if (body.action !== 'accept') return respond({ error:'Unknown action' },400);
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) return respond({ error:'Invalid acceptance values' },400);
    const input = parsed.data;
    // Redirects are configured by the owner, never accepted from untrusted input.
    const allowedOrigins = (Deno.env.get('APPLICANT_ALLOWED_ORIGINS') || '').split(',').map(s=>s.trim()).filter(Boolean);
    if (!allowedOrigins.includes(new URL(input.origin).origin)) return respond({ error:'Diese Website muss zuerst in APPLICANT_ALLOWED_ORIGINS eingetragen werden.' },400);
    const { data:application,error:appError } = await admin.from('applications').select('*').eq('id',input.application_id).single();
    if (appError || !application || !['pending','approved'].includes(application.status)) return respond({ error:'Application unavailable' },400);
    const { data:template } = await admin.from('contract_templates').select('id').eq('id',input.template_id).eq('is_active',true).maybeSingle();
    if (!template) return respond({ error:'Active contract template required' },400);
    const { data:existing } = await admin.from('applicant_workflows').select('user_id').eq('application_id',input.application_id).maybeSingle();
    if (existing) {
      const authClient = createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false}});
      const {error:mailError}=await authClient.auth.resetPasswordForEmail(application.email,{redirectTo:new URL('/reset-password',input.origin).href});
      return respond({success:true,already_accepted:true,email_sent:!mailError,warning:mailError ? 'Vertrag bereitgestellt. Zugangsmail konnte nicht gesendet werden; Passwortlink erneut senden.' : null});
    }
    const { data:profile } = await admin.from('profiles').select('id').ilike('email',application.email).maybeSingle();
    let targetId = profile?.id;
    let accountCreated = false;
    if (!targetId) {
      // Random inaccessible password, never returned or persisted outside Auth.
      const { data,error } = await admin.auth.admin.createUser({ email:application.email,
        password:crypto.randomUUID()+crypto.randomUUID(),email_confirm:false,
        user_metadata:{ first_name:application.first_name,last_name:application.last_name,contract_type:application.employment_type } });
      if (error || !data.user) throw error || new Error('Account creation failed');
      targetId=data.user.id; accountCreated=true;
      const { error:profileError } = await admin.from('profiles').upsert({ id:targetId,email:application.email },{ onConflict:'id',ignoreDuplicates:true });
      if (profileError) throw profileError;
      const { error:roleError } = await admin.from('user_roles').upsert({ user_id:targetId,role:'employee' },{ onConflict:'user_id,role',ignoreDuplicates:true });
      if (roleError) throw roleError;
    }
    const { error } = await admin.rpc('applicant_finalize_acceptance',{ _application:input.application_id,_user:targetId,
      _template:input.template_id,_start:input.start_date,_salary:input.salary,_admin:user.id });
    if (error) {
      if (accountCreated) await admin.auth.admin.deleteUser(targetId);
      throw error;
    }
    // Auth sends its own single-use recovery email; no private key or token is returned.
    const authClient = createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false}});
    const { error:mailError } = await authClient.auth.resetPasswordForEmail(application.email,{redirectTo:new URL('/reset-password',input.origin).href});
    return respond({ success:true,email_sent:!mailError,warning:mailError ? 'Vertrag bereitgestellt. Zugangsmail konnte nicht gesendet werden; Passwortlink erneut senden.' : null });
  } catch {
    return respond({ error:'Vorgang fehlgeschlagen. Einrichtung und Funktionsprotokoll prüfen / Operation failed; check setup and function logs' },500);
  }
});