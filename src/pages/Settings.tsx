import { useState, useEffect } from "react";
import euroscentLogo from "@/assets/euroscent-logo.png";
import { currentCompanyDetails } from "@/lib/companyDetails";
import { PageLoader } from "@/components/PageLoader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminPinSettings } from "@/components/AdminPinSettings";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-stub";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Mail, 
  FileText, 
  Palette, 
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Eye,
  Edit,
  Copy,
  Trash2,
  Plus,
  Upload,
  Wand2,
  Info,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  version: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CompanySignature {
  id: string;
  signature_data: string;
  signer_name: string;
  signer_title: string;
  created_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractTemplate[]>([]);
  const [signature, setSignature] = useState<CompanySignature | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [emailDelayEnabled, setEmailDelayEnabled] = useState(false);
  const [emailDelayHours, setEmailDelayHours] = useState(2);
  const [emailSettings, setEmailSettings] = useState<any>(null);
  const [previewContract, setPreviewContract] = useState<ContractTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    company_name: "",
    website_name: "",
    website_url: "",
    main_email: "",
    support_email: "",
    main_phone: "",
    support_phone: "",
    street_address: "",
    postal_code: "",
    city: "",
    country: "Deutschland",
    trade_register_number: "",
    register_court: "",
    vat_id: "",
    managing_director: "",
    content_responsible: "",
    legal_form: "GmbH",
    data_protection_officer: "",
    data_protection_email: "",
    logo_url: "",
    favicon_url: "",
    primary_color: "#000000",
    secondary_color: "#ffffff",
    accent_color: "#3b82f6",
    meeting_booking_url: ""
  });

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const isAdmin = roles?.some((r) => r.role === "admin");
    
    if (!isAdmin) {
      toast.error("Zugriff verweigert");
      navigate("/dashboard");
      return;
    }

    await fetchContracts();
    await fetchSignature();
    await fetchEmailSettings();
    await fetchContactInfo();
    setLoading(false);
  };

  const fetchContracts = async () => {
    const { data, error } = await supabase
      .from("contract_templates")
      .select("*")
      .order("category", { ascending: true });

    if (error) {
      toast.error("Fehler beim Laden der Verträge");
      return;
    }

    setContracts(data || []);
  };

  const fetchSignature = async () => {
    const { data, error } = await supabase
      .from("company_signature")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setSignature(data);
      setSignerName(data.signer_name);
      setSignerTitle(data.signer_title);
      setSignatureImageUrl(data.signature_data);
    }
  };

  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error("Bitte laden Sie eine Bilddatei hoch (JPG, PNG, etc.)");
      return;
    }

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Die Datei ist zu groß. Maximum 2MB erlaubt.");
      return;
    }

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        
        // Update or create signature
        const { data: existingSignature } = await supabase
          .from("company_signature")
          .select("*")
          .single();

        if (existingSignature) {
          const { error } = await supabase
            .from("company_signature")
            .update({
              signature_data: base64Image,
              signer_name: signerName || existingSignature.signer_name,
              signer_title: signerTitle || existingSignature.signer_title,
            })
            .eq("id", existingSignature.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("company_signature")
            .insert({
              signature_data: base64Image,
              signer_name: signerName || "Nicht angegeben",
              signer_title: signerTitle || "Nicht angegeben",
            });

          if (error) throw error;
        }

        setSignatureImageUrl(base64Image);
        setSignature({
          id: existingSignature?.id || "",
          signature_data: base64Image,
          signer_name: signerName || existingSignature?.signer_name || "",
          signer_title: signerTitle || existingSignature?.signer_title || "",
          created_at: existingSignature?.created_at || new Date().toISOString(),
        });
        
        toast.success("Unterschrift erfolgreich hochgeladen");
      };

      reader.onerror = () => {
        toast.error("Fehler beim Lesen der Datei");
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading signature:", error);
      toast.error("Fehler beim Hochladen der Unterschrift");
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Bitte laden Sie eine Bilddatei hoch");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Die Datei ist zu groß. Maximum 5MB erlaubt.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      // First get existing data
      const { data: existing } = await supabase
        .from("company_contact")
        .select("*")
        .limit(1)
        .maybeSingle();

      // Update with new logo URL
      const updatedData = { ...contactInfo, logo_url: publicUrl };
      
      let error;
      if (existing) {
        ({ error } = await supabase
          .from("company_contact")
          .update({ logo_url: publicUrl })
          .eq("id", existing.id));
      } else {
        ({ error } = await supabase
          .from("company_contact")
          .insert(updatedData));
      }

      if (error) throw error;

      setContactInfo(updatedData);
      toast.success("Logo erfolgreich hochgeladen");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Fehler beim Hochladen des Logos");
    }
  };

  const handleFaviconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Bitte laden Sie eine Bilddatei hoch");
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error("Die Datei ist zu groß. Maximum 1MB erlaubt.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `favicon-${Date.now()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      // First get existing data
      const { data: existing } = await supabase
        .from("company_contact")
        .select("*")
        .limit(1)
        .maybeSingle();

      // Update with new favicon URL
      const updatedData = { ...contactInfo, favicon_url: publicUrl };
      
      let error;
      if (existing) {
        ({ error } = await supabase
          .from("company_contact")
          .update({ favicon_url: publicUrl })
          .eq("id", existing.id));
      } else {
        ({ error } = await supabase
          .from("company_contact")
          .insert(updatedData));
      }

      if (error) throw error;

      setContactInfo(updatedData);
      toast.success("Favicon erfolgreich hochgeladen");
    } catch (error) {
      console.error("Error uploading favicon:", error);
      toast.error("Fehler beim Hochladen des Favicons");
    }
  };

  const fetchEmailSettings = async () => {
    const { data, error } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setEmailSettings(data);
      setEmailDelayEnabled(data.delay_enabled);
      setEmailDelayHours(data.delay_hours);
    }
  };

  const fetchContactInfo = async () => {
    const { data } = await supabase
      .from("company_contact")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data) {
      setContactInfo(currentCompanyDetails(data));
    }
  };

  const updateContactInfo = async () => {
    const { data: existing } = await supabase
      .from("company_contact")
      .select("*")
      .limit(1)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("company_contact")
        .update(contactInfo)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("company_contact")
        .insert(contactInfo));
    }

    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }

    toast.success("Kontaktinformationen aktualisiert");
    fetchContactInfo();
  };

  const deleteContract = async (id: string) => {
    const { error } = await supabase
      .from("contract_templates")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }

    toast.success("Vertrag gelöscht");
    fetchContracts();
  };

  const duplicateContract = async (contract: ContractTemplate) => {
    const { error } = await supabase
      .from("contract_templates")
      .insert({
        name: `Kopie von ${contract.name}`,
        category: contract.category,
        version: contract.version,
        content: contract.content,
        is_active: contract.is_active,
      });

    if (error) {
      toast.error("Fehler beim Kopieren");
      return;
    }

    toast.success("Vertrag kopiert");
    fetchContracts();
  };

  const updateSignature = async () => {
    if (!signerName || !signerTitle) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    const signatureUpdate = {
      signer_name: signerName,
      signer_title: signerTitle,
    };

    let error;
    
    if (signature) {
      ({ error } = await supabase
        .from("company_signature")
        .update(signatureUpdate)
        .eq("id", signature.id));
    } else {
      ({ error } = await supabase
        .from("company_signature")
        .insert({
          ...signatureUpdate,
          signature_data: "placeholder", // To be replaced with actual signature
        }));
    }

    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }

    toast.success("Informationen aktualisiert");
    fetchSignature();
  };

  const updateEmailSettings = async () => {
    if (emailDelayHours < 1 || emailDelayHours > 168) {
      toast.error("Verzögerung muss zwischen 1 und 168 Stunden liegen");
      return;
    }

    const settingsUpdate = {
      delay_enabled: emailDelayEnabled,
      delay_hours: emailDelayHours,
    };

    let error;
    
    if (emailSettings) {
      ({ error } = await supabase
        .from("email_settings")
        .update(settingsUpdate)
        .eq("id", emailSettings.id));
    } else {
      ({ error } = await supabase
        .from("email_settings")
        .insert(settingsUpdate));
    }

    if (error) {
      toast.error("Fehler beim Speichern");
      return;
    }

    toast.success("E-Mail Einstellungen aktualisiert");
    fetchEmailSettings();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "vollzeit":
        return "📄";
      case "teilzeit":
        return "📄";
      case "minijob":
        return "📄";
      default:
        return "📄";
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <>
      <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Einstellungen</h1>
          </div>
          <p className="text-muted-foreground">Verwalten Sie die Einstellungen Ihrer Anwendung</p>

          <Tabs defaultValue="contracts" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-11">
              <TabsTrigger value="company" className="gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Unternehmen</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Kontakt</span>
              </TabsTrigger>
              <TabsTrigger value="legal" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Rechtliches</span>
              </TabsTrigger>
              <TabsTrigger value="logo-favicon" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Logo & Favicon</span>
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-2">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Branding</span>
              </TabsTrigger>
              <TabsTrigger value="kyc" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">KYC</span>
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Zahlungen</span>
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">E-Mail</span>
              </TabsTrigger>
              <TabsTrigger value="contracts" className="gap-2">
                <FileText className="h-4 w-4 text-orange-500" />
                <span className="hidden sm:inline">Verträge</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Live Chat</span>
              </TabsTrigger>
              <TabsTrigger value="pin" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">PIN</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pin">
              <AdminPinSettings />
            </TabsContent>

            <TabsContent value="contracts" className="space-y-6">
              {/* Contract Templates Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Vertragsvorlagen</h2>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={() => navigate("/dashboard/admin/contract-editor")}
                  >
                    <Plus className="h-4 w-4" />
                    Neue Vorlage
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contracts.map((contract) => (
                    <Card key={contract.id} className="relative">
                      {contract.is_active && (
                        <Badge className="absolute top-4 right-4 bg-green-100 text-green-800">
                          Aktiv
                        </Badge>
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{getCategoryIcon(contract.category)}</div>
                          <div className="flex-1">
                            <CardTitle className="text-base">{contract.name}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground">Kategorie</div>
                            <div className="font-medium capitalize">{contract.category}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Version</div>
                            <div className="font-medium">{contract.version}</div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Zuletzt bearbeitet {format(new Date(contract.updated_at), "PPP", { locale: de })}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              setPreviewContract(contract);
                              setIsPreviewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => navigate(`/dashboard/admin/contract-editor/${contract.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => duplicateContract(contract)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => deleteContract(contract.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Company Signature Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <span>✍️</span> Firmenunterschrift
                </h2>

                <Card>
                  <CardContent className="pt-6">
                    <input
                      type="file"
                      id="signature-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleSignatureUpload}
                    />
                    
                    {!signature ? (
                      <div className="text-center py-12 space-y-4">
                        <div className="text-4xl">✍️</div>
                        <div>
                          <h3 className="font-medium mb-2">Keine Firmenunterschrift konfiguriert</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Generieren Sie eine professionelle Unterschrift oder laden Sie eine bestehende hoch. 
                            Diese wird automatisch in alle PDF-Dokumente eingefügt.
                          </p>
                        </div>
                        <div className="flex gap-3 justify-center">
                          <Button variant="destructive" className="gap-2">
                            <Wand2 className="h-4 w-4" />
                            Unterschrift generieren
                          </Button>
                          <Button 
                            variant="outline" 
                            className="gap-2"
                            onClick={() => document.getElementById('signature-upload')?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            Unterschrift hochladen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                          {signatureImageUrl ? (
                            <img 
                              src={signatureImageUrl} 
                              alt="Firmenunterschrift" 
                              className="max-h-32 mx-auto"
                            />
                          ) : (
                            <>
                              <div className="text-4xl mb-2">✍️</div>
                              <p className="text-sm text-muted-foreground">Unterschrift vorhanden</p>
                            </>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <Button variant="destructive" size="sm" className="gap-2">
                            <Wand2 className="h-4 w-4" />
                            Neu generieren
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => document.getElementById('signature-upload')?.click()}
                          >
                            <Upload className="h-4 w-4" />
                            Hochladen
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="signer-name">Name des Unterzeichners</Label>
                        <Input
                          id="signer-name"
                          placeholder="Name der Person, die für das Unternehmen unterschreibt"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signer-title">Titel des Unterzeichners</Label>
                        <Input
                          id="signer-title"
                          placeholder="Position oder Titel der Unterzeichners"
                          value={signerTitle}
                          onChange={(e) => setSignerTitle(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button onClick={updateSignature}>
                        Informationen aktualisieren
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Company Tab */}
            <TabsContent value="company">
              <Card>
                <CardHeader>
                  <CardTitle>Unternehmensinformationen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Unternehmensname</Label>
                    <Input
                      id="company-name"
                      placeholder="Unternehmen GmbH"
                      value={contactInfo.company_name}
                      onChange={(e) => setContactInfo({ ...contactInfo, company_name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wird für den Dokumententitel und Überschriften verwendet.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website-name">Website Name</Label>
                    <Input
                      id="website-name"
                      placeholder="KYC Unite"
                      value={contactInfo.website_name}
                      onChange={(e) => setContactInfo({ ...contactInfo, website_name: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wird für den Dokumententitel und Überschriften verwendet.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website-url">Website URL</Label>
                    <Input
                      id="website-url"
                      type="url"
                      placeholder="https://kyc-unite-84.com"
                      value={contactInfo.website_url}
                      onChange={(e) => setContactInfo({ ...contactInfo, website_url: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={() => navigate("/dashboard")}>
                      Abbrechen
                    </Button>
                    <Button onClick={updateContactInfo}>
                      Speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle>Kontaktinformationen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Haupt-E-Mail</h3>
                    <Input
                      placeholder="info@unternehmen.de"
                      value={contactInfo.main_email}
                      onChange={(e) => setContactInfo({ ...contactInfo, main_email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Support-E-Mail</h3>
                    <Input
                      placeholder="support@unternehmen.de"
                      value={contactInfo.support_email}
                      onChange={(e) => setContactInfo({ ...contactInfo, support_email: e.target.value })}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">WhatsApp-Nummer für Terminanfragen</h3>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      placeholder="4917613627749"
                      value={contactInfo.main_phone}
                      onChange={(e) => setContactInfo({ ...contactInfo, main_phone: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Diese Nummer wird für WhatsApp-Links in Kennenlern-Gespräch E-Mails verwendet. Bitte nur Ziffern eingeben (z.B. 4917613627749 ohne +, Leerzeichen oder Klammern).
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Support-Telefon</h3>
                    <Input
                      placeholder="+49 (0) 123 456 790"
                      value={contactInfo.support_phone}
                      onChange={(e) => setContactInfo({ ...contactInfo, support_phone: e.target.value })}
                    />
                  </div>


                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Firmenadresse</h3>
                    <div className="space-y-2">
                      <Label>Straße und Hausnummer</Label>
                      <Input
                        placeholder="[Straße und Hausnummer]"
                        value={contactInfo.street_address}
                        onChange={(e) => setContactInfo({ ...contactInfo, street_address: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>PLZ</Label>
                      <Input
                        placeholder="[PLZ]"
                        value={contactInfo.postal_code}
                        onChange={(e) => setContactInfo({ ...contactInfo, postal_code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stadt</Label>
                      <Input
                        placeholder="[Stadt]"
                        value={contactInfo.city}
                        onChange={(e) => setContactInfo({ ...contactInfo, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Land</Label>
                      <Input
                        placeholder="Deutschland"
                        value={contactInfo.country}
                        onChange={(e) => setContactInfo({ ...contactInfo, country: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={updateContactInfo}>
                      Speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="legal">
              <Card>
                <CardHeader>
                  <CardTitle>Rechtliche Informationen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="trade-register">Handelsregisternummer</Label>
                      <Input
                        id="trade-register"
                        placeholder="z.B. HRB 123456"
                        value={contactInfo.trade_register_number}
                        onChange={(e) => setContactInfo({ ...contactInfo, trade_register_number: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-court">Registergericht</Label>
                      <Input
                        id="register-court"
                        placeholder="z.B. Amtsgericht Berlin"
                        value={contactInfo.register_court}
                        onChange={(e) => setContactInfo({ ...contactInfo, register_court: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vat-id">Umsatzsteuer-ID</Label>
                      <Input
                        id="vat-id"
                        placeholder="z.B. DE123456789"
                        value={contactInfo.vat_id}
                        onChange={(e) => setContactInfo({ ...contactInfo, vat_id: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="managing-director">Geschäftsführer</Label>
                      <Input
                        id="managing-director"
                        placeholder="[Geschäftsführer]"
                        value={contactInfo.managing_director}
                        onChange={(e) => setContactInfo({ ...contactInfo, managing_director: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content-responsible">Verantwortlich für den Inhalt</Label>
                    <Input
                      id="content-responsible"
                      placeholder="[Geschäftsführer]"
                      value={contactInfo.content_responsible}
                      onChange={(e) => setContactInfo({ ...contactInfo, content_responsible: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Gemäß § 55 Abs. 2 RStV
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="legal-form">Rechtsform</Label>
                    <Select 
                      value={contactInfo.legal_form} 
                      onValueChange={(value) => setContactInfo({ ...contactInfo, legal_form: value })}
                    >
                      <SelectTrigger id="legal-form">
                        <SelectValue placeholder="Rechtsform auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GmbH">GmbH</SelectItem>
                        <SelectItem value="UG">UG (haftungsbeschränkt)</SelectItem>
                        <SelectItem value="AG">AG</SelectItem>
                        <SelectItem value="KG">KG</SelectItem>
                        <SelectItem value="OHG">OHG</SelectItem>
                        <SelectItem value="Einzelunternehmen">Einzelunternehmen</SelectItem>
                        <SelectItem value="GbR">GbR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-medium">Datenschutz (optional)</h3>
                    <p className="text-sm text-muted-foreground">
                      Optional: Für DSGVO-Compliance
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="data-protection-officer">Datenschutzbeauftragter</Label>
                      <Input
                        id="data-protection-officer"
                        placeholder="[Optional für DSGVO-Compliance]"
                        value={contactInfo.data_protection_officer}
                        onChange={(e) => setContactInfo({ ...contactInfo, data_protection_officer: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data-protection-email">Datenschutz-Kontakt E-Mail</Label>
                      <Input
                        id="data-protection-email"
                        type="email"
                        placeholder="datenschutz@unternehmen.de"
                        value={contactInfo.data_protection_email}
                        onChange={(e) => setContactInfo({ ...contactInfo, data_protection_email: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate E-Mail für Datenschutzanfragen (falls abweichend von Haupt-E-Mail)
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={updateContactInfo}>
                      Speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Logo & Favicon Tab */}
            <TabsContent value="logo-favicon">
              <div className="space-y-6">
                {/* Logo Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Logo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6 items-center">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">Upload Logo</p>
                        <div 
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                        >
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Drag and drop a file or click to select</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            image/png, image/jpeg, image/svg+xml, image/webp (max. 5MB)
                          </p>
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">Current Logo</p>
                        <div className="border rounded-lg p-6 flex items-center justify-center min-h-[200px]" style={{ backgroundImage: 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }}>
                          {contactInfo.logo_url ? (
                            <img 
                              src={contactInfo.logo_url} 
                              alt="Company Logo" 
                              className="max-h-32 max-w-full object-contain"
                            />
                          ) : (
                            <div className="text-center">
                              <div className="text-4xl font-bold text-yellow-500">KYC</div>
                              <p className="text-xs text-gray-400 mt-2">Default Logo</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Favicon Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Favicon</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6 items-center">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">Upload Favicon</p>
                        <div 
                          onClick={() => document.getElementById('favicon-upload')?.click()}
                          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                        >
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Drag and drop a file or click to select</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            image/png, image/x-icon, image/svg+xml, image/vnd.microsoft.icon (max. 1MB)
                          </p>
                        </div>
                        <input
                          id="favicon-upload"
                          type="file"
                          accept="image/*,.ico"
                          className="hidden"
                          onChange={handleFaviconUpload}
                        />
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">Current Favicon</p>
                        <div className="border rounded-lg p-6 flex items-center justify-center min-h-[200px]" style={{ backgroundImage: 'repeating-conic-gradient(#d1d5db 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }}>
                          {contactInfo.favicon_url ? (
                            <img 
                              src={contactInfo.favicon_url} 
                              alt="Favicon" 
                              className="w-16 h-16 object-contain"
                            />
                          ) : (
                            <div className="text-center">
                              <div className="w-16 h-16 bg-black border-2 border-yellow-500 flex items-center justify-center mx-auto">
                                <span className="text-yellow-500 font-bold text-lg">KYC</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-2">Default Favicon</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding">
              <Card>
                <CardHeader>
                  <CardTitle>Branding-Farben</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Primärfarbe</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary-color"
                          type="color"
                          value={contactInfo.primary_color}
                          onChange={(e) => setContactInfo({ ...contactInfo, primary_color: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          type="text"
                          value={contactInfo.primary_color}
                          onChange={(e) => setContactInfo({ ...contactInfo, primary_color: e.target.value })}
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="secondary-color">Sekundärfarbe</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary-color"
                          type="color"
                          value={contactInfo.secondary_color}
                          onChange={(e) => setContactInfo({ ...contactInfo, secondary_color: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          type="text"
                          value={contactInfo.secondary_color}
                          onChange={(e) => setContactInfo({ ...contactInfo, secondary_color: e.target.value })}
                          placeholder="#ffffff"
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accent-color">Akzentfarbe</Label>
                      <div className="flex gap-2">
                        <Input
                          id="accent-color"
                          type="color"
                          value={contactInfo.accent_color}
                          onChange={(e) => setContactInfo({ ...contactInfo, accent_color: e.target.value })}
                          className="w-20 h-10"
                        />
                        <Input
                          type="text"
                          value={contactInfo.accent_color}
                          onChange={(e) => setContactInfo({ ...contactInfo, accent_color: e.target.value })}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={updateContactInfo}>
                      Speichern
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="kyc">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">KYC-Einstellungen</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="payment">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">Zahlungseinstellungen</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle>E-Mail Einstellungen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                      <strong className="block mb-1">E-Mail Verzögerung</strong>
                      Konfigurieren Sie die automatische Verzögerung beim Versenden von E-Mails. Dies kann hilfreich sein, um versehentliche Sendungen zu vermeiden.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox 
                        id="delay-enabled"
                        checked={emailDelayEnabled}
                        onCheckedChange={(checked) => setEmailDelayEnabled(checked as boolean)}
                      />
                      <div className="space-y-1">
                        <Label 
                          htmlFor="delay-enabled" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          E-Mail Verzögerung aktivieren
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Wenn aktiviert, werden E-Mails nicht sofort versendet, sondern nach der konfigurierten Wartezeit.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delay-hours">Verzögerung in Stunden</Label>
                      <Input
                        id="delay-hours"
                        type="number"
                        min="1"
                        max="168"
                        value={emailDelayHours}
                        onChange={(e) => setEmailDelayHours(parseInt(e.target.value) || 2)}
                        disabled={!emailDelayEnabled}
                        className="w-32"
                      />
                      <p className="text-sm text-muted-foreground">
                        Anzahl der Stunden, um die E-Mails verzögert werden sollen (1-168 Stunden / max. 7 Tage).
                      </p>
                    </div>

                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-900">
                        <strong className="block mb-1">Hinweis zur E-Mail Verzögerung</strong>
                        Diese Einstellung betrifft automatisch generierte E-Mails wie Benachrichtigungen und Bestätigungen. Kritische E-Mails wie Passwort-Resets werden weiterhin sofort versendet.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setIsEmailPreviewOpen(true)}>
                        <Eye className="h-4 w-4 mr-2" />
                        E-Mail Vorschau
                      </Button>
                      <Button onClick={updateEmailSettings}>
                        Einstellungen speichern
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="chat">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">Live-Chat-Einstellungen</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>

    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{previewContract?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge>{previewContract?.category}</Badge>
            <Badge variant="outline">{previewContract?.version}</Badge>
          </div>
          <Separator />
          <div 
            className="prose prose-sm max-w-none whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: previewContract?.content || '' }}
          />
        </div>
      </DialogContent>
    </Dialog>

    {/* Email Preview Dialog */}
    <Dialog open={isEmailPreviewOpen} onOpenChange={setIsEmailPreviewOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>E-Mail Vorschau: Bewerbung akzeptiert</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-sm font-medium">Betreff:</p>
            <p className="text-sm">Herzlichen Glückwunsch! Ihre Bewerbung wurde akzeptiert</p>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-sm font-medium">Von:</p>
            <p className="text-sm">EuroScent &lt;onboarding@resend.dev&gt;</p>
          </div>
          <Separator />
          <div className="bg-gray-100 p-6 rounded-lg">
            <div className="max-w-[600px] mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Header with Gradient */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-10 text-center">
                <div className="h-12 mx-auto mb-5 flex items-center justify-center">
                  <img src={euroscentLogo} alt="EuroScent Logo" className="max-w-[180px] h-auto" />
                </div>
                <h1 className="text-white text-3xl font-bold">
                  Glückwunsch, [Vorname]!
                </h1>
              </div>
              
              {/* Content */}
              <div className="p-10">
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-8">
                  <p className="text-green-800 font-semibold m-0">
                    ✓ Ihre Bewerbung wurde akzeptiert
                  </p>
                </div>
                
                <p className="text-gray-700 mb-5 leading-relaxed">
                  Wir freuen uns, Ihnen mitteilen zu können, dass Ihre Bewerbung bei <strong>EuroScent</strong> erfolgreich war!
                </p>
                
                <p className="text-gray-700 mb-8 leading-relaxed">
                  Um mit der Einrichtung Ihres Mitarbeiterkontos zu beginnen und alle erforderlichen Informationen bereitzustellen, klicken Sie bitte auf den untenstehenden Button:
                </p>
                
                {/* CTA Button */}
                <div className="text-center py-5">
                  <div className="inline-block bg-gradient-to-r from-purple-600 to-purple-400 text-white px-10 py-4 rounded-lg font-semibold shadow-lg">
                    Mitarbeiterkonto erstellen
                  </div>
                </div>
                
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <p className="text-gray-600 text-sm mb-3">
                    Falls Sie Fragen haben oder Unterstützung benötigen, zögern Sie nicht, uns jederzeit zu kontaktieren.
                  </p>
                  
                  <p className="text-gray-700 mt-5">
                    Mit freundlichen Grüßen,<br />
                    <strong className="text-purple-600">Das EuroScent Team</strong>
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-10 py-8 text-center border-t border-gray-200">
                <p className="text-gray-600 text-xs mb-3">
                  © 2025 EuroScent. Alle Rechte vorbehalten.
                </p>
                <p className="mb-2">
                  <a href="/impressum" className="text-gray-600 text-xs hover:underline mx-2">Impressum</a>
                  <span className="text-gray-300">|</span>
                  <a href="/privacy" className="text-gray-600 text-xs hover:underline mx-2">Datenschutz</a>
                </p>
                <p className="text-gray-400 text-xs">
                  Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Email Preview Dialog - All Email Types */}
    <Dialog open={isEmailPreviewOpen} onOpenChange={setIsEmailPreviewOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>E-Mail Vorschauen - Bewerbungsprozess</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="confirmation" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="confirmation">Eingangsbestätigung</TabsTrigger>
            <TabsTrigger value="acceptance">Bewerbung angenommen</TabsTrigger>
            <TabsTrigger value="rejection">Bewerbung abgelehnt</TabsTrigger>
          </TabsList>

          {/* Eingangsbestätigung */}
          <TabsContent value="confirmation" className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="text-sm font-medium">Betreff:</p>
              <p className="text-sm">Bewerbungseingang bestätigt - EuroScent</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="text-sm font-medium">Von:</p>
              <p className="text-sm">EuroScent &lt;office@euroscent.de&gt;</p>
            </div>
            <Separator />
            <div className="bg-gray-100 p-6 rounded-lg">
              <div className="max-w-[600px] mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-10 text-center">
                  <div className="mx-auto mb-5 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 bg-white/95 px-6 py-3 rounded-xl shadow-md">
                      <img src={euroscentLogo} alt="EuroScent Logo" className="max-w-[160px] h-auto" />
                    </div>
                  </div>
                  <h1 className="text-white text-3xl font-bold">
                    Vielen Dank für Ihre Bewerbung!
                  </h1>
                </div>
                
                <div className="p-10">
                  <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded mb-8">
                    <p className="text-purple-600 font-semibold m-0">
                      ✓ Ihre Bewerbung ist bei uns eingegangen
                    </p>
                  </div>
                  
                  <p className="text-gray-700 text-base leading-relaxed mb-5">
                    Hallo [Vorname],
                  </p>
                  
                  <p className="text-gray-700 text-base leading-relaxed mb-5">
                    wir haben Ihre Bewerbung bei <strong>EuroScent</strong> erfolgreich erhalten.
                  </p>
                  
                  <div className="bg-gray-50 rounded-lg p-5 my-8">
                    <p className="text-gray-600 text-sm leading-relaxed mb-2">
                      <strong className="text-gray-700">Was passiert als Nächstes?</strong>
                    </p>
                    <ul className="text-gray-600 text-sm leading-relaxed m-0 pl-5">
                      <li>Prüfung Ihrer Bewerbungsunterlagen</li>
                      <li>Bei positivem Feedback erhalten Sie eine Einladung</li>
                      <li>Sie können sich dann in unserem System registrieren</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-8 text-center border-t border-gray-200">
                  <p className="text-gray-500 text-xs">© 2025 EuroScent. Alle Rechte vorbehalten.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bewerbung angenommen */}
          <TabsContent value="acceptance" className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="text-sm font-medium">Betreff:</p>
              <p className="text-sm">Herzlichen Glückwunsch! Ihre Bewerbung wurde akzeptiert</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="text-sm font-medium">Von:</p>
              <p className="text-sm">EuroScent &lt;office@euroscent.de&gt;</p>
            </div>
            <Separator />
            <div className="bg-gray-100 p-6 rounded-lg">
              <div className="max-w-[600px] mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-10 text-center">
                  <div className="mx-auto mb-5 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 bg-white/95 px-6 py-3 rounded-xl shadow-md">
                      <img src={euroscentLogo} alt="EuroScent Logo" className="max-w-[160px] h-auto" />
                    </div>
                  </div>
                  <h1 className="text-white text-3xl font-bold">
                    Glückwunsch, [Vorname]!
                  </h1>
                </div>
                
                <div className="p-10">
                  <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-8">
                    <p className="text-green-800 font-semibold m-0">
                      ✓ Ihre Bewerbung wurde akzeptiert
                    </p>
                  </div>
                  
                  <p className="text-gray-700 text-base leading-relaxed mb-5">
                    Ihre Bewerbung bei <strong>EuroScent</strong> war erfolgreich!
                  </p>

                  <div className="text-center py-5">
                    <div className="inline-block bg-gradient-to-r from-purple-600 to-purple-400 text-white py-4 px-10 rounded-lg font-semibold shadow-lg">
                      Mitarbeiterkonto erstellen
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-8 text-center border-t border-gray-200">
                  <p className="text-gray-500 text-xs">© 2025 EuroScent. Alle Rechte vorbehalten.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bewerbung abgelehnt */}
          <TabsContent value="rejection" className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="text-sm font-medium">Betreff:</p>
              <p className="text-sm">Rückmeldung zu Ihrer Bewerbung - EuroScent</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <p className="text-sm font-medium">Von:</p>
              <p className="text-sm">EuroScent &lt;office@euroscent.de&gt;</p>
            </div>
            <Separator />
            <div className="bg-gray-100 p-6 rounded-lg">
              <div className="max-w-[600px] mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-purple-400 p-10 text-center">
                  <div className="mx-auto mb-5 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 bg-white/95 px-6 py-3 rounded-xl shadow-md">
                      <img src={euroscentLogo} alt="EuroScent Logo" className="max-w-[160px] h-auto" />
                    </div>
                  </div>
                  <h1 className="text-white text-3xl font-bold">
                    Rückmeldung zu Ihrer Bewerbung
                  </h1>
                </div>
                
                <div className="p-10">
                  <p className="text-gray-700 text-base leading-relaxed mb-5">
                    Sehr geehrte/r [Vorname] [Nachname],
                  </p>
                  
                  <p className="text-gray-700 text-base leading-relaxed mb-5">
                    vielen Dank für Ihr Interesse an einer Position bei <strong>EuroScent</strong>.
                  </p>
                  
                  <p className="text-gray-700 text-base leading-relaxed mb-5">
                    Nach sorgfältiger Prüfung haben wir uns für andere Kandidaten entschieden.
                  </p>

                  <div className="bg-gray-50 rounded-lg p-5 my-8">
                    <p className="text-gray-600 text-sm leading-relaxed m-0">
                      Wir wünschen Ihnen für Ihren weiteren beruflichen Weg alles Gute.
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-8 text-center border-t border-gray-200">
                  <p className="text-gray-500 text-xs">© 2025 EuroScent. Alle Rechte vorbehalten.</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Settings;
