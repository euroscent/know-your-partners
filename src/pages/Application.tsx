import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, LanguageSwitch } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import euroscentLogo from "@/assets/euroscent-logo.png";

const schema=z.object({first_name:z.string().trim().min(1).max(100),last_name:z.string().trim().min(1).max(100),email:z.string().trim().email().max(255),phone:z.string().trim().min(5).max(40),birth_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),street:z.string().trim().min(3).max(200),postal_code:z.string().trim().min(2).max(20),city:z.string().trim().min(2).max(100),employment_type:z.enum(['minijob','teilzeit','vollzeit','freelancer']),message:z.string().max(3000),website:z.string().max(0)});
export default function Application(){
 const {lang}=useI18n();const tr=(de:string,en:string)=>lang==='en'?en:de;
 const [values,setValues]=useState({first_name:'',last_name:'',email:'',phone:'',birth_date:'',street:'',postal_code:'',city:'',employment_type:'',message:'',website:''});
 const [resume,setResume]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [submitted,setSubmitted]=useState(false);const [error,setError]=useState('');
 const submit=async(e:FormEvent)=>{e.preventDefault();setError('');const parsed=schema.safeParse(values);if(!parsed.success){setError(tr('Bitte alle Pflichtfelder prüfen.','Please check all required fields.'));return;}setBusy(true);try{
 let pdf:string|undefined;if(resume){if(resume.type!=='application/pdf'||resume.size>5*1024*1024)throw new Error(tr('Nur PDF bis 5 MB','PDF only, up to 5 MB'));pdf=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('File unreadable'));reader.readAsDataURL(resume);});}
 const {data,error}=await supabase.functions.invoke('applicant-api',{body:{action:'submit',application:{...parsed.data,...(pdf?{resume:pdf}:{})}}});if(error||data?.error)throw new Error(data?.error||tr('Bewerbung konnte nicht gesendet werden. Einrichtung des Bewerbungsdienstes prüfen.','Could not submit application. Check application service setup.'));setSubmitted(true);
 }catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const fields=[['first_name',tr('Vorname','First name'),'text'],['last_name',tr('Nachname','Last name'),'text'],['email',tr('E-Mail','Email'),'email'],['phone',tr('Telefonnummer','Phone'),'tel'],['birth_date',tr('Geburtsdatum','Date of birth'),'date'],['street',tr('Straße und Hausnummer','Street and number'),'text'],['postal_code',tr('Postleitzahl','Postal code'),'text'],['city',tr('Ort','City'),'text']] as const;
 return <main className="min-h-screen euroscent-login-bg px-4 py-8"><div className="max-w-2xl mx-auto relative z-10"><div className="flex justify-between items-center mb-8"><Button asChild variant="ghost"><Link to="/login"><ArrowLeft className="h-4 w-4 mr-2"/>{tr('Anmeldung','Sign in')}</Link></Button><LanguageSwitch/></div><header className="mb-8 flex items-center gap-4"><img src={euroscentLogo} alt="EuroScent" className="h-16 w-16 rounded-full"/><div><h1 className="text-3xl font-semibold">EuroScent</h1><p className="text-muted-foreground">{tr('Bewerbung','Application')}</p></div></header>
 {submitted?<section className="border-y border-border py-10 space-y-4"><CheckCircle2 className="h-10 w-10 text-primary"/><h2 className="text-2xl font-semibold">{tr('Bewerbung eingegangen','Application received')}</h2><p>{tr('Ihre Bewerbung wurde gespeichert und steht unserem Team zur Prüfung bereit.','Your application has been saved and is ready for our team to review.')}</p><Button asChild variant="outline"><Link to="/login">{tr('Zur Anmeldung','Go to sign in')}</Link></Button></section>:<form onSubmit={submit} className="space-y-6"><div className="grid sm:grid-cols-2 gap-4">{fields.map(([key,title,type])=><div key={key} className="space-y-2"><Label htmlFor={key}>{title} *</Label><Input id={key} type={type} value={values[key]} required maxLength={200} max={type==='date'?new Date().toISOString().slice(0,10):undefined} onChange={e=>setValues({...values,[key]:e.target.value})}/></div>)}</div>
 <div className="space-y-2"><Label>{tr('Gewünschte Vertragsart','Preferred contract type')} *</Label><Select value={values.employment_type} onValueChange={v=>setValues({...values,employment_type:v})}><SelectTrigger><SelectValue placeholder={tr('Bitte wählen','Please select')}/></SelectTrigger><SelectContent><SelectItem value="minijob">Minijob</SelectItem><SelectItem value="teilzeit">{tr('Teilzeit','Part-time')}</SelectItem><SelectItem value="vollzeit">{tr('Vollzeit','Full-time')}</SelectItem><SelectItem value="freelancer">Freelancer</SelectItem></SelectContent></Select></div>
 <div className="space-y-2"><Label htmlFor="message">{tr('Nachricht (optional)','Message (optional)')}</Label><Textarea id="message" maxLength={3000} value={values.message} onChange={e=>setValues({...values,message:e.target.value})}/></div><div className="space-y-2"><Label htmlFor="resume">{tr('Lebenslauf (PDF, optional, maximal 5 MB)','CV (PDF, optional, up to 5 MB)')}</Label><Input id="resume" type="file" accept="application/pdf" onChange={e=>setResume(e.target.files?.[0]||null)}/></div>
 <input className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="off" value={values.website} onChange={e=>setValues({...values,website:e.target.value})}/>
 {error&&<p role="alert" className="text-destructive">{error}</p>}<Button type="submit" disabled={busy} className="w-full">{busy?tr('Wird gesendet…','Submitting…'):tr('Bewerbung einreichen','Submit application')}</Button></form>}
 </div></main>;
}
