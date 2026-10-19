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
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,31}$/),
  password: z.string().min(12).max(128),
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
    if (body.action === 'login') {
      if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 32 || body.password.length > 128) return respond({error:'Invalid login credentials'},400);
      const {data:allowed,error:limitError}=await admin.rpc('check_brute_force',{_identifier:body.username.trim().toLowerCase(),_action:'applicant_login',_window_minutes:15,_max_attempts:10});
      if(limitError || !allowed) return respond({error:'Bitte später erneut versuchen / Please try again later'},429);
      const {data:profile,error:lookupError}=await admin.from('profiles').select('id,email').eq('username',body.username.trim().toLowerCase()).maybeSingle();
      if(lookupError || !profile) return respond({error:'Invalid login credentials'},401);
      const {data:account,error:accountError}=await admin.from('applicant_accounts').select('accepted_at').eq('user_id',profile.id).maybeSingle();
      if(accountError || (account && !account.accepted_at)) return respond({error:'Invalid login credentials'},401);
      const client=createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false}});
      const {data,error}=await client.auth.signInWithPassword({email:profile.email,password:body.password});
      if(error || !data.session) return respond({error:'Invalid login credentials'},401);
      return respond({session:data.session});
    }
    if (body.action === 'submit') {
      const parsed = applicationSchema.safeParse(body.application);
      if (!parsed.success) return respond({ error: 'Bitte alle Pflichtfelder prüfen / Check required fields' },400);
      const { resume, website, username, password, ...application } = parsed.data;
      const date = new Date(application.birth_date + 'T00:00:00Z');
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==application.birth_date || date >= new Date()) return respond({ error:'Invalid birth date' },400);
      const ip = req.headers.get('cf-connecting-ip');
      // Do not impose a shared five-person limit when ingress omits the client IP.
      // The global ceiling below remains enforced regardless of this header.
      if (ip) {
        const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
        const key = Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
        const { data: allowed, error: limitError } = await admin.rpc('applicant_submission_allowed',{ _key:key });
        if (limitError || !allowed) return respond({ error:'Bitte später erneut versuchen / Please try again later' },429);
      }
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
      let createdId: string | undefined;
      let applicationId: string | undefined;
      try {
        const {data:taken,error:lookupError}=await admin.from('profiles').select('id').eq('username',username).maybeSingle();
        if(lookupError) throw lookupError;
        if(taken) { if(path) await admin.storage.from('verification-documents').remove([path]); return respond({error:'Benutzername nicht verfügbar / Username unavailable'},409); }
        const {data:created,error:createError}=await admin.auth.admin.createUser({email:application.email.toLowerCase(),password,email_confirm:false,ban_duration:'876000h',user_metadata:{first_name:application.first_name,last_name:application.last_name}});
        if(createError || !created.user) {
          if(path) await admin.storage.from('verification-documents').remove([path]);
          // Auth failures are not all duplicate accounts. Never expose raw errors or credentials.
          const code = createError?.code;
          const diagnostic = typeof code === 'string' && /^[a-z_]{1,64}$/.test(code) ? code : 'auth_creation_failed';
          console.error('Applicant Auth creation failed', { code: diagnostic, status: createError?.status });
          if (code === 'email_exists' || code === 'user_already_exists') {
            return respond({error:'Für diese E-Mail existiert bereits ein Konto. Bitte anmelden oder Passwort vergessen verwenden / An account already exists for this email; sign in or use password recovery',code:diagnostic},409);
          }
          if (code === 'weak_password') {
            return respond({error:'Das Passwort erfüllt die Sicherheitsanforderungen nicht. Bitte ein stärkeres Passwort wählen / Password does not meet security requirements; choose a stronger password',code:diagnostic},422);
          }
          if (code === 'email_address_invalid' || code === 'email_address_not_authorized') {
            return respond({error:'Diese E-Mail-Adresse wird vom Anmeldedienst nicht akzeptiert / This email address is not accepted by the account service',code:diagnostic},422);
          }
          if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || createError?.status === 429) {
            return respond({error:'Bitte später erneut versuchen / Please try again later',code:diagnostic},429);
          }
          const explanation = code === 'unexpected_failure'
            ? 'Konto konnte wegen eines internen Fehlers nicht angelegt werden. Der Betreiber muss die Kontoanlage und Datenbank-Auslöser prüfen / Account creation failed internally; the owner must check account creation and database triggers'
            : 'Konto konnte nicht angelegt werden. Der Betreiber muss die Einrichtung des Anmeldedienstes prüfen / Account creation failed; the owner must check account service setup';
          return respond({error:`${explanation} (${diagnostic})`,code:diagnostic},500);
        }
        createdId=created.user.id;
        const {error:profileError}=await admin.from('profiles').upsert({id:createdId,email:application.email.toLowerCase(),username});
        if(profileError) throw profileError;
        const {data:saved,error:saveError}=await admin.from('applications').insert({...application,email:application.email.toLowerCase(),status:'pending',resume_path:path}).select('id').single();
        if(saveError || !saved) throw saveError || new Error('Application not saved');
        applicationId=saved.id;
        const {error:linkError}=await admin.from('applicant_accounts').insert({user_id:createdId,application_id:applicationId});
        if(linkError) throw linkError;
      } catch(error) {
        if(applicationId) await admin.from('applications').delete().eq('id',applicationId);
        if(createdId) await admin.auth.admin.deleteUser(createdId);
        if(path) await admin.storage.from('verification-documents').remove([path]);
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
    const unlockChosenAccount = async () => {
      const {data:account,error}=await admin.from('applicant_accounts').select('user_id').eq('application_id',input.application_id).maybeSingle();
      if(error) throw error;
      if(!account) return false;
      const {data:workflow,error:workflowError}=await admin.from('applicant_workflows').select('user_id').eq('application_id',input.application_id).eq('user_id',account.user_id).maybeSingle();
      if(workflowError || !workflow) throw workflowError || new Error('Accepted workflow required');
      const {error:unlockError}=await admin.auth.admin.updateUserById(account.user_id,{ban_duration:'none',email_confirm:true});
      if(unlockError) throw unlockError;
      const {error:markError}=await admin.from('applicant_accounts').update({accepted_at:new Date().toISOString()}).eq('user_id',account.user_id);
      if(markError) throw markError;
      return true;
    };
    // Redirects are configured by the owner, never accepted from untrusted input.
    const allowedOrigins = (Deno.env.get('APPLICANT_ALLOWED_ORIGINS') || '').split(',').map(s=>s.trim()).filter(Boolean);
    if (!allowedOrigins.includes(new URL(input.origin).origin)) return respond({ error:'Diese Website muss zuerst in APPLICANT_ALLOWED_ORIGINS eingetragen werden.' },400);
    const { data:application,error:appError } = await admin.from('applications').select('*').eq('id',input.application_id).single();
    if (appError || !application || !['pending','approved'].includes(application.status)) return respond({ error:'Application unavailable' },400);
    const { data:template } = await admin.from('contract_templates').select('id').eq('id',input.template_id).eq('is_active',true).maybeSingle();
    if (!template) return respond({ error:'Active contract template required' },400);
    const { data:existing } = await admin.from('applicant_workflows').select('user_id').eq('application_id',input.application_id).maybeSingle();
    if (existing) {
      if(await unlockChosenAccount()) return respond({success:true,already_accepted:true});
      const authClient = createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false}});
      const {error:mailError}=await authClient.auth.resetPasswordForEmail(application.email,{redirectTo:new URL('/reset-password',input.origin).href});
      return respond({success:true,already_accepted:true,email_sent:!mailError,warning:mailError ? 'Vertrag bereitgestellt. Zugangsmail konnte nicht gesendet werden; der Bewerber nutzt bei Bedarf Passwort vergessen.' : null});
    }
    const { data:profile } = await admin.from('profiles').select('id').ilike('email',application.email).maybeSingle();
    let targetId = profile?.id;
    let accountCreated = false;
    try {
    if (!targetId) {
      // Random inaccessible password, never returned or persisted outside Auth.
      const { data,error } = await admin.auth.admin.createUser({ email:application.email,
        password:crypto.randomUUID()+crypto.randomUUID(),email_confirm:false,
        user_metadata:{ first_name:application.first_name,last_name:application.last_name,contract_type:application.employment_type } });
      if (error || !data.user) throw error || new Error('Account creation failed');
      targetId=data.user.id; accountCreated=true;
    }
      const {data:targetAdmin,error:targetRoleError}=await admin.from('user_roles').select('role').eq('user_id',targetId).eq('role','admin').maybeSingle();
      if (targetRoleError) throw targetRoleError;
      if (targetAdmin) throw new Error('Admin account cannot become applicant');
      const { error:profileError } = await admin.from('profiles').upsert({ id:targetId,email:application.email },{ onConflict:'id',ignoreDuplicates:true });
      if (profileError) throw profileError;
      const { error:roleError } = await admin.from('user_roles').upsert({ user_id:targetId,role:'employee' },{ onConflict:'user_id,role',ignoreDuplicates:true });
      if (roleError) throw roleError;
    const { error } = await admin.rpc('applicant_finalize_acceptance',{ _application:input.application_id,_user:targetId,
      _template:input.template_id,_start:input.start_date,_salary:input.salary,_admin:user.id });
    if (error) throw error;
    } catch (error) {
      if (accountCreated && targetId) {
        // Never delete an account if another acceptance has already linked it.
        const {data:linked,error:linkError}=await admin.from('applicant_workflows').select('user_id').eq('user_id',targetId).maybeSingle();
        if (!linked && !linkError) await admin.auth.admin.deleteUser(targetId);
      }
      throw error;
    }
    if(await unlockChosenAccount()) return respond({success:true});
    // Legacy applications still use the existing recovery-email flow.
    const authClient = createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false}});
    const { error:mailError } = await authClient.auth.resetPasswordForEmail(application.email,{redirectTo:new URL('/reset-password',input.origin).href});
    return respond({ success:true,email_sent:!mailError,warning:mailError ? 'Vertrag bereitgestellt. Zugangsmail konnte nicht gesendet werden; der Bewerber nutzt bei Bedarf Passwort vergessen.' : null });
  } catch {
    return respond({ error:'Vorgang fehlgeschlagen. Einrichtung und Funktionsprotokoll prüfen / Operation failed; check setup and function logs' },500);
  }
});