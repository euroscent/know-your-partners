import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, RefreshCw, Eraser, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { applicantDb, ApplicantWorkflow, loadApplicantWorkflows, bankSchema } from "@/lib/applicantWorkflow";

export function ApplicantProgress({ compact = false, onChange }: { compact?: boolean; onChange?: (workflow: ApplicantWorkflow | null) => void }) {
  const { lang } = useI18n();
  const tr = (de: string, en: string) => lang === "en" ? en : de;
  const [workflow, setWorkflow] = useState<ApplicantWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [holder, setHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const refresh = async () => {
    try {
      const rows = await loadApplicantWorkflows();
      const next = rows[0] || null;
      setWorkflow(next); onChange?.(next); setError("");
    } catch (e: any) {
      // Old external installations remain usable until the additive SQL is installed.
      if (!["PGRST202", "42883"].includes(e?.code)) setError(tr("Aufnahmestatus konnte nicht geladen werden.", "Could not load onboarding status."));
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 15000); return () => window.clearInterval(timer); }, []);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await operation(); await refresh(); } catch (e: any) { setError(e?.message || tr("Speichern fehlgeschlagen", "Could not save")); }
    finally { setBusy(false); }
  };
  if (loading) return <p className="text-sm text-muted-foreground">{tr("Aufnahmestatus wird geladen…", "Loading onboarding status…")}</p>;
  if (!workflow) return error ? <p role="alert" className="text-destructive">{error}</p> : null;
  const steps = [
    [tr("Bewerbung angenommen", "Application accepted"), true],
    [tr("Vertrag unterschrieben", "Contract signed"), Boolean(workflow.signed_at)],
    [tr("Bankdaten vollständig", "Bank details complete"), workflow.bank_complete],
    [tr("Identität genehmigt", "Identity approved"), workflow.identity_status === "approved"],
  ] as const;
  const upload = async () => {
    if (!front || !back) throw new Error(tr("Vorder- und Rückseite erforderlich", "Front and back are required"));
    const paths: string[] = [];
    for (const [side, file] of [["front", front], ["back", back]] as const) {
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error(tr("Nur JPG, PNG oder WebP bis 5 MB", "Only JPG, PNG or WebP up to 5 MB"));
      const path = `${workflow.user_id}/applicant/${crypto.randomUUID()}-${side}`;
      const { error } = await applicantDb.storage.from('verification-documents').upload(path, file, { contentType:file.type });
      if (error) throw error;
      paths.push(path);
    }
    const { error } = await applicantDb.rpc('submit_applicant_identity',{ _front:paths[0],_back:paths[1] });
    if (error) throw error;
    setFront(null); setBack(null);
  };
  return <section className="border-y border-border py-6 space-y-6">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-semibold">{tr("Mitarbeiteraufnahme", "Employee onboarding")}</h2>
      <div className="flex items-center gap-2"><span className={workflow.active ? "text-primary font-semibold" : "text-muted-foreground"}>{workflow.active ? tr("Aktiv", "Active") : tr("In Aufnahme", "Onboarding")}</span>
      <Button variant="ghost" size="icon" onClick={refresh} aria-label={tr("Aktualisieren", "Refresh")} title={tr("Aktualisieren", "Refresh")}><RefreshCw className="h-4 w-4" /></Button></div>
    </div>
    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">{steps.map(([title, complete]) => <li key={title} className="flex gap-2 items-center text-sm">{complete ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-muted-foreground" />} {title}</li>)}</ol>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {compact ? <Button asChild variant="outline"><Link to="/dashboard/onboarding"><FileText className="h-4 w-4 mr-2" />{tr("Aufnahme öffnen", "Open onboarding")}</Link></Button> : <>
      <section className="space-y-4">
        <h3 className="font-semibold">{tr("Arbeitsvertrag", "Employment contract")}</h3>
        <div className="max-h-96 overflow-auto border border-border rounded-md bg-muted/20 p-4 whitespace-pre-wrap text-sm">{new DOMParser().parseFromString(workflow.contract_content || "", "text/html").body.textContent}</div>
        {workflow.signed_at ? <div className="space-y-2"><p className="text-sm">{tr("Unterschrieben am", "Signed on")} {new Date(workflow.signed_at).toLocaleString(lang === "en" ? "en-GB" : "de-DE")}</p>{workflow.signature_data && <img src={workflow.signature_data} alt={tr("Ihre Unterschrift", "Your signature")} className="max-w-full h-24 object-contain bg-muted rounded" />}</div> : <>
          <canvas ref={canvas} width={640} height={180} aria-label={tr("Unterschrift", "Signature")} className="border border-border rounded-md bg-muted w-full max-w-xl touch-none"
            onPointerDown={e => { const c = canvas.current; if (!c) return; c.setPointerCapture(e.pointerId); const r=c.getBoundingClientRect(); const ctx=c.getContext('2d'); if (!ctx) return; ctx.beginPath(); ctx.moveTo((e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height); drawing.current=true; }}
            onPointerMove={e => { const c=canvas.current; if (!c || !drawing.current) return; const ctx=c.getContext('2d'); if (!ctx) return; const r=c.getBoundingClientRect(); ctx.lineWidth=2; ctx.strokeStyle=getComputedStyle(c).color; ctx.lineTo((e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height);ctx.stroke();hasInk.current=true; }}
            onPointerUp={() => { drawing.current=false; }} onPointerCancel={() => { drawing.current=false; }} />
          <Button variant="ghost" size="icon" title={tr("Unterschrift löschen", "Clear signature")} aria-label={tr("Unterschrift löschen", "Clear signature")} onClick={() => { const c=canvas.current;c?.getContext('2d')?.clearRect(0,0,c.width,c.height);hasInk.current=false; }}><Eraser className="h-4 w-4" /></Button>
          <div className="flex gap-2 items-start"><Checkbox id="contract-consent" checked={consent} onCheckedChange={value => setConsent(value === true)} /><Label htmlFor="contract-consent">{tr("Ich habe diesen Vertrag gelesen und unterschreibe diese Fassung.", "I have read this contract and sign this version.")}</Label></div>
          <Button disabled={busy || !consent} onClick={() => run(async () => { if (!hasInk.current || !canvas.current) throw new Error(tr("Bitte unterschreiben", "Please sign")); const {error}=await applicantDb.rpc('sign_applicant_contract',{_signature:canvas.current.toDataURL('image/png')});if(error)throw error; })}>{tr("Verbindlich unterschreiben", "Sign contract")}</Button>
        </>}
      </section>
      <form className="space-y-4 border-t border-border pt-6" onSubmit={e => {e.preventDefault();run(async () => {const parsed=bankSchema.safeParse({holder,iban,bic});if(!parsed.success)throw new Error(tr("Bitte Bankdaten prüfen", "Please check bank details"));const {error}=await applicantDb.rpc('save_applicant_bank',{_holder:parsed.data.holder,_iban:parsed.data.iban,_bic:parsed.data.bic});if(error)throw error;setIban('');setBic('');});}}>
        <h3 className="font-semibold">{tr("Bankdaten für Gehaltszahlungen", "Bank details for salary payments")}</h3>
        {!workflow.signed_at ? <p className="text-muted-foreground text-sm">{tr("Nach Vertragsunterschrift verfügbar", "Available after signing the contract")}</p> : workflow.bank_complete ? <p className="text-primary">{tr("Bankdaten gespeichert", "Bank details saved")}</p> : <><div className="grid sm:grid-cols-2 gap-4">{[["holder",tr("Kontoinhaber","Account holder"),holder,setHolder],["iban","IBAN",iban,setIban],["bic","BIC",bic,setBic]].map(([id,title,value,setter]) => <div className="space-y-2" key={String(id)}><Label htmlFor={String(id)}>{String(title)}</Label><Input id={String(id)} value={String(value)} required maxLength={150} onChange={e => (setter as (v:string)=>void)(e.target.value)} /></div>)}</div><Button type="submit" disabled={busy}>{tr("Bankdaten speichern", "Save bank details")}</Button></>}
      </form>
      <section className="space-y-4 border-t border-border pt-6"><h3 className="font-semibold">{tr("Identitätsprüfung", "Identity verification")}</h3>
        {workflow.identity_status === "rejected" && <p role="alert" className="text-destructive">{tr("Abgelehnt", "Rejected")}: {workflow.rejection_reason}</p>}
        {!workflow.bank_complete ? <p className="text-muted-foreground">{tr("Zuerst Vertrag und Bankdaten abschließen", "Complete contract and bank details first")}</p> : ['approved','pending'].includes(workflow.identity_status) ? <p>{workflow.identity_status==='approved' ? tr("Identität genehmigt", "Identity approved") : tr("Bilder eingereicht – Prüfung ausstehend", "Images submitted – awaiting review")}</p> : <>
          <div className="grid sm:grid-cols-2 gap-4">{[["front",tr("Ausweis Vorderseite", "ID front"),setFront],["back",tr("Ausweis Rückseite", "ID back"),setBack]].map(([id,title,setter]) => <div key={String(id)} className="space-y-2"><Label htmlFor={String(id)}>{String(title)}</Label><Input type="file" id={String(id)} accept="image/jpeg,image/png,image/webp" onChange={e => (setter as (f:File|null)=>void)(e.target.files?.[0] || null)} /></div>)}</div>
          <Button disabled={busy || !front || !back} onClick={() => run(upload)}>{tr("Zur Prüfung einreichen", "Submit for review")}</Button>
        </>}
      </section>
      {workflow.active && <Button asChild><Link to="/dashboard/tasks">{tr("Meine Aufträge", "My tasks")}</Link></Button>}
    </>}
  </section>;
}