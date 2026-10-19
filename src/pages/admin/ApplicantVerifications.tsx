import { useEffect, useState } from "react";
import { applicantDb, ApplicantWorkflow, loadApplicantWorkflows } from "@/lib/applicantWorkflow";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Eye, RefreshCw } from "lucide-react";

export default function ApplicantVerifications() {
  const { lang } = useI18n();const tr=(de:string,en:string)=>lang==='en'?en:de;
  const [rows,setRows]=useState<ApplicantWorkflow[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<ApplicantWorkflow|null>(null);const [images,setImages]=useState<string[]>([]);const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
  const refresh=async()=>{try{setRows(await loadApplicantWorkflows());setError('');}catch{setError(tr('Aufnahmestatus nicht verfügbar. Einrichtung erforderlich.','Onboarding status unavailable. Setup required.'));}finally{setLoading(false);}};
  useEffect(()=>{refresh();const t=window.setInterval(refresh,15000);return()=>window.clearInterval(t);},[]);
  const open=async(row:ApplicantWorkflow)=>{setSelected(row);setImages([]);setReason('');setBusy(true);try{
    const urls=[];for(const path of [row.id_front_path,row.id_back_path]){if(!path)continue;const {data,error}=await applicantDb.storage.from('verification-documents').createSignedUrl(path,120);if(error)throw error;urls.push(data.signedUrl);}setImages(urls);
  }catch{setError(tr('Ausweisbilder konnten nicht geladen werden.','Could not load identity images.'));}finally{setBusy(false);}};
  const review=async(approve:boolean)=>{if(!selected)return;setBusy(true);try{const {error}=await applicantDb.rpc('review_applicant_identity',{_user:selected.user_id,_approve:approve,_reason:approve?null:reason});if(error)throw error;setSelected(null);setImages([]);await refresh();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  return <div className="p-4 md:p-8 space-y-6">
    <div className="flex justify-between items-center"><h1 className="text-3xl font-semibold">{tr('Verifizierungen','Verifications')}</h1><Button variant="ghost" size="icon" title={tr('Aktualisieren','Refresh')} aria-label={tr('Aktualisieren','Refresh')} onClick={refresh}><RefreshCw className="h-4 w-4"/></Button></div>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {loading?<p>{tr('Wird geladen…','Loading…')}</p>:rows.length===0?<p className="text-muted-foreground">{tr('Noch keine angenommenen Bewerber','No accepted applicants yet')}</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border">{[tr('Mitarbeiter','Employee'),tr('Vertrag','Contract'),tr('Bankdaten','Bank details'),tr('Identität','Identity'),tr('Status','Status'),''].map((title,i)=><th key={i} className="text-left py-3 pr-4">{title}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.user_id} className="border-b border-border"><td className="py-4 pr-4">{row.first_name} {row.last_name}<div className="text-muted-foreground break-all">{row.email}</div></td><td>{row.signed_at?tr('Unterschrieben','Signed'):tr('Ausstehend','Pending')}</td><td>{row.bank_complete?tr('Vollständig','Complete'):tr('Ausstehend','Pending')}</td><td>{({not_submitted:tr('Nicht eingereicht','Not submitted'),pending:tr('In Prüfung','Under review'),approved:tr('Genehmigt','Approved'),rejected:tr('Abgelehnt','Rejected')})[row.identity_status]}</td><td className={row.active?'text-primary':'text-muted-foreground'}>{row.active?tr('Aktiv','Active'):tr('In Aufnahme','Onboarding')}</td><td><Button variant="outline" size="sm" onClick={()=>open(row)}><Eye className="h-4 w-4 mr-2"/>{tr('Prüfen','Review')}</Button></td></tr>)}</tbody></table></div>}
    <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open){setSelected(null);setImages([]);}}}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.first_name} {selected?.last_name}</DialogTitle></DialogHeader>
      {error&&<p role="alert" className="text-destructive">{error}</p>}
      {selected&&<><details><summary className="cursor-pointer font-medium">{tr('Vertrag ansehen','View contract')}</summary><div className="whitespace-pre-wrap text-sm border-y border-border py-4 max-h-64 overflow-auto">{new DOMParser().parseFromString(selected.contract_content||'','text/html').body.textContent}</div>{selected.signature_data&&<img src={selected.signature_data} className="h-24 max-w-full object-contain" alt={tr('Mitarbeiterunterschrift','Employee signature')}/>}<p className="text-sm">{selected.signed_at?new Date(selected.signed_at).toLocaleString(lang==='en'?'en-GB':'de-DE'):tr('Noch nicht unterschrieben','Not signed yet')}</p></details>
      {selected.company_signature && <div><p className="text-sm">EuroScent GmbH · Rolf Erwin Ruhfus</p><img src={selected.company_signature} alt={tr('Unterschrift Arbeitgeber','Employer signature')} className="h-24 max-w-full object-contain" /></div>}
      <div className="grid sm:grid-cols-2 gap-4">{images.map((url,i)=><figure key={url}><figcaption className="mb-2 text-sm">{i===0?tr('Vorderseite','Front'):tr('Rückseite','Back')}</figcaption><img src={url} alt={i===0?tr('Ausweis Vorderseite','ID front'):tr('Ausweis Rückseite','ID back')} className="w-full h-60 object-contain bg-muted"/></figure>)}</div>
      {selected.rejection_reason&&<p className="text-destructive">{selected.rejection_reason}</p>}
      {selected.identity_status==='pending'&&<><Textarea aria-label={tr('Ablehnungsgrund','Rejection reason')} placeholder={tr('Ablehnungsgrund','Rejection reason')} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/><div className="flex gap-2 flex-wrap"><Button disabled={busy||images.length!==2} onClick={()=>review(true)}><Check className="h-4 w-4 mr-2"/>{tr('Genehmigen','Approve')}</Button><Button variant="destructive" disabled={busy||reason.trim().length<3} onClick={()=>review(false)}><X className="h-4 w-4 mr-2"/>{tr('Ablehnen','Reject')}</Button></div></>}
      </>}
    </DialogContent></Dialog>
  </div>;
}