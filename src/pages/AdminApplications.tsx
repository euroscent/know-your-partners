import { useEffect, useState } from "react";
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
}

const AdminApplications = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [acceptOption, setAcceptOption] = useState<string>("");
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
      toast.error("Fehler beim Laden der Bewerbungen");
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
    setAcceptOption("");
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
    if (!selectedApplication || !acceptOption) {
      toast.error("Bitte wählen Sie eine Option aus.");
      return;
    }
    
    // Bei festen Anstellungsarten muss ein Startdatum ausgewählt sein
    const isFreieWahl = acceptOption === "freie_wahl";
    if (!isFreieWahl && !startDate) {
      toast.error("Bitte wählen Sie ein Startdatum aus.");
      return;
    }

    setIsProcessing(true);

    try {
      // Bestimme die tatsächliche Anstellungsart für die Datenbank
      const employmentType = isFreieWahl ? null : acceptOption;
      
      // Update application status and employment type
      const { error: updateError } = await supabase
        .from("applications")
        .update({ 
          status: "approved",
          employment_type: employmentType 
        })
        .eq("id", selectedApplication.id);

      if (updateError) throw updateError;

      // Send acceptance email
      const { error: emailError } = await supabase.functions.invoke("send-acceptance-email", {
        body: {
          firstName: selectedApplication.first_name,
          lastName: selectedApplication.last_name,
          email: selectedApplication.email,
          employmentType: isFreieWahl ? null : acceptOption,
          startDate: isFreieWahl ? null : startDate,
          lockFields: !isFreieWahl,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        toast.error("Bewerbung akzeptiert, aber E-Mail konnte nicht gesendet werden.");
      } else {
        toast.success("Bewerbung akzeptiert! Der Bewerber erhält eine E-Mail.");
      }

      setAcceptDialogOpen(false);
      setSelectedApplication(null);
      setAcceptOption("");
      setStartDate("");
      fetchApplications();
    } catch (error: any) {
      console.error("Error accepting application:", error);
      toast.error(error.message || "Fehler beim Akzeptieren der Bewerbung.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectApplication = async (id: string) => {
    try {
      const { error } = await supabase
        .from("applications")
        .update({ status: "rejected" })
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

  const handleConvertToFreelancer = async (application: Application) => {
    if (!confirm(`${application.first_name} ${application.last_name} als Freelancer übernehmen?\n\n• Mitarbeiterkonto wird angelegt\n• Freelancer-Vertrag wird erstellt\n• Freie Outlook-E-Mail wird zugewiesen`)) {
      return;
    }

    try {
      toast.info("Mitarbeiter wird angelegt...");

      // 0) Check if a profile with this email already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .ilike("email", application.email)
        .maybeSingle();

      let newUserId: string;

      if (existingProfile?.id) {
        const existingName = `${existingProfile.first_name || ""} ${existingProfile.last_name || ""}`.trim();
        const proceed = confirm(
          `Diese E-Mail (${application.email}) ist bereits registriert${existingName ? ` als „${existingName}"` : ""}.\n\nBestehendes Konto als Freelancer übernehmen und mit den Bewerber-Daten aktualisieren?`
        );
        if (!proceed) return;
        newUserId = existingProfile.id;
        await supabase
          .from("profiles")
          .update({
            first_name: application.first_name,
            last_name: application.last_name,
            employment_type: "freelancer",
          })
          .eq("id", newUserId);
      } else {
        // 1) Create employee via edge function (employment_type = freelancer)
        const { data: createData, error: createError } = await supabase.functions.invoke("create-employee", {
          body: {
            email: application.email,
            first_name: application.first_name,
            last_name: application.last_name,
            employment_type: "freelancer",
            verified: false,
          },
        });

        if (createError || !createData?.user_id) {
          throw new Error(createData?.error || createError?.message || "Mitarbeiter konnte nicht angelegt werden");
        }
        newUserId = createData.user_id as string;
      }

      // 2) Update profile with phone + birth_date from application
      const profileUpdate: Record<string, any> = {
        phone: application.phone,
      };
      if (application.birth_date) profileUpdate.birth_date = application.birth_date;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", newUserId);

      if (profileError) console.warn("Profil-Update Fehler:", profileError);

      // 3) Create freelancer contract from template
      try {
        const [{ data: companyData }, { data: signatureData }, { data: templateData }] = await Promise.all([
          supabase.from("company_contact").select("*").maybeSingle(),
          supabase.from("company_signature").select("*").maybeSingle(),
          supabase.from("contract_templates").select("content").ilike("category", "freelancer").eq("is_active", true).maybeSingle(),
        ]);

        if (templateData?.content) {
          let contractContent = templateData.content;
          contractContent = contractContent.replace(/\{\{mitarbeiter_vorname\}\}/g, application.first_name || "");
          contractContent = contractContent.replace(/\{\{mitarbeiter_nachname\}\}/g, application.last_name || "");
          contractContent = contractContent.replace(/\{\{mitarbeiter_geburtsdatum\}\}/g, application.birth_date ? formatDateToGerman(application.birth_date) : "");
          contractContent = contractContent.replace(/\{\{unternehmen_name\}\}/g, companyData?.company_name || "");
          contractContent = contractContent.replace(/\{\{unternehmen_strasse\}\}/g, companyData?.street_address || "");
          contractContent = contractContent.replace(/\{\{unternehmen_plz\}\}/g, companyData?.postal_code || "");
          contractContent = contractContent.replace(/\{\{unternehmen_stadt\}\}/g, companyData?.city || "");
          contractContent = contractContent.replace(/\{\{datum\}\}/g, new Date().toLocaleDateString("de-DE"));
          contractContent = contractContent.replace(/\{\{unterzeichner_name\}\}/g, signatureData?.signer_name || "");
          contractContent = contractContent.replace(/\{\{unterzeichner_titel\}\}/g, signatureData?.signer_title || "");

          const { error: contractError } = await supabase
            .from("employee_documents")
            .insert({
              user_id: newUserId,
              document_type: "contract",
              title: `Freelancer-Vertrag - ${application.first_name} ${application.last_name}`,
              description: `Freelancer-Vertrag für ${application.first_name} ${application.last_name}`,
              contract_type: "freelancer",
              start_date: new Date().toISOString().split("T")[0],
              signature_data: "",
              content: contractContent,
            });

          if (contractError) console.warn("Vertrag-Fehler:", contractError);
        } else {
          toast.warning("Keine aktive Freelancer-Vorlage gefunden – Vertrag nicht erstellt.");
        }
      } catch (e) {
        console.warn("Vertrag konnte nicht erstellt werden:", e);
      }

      // 4) Assign next available Outlook email
      const { data: freeAccount } = await supabase
        .from("email_accounts")
        .select("id, email_address")
        .eq("status", "available")
        .ilike("provider", "%outlook%")
        .is("assigned_to", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      let assignedEmail: string | null = null;
      if (freeAccount?.id) {
        const { error: assignError } = await supabase
          .from("email_accounts")
          .update({ assigned_to: newUserId, status: "assigned" })
          .eq("id", freeAccount.id);
        if (assignError) {
          console.warn("E-Mail-Zuweisung Fehler:", assignError);
        } else {
          assignedEmail = freeAccount.email_address;
        }
      }

      // 5) Update application status to approved
      await supabase
        .from("applications")
        .update({ status: "approved", employment_type: "freelancer" })
        .eq("id", application.id);

      toast.success(
        `${application.first_name} ${application.last_name} als Freelancer übernommen` +
          (assignedEmail ? ` · Outlook: ${assignedEmail}` : " · Keine freie Outlook-E-Mail verfügbar")
      );
      fetchApplications();
    } catch (error: any) {
      console.error("Convert to freelancer error:", error);
      toast.error(error.message || "Fehler beim Übernehmen als Freelancer");
    }
  };

  const downloadResume = async (resumePath: string, firstName: string, lastName: string) => {
    try {

      const { data, error } = await supabase.storage
        .from('applications')
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
        <h1 className="text-2xl font-semibold">Bewerbungsübersicht ({stats.total})</h1>
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
                            ? "Eingestellt"
                            : "Abgelehnt"}
                        </Badge>
                        {app.status === "approved" && (
                          <Badge variant="outline" className="text-xs">
                            ✉ E-Mail gesendet
                          </Badge>
                        )}
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
                              .from('applications')
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
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => handleConvertToFreelancer(app)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Als Freelancer übernehmen
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
                              Akzeptieren
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
            <DialogTitle>Bewerbung akzeptieren</DialogTitle>
            <DialogDescription>
              Wählen Sie die Anstellungsart für {selectedApplication?.first_name} {selectedApplication?.last_name}.
              Der Bewerber erhält automatisch eine E-Mail mit einem personalisierten Registrierungslink.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="accept-option">Anstellungsart *</Label>
              <Select value={acceptOption} onValueChange={setAcceptOption}>
                <SelectTrigger id="accept-option">
                  <SelectValue placeholder="Anstellungsart wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="freie_wahl">🔓 Freie Wahl (Bewerber wählt selbst)</SelectItem>
                  <SelectItem value="minijob">Minijob (603€ Basis)</SelectItem>
                  <SelectItem value="teilzeit">Teilzeit</SelectItem>
                  <SelectItem value="vollzeit">Vollzeit</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {acceptOption === "freie_wahl" 
                  ? "Der Bewerber kann Anstellungsart und Startdatum selbst wählen"
                  : acceptOption 
                    ? "Anstellungsart und Startdatum sind für den Bewerber vorgegeben"
                    : ""
                }
              </p>
            </div>
            
            {/* Startdatum - nur anzeigen bei fester Anstellungsart */}
            {acceptOption && acceptOption !== "freie_wahl" && (
              <div className="grid gap-2">
                <Label htmlFor="start-date">Startdatum *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  Das Startdatum wird im Registrierungsformular vorausgefüllt und kann vom Bewerber nicht geändert werden.
                </p>
              </div>
            )}
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
              disabled={!acceptOption || (acceptOption !== "freie_wahl" && !startDate) || isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? "Wird verarbeitet..." : "Akzeptieren & E-Mail senden"}
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
            <DialogTitle>Bewerbungsdetails</DialogTitle>
            <DialogDescription>
              {detailApplication?.first_name} {detailApplication?.last_name}
            </DialogDescription>
          </DialogHeader>
          {detailApplication && (
            <div className="space-y-4">
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
                      onClick={() => downloadResume(detailApplication.resume_path!, detailApplication.first_name, detailApplication.last_name)}
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
