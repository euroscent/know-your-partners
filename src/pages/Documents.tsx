import euroscentLogo from "@/assets/euroscent-logo.png";
import { currentCompanyDetails } from "@/lib/companyDetails";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/lib/toast-stub";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Calendar, Mail, Inbox, MailOpen, Trash2, Eye, Circle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { formatContractContent, replaceContractPlaceholders } from "@/lib/formatContractContent";
import { EmployeeEmailInbox } from "@/components/EmployeeEmailInbox";
import { ApplicantProgress } from "@/components/ApplicantProgress";
import { ApplicantWorkflow, loadApplicantWorkflows } from "@/lib/applicantWorkflow";

interface Document {
  id: string;
  document_type: string;
  title: string;
  description: string;
  contract_type: string;
  start_date: string;
  signature_data: string;
  created_at: string;
  content: string;
  is_read?: boolean;
  user_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    street: string | null;
    city: string | null;
    postal_code: string | null;
    birth_date: string | null;
    email: string | null;
  };
}

const Documents = () => {
  const [workflowContracts,setWorkflowContracts] = useState<Record<string,ApplicantWorkflow>>({});
  useEffect(() => { loadApplicantWorkflows().then(rows => setWorkflowContracts(Object.fromEntries(rows.map(w=>[w.contract_id,w])))).catch(()=>{}); }, []);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [companySignature, setCompanySignature] = useState<string>("");
  const [companySignerName, setCompanySignerName] = useState<string>("");
  const [companySignerTitle, setCompanySignerTitle] = useState<string>("");
  const [companyContact, setCompanyContact] = useState<any>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("alle");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Filter documents by contract type
  const filteredDocuments = documents.filter((doc) => {
    if (contractTypeFilter === "alle") return true;
    return doc.contract_type === contractTypeFilter;
  });

  // Count documents per category
  const getCategoryCount = (type: string) => {
    if (type === "alle") return documents.length;
    return documents.filter((doc) => doc.contract_type === type).length;
  };

  useEffect(() => {
    checkAuth();
    fetchDocuments();
    fetchCompanySignature();
    fetchCompanyContact();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchDocuments = async () => {
    try {
      // Ensure we have a valid session before querying
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdmin = !!roleData;
      setIsAdmin(isAdmin);

      // If admin, fetch all documents with profiles; otherwise only user's documents
      let query = supabase
        .from("employee_documents")
        .select(`
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
            street,
            city,
            postal_code,
            birth_date,
            email,
            signature_data
          )
        `)
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("user_id", session.user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: "Dokumente konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanySignature = async () => {
    try {
      const { data } = await supabase
        .from("company_signature")
        .select("*")
        .maybeSingle();

      if (data) {
        setCompanySignature(data.signature_data);
        setCompanySignerName(data.signer_name);
        setCompanySignerTitle(data.signer_title);
      }
    } catch (error) {
      console.error("Error loading company signature:", error);
    }
  };

  const fetchCompanyContact = async () => {
    try {
      const { data } = await supabase
        .from("company_contact")
        .select("*")
        .maybeSingle();

      if (data) {
        setCompanyContact(currentCompanyDetails(data));
      }
    } catch (error) {
      console.error("Error loading company contact:", error);
    }
  };

  // Attempt automatic contract creation if missing (based on user metadata from signup)
  const attemptedAutoCreate = useRef(false);
  const createContractFromMetadataIfMissing = async (manual = false) => {
    if (attemptedAutoCreate.current && !manual) return;
    attemptedAutoCreate.current = true;

    try {
      const currentUser = user as any;
      if (!currentUser) return;
      try { if ((await loadApplicantWorkflows()).some(w => w.user_id === currentUser.id)) return; } catch { /* Legacy installation */ }

      const hasContract = documents.some((d) => d.document_type === 'contract' && d.user_id === currentUser.id);
      if (hasContract && !manual) return;

      // Load latest profile for fallbacks
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name,last_name,employment_type,street,postal_code,city,birth_date,email,signature_data")
        .eq("id", currentUser.id)
        .maybeSingle();

      const meta: any = currentUser.user_metadata || {};
      const firstName = meta.first_name || profile?.first_name;
      const lastName = meta.last_name || profile?.last_name;
      const startDateMeta = meta.start_date as string | undefined;
      const contractTypeMeta = meta.contract_type || profile?.employment_type || 'teilzeit';
      const signatureMeta = meta.signature as string | undefined;

      // Require at least names, fallback start date to today
      if (!firstName || !lastName) {
        if (manual) {
          toast({ title: 'Daten unvollständig', description: 'Vor-/Nachname fehlen im Profil.', variant: 'destructive' });
        }
        return;
      }
      const startDate = startDateMeta || new Date().toLocaleDateString('de-DE');

       const monthlySalary = contractTypeMeta === 'minijob' ? '603' :
                             contractTypeMeta === 'teilzeit' ? '2560' :
                             contractTypeMeta === 'vollzeit' ? '3890' :
                             'Nach Vereinbarung';

       // Try to reuse last signature from previous contract if metadata signature is missing
       const { data: lastSigned } = await supabase
         .from('employee_documents')
         .select('signature_data')
         .eq('user_id', currentUser.id)
         .eq('document_type', 'contract')
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle();

       const chosenSignature = signatureMeta || profile?.signature_data || lastSigned?.signature_data || null;

      // EuroScent-Vertragsvorlage verwenden, falls vorhanden
      let contractContent: string;
      const { data: templateData } = await supabase
        .from("contract_templates")
        .select("content, default_salary")
        .ilike("category", contractTypeMeta)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (templateData?.content) {
        const templateSalary =
          templateData.default_salary != null
            ? Number(templateData.default_salary).toLocaleString('de-DE')
            : monthlySalary;
        const { data: sigData } = await supabase
          .from("company_signature")
          .select("signature_data")
          .maybeSingle();
        contractContent = replaceContractPlaceholders(templateData.content, {
          startDate,
          salary: templateSalary,
          firstName: firstName || '',
          lastName: lastName || '',
          street: profile?.street || '',
          postalCode: profile?.postal_code || '',
          city: profile?.city || '',
          companySignature: sigData?.signature_data || '',
        }).replace(/\{\{[^}]*\}\}/g, "");
      } else {
       contractContent = `Arbeitsvertrag – ${getContractTypeLabel(contractTypeMeta)}\n\n` +
        `Vertrag zwischen\n\n` +
        `Unternehmen\n${companyContact?.company_name || "EuroScent GmbH"}\n` +
        `${companyContact?.street_address || "Grimmaischer Steinweg 8"}\n` +
        `${companyContact?.postal_code || "04103"} ${companyContact?.city || "Leipzig"}\n` +
        `${companyContact?.country || "Deutschland"}\n\n` +
        `Mitarbeiter\n${firstName} ${lastName}\n` +
        `${profile?.street || ""}\n` +
        `${profile?.postal_code || ""} ${profile?.city || ""}\n\n` +
        `Vergütung\nMonatliches Gehalt: ${monthlySalary} €\n\n` +
        `Datum: ${new Date().toLocaleDateString('de-DE')}\nStartdatum: ${startDate}`;
      }

      const { error: docError } = await supabase
        .from('employee_documents')
        .insert({
          user_id: currentUser.id,
          document_type: 'contract',
          title: `Arbeitsvertrag - ${getContractTypeLabel(contractTypeMeta)}`,
          description: `Ihr ${getContractTypeLabel(contractTypeMeta)}-Vertrag mit Startdatum ${startDate}`,
          contract_type: contractTypeMeta,
          start_date: startDate,
          signature_data: chosenSignature,
          content: contractContent,
        });

      if (!docError) {
        toast({ title: 'Vertrag erstellt', description: 'Ihr Arbeitsvertrag wurde erstellt.' });
        fetchDocuments();
      } else {
        console.error('Auto-create contract error:', docError);
        if (manual) {
          toast({ title: 'Fehler', description: 'Vertrag konnte nicht erstellt werden.', variant: 'destructive' });
        }
      }
    } catch (e) {
      console.error('Auto-create contract exception:', e);
      if (manual) {
        toast({ title: 'Fehler', description: 'Unerwarteter Fehler bei Vertragserstellung.', variant: 'destructive' });
      }
    }
  };

  useEffect(() => {
    // Versuche automatisch einen Vertrag zu erzeugen, wenn keiner existiert
    if (!loading && user) {
      createContractFromMetadataIfMissing(false);
    }
  }, [user, loading, documents]);

  const getContractTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      minijob: "Minijob",
      teilzeit: "Teilzeit",
      vollzeit: "Vollzeit",
      freelancer: "Freelancer",
    };
    return labels[type] || type;
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      contract: "Arbeitsvertrag",
      certificate: "Zertifikat",
      other: "Sonstiges",
    };
    return labels[type] || type;
  };

  const getContractTypeLabelExtended = (type: string) => {
    const labels: Record<string, string> = {
      minijob: "Minijob",
      teilzeit: "Teilzeit",
      vollzeit: "Vollzeit",
      freelancer: "Freelancer",
      kyc_compliance: "KYC Compliance",
    };
    return labels[type] || getContractTypeLabel(type);
  };

  const buildContractBodyHtml = (raw: string, startDate?: string) => {
    let content = raw || "";

    // Replace {{startdatum}} and the common fallback phrase "ab sofort" with the actual start date
    if (startDate) {
      const displayStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
        ? format(new Date(startDate), "dd.MM.yyyy", { locale: de })
        : startDate;
      content = content
        .replace(/\{\{startdatum\}\}/gi, displayStart)
        .replace(/ab\s+sofort(\s*\(.*?\))?/i, `ab ${displayStart}`);
    }

    // Prevent duplicate signature blocks inside the contract text (we render signatures separately in the UI)
    content = content
      .replace(/<div\s+class=["']signature-block["'][^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<img\b[^>]*>/gi, "")
      .replace(/^\s*(unterschrift arbeitnehmer|unterschrift arbeitgeber|unterschriften|arbeitgeber|arbeitnehmer)\s*$/gim, "");

    return formatContractContent(content);
  };

  const downloadContract = async (doc: Document) => {
    // Embed logo as data URL so it also works after download
    let logoDataUrl = '';
    try {
      // Use company logo from database if available, otherwise fallback to local
      const logoSource = companyContact?.logo_url || euroscentLogo;
      const res = await fetch(logoSource);
      if (res.ok) {
        const blob = await res.blob();
        logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.warn('Logo konnte nicht geladen werden', e);
    }

    const contractContentHtml = doc.content ? buildContractBodyHtml(doc.content, doc.start_date) : "";

    // Create a simple contract HTML document matching the PDF style
    const contractHTML = `
      <!DOCTYPE html>
      <html>

        <head>
          <meta charset="utf-8">
          <title>${doc.title}</title>
          <style>
            @page {
              margin: 2.5cm 2.5cm 3.5cm 2.5cm;
              size: A4;
            }
            
            body { 
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #000;
              max-width: 21cm;
              margin: 0 auto;
              padding: 20px;
              font-size: 11pt;
              position: relative;
              min-height: 100vh;
            }
            
            .logo-header {
              text-align: center;
              margin-bottom: 30px;
            }
            
            .logo-header img {
              max-width: 300px;
              height: auto;
            }
            
            h1 { 
              text-align: center;
              color: #000;
              font-size: 18pt;
              margin: 0 0 30px 0;
              font-weight: 700;
            }
            
            h2 {
              font-size: 13pt;
              font-weight: 700;
              margin: 25px 0 15px 0;
              color: #000;
            }
            
            h3 {
              font-size: 12pt;
              font-weight: 700;
              margin: 20px 0 10px 0;
              color: #000;
            }
            
            .content-section h3 {
              font-weight: 700;
            }
            
            .contract-header {
              margin-bottom: 25px;
            }
            
            .contract-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            .contract-table td {
              padding: 8px;
              vertical-align: top;
              border: 1px solid #000;
            }
            
            .contract-table td:first-child {
              font-weight: 700;
              width: 150px;
            }
            
            .content-section {
              margin: 20px 0;
            }
            
            .content-section p {
              margin: 10px 0;
              text-align: justify;
            }
            
            .signatures {
              margin-top: 60px;
              page-break-inside: avoid;
            }
            
            .signature-row {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
            }
            
            .signature {
              width: 45%;
            }
            
            .signature-line {
              border-bottom: 1px solid #000;
              margin-bottom: 5px;
              height: 100px;
              display: flex;
              align-items: flex-end;
              justify-content: center;
            }
            
            .signature img {
              max-width: 100%;
              max-height: 90px;
              width: auto;
              height: auto;
              object-fit: contain;
              margin-bottom: 5px;
            }
            
            .footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 7pt;
              color: #666;
              text-align: center;
              line-height: 1.4;
              page-break-inside: avoid;
            }
            
            .footer-content {
              display: flex;
              justify-content: space-around;
              flex-wrap: wrap;
              gap: 15px;
            }
            
            .footer-section {
              flex: 1;
              min-width: 150px;
            }
            
            @media print {
              body { 
                padding: 0;
              }
              .content-section { 
                page-break-inside: avoid; 
              }
              .signatures { 
                page-break-inside: avoid; 
              }
              .footer { 
                margin-top: 40px;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="logo-header">
            <img src="${logoDataUrl}" alt="EuroScent Logo" />
          </div>
          
          <h1>${doc.title}</h1>
          
          <h2>Vertrag zwischen</h2>
          
          <div style="display: flex; justify-content: space-between; background-color: #f0f0f0; border-radius: 8px; padding: 25px; margin: 20px 0;">
            <div style="width: 48%;">
              <p style="margin: 0 0 15px 0;"><strong>Unternehmen:</strong></p>
              <p style="margin: 0; line-height: 1.6;">
                <strong>${companyContact?.company_name || "Unternehmen"}</strong><br>
                ${companyContact?.street_address || ""}<br>
                ${companyContact?.postal_code || ""} ${companyContact?.city || ""}<br>
                ${companyContact?.country || "Deutschland"}
              </p>
            </div>
            <div style="width: 48%;">
              <p style="margin: 0 0 15px 0;"><strong>Mitarbeiter/in:</strong></p>
              <p style="margin: 0; line-height: 1.6;">
                <strong>${doc.profiles?.first_name || ''} ${doc.profiles?.last_name || ''}</strong><br>
                ${doc.profiles?.street ? `${doc.profiles.street}<br>` : ""}
                ${doc.profiles?.postal_code || doc.profiles?.city ? `${doc.profiles?.postal_code || ''} ${doc.profiles?.city || ''}<br>` : ""}
                Deutschland
              </p>
            </div>
          </div>
          
          ${contractContentHtml ? `
            <div class="content-section contract-content">
              ${contractContentHtml}
            </div>
          ` : ""}

          <div class="signatures">
            <p>${companyContact?.city || "Berlin"}, den ${format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}</p>
            
            <div class="signature-row">
              <div class="signature">
                <div class="signature-line">
                  ${(workflowContracts[doc.id] ? workflowContracts[doc.id].company_signature : companySignature) ? `<img src="${workflowContracts[doc.id]?.company_signature || companySignature}" alt="Unterschrift" />` : ''}
                </div>
                <p style="margin: 5px 0 0 0;">Geschäftsführer: Rolf Erwin Ruhfus</p>
              </div>
              
              <div class="signature">
                <div class="signature-line">
                  ${doc.signature_data ? `<img src="${doc.signature_data}" alt="Unterschrift" />` : ''}
                </div>
                <p style="margin: 5px 0 0 0;">${doc.profiles?.first_name || ''} ${doc.profiles?.last_name || ''}</p>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-content">
              <div class="footer-section">
                <strong>EuroScent GmbH</strong><br>
                Professionelle KYC-Lösungen für verschiedene Branchen
              </div>
              <div class="footer-section">
                Königsallee 89<br>
                D-40212 Düsseldorf
              </div>
              <div class="footer-section">
                Amtsgericht Düsseldorf<br>
                HRB 69139
              </div>
              <div class="footer-section">
                Umsatzsteuer-ID: DE152885038
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([contractHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download gestartet",
      description: "Ihr Dokument wird heruntergeladen",
    });
  };

  const handleOpenDocument = async (doc: Document) => {
    // Mark document as read if not already
    if (!doc.is_read) {
      await supabase
        .from("employee_documents")
        .update({ is_read: true })
        .eq("id", doc.id);
      
      // Update local state
      setDocuments(prev => prev.map(d => 
        d.id === doc.id ? { ...d, is_read: true } : d
      ));
    }

    setSelectedDocument(doc);
    setIsDialogOpen(true);
  };
  const handleDeleteDocument = async (docId: string) => {
    try {
      const { error } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      toast({
        title: "Dokument gelöscht",
        description: "Das Dokument wurde erfolgreich entfernt",
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: `Dokument konnte nicht gelöscht werden${error?.message ? `: ${error.message}` : ''}`,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lade Dokumente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {!isAdmin && <ApplicantProgress compact />}
        <div className="mb-6 flex items-center gap-3">
          <Inbox className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Posteingang</h1>
            <p className="text-muted-foreground mt-1">
              Ihre Dokumente und E-Mails
            </p>
          </div>
        </div>

        {/* Main Tabs: Documents vs Emails */}
        {!isAdmin && user && (
          <Tabs defaultValue="emails" className="space-y-4">
            <TabsList>
              <TabsTrigger value="emails" className="gap-2">
                <Mail className="h-4 w-4" />
                E-Mails
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="h-4 w-4" />
                Dokumente
              </TabsTrigger>
            </TabsList>

            <TabsContent value="emails">
              <EmployeeEmailInbox userId={user.id} />
            </TabsContent>

            <TabsContent value="documents">
              {documents.length === 0 ? (
                <Card className="py-16 text-center">
                  <MailOpen className="h-20 w-20 mx-auto mb-4 opacity-30 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Keine Dokumente vorhanden</h3>
                  <p className="text-muted-foreground">Sie haben noch keine Dokumente erhalten</p>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">Dokumente & Verträge</span>
                    </div>
                  </div>
                  <div>
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="border-b last:border-b-0 px-4 py-4 hover:bg-accent/30 cursor-pointer"
                        onClick={() => handleOpenDocument(doc)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <p className="font-medium">{doc.title}</p>
                          <Badge variant="secondary">{getDocumentTypeLabel(doc.document_type)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Admin View - same as before */}
        {isAdmin && (
          <>
            {/* Contract Type Filter Tabs */}
            {documents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { value: "alle", label: "Alle" },
                  { value: "minijob", label: "Minijob" },
                  { value: "teilzeit", label: "Teilzeit" },
                  { value: "vollzeit", label: "Vollzeit" },
                  { value: "freelancer", label: "Freelancer" },
                ].map((tab) => (
                  <Button
                    key={tab.value}
                    variant={contractTypeFilter === tab.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setContractTypeFilter(tab.value)}
                    className="gap-2"
                  >
                    {tab.label}
                    <Badge 
                      variant={contractTypeFilter === tab.value ? "secondary" : "outline"} 
                      className="ml-1 h-5 min-w-[20px] flex items-center justify-center text-xs"
                    >
                      {getCategoryCount(tab.value)}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}

            <Card className="overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">Dokumente & Verträge</span>
                </div>
              </div>

              {filteredDocuments.length === 0 ? (
                <CardContent className="py-16 text-center">
                  <MailOpen className="h-20 w-20 mx-auto mb-4 opacity-30 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">
                    {contractTypeFilter !== "alle" 
                      ? `Keine ${getContractTypeLabel(contractTypeFilter)}-Verträge vorhanden`
                      : "Postfach ist leer"
                    }
                  </h3>
                  <p className="text-muted-foreground">
                    {contractTypeFilter !== "alle"
                      ? "Wählen Sie eine andere Kategorie oder zeigen Sie alle Dokumente an"
                      : "Sie haben noch keine Dokumente erhalten"
                    }
                  </p>
                  {contractTypeFilter !== "alle" ? (
                    <div className="mt-6">
                      <Button variant="outline" onClick={() => setContractTypeFilter("alle")}>
                        Alle Dokumente anzeigen
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <Button onClick={() => createContractFromMetadataIfMissing(true)}>
                        Vertrag jetzt automatisch erzeugen
                      </Button>
                    </div>
                  )}
                </CardContent>
              ) : (
                <div>
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="border-b last:border-b-0 border-l-4 border-l-transparent hover:border-l-primary hover:bg-accent/30 transition-colors"
                    >
                      <div className="px-4 py-4 flex items-center gap-3">
                        {!doc.is_read && (
                          <Circle className="h-3 w-3 fill-primary text-primary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                            <p className="font-semibold truncate">
                              {doc.title}
                            </p>
                            <Badge variant="secondary" className="flex-shrink-0">
                              {getDocumentTypeLabel(doc.document_type)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Von: {isAdmin 
                              ? ([doc.profiles?.first_name, doc.profiles?.last_name].filter(Boolean).join(" ") || "Mitarbeiter")
                              : (companySignerName || "Rolf Erwin Ruhfus")
                            }
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {doc.contract_type && (
                              <Badge variant="outline">
                                {getContractTypeLabelExtended(doc.contract_type)}
                              </Badge>
                            )}
                            {doc.start_date && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {(() => {
                                  try {
                                    let date: Date;
                                    if (doc.start_date.includes('.')) {
                                      const [day, month, year] = doc.start_date.split('.');
                                      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    } else {
                                      date = new Date(doc.start_date);
                                    }
                                    return format(date, "dd.MM.yyyy", { locale: de });
                                  } catch {
                                    return doc.start_date;
                                  }
                                })()}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(doc.created_at), "dd.MM.yyyy", { locale: de })}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDocument(doc)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Öffnen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadContract(doc)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Möchten Sie dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
        {/* Document Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            {selectedDocument && (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <DialogTitle className="text-2xl mb-2">{selectedDocument.title}</DialogTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="secondary">
                          {getDocumentTypeLabel(selectedDocument.document_type)}
                        </Badge>
                        {selectedDocument.contract_type && (
                          <span>• Vertragsart: {getContractTypeLabel(selectedDocument.contract_type)}</span>
                        )}
                        {selectedDocument.start_date && (
                          <span>• Startdatum: {selectedDocument.start_date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                
                <ScrollArea className="h-[calc(90vh-200px)] pr-4">
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Beschreibung</p>
                      <p className="text-sm">{selectedDocument.description}</p>
                    </div>

                    {selectedDocument.content && selectedDocument.document_type === 'certificate' ? (
                      <div>
                        <div
                          className="certificate-view"
                          dangerouslySetInnerHTML={{ __html: selectedDocument.content }}
                        />
                      </div>
                    ) : selectedDocument.content ? (
                      <div>
                        <p className="text-sm font-semibold mb-3">Vertragsinhalt</p>
                        <div className="bg-muted/30 p-6 rounded-lg border">
                          <div
                            className="text-sm leading-relaxed contract-content"
                            dangerouslySetInnerHTML={{
                              __html: buildContractBodyHtml(selectedDocument.content, selectedDocument.start_date),
                            }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {selectedDocument.document_type !== 'certificate' && (
                    <div>
                      <p className="text-sm font-semibold mb-3">Unterschriften</p>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Arbeitgeber</p>
                          {(workflowContracts[selectedDocument.id] ? workflowContracts[selectedDocument.id].company_signature : companySignature) ? (
                            <div className="w-full h-32 border-b-2 border-foreground/20 bg-white p-2 rounded flex items-center justify-center">
                              <img 
                                src={workflowContracts[selectedDocument.id]?.company_signature || companySignature}
                                alt="Unterschrift Arbeitgeber" 
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 border-2 border-dashed border-muted-foreground/30 bg-muted/20 rounded flex items-center justify-center">
                              <p className="text-sm text-muted-foreground">Keine Unterschrift vorhanden</p>
                            </div>
                          )}
                          {companySignature && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">{companySignerName}</p>
                              <p>{companySignerTitle}</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Arbeitnehmer</p>
                          {selectedDocument.signature_data ? (
                            <div className="w-full h-32 border-b-2 border-foreground/20 bg-white p-2 rounded flex items-center justify-center">
                              <img 
                                src={selectedDocument.signature_data}
                                alt="Unterschrift Arbeitnehmer" 
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 border-2 border-dashed border-muted-foreground/30 bg-muted/20 rounded flex items-center justify-center">
                              <p className="text-sm text-muted-foreground">Keine Unterschrift vorhanden</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    )}

                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Erstellt am: {format(new Date(selectedDocument.created_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })} Uhr
                      </p>
                    </div>
                  </div>
                </ScrollArea>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Schließen
                  </Button>
                  <Button onClick={() => downloadContract(selectedDocument)}>
                    <Download className="h-4 w-4 mr-2" />
                    Herunterladen
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Documents;
