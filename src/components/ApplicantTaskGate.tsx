import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { loadApplicantWorkflows } from "@/lib/applicantWorkflow";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function ApplicantTaskGate({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [state,setState] = useState<'loading'|'allowed'|'blocked'|'error'>('loading');
  useEffect(() => { let alive=true;(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){if(alive)setState('blocked');return;}
    const {data:roles}=await supabase.from('user_roles').select('role').eq('user_id',session.user.id);
    if(roles?.some(r=>r.role==='admin')){if(alive)setState('allowed');return;}
    try{const workflow=(await loadApplicantWorkflows())[0];if(alive)setState(!workflow || workflow.active?'allowed':'blocked');}
    catch(e:any){if(alive)setState(['PGRST202','42883'].includes(e?.code)?'allowed':'error');}
  })();return()=>{alive=false;};},[]);
  if(state==='allowed')return <>{children}</>;
  return <main className="min-h-screen bg-background p-8"><div className="max-w-xl mx-auto space-y-4"><h1 className="text-2xl font-semibold">{lang==='en'?'Employee onboarding':'Mitarbeiteraufnahme'}</h1><p className="text-muted-foreground">{state==='loading'?(lang==='en'?'Checking status…':'Status wird geprüft…'):state==='error'?(lang==='en'?'Status could not be checked. Please try again.':'Status konnte nicht geprüft werden. Bitte erneut versuchen.'):(lang==='en'?'Complete your contract, bank details and identity verification before working on tasks.':'Schließen Sie Vertrag, Bankdaten und Identitätsprüfung ab, bevor Sie Aufträge bearbeiten.')}</p><Button asChild variant="outline"><Link to="/dashboard/onboarding">{lang==='en'?'Open onboarding':'Mitarbeiteraufnahme öffnen'}</Link></Button></div></main>;
}