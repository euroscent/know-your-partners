import { useState, useEffect } from "react";
import { PageLoader } from "@/components/PageLoader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import payexpertLogo from "@/assets/euroscent-logo.png";
import { currentCompanyDetails } from "@/lib/companyDetails";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { formatDateToGerman } from "@/lib/dateUtils";

interface PayrollEntry {
  id: string;
  month: number;
  year: number;
  gross_salary: number;
  working_hours: number;
  hourly_rate: number | null;
  tax_deduction: number;
  social_security: number;
  health_insurance: number;
  other_deductions: number;
  net_salary: number;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  birth_date: string | null;
  email: string | null;
  tax_id: string | null;
  social_security_number: string | null;
  employment_type: string | null;
  tax_class: number | null;
  iban: string | null;
  account_holder: string | null;
}

interface PayrollEntryExtended extends PayrollEntry {
  isMinijob?: boolean;
}

interface CompanyContact {
  company_name: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
}

const Payroll = () => {
  const navigate = useNavigate();
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [companyContact, setCompanyContact] = useState<CompanyContact | null>(null);

  useEffect(() => {
    checkAuth();
    fetchCompanyContact();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      fetchPayroll(user.id);
      fetchUserProfile(user.id);
    }
  };

  const fetchUserProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "first_name, last_name, street, postal_code, city, birth_date, email, tax_id, social_security_number, employment_type, tax_class, iban, account_holder",
        )
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;
      setUserProfile(data);
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchCompanyContact = async () => {
    try {
      const { data, error } = await supabase
        .from("company_contact")
        .select("company_name, street_address, postal_code, city")
        .maybeSingle();

      if (error) throw error;
      setCompanyContact(currentCompanyDetails(data || {}));
    } catch (error: any) {
      console.error("Error fetching company contact:", error);
    }
  };

  const fetchPayroll = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("user_id", uid)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      setPayrollEntries(data || []);
    } catch (error: any) {
      console.error("Error fetching payroll:", error);
      toast.error("Fehler beim Laden der Lohnabrechnungen");
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  const generatePDF = (entry: PayrollEntry) => {
    const doc = new jsPDF();
    const isMinijob = userProfile?.employment_type?.toLowerCase() === "minijob";
    const actualNetSalary = isMinijob ? entry.gross_salary : entry.net_salary;

    let yPos = 20;

    // Logo laden und einfügen mit korrekten Proportionen
    const img = new Image();
    img.src = payexpertLogo;
    img.onload = () => {
      // Berechne das richtige Seitenverhältnis
      const logoWidth = 50;
      const logoHeight = (img.height / img.width) * logoWidth;
      doc.addImage(img, "PNG", 15, yPos, logoWidth, logoHeight);

      // Firmendaten rechts
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(companyContact?.company_name || "EuroScent GmbH", 200, yPos + 5, { align: "right" });
      doc.text(companyContact?.street_address || "Königsallee 89", 200, yPos + 10, { align: "right" });
      doc.text(`${companyContact?.postal_code || "10559"} ${companyContact?.city || "Berlin"}`, 200, yPos + 15, {
        align: "right",
      });

      yPos = 50;

      // Titel und Monat
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text("Entgeltbescheinigung", 15, yPos);
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`${monthNames[entry.month - 1]} ${entry.year}`, 15, yPos + 7);

      yPos = 70;

      // Arbeitnehmer Box
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, 180, 25, "F");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("Arbeitnehmer", 20, yPos + 6);
      doc.setFontSize(9);
      doc.text(`${userProfile?.first_name || ""} ${userProfile?.last_name || ""}`, 20, yPos + 12);
      doc.text(`${userProfile?.street || ""}`, 20, yPos + 17);
      doc.text(`${userProfile?.postal_code || ""} ${userProfile?.city || ""}`, 20, yPos + 22);

      // Beschäftigungsart und Steuerklasse
      doc.text(`Beschäftigungsart: ${userProfile?.employment_type || "-"}`, 120, yPos + 12);
      if (userProfile?.tax_class) {
        doc.text(`Steuerklasse: ${userProfile.tax_class}`, 120, yPos + 17);
      }

      yPos += 32;

      // Abrechnungszeitraum
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Abrechnungszeitraum:", 15, yPos);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `01.${entry.month.toString().padStart(2, "0")}.${entry.year} - ${new Date(entry.year, entry.month, 0).getDate()}.${entry.month.toString().padStart(2, "0")}.${entry.year}`,
        70,
        yPos,
      );

      yPos += 10;

      // Brutto-Bezüge Tabelle
      autoTable(doc, {
        startY: yPos,
        head: [["Brutto-Bezüge", "Betrag"]],
        body: [
          ["Bruttogehalt", `${entry.gross_salary.toFixed(2)} €`],
          [
            `Arbeitsstunden: ${entry.working_hours} h`,
            entry.hourly_rate ? `à ${entry.hourly_rate.toFixed(2)} €/h` : "",
          ],
        ],
        foot: [["Steuer- und SV-pflichtiges Brutto:", `${entry.gross_salary.toFixed(2)} €`]],
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Abzüge Tabelle
      const abzuegeBody: any[] = [];

      abzuegeBody.push([isMinijob ? "Pauschalsteuer (2%)" : "Lohnsteuer", `-${entry.tax_deduction.toFixed(2)} €`]);

      if (!isMinijob) {
        abzuegeBody.push(["Solidaritätszuschlag (5,5%)", `-${(entry.tax_deduction * 0.055).toFixed(2)} €`]);
        abzuegeBody.push(["Krankenversicherung (7,30%)", `-${entry.health_insurance.toFixed(2)} €`]);
        abzuegeBody.push(["Rentenversicherung (9,30%)", `-${(entry.social_security * 0.48).toFixed(2)} €`]);
        abzuegeBody.push(["Arbeitslosenversicherung (1,20%)", `-${(entry.social_security * 0.13).toFixed(2)} €`]);
        abzuegeBody.push(["Pflegeversicherung (1,70%)", `-${(entry.social_security * 0.18).toFixed(2)} €`]);
      }

      if (entry.other_deductions > 0) {
        abzuegeBody.push(["Weitere Abzüge", `-${entry.other_deductions.toFixed(2)} €`]);
      }

      const totalAbzuege = isMinijob
        ? entry.tax_deduction + entry.other_deductions
        : entry.tax_deduction * 1.055 + entry.social_security + entry.health_insurance + entry.other_deductions;

      autoTable(doc, {
        startY: yPos,
        head: [[isMinijob ? "Pauschalabgaben (Arbeitgeber zahlt)" : "Gesetzliche Abzüge", "Betrag"]],
        body: abzuegeBody,
        foot: [[isMinijob ? "Pauschalabgaben gesamt:" : "Gesetzliche Abzüge gesamt:", `-${totalAbzuege.toFixed(2)} €`]],
        theme: "grid",
        headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Auszahlungsbetrag Box
      doc.setFillColor(46, 204, 113);
      doc.rect(15, yPos, 180, 20, "F");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text("Auszahlungsbetrag", 20, yPos + 8);
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text(`${actualNetSalary.toFixed(2)} €`, 190, yPos + 8, { align: "right" });
      doc.setFont(undefined, "normal");

      if (isMinijob) {
        doc.setFontSize(8);
        doc.text("✓ Bruttobetrag (Pauschalabgaben trägt der Arbeitgeber)", 20, yPos + 15);
      }

      yPos += 28;

      // Zahlungsinformationen
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      if (entry.payment_date) {
        doc.text(`Auszahlung am: ${new Date(entry.payment_date).toLocaleDateString("de-DE")}`, 15, yPos);
        yPos += 6;
      }

      if (userProfile?.iban) {
        doc.text(`IBAN: ${userProfile.iban}`, 15, yPos);
        yPos += 5;
        if (userProfile.account_holder) {
          doc.text(`Kontoinhaber: ${userProfile.account_holder}`, 15, yPos);
          yPos += 5;
        }
      }

      // Hinweis bei Minijobs
      if (isMinijob) {
        yPos += 5;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Hinweis: Bei Minijobs trägt der Arbeitgeber die Pauschalabgaben. Für Sie fallen keine", 15, yPos);
        yPos += 4;
        doc.text("Sozialversicherungsbeiträge an. Der Auszahlungsbetrag entspricht Ihrem Bruttogehalt.", 15, yPos);
      }

      // Notizen
      if (entry.notes) {
        yPos += 10;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Anmerkungen:", 15, yPos);
        yPos += 4;
        doc.text(entry.notes, 15, yPos, { maxWidth: 180 });
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Diese Entgeltbescheinigung wurde elektronisch erstellt und ist ohne Unterschrift gültig.",
        105,
        pageHeight - 15,
        { align: "center" },
      );
      doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 105, pageHeight - 10, { align: "center" });

      // PDF speichern
      doc.save(`Lohnabrechnung_${monthNames[entry.month - 1]}_${entry.year}.pdf`);
      toast.success("PDF wurde heruntergeladen");
    };

    img.onerror = () => {
      toast.error("Logo konnte nicht geladen werden");
    };
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Entgeltbescheinigungen</h1>

      {payrollEntries.length === 0 ? (
        <Card>
          <CardContent className="p-8 md:p-12 text-center text-muted-foreground">
            Noch keine Lohnabrechnungen vorhanden
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Warnung bei fehlenden Bankdaten */}
          {!userProfile?.iban && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <span className="text-amber-800 dark:text-amber-200 text-sm">
                  <strong>Fehlende Bankdaten:</strong> Bitte hinterlegen Sie Ihre IBAN in den Einstellungen, damit Ihr
                  Gehalt überwiesen werden kann.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-600 text-amber-700 hover:bg-amber-100 w-full md:w-auto"
                  onClick={() => navigate("/dashboard/employee-settings?tab=financial")}
                >
                  Zu den Einstellungen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Carousel className="w-full">
            <div className="flex items-center justify-center gap-2 md:gap-4 mb-4">
              <CarouselPrevious className="relative static translate-y-0 h-8 w-8 md:h-10 md:w-10" />
              <p className="text-xs md:text-sm text-muted-foreground text-center px-2">Wischen Sie nach links/rechts</p>
              <CarouselNext className="relative static translate-y-0 h-8 w-8 md:h-10 md:w-10" />
            </div>
            <CarouselContent>
              {payrollEntries.map((entry) => {
                const isMinijob = userProfile?.employment_type?.toLowerCase() === "minijob";
                // Bei Minijobs zahlt der Arbeitgeber die Pauschalabgaben, daher Auszahlung = Brutto
                const actualNetSalary = isMinijob ? entry.gross_salary : entry.net_salary;
                return (
                  <CarouselItem key={entry.id}>
                    <Card className="overflow-hidden border-2">
                      {/* KOPFTEIL DER LOHNABRECHNUNG */}
                      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          <div>
                            <h3 className="font-semibold text-xs md:text-sm mb-2 opacity-90">Arbeitgeber</h3>
                            <p className="font-bold text-base md:text-lg">
                              {companyContact?.company_name || "EuroScent GmbH"}
                            </p>
                            <p className="text-xs md:text-sm opacity-90">
                              {companyContact?.street_address || "Königsallee 89"}
                            </p>
                            <p className="text-xs md:text-sm opacity-90">
                              {companyContact?.postal_code || "40212"} {companyContact?.city || "Düsseldorf"}
                            </p>
                          </div>
                          <div className="md:text-right">
                            <h2 className="text-xl md:text-2xl font-bold">Entgeltbescheinigung</h2>
                            <p className="text-base md:text-lg font-semibold mt-1">
                              {monthNames[entry.month - 1]} {entry.year}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ARBEITNEHMER ANGABEN */}
                      <div className="bg-muted/30 p-4 md:p-6 space-y-4 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="font-semibold text-sm mb-3">Arbeitnehmer</h3>
                            <div className="space-y-2 text-sm">
                              <p className="font-medium">
                                {userProfile?.first_name} {userProfile?.last_name}
                              </p>
                              <p className="text-muted-foreground">{userProfile?.street}</p>
                              <p className="text-muted-foreground">
                                {userProfile?.postal_code} {userProfile?.city}
                              </p>
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm mb-3">Persönliche Daten</h3>
                            <div className="space-y-2 text-sm">
                              {userProfile?.birth_date && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Geburtsdatum:</span>
                                  <span>{formatDateToGerman(userProfile.birth_date)}</span>
                                </div>
                              )}
                              {userProfile?.tax_id && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Steuer-ID:</span>
                                  <span className="break-all">{userProfile.tax_id}</span>
                                </div>
                              )}
                              {userProfile?.social_security_number && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">SV-Nummer:</span>
                                  <span className="break-all">{userProfile.social_security_number}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-0">
                        {/* ARBEITNEHMER ANGABEN (ohne Duplikate) */}
                        <div className="bg-muted/30 p-4 md:p-6 grid grid-cols-2 gap-3 md:gap-4 border-b">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Steuerklasse</p>
                            <p className="text-sm md:text-base">
                              {userProfile?.tax_class != null ? `Klasse ${userProfile.tax_class}` : "—"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Beschäftigungsart</p>
                            <p className="text-sm md:text-base">{userProfile?.employment_type || "—"}</p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs text-muted-foreground">Abrechnungszeitraum</p>
                            <p className="text-sm md:text-base">
                              01.{entry.month.toString().padStart(2, "0")}.{entry.year} -{" "}
                              {new Date(entry.year, entry.month, 0).getDate()}.{entry.month.toString().padStart(2, "0")}
                              .{entry.year}
                            </p>
                          </div>
                        </div>

                        {/* BRUTTO-BEZÜGE */}
                        <div className="p-4 md:p-6 space-y-3 md:space-y-4 border-b">
                          <h3 className="font-bold text-sm md:text-base uppercase tracking-wide">Brutto-Bezüge</h3>
                          <div className="space-y-2 pl-2 md:pl-4">
                            <div className="flex justify-between text-sm md:text-base">
                              <span>Bruttogehalt</span>
                              <span className="font-semibold">{entry.gross_salary.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between text-xs md:text-sm text-muted-foreground">
                              <span>• Arbeitsstunden: {entry.working_hours} h</span>
                              {entry.hourly_rate && <span>à {entry.hourly_rate.toFixed(2)} €/h</span>}
                            </div>
                          </div>
                          <div className="pt-3 border-t flex justify-between font-bold text-sm md:text-base">
                            <span>Steuer- und SV-pflichtiges Brutto:</span>
                            <span>{entry.gross_salary.toFixed(2)} €</span>
                          </div>
                        </div>

                        {/* GESETZLICHE ABZÜGE */}
                        <div className="p-4 md:p-6 space-y-3 md:space-y-4 border-b bg-muted/20">
                          <h3 className="font-bold text-sm md:text-base uppercase tracking-wide">
                            {isMinijob ? "Pauschalabgaben (Arbeitgeber zahlt)" : "Gesetzliche Abzüge"}
                          </h3>

                          {/* Steuerabzüge */}
                          <div className="space-y-2 pl-2 md:pl-4">
                            <p className="font-semibold text-xs md:text-sm">Steuerabzüge</p>
                            <div className="flex justify-between text-xs md:text-sm">
                              <span>{isMinijob ? "Pauschalsteuer (2%)" : "Lohnsteuer"}</span>
                              <span className="text-destructive font-medium">-{entry.tax_deduction.toFixed(2)} €</span>
                            </div>
                            {!isMinijob && (
                              <div className="flex justify-between text-xs md:text-sm">
                                <span>Solidaritätszuschlag</span>
                                <span className="text-destructive font-medium">
                                  -{(entry.tax_deduction * 0.055).toFixed(2)} €
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Sozialversicherungsbeiträge nur bei Nicht-Minijobs */}
                          {!isMinijob && (
                            <div className="space-y-2 pl-4 pt-2">
                              <p className="font-semibold text-sm">Sozialversicherungsbeiträge (Arbeitnehmeranteil)</p>
                              <div className="flex justify-between text-sm">
                                <span>Krankenversicherung (7,30%)</span>
                                <span className="text-destructive font-medium">
                                  -{entry.health_insurance.toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Rentenversicherung (9,30%)</span>
                                <span className="text-destructive font-medium">
                                  -{(entry.social_security * 0.48).toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Arbeitslosenversicherung (1,20%)</span>
                                <span className="text-destructive font-medium">
                                  -{(entry.social_security * 0.2).toFixed(2)} €
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Pflegeversicherung (1,525%)</span>
                                <span className="text-destructive font-medium">
                                  -{(entry.social_security * 0.32).toFixed(2)} €
                                </span>
                              </div>
                            </div>
                          )}

                          {isMinijob && (
                            <div className="text-xs text-muted-foreground pl-4 pt-2 italic">
                              Hinweis: Bei Minijobs trägt der Arbeitgeber die Pauschalabgaben. Für Sie fallen keine
                              Sozialversicherungsbeiträge an. Der Auszahlungsbetrag entspricht Ihrem Bruttogehalt.
                            </div>
                          )}

                          {entry.other_deductions > 0 && (
                            <div className="space-y-2 pl-2 md:pl-4 pt-2">
                              <p className="font-semibold text-xs md:text-sm">Sonstige Abzüge</p>
                              <div className="flex justify-between text-xs md:text-sm">
                                <span>Weitere Abzüge</span>
                                <span className="text-destructive font-medium">
                                  -{entry.other_deductions.toFixed(2)} €
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="pt-3 border-t flex justify-between font-bold text-sm md:text-base">
                            <span className="text-sm md:text-base">
                              {isMinijob ? "Pauschalabgaben gesamt:" : "Gesetzliche Abzüge gesamt:"}
                            </span>
                            <span className="text-destructive">
                              -
                              {(isMinijob
                                ? entry.tax_deduction + entry.other_deductions
                                : entry.tax_deduction * 1.055 +
                                  entry.social_security +
                                  entry.health_insurance +
                                  entry.other_deductions
                              ).toFixed(2)}{" "}
                              €
                            </span>
                          </div>
                        </div>

                        {/* AUSZAHLUNGSBETRAG */}
                        <div className="p-4 md:p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
                          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div className="flex-1">
                              <p className="text-xs md:text-sm text-muted-foreground mb-1">Auszahlungsbetrag</p>
                              <p className="text-2xl md:text-3xl font-bold text-primary">
                                {actualNetSalary.toFixed(2)} €
                              </p>
                              {isMinijob && (
                                <p className="text-xs text-green-600 font-semibold mt-1">
                                  ✓ Bruttobetrag (Pauschalabgaben trägt der Arbeitgeber)
                                </p>
                              )}
                            </div>
                            <Button
                              size="lg"
                              variant="outline"
                              className="gap-2 w-full md:w-auto"
                              onClick={() => generatePDF(entry)}
                            >
                              <Download className="w-4 h-4 md:w-5 md:h-5" />
                              <span className="text-sm md:text-base">PDF herunterladen</span>
                            </Button>
                          </div>
                          {entry.payment_date && (
                            <div className="mt-4 pt-4 border-t border-primary/20">
                              <p className="text-xs md:text-sm">
                                <span className="text-muted-foreground">Auszahlung am:</span>{" "}
                                <span className="font-semibold">
                                  {new Date(entry.payment_date).toLocaleDateString("de-DE")}
                                </span>
                              </p>
                            </div>
                          )}
                          {userProfile?.iban && (
                            <div className="mt-4 pt-4 border-t border-primary/20 space-y-1">
                              <p className="text-xs md:text-sm">
                                <span className="text-muted-foreground">Auszahlungskonto:</span>
                              </p>
                              <p className="text-xs md:text-sm font-mono font-semibold break-all">{userProfile.iban}</p>
                              {userProfile.account_holder && (
                                <p className="text-xs text-muted-foreground">
                                  Kontoinhaber: {userProfile.account_holder}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground italic mt-2">
                                Der Betrag wurde auf das angegebene Konto überwiesen.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ANMERKUNGEN */}
                        {entry.notes && (
                          <div className="p-4 md:p-6 bg-muted/30 border-t">
                            <p className="text-xs md:text-sm text-muted-foreground font-semibold mb-2 uppercase tracking-wide">
                              Anmerkungen
                            </p>
                            <p className="text-xs md:text-sm whitespace-pre-wrap">{entry.notes}</p>
                          </div>
                        )}

                        {/* FOOTER */}
                        <div className="p-3 md:p-4 bg-muted/50 text-xs text-muted-foreground text-center border-t">
                          <p>Diese Entgeltbescheinigung wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        </>
      )}
    </div>
  );
};

export default Payroll;
