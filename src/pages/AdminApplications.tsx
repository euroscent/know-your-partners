import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageLoader } from "@/components/PageLoader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast-stub";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Eye, Trash2, Search, Users, Download, Check, X, Calendar, Mail, FileText, Send, UserPlus } from "lucide-react";
import { formatDateToGerman } from "@/lib/dateUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readFunctionError } from "@/lib/functionError";

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string | null;
  message: string | null;
  status: string;
  created_at: string;
  resume_path: string | null;
  employment_type: string | null;
  meeting_requested_at: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
}

const AdminApplications = () => {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const tr = (de: string, en: string) => lang === "en" ? en : de;
  const [templates, setTemplates] = useState<{id:string;name:string;category:string;version:string;default_salary:number|null}[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [salary, setSalary] = useState("");
  const [notice, setNotice] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
    const [startDate, setStartDate] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [detailApplication, setDetailApplication] = useState<Application | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    checkAdminAndFetchApplications();
  }, []);

  const checkAdminAndFetchApplications = async () => {
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

    fetchApplications();
  };

  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(tr("Bewerbungen konnten nicht geladen werden. Bitte erneut versuchen.", "Could not load applications. Please try again."));
      setLoading(false);
      return;
    }

    setApplications(data || []);
    setLoading(false);
  };

  // Live-Updates für neue/aktualisierte Bewerbungen
  useEffect(() => {
    const channel = supabase
      .channel("applications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        (payload) => {
          fetchApplications();
          const newApp = payload.new as Application;
          toast.success(`Neue Bewerbung: ${newApp.first_name} ${newApp.last_name}`, {
            description: `E-Mail: ${newApp.email}`,
            duration: 5000,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "applications" },
        () => {
          fetchApplications();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "applications" },
        () => {
          fetchApplications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const updateStatus = async (id: string, status: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { error } = await supabase
      .from("applications")
      .update({
        status,
        reviewed_by: session?.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Aktualisieren");
      return;
    }

    toast.success("Status aktualisiert");
    fetchApplications();
  };

  const openAcceptDialog = (application: Application) => {
    setSelectedApplication(application);
    setTemplateId(""); setSalary(""); setNotice("");
    supabase.from("contract_templates").select("id,name,category,version,default_salary").eq("is_active",true).order("name").then(({data,error}) => { if(error) setNotice(tr("Vorlagen konnten nicht geladen werden.","Could not load templates.")); setTemplates(data || []); });
    // Setze Standard-Startdatum auf den 1. des nächsten Monats
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    // Formatiere lokales Datum als YYYY-MM-DD ohne UTC-Konvertierung
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const day = String(nextMonth.getDate()).padStart(2, '0');
    setStartDate(`${year}-${month}-${day}`);
    setAcceptDialogOpen(true);
  };

  const handleAcceptApplication = async () => {
    if (!selectedApplication || !templateId || !startDate || salary === "" || !Number.isFinite(Number(salary))) return;
    setIsProcessing(true); setNotice("");
    try {
      const {data,error} = await supabase.functions.invoke("applicant-api",{body:{action:"accept",application_id:selectedApplication.id,template_id:templateId,start_date:startDate,salary:Number(salary),origin:window.location.origin}});
      if(error || data?.error) {
        const failure = await readFunctionError(error, data);
        let message = failure.message;
        if (message?.includes("APPLICANT_ALLOWED_ORIGINS")) {
          message = tr(
            `Diese Website ist für die Bewerberannahme noch nicht freigegeben. Ergänze ${window.location.origin} in der Einstellung APPLICANT_ALLOWED_ORIGINS des Bewerbungsdienstes; vorhandene Adressen beibehalten und mit Komma trennen.`,
            `This website is not yet allowed to accept applicants. Add ${window.location.origin} to the application service's APPLICANT_ALLOWED_ORIGINS setting; keep existing addresses and separate them with commas.`
          );
        } else if (failure.status === 401) {
          message = tr("Die Anmeldung wurde vom Bewerbungsdienst abgelehnt. Bitte erneut anmelden. Falls der Fehler bleibt, die JWT-Prüfung der Funktion applicant-api kontrollieren; die Funktion prüft den Adminzugang selbst.", "The application service rejected the session. Please sign in again. If this persists, check JWT verification for applicant-api; the function validates admin access itself.");
        }
        throw new Error(message || (failure.status === 404
          ? tr("Der Bewerbungsdienst applicant-api wurde im verbundenen Backend nicht gefunden.", "The applicant-api service was not found in the connected backend.")
          : tr("Der Bewerbungsdienst konnte nicht erreicht werden. Bitte Verbindung und Funktionsprotokoll von applicant-api prüfen.", "Could not reach the application service. Check the connection and applicant-api function logs.")));
      }
      const message = data.warning || tr("Bewerbung angenommen und Vertrag bereitgestellt.","Application accepted and contract provided.");
      setNotice(message); toast.success(message); setAcceptDialogOpen(false); fetchApplications();
    } catch(e:any) { setNotice(e.message); } finally {setIsProcessing(false);}
  };

  const handleRejectApplication = async (id: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data.user?.id })
        .eq("id", id);

      if (error) throw error;

      toast.success("Bewerbung erfolgreich abgelehnt.");
      fetchApplications();
    } catch (error: any) {
      console.error("Error rejecting application:", error);
      toast.error(error.message || "Fehler beim Ablehnen der Bewerbung.");
    }
  };

  const handleSendMeetingRequest = async (application: Application) => {
    try {
      const { error } = await supabase.functions.invoke("send-meeting-request-email", {
        body: {
          firstName: application.first_name,
          lastName: application.last_name,
          email: application.email,
        },
      });

      if (error) throw error;

      // Update the application to mark meeting request as sent
      const { error: updateError } = await supabase
        .from("applications")
        .update({ meeting_requested_at: new Date().toISOString() })
        .eq("id", application.id);

      if (updateError) throw updateError;

      toast.success("Kennenlern-Gespräch E-Mail wurde erfolgreich gesendet!");
      fetchApplications(); // Refresh the list
    } catch (error: any) {
      console.error("Error sending meeting request:", error);
      toast.error(error.message || "Fehler beim Senden der E-Mail.");
    }
  };

  const deleteApplication = async (id: string) => {
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }

    toast.success("Bewerbung gelöscht");
    fetchApplications();
  };

  const handleSendContractReminder = async (application: Application) => {
    try {
      const { error } = await supabase.functions.invoke("send-contract-reminder", {
        body: {
          firstName: application.first_name,
          lastName: application.last_name,
          email: application.email,
          employmentType: application.employment_type,
        },
      });

      if (error) throw error;

      toast.success("Erinnerungs-E-Mail wurde erfolgreich gesendet!");
    } catch (error: any) {
      console.error("Error sending contract reminder:", error);
      toast.error(error.message || "Fehler beim Senden der Erinnerungs-E-Mail.");
    }
  };

  const handleConvertToFreelancer = (application: Application) => {
    openAcceptDialog(application);
  };

  const downloadResume = async (resumePath: string, firstName: string, lastName: string) => {
    try {

      const { data, error } = await supabase.storage
        .from(resumePath.startsWith('applications/') ? 'verification-documents' : 'applications')
        .download(resumePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CV_${firstName}_${lastName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Lebenslauf heruntergeladen");
    } catch (error: any) {
      toast.error("Fehler beim Herunterladen: " + error.message);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const activeTab = statusFilter === "contacted" ? "contacted" : "applications";

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.phone.includes(searchTerm);

    if (activeTab === "contacted") {
      return matchesSearch && app.status === "contacted";
    }

    // Regular applications tab - exclude "contacted"
    const matchesStatus = statusFilter === "all" ? app.status !== "contacted" : app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const regularApps = applications.filter((a) => a.status !== "contacted");
  const contactedApps = applications.filter((a) => a.status === "contacted");

  const stats = {
    total: regularApps.length,
    pending: regularApps.filter((a) => a.status === "pending").length,
    approved: regularApps.filter((a) => a.status === "approved").length,
    rejected: regularApps.filter((a) => a.status === "rejected").length,
    contacted: contactedApps.length,
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">{tr("Neue Bewerber", "New applicants")} ({stats.total})</h1>
        {notice && <p role="status" className="text-primary">{notice}</p>}
      </div>

      {/* Stats Cards */}
      <div>
        <h2 className="text-lg font-medium mb-4">Bewerbungs-Übersicht</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Gesamt</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Ausstehend</div>
              <div className="text-3xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Eingestellt</div>
              <div className="text-3xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Abgelehnt</div>
              <div className="text-3xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Kontaktiert</div>
              <div className="text-3xl font-bold">{stats.contacted}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs for Applications vs Contacted */}
      <Tabs defaultValue="applications" onValueChange={(val) => {
        if (val === "contacted") {
          setStatusFilter("contacted");
        } else {
          setStatusFilter("all");
        }
      }}>
        <TabsList>
          <TabsTrigger value="applications" className="gap-2">
            <Users className="h-4 w-4" />
            Bewerbungen ({stats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <h2 className="text-lg font-medium">Bewerbungen verwalten</h2>

          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nach Name, E-Mail oder Telefon suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter === "contacted" ? "all" : statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="approved">Eingestellt</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
          </div>

        {/* Applications Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">BEWERBER</TableHead>
                  <TableHead>KONTAKT</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>EINGEGANGEN</TableHead>
                  <TableHead className="text-right">AKTIONEN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(app.first_name, app.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {app.first_name} {app.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {app.birth_date 
                              ? `Geboren: ${formatDateToGerman(app.birth_date)}`
                              : "Keine Geburtsdaten"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm flex items-center gap-1">
                          <span>✉</span>
                          <span>{app.email}</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <span>📞</span>
                          <span>{app.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            app.status === "approved"
                              ? "default"
                              : app.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            app.status === "pending"
                              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              : app.status === "approved"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : ""
                          }
                        >
                          ⚠{" "}
                          {app.status === "pending"
                            ? "Ausstehend"
                            : app.status === "approved"
                            ? tr("Angenommen", "Accepted")
                            : "Abgelehnt"}
                        </Badge>
                        {app.status === "approved" && <Button variant="link" size="sm" onClick={async () => {
                          const {error} = await supabase.auth.resetPasswordForEmail(app.email,{redirectTo:window.location.origin + '/reset-password'});
                          setNotice(error ? tr('Passwortlink konnte nicht gesendet werden.','Could not send password link.') : tr('Passwortlink angefordert.','Password link requested.'));
                        }}>{tr('Passwortlink senden','Send password link')}</Button>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(app.created_at), "dd.MM.yyyy, HH:mm", {
                          locale: de,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary hover:text-primary"
                          onClick={() => {
                            setDetailApplication(app);
                            setPreviewUrl(null);

                            if (!app.resume_path) {
                              setPreviewLoading(false);
                              return;
                            }

                            setPreviewLoading(true);
                            supabase.storage
                              .from(app.resume_path.startsWith('applications/') ? 'verification-documents' : 'applications')
                              .download(app.resume_path)
                              .then(({ data, error }) => {
                                if (!error && data) {
                                  const url = URL.createObjectURL(data);
                                  setPreviewUrl(url);
                                }
                                setPreviewLoading(false);
                              });
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleSendMeetingRequest(app)}
                          disabled={!!app.meeting_requested_at}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          {app.meeting_requested_at ? "Gespräch angefragt" : "Kennenlern-Gespräch"}
                        </Button>
                        {app.status === "approved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => handleSendContractReminder(app)}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Vertragserinnerung
                          </Button>
                        )}
                        {(app.status === "pending" || app.status === "approved") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary hover:text-primary"
                            onClick={() => handleConvertToFreelancer(app)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            {tr("Freelancer-Vertrag auswählen", "Select freelancer contract")}
                          </Button>
                        )}
                        {app.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openAcceptDialog(app)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              {tr("Bewerbung annehmen", "Accept application")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => handleRejectApplication(app.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Ablehnen
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteApplication(app.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Löschen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredApplications.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Keine Bewerbungen gefunden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Bewerbung annehmen", "Accept application")}</DialogTitle>
            <DialogDescription>{selectedApplication?.first_name} {selectedApplication?.last_name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>{tr("Vertragsvorlage", "Contract template")} *</Label>
              <Select value={templateId} onValueChange={id => {setTemplateId(id);const template=templates.find(t=>t.id===id);setSalary(template?.default_salary == null ? "" : String(template.default_salary));}}>
                <SelectTrigger><SelectValue placeholder={tr("Vorlage auswählen", "Select template")} /></SelectTrigger>
                <SelectContent>{templates.map(t=><SelectItem key={t.id} value={t.id}>{t.name} · {t.category} · {t.version}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label htmlFor="start-date">{tr("Startdatum", "Start date")} *</Label><Input id="start-date" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="salary">{tr("Vergütung laut Vorlage (€)", "Compensation according to template (€)")} *</Label><Input id="salary" type="number" min="0" max="1000000" step="0.01" value={salary} onChange={e=>setSalary(e.target.value)} /></div>
            {notice && <p role="alert" className="text-destructive">{notice}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setAcceptDialogOpen(false)}
              disabled={isProcessing}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleAcceptApplication}
              disabled={!templateId || !startDate || salary === "" || Number(salary) < 0 || isProcessing}
              
            >
              {isProcessing ? tr("Wird verarbeitet…","Processing…") : tr("Bewerbung annehmen","Accept application")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailApplication} onOpenChange={(open) => {
        if (!open) {
          setDetailApplication(null);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr("Bewerbungsdetails", "Application details")}</DialogTitle>
            <DialogDescription>
              {detailApplication?.first_name} {detailApplication?.last_name}
            </DialogDescription>
          </DialogHeader>
          {detailApplication && (
            <div className="space-y-4">
              <p className="text-sm">{tr("Adresse", "Address")}: {detailApplication.street} {detailApplication.postal_code} {detailApplication.city}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{detailApplication.first_name} {detailApplication.last_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Geburtsdatum</p>
                  <p className="font-medium">{detailApplication.birth_date ? formatDateToGerman(detailApplication.birth_date) : "–"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">E-Mail</p>
                  <p className="font-medium break-all">{detailApplication.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefon</p>
                  <p className="font-medium">{detailApplication.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Zeitmodell</p>
                  <p className="font-medium">{detailApplication.employment_type || "–"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Eingegangen</p>
                  <p className="font-medium">{format(new Date(detailApplication.created_at), "dd.MM.yyyy, HH:mm", { locale: de })}</p>
                </div>
              </div>

              {detailApplication.message && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Anschreiben</p>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {detailApplication.message}
                  </div>
                </div>
              )}

              {!detailApplication.message && (
                <div className="text-sm text-muted-foreground italic">
                  Kein Anschreiben eingereicht.
                </div>
              )}

              {detailApplication.resume_path && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-muted-foreground text-sm flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Hochgeladene Dateien
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => { if (detailApplication.resume_path) downloadResume(detailApplication.resume_path, detailApplication.first_name, detailApplication.last_name); }}
                    >
                      <Download className="h-4 w-4" />
                      Herunterladen
                    </Button>
                  </div>
                  <>
                    {previewLoading && (
                      <div className="bg-muted rounded-lg p-8 text-center text-sm text-muted-foreground">
                        Datei wird geladen...
                      </div>
                    )}
                    {previewUrl && detailApplication.resume_path.toLowerCase().endsWith('.pdf') && (
                      <iframe
                        src={previewUrl}
                        className="w-full h-[500px] rounded-lg border"
                        title="PDF Vorschau"
                      />
                    )}
                    {previewUrl && !detailApplication.resume_path.toLowerCase().endsWith('.pdf') && (
                      detailApplication.resume_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={previewUrl} alt="Vorschau" className="w-full rounded-lg border" />
                      ) : (
                        <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
                          Vorschau nicht verfügbar – bitte herunterladen.
                        </div>
                      )
                    )}
                    {!previewLoading && !previewUrl && (
                      <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
                        Datei konnte nicht geladen werden.
                      </div>
                    )}
                  </>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminApplications;
