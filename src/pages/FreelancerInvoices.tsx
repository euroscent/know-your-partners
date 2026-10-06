import { useState, useEffect } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Euro, Clock, CheckCircle, AlertCircle, Barcode as BarcodeIcon, Send, MapPin, ExternalLink } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import payexpertLogo from "@/assets/epp-logo-dark.png";
import { Barcode128 } from "@/components/Barcode128";
import { QRCodeSVG } from "qrcode.react";

const PARTNER_FINDER_URL = "https://www.barzahlen.de/de/filialfinder";

interface BonusBreakdownItem {
  id?: string;
  label?: string;
  amount?: number;
}

interface FreelancerInvoice {
  id: string;
  task_title: string;
  hours_worked: number;
  hourly_rate: number;
  gross_amount: number;
  bonus_amount?: number | null;
  bonus_breakdown?: any;
  invoice_number: string;
  invoice_date: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  payout_status: string | null;
  payout_requested_at: string | null;
  payout_approved_at: string | null;
  payout_barcode: string | null;
  payout_image_url: string | null;
  payout_expires_at: string | null;
  payout_redeemed_at: string | null;
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  tax_id: string | null;
  iban: string | null;
  account_holder: string | null;
}

interface CompanyContact {
  company_name: string | null;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
}

const FreelancerInvoices = () => {
  const [invoices, setInvoices] = useState<FreelancerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [companyContact, setCompanyContact] = useState<CompanyContact | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0 });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadData();
  }, []);

  // Tick every 30s to update expiry display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Parallel laden
      const [invoicesRes, profileRes, companyRes] = await Promise.all([
        supabase
          .from("freelancer_invoices")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("first_name, last_name, street, postal_code, city, email, tax_id, iban, account_holder")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("company_contact")
          .select("company_name, street_address, postal_code, city")
          .maybeSingle()
      ]);

      if (invoicesRes.data) {
        // Sichtbar: alle Rechnungen aus dem aktuellen Monat
        // PLUS alle noch offenen Rechnungen (nicht bezahlt / Auszahlung noch nicht eingelöst),
        // damit ältere, aber noch nicht abgeschlossene Auszahlungen nicht "verschwinden".
        const nowDate = new Date();
        const currentMonth = nowDate.getMonth();
        const currentYear = nowDate.getFullYear();

        const visibleInvoices = invoicesRes.data.filter((inv) => {
          const created = new Date(inv.created_at);
          const isCurrentMonth =
            created.getMonth() === currentMonth &&
            created.getFullYear() === currentYear;
          const isStillOpen =
            inv.status !== "paid" &&
            inv.status !== "cancelled" &&
            inv.payout_status !== "redeemed";
          return isCurrentMonth || isStillOpen;
        });

        setInvoices(visibleInvoices);
        const pending = visibleInvoices
          .filter((i) => i.status === "pending")
          .reduce((sum, i) => sum + i.gross_amount, 0);
        const paid = visibleInvoices
          .filter((i) => i.status === "paid")
          .reduce((sum, i) => sum + i.gross_amount, 0);
        setStats({
          total: visibleInvoices.reduce((sum, i) => sum + i.gross_amount, 0),
          pending,
          paid,
        });
      }

      if (profileRes.data) setUserProfile(profileRes.data);
      if (companyRes.data) setCompanyContact(companyRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (invoice: FreelancerInvoice) => {
    const doc = new jsPDF();
    let yPos = 20;

    const img = new Image();
    img.src = payexpertLogo;
    img.onload = () => {
      const logoWidth = 50;
      const logoHeight = (img.height / img.width) * logoWidth;
      doc.addImage(img, "PNG", 15, yPos, logoWidth, logoHeight);

      // Firmendaten rechts
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(companyContact?.company_name || "epp GmbH", 200, yPos + 5, { align: "right" });
      doc.text(companyContact?.street_address || "Kürschnershof 2", 200, yPos + 10, { align: "right" });
      doc.text(`${companyContact?.postal_code || "10559"} ${companyContact?.city || "Berlin"}`, 200, yPos + 15, { align: "right" });

      yPos = 55;

      // Titel
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text("Honorarabrechnung", 15, yPos);
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Rechnungsnummer: ${invoice.invoice_number}`, 15, yPos + 8);
      doc.text(`Datum: ${new Date(invoice.invoice_date).toLocaleDateString("de-DE")}`, 15, yPos + 14);

      yPos = 85;

      // Freelancer Box
      doc.setFillColor(245, 245, 245);
      doc.rect(15, yPos, 180, 25, "F");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text("Auftragnehmer (Freelancer)", 20, yPos + 6);
      doc.setFontSize(9);
      doc.text(`${userProfile?.first_name || ""} ${userProfile?.last_name || ""}`, 20, yPos + 12);
      doc.text(`${userProfile?.street || ""}`, 20, yPos + 17);
      doc.text(`${userProfile?.postal_code || ""} ${userProfile?.city || ""}`, 20, yPos + 22);

      if (userProfile?.tax_id) {
        doc.text(`Steuer-ID: ${userProfile.tax_id}`, 120, yPos + 12);
      }

      yPos += 35;

      // Leistungstabelle inkl. Boni
      const bonusItems: BonusBreakdownItem[] = Array.isArray(invoice.bonus_breakdown)
        ? (invoice.bonus_breakdown as BonusBreakdownItem[])
        : [];
      const bonusSum = Number(invoice.bonus_amount ?? 0);
      const baseAmount = Number(invoice.gross_amount) - bonusSum;
      const tableBody: (string | number)[][] = [
        [
          invoice.task_title,
          `${invoice.hours_worked} h`,
          `${invoice.hourly_rate.toFixed(2)} €`,
          `${baseAmount.toFixed(2)} €`,
        ],
      ];
      for (const item of bonusItems) {
        tableBody.push([
          `Bonus: ${item.label || "Zusatzvergütung"}`,
          "",
          "",
          `${Number(item.amount ?? 0).toFixed(2)} €`,
        ]);
      }
      if (bonusItems.length === 0 && bonusSum > 0) {
        tableBody.push(["Bonus / Zusatzvergütung", "", "", `${bonusSum.toFixed(2)} €`]);
      }
      autoTable(doc, {
        startY: yPos,
        head: [["Leistungsbeschreibung", "Stunden", "Stundensatz", "Betrag"]],
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Gesamtbetrag Box
      doc.setFillColor(46, 204, 113);
      doc.rect(15, yPos, 180, 25, "F");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("Gesamtbetrag (Brutto = Netto)", 20, yPos + 8);
      doc.setFontSize(8);
      doc.text("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung)", 20, yPos + 14);
      doc.setFontSize(16);
      doc.setFont(undefined, "bold");
      doc.text(`${invoice.gross_amount.toFixed(2)} €`, 190, yPos + 10, { align: "right" });
      doc.setFont(undefined, "normal");

      yPos += 35;

      // Bankdaten
      if (userProfile?.iban) {
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("Bankverbindung für Überweisung:", 15, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.text(`IBAN: ${userProfile.iban}`, 15, yPos);
        if (userProfile.account_holder) {
          yPos += 5;
          doc.text(`Kontoinhaber: ${userProfile.account_holder}`, 15, yPos);
        }
      }

      yPos += 15;

      // Hinweis
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Hinweis: Als Freelancer sind Sie selbst für die Versteuerung dieses Honorars verantwortlich.", 15, yPos);
      doc.text("Diese Abrechnung dient als Nachweis über die erbrachte Leistung.", 15, yPos + 4);

      // Status
      if (invoice.status === "paid" && invoice.paid_at) {
        yPos += 15;
        doc.setFontSize(10);
        doc.setTextColor(46, 204, 113);
        doc.text(`✓ Bezahlt am: ${new Date(invoice.paid_at).toLocaleDateString("de-DE")}`, 15, yPos);
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Elektronisch erstellte Honorarabrechnung", 105, pageHeight - 15, { align: "center" });
      doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, 105, pageHeight - 10, { align: "center" });

      doc.save(`Honorar_${invoice.invoice_number}.pdf`);
      toast.success("PDF wurde heruntergeladen");
    };

    img.onerror = () => {
      toast.error("Logo konnte nicht geladen werden");
    };
  };

  const requestPayout = async (invoice: FreelancerInvoice, isReRequest = false) => {
    try {
      const { error } = await supabase
        .from("freelancer_invoices")
        .update({
          payout_status: "requested",
          payout_requested_at: new Date().toISOString(),
          // Clear stale code data on re-request
          payout_barcode: null,
          payout_image_url: null,
          payout_expires_at: null,
          payout_approved_at: null,
        })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success(
        isReRequest
          ? "Neuer Code wurde angefordert. Du wirst benachrichtigt, sobald er bereitsteht."
          : "Auszahlung angefordert. Du wirst benachrichtigt, sobald sie freigegeben ist."
      );
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Anfrage konnte nicht gesendet werden");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Bezahlt</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><Clock className="h-3 w-3 mr-1" /> Ausstehend</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Storniert</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPayoutBadge = (payoutStatus: string | null) => {
    switch (payoutStatus) {
      case "requested":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Clock className="h-3 w-3 mr-1" /> Auszahlung beantragt</Badge>;
      case "approved":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600"><BarcodeIcon className="h-3 w-3 mr-1" /> Auszahlung freigegeben</Badge>;
      case "redeemed":
        return <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Eingelöst</Badge>;
      case "rejected":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Abgelehnt</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Honorarabrechnungen</h1>

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Euro className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gesamtumsatz</p>
              <p className="text-2xl font-bold">{stats.total.toFixed(2)} €</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ausstehend</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending.toFixed(2)} €</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Erhalten</p>
              <p className="text-2xl font-bold text-green-600">{stats.paid.toFixed(2)} €</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abrechnungsliste */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Noch keine Honorarabrechnungen vorhanden</p>
            <p className="text-sm mt-2">Sobald Sie einen Auftrag abschließen, wird automatisch eine Abrechnung erstellt.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => {
            const payoutStatus = invoice.payout_status ?? "none";
            const expiresMs = invoice.payout_expires_at
              ? new Date(invoice.payout_expires_at).getTime()
              : null;
            const isExpired =
              payoutStatus === "approved" &&
              expiresMs !== null &&
              expiresMs < now;
            const showApprovedCode = payoutStatus === "approved" && !isExpired;
            const canRequestPayout =
              invoice.status !== "cancelled" && payoutStatus === "none";
            const canReRequest =
              invoice.status !== "cancelled" && isExpired;

            // Verbleibende Zeit als hh:mm
            let remainingLabel = "";
            if (showApprovedCode && expiresMs !== null) {
              const diffMin = Math.max(0, Math.floor((expiresMs - now) / 60000));
              const h = Math.floor(diffMin / 60);
              const m = diffMin % 60;
              remainingLabel = `${h}h ${m.toString().padStart(2, "0")}min`;
            }

            return (
              <Card key={invoice.id} className="overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Linker Bereich */}
                  <div className="flex-1 p-4 md:p-6">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground">{invoice.invoice_number}</p>
                        <h3 className="font-semibold text-lg">{invoice.task_title}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(invoice.status)}
                        {isExpired ? (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" /> Code abgelaufen
                          </Badge>
                        ) : (
                          getPayoutBadge(payoutStatus)
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {invoice.hours_worked} Stunden
                      </span>
                      <span>× {invoice.hourly_rate.toFixed(2)} €/h</span>
                      <span className="font-semibold text-foreground">
                        = {invoice.gross_amount.toFixed(2)} €
                      </span>
                      <span>
                        {new Date(invoice.invoice_date).toLocaleDateString("de-DE")}
                      </span>
                    </div>

                    {/* Bonus-Aufschlüsselung */}
                    {Number(invoice.bonus_amount ?? 0) > 0 && (
                      <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            Genehmigte Zusatzvergütung
                          </p>
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                            + {Number(invoice.bonus_amount).toFixed(2)} €
                          </p>
                        </div>
                        {Array.isArray(invoice.bonus_breakdown) && invoice.bonus_breakdown.length > 0 && (
                          <ul className="space-y-0.5">
                            {invoice.bonus_breakdown.map((b: BonusBreakdownItem, i: number) => (
                              <li
                                key={(b?.id as string) || i}
                                className="flex items-center justify-between text-xs text-muted-foreground"
                              >
                                <span className="truncate">{b?.label || "Bonus"}</span>
                                <span className="tabular-nums shrink-0">
                                  + {Number(b?.amount ?? 0).toFixed(2)} €
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Auszahlungs-Bereich – aktiver, gültiger Code */}
                    {showApprovedCode && (invoice.payout_barcode || invoice.payout_image_url) && (
                      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <BarcodeIcon className="h-4 w-4 text-emerald-600" />
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                              Bargeld-Auszahlungscode
                            </p>
                          </div>
                          <span className="text-xs font-medium text-amber-600 inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Gültig noch {remainingLabel}
                          </span>
                        </div>

                        {/* Barzahlen / viacash Branding-Zeile */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-bold">
                            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-background/60 text-[10px]">
                              ⓑ
                            </span>
                            Barzahlen
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                            <span className="font-mono tracking-tighter">|||</span>
                            <span>via<span className="font-light">cash</span></span>
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Wir bieten den „Bargeld-Code" in Kooperation mit der{" "}
                          <span className="font-semibold text-foreground">GRENKE BANK AG, Baden-Baden</span>{" "}
                          an, die in unserem Auftrag Ihre Auszahlungen vornimmt. Die Partnerfilialen
                          handeln ihrerseits im Namen und auf Rechnung der GRENKE BANK AG.
                        </p>

                        <div className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 border">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            Bargeldauszahlung
                          </span>
                          <span className="text-lg font-bold">
                            {invoice.gross_amount.toFixed(2).replace(".", ",")} €
                          </span>
                        </div>

                        <div className="rounded-md bg-white p-3 flex justify-center">
                          {invoice.payout_image_url ? (
                            <img
                              src={invoice.payout_image_url}
                              alt="Auszahlungs-Barcode"
                              className="max-h-32 object-contain"
                            />
                          ) : invoice.payout_barcode ? (
                            <Barcode128
                              value={invoice.payout_barcode}
                              format="EAN13"
                              height={80}
                              fontSize={14}
                            />
                          ) : null}
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                          Code in einer Barzahlen / viacash Partnerfiliale (z. B. Supermarkt, Tankstelle, Drogerie) zur Auszahlung vorlegen.
                        </p>

                        {/* Partnerfilialen-Finder */}
                        <div className="rounded-lg border bg-background/60 p-3 flex items-center gap-3 flex-wrap">
                          <div className="bg-white p-1.5 rounded-md border shrink-0">
                            <QRCodeSVG
                              value={PARTNER_FINDER_URL}
                              size={72}
                              level="M"
                              includeMargin={false}
                            />
                          </div>
                          <div className="flex-1 min-w-[160px] space-y-1">
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                              Partnerfilialen finden
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              QR-Code mit dem Smartphone scannen oder Link öffnen, um die nächstgelegene Annahmestelle anzuzeigen.
                            </p>
                            <a
                              href={PARTNER_FINDER_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Filialfinder öffnen <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Abgelaufen */}
                    {isExpired && (
                      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                        <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" /> Code abgelaufen
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Dein Bargeld-Code ist seit{" "}
                          {invoice.payout_expires_at
                            ? new Date(invoice.payout_expires_at).toLocaleString("de-DE")
                            : ""}{" "}
                          ungültig. Du kannst für diesen Auftrag erneut eine Auszahlung anfordern.
                        </p>
                      </div>
                    )}

                    {payoutStatus === "requested" && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Auszahlung angefragt am{" "}
                        {invoice.payout_requested_at
                          ? new Date(invoice.payout_requested_at).toLocaleString("de-DE")
                          : ""}
                        . Du wirst benachrichtigt, sobald der Code bereitsteht.
                      </p>
                    )}

                    {payoutStatus === "redeemed" && invoice.payout_redeemed_at && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Eingelöst am {new Date(invoice.payout_redeemed_at).toLocaleString("de-DE")}.
                      </p>
                    )}
                  </div>

                  {/* Rechter Bereich */}
                  <div className="bg-muted/30 p-4 md:p-6 flex flex-col items-center justify-center md:min-w-[220px] border-t md:border-t-0 md:border-l gap-2">
                    <p className="text-2xl font-bold text-primary">{invoice.gross_amount.toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground mb-1">Brutto = Netto</p>
                    <Button size="sm" variant="outline" onClick={() => generatePDF(invoice)} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    {canRequestPayout && (
                      <Button
                        size="sm"
                        onClick={() => requestPayout(invoice)}
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Auszahlung anfordern
                      </Button>
                    )}
                    {canReRequest && (
                      <Button
                        size="sm"
                        onClick={() => requestPayout(invoice, true)}
                        className="w-full"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Neuen Code anfordern
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FreelancerInvoices;
