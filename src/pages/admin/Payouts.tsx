import { useEffect, useMemo, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Barcode128 } from "@/components/Barcode128";
import { Barcode, CheckCircle2, Clock, Euro, User, FileText, RefreshCw, Upload, ImageIcon, Timer } from "lucide-react";
import { toast } from "@/lib/toast-stub";

interface PayoutInvoice {
  id: string;
  user_id: string;
  task_title: string;
  invoice_number: string;
  gross_amount: number;
  payout_status: string;
  payout_requested_at: string | null;
  payout_approved_at: string | null;
  payout_barcode: string | null;
  payout_image_url: string | null;
  payout_expires_at: string | null;
  payout_redeemed_at: string | null;
  payout_notes: string | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const PAYOUT_VALIDITY_HOURS = 2;

// EAN-13 Prüfziffer nach GTIN-Standard berechnen (Eingabe: 12 Ziffern)
const computeEan13CheckDigit = (digits12: string): string => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const mod = sum % 10;
  return String((10 - mod) % 10);
};

// Zufällige 13-stellige EAN mit gültiger Prüfziffer (Präfix 406 = freie Reserve in DE-Bereich)
const generateDefaultCode = () => {
  let body = "406";
  for (let i = 0; i < 9; i++) body += Math.floor(Math.random() * 10).toString();
  return body + computeEan13CheckDigit(body);
};

// Eingabe normalisieren & ggf. Prüfziffer ergänzen → 13-stellige EAN oder null
const normalizeEan13 = (raw: string): string | null => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 13) {
    const expected = computeEan13CheckDigit(digits.slice(0, 12));
    return digits[12] === expected ? digits : null;
  }
  if (digits.length === 12) {
    return digits + computeEan13CheckDigit(digits);
  }
  return null;
};

const AdminPayouts = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<PayoutInvoice[]>([]);
  const [barcodeInputs, setBarcodeInputs] = useState<Record<string, string>>({});
  const [imageUploads, setImageUploads] = useState<Record<string, string>>({}); // invoiceId -> uploaded url
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("freelancer_invoices")
        .select(
          "id, user_id, task_title, invoice_number, gross_amount, payout_status, payout_requested_at, payout_approved_at, payout_barcode, payout_image_url, payout_expires_at, payout_redeemed_at, payout_notes"
        )
        .in("payout_status", ["requested", "approved", "redeemed"])
        .order("payout_requested_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const invoices = (data || []) as PayoutInvoice[];
      const userIds = Array.from(new Set(invoices.map((i) => i.user_id)));

      let profilesMap: Record<string, PayoutInvoice["profile"]> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds);
        profilesMap = Object.fromEntries(
          (profiles || []).map((p: any) => [p.id, p])
        );
      }

      setItems(invoices.map((i) => ({ ...i, profile: profilesMap[i.user_id] || null })));
    } catch (err: any) {
      console.error(err);
      toast.error("Auszahlungsanfragen konnten nicht geladen werden");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const requested = useMemo(
    () => items.filter((i) => i.payout_status === "requested"),
    [items]
  );
  const approved = useMemo(
    () => items.filter((i) => i.payout_status === "approved"),
    [items]
  );
  const redeemed = useMemo(
    () => items.filter((i) => i.payout_status === "redeemed"),
    [items]
  );

  const fullName = (p?: PayoutInvoice["profile"]) =>
    p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unbekannt" : "Unbekannt";

  const handleUploadImage = async (invoice: PayoutInvoice, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte ein Bild hochladen (PNG/JPG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bild zu groß (max. 5 MB)");
      return;
    }
    setUploadingId(invoice.id);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${invoice.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payout-barcodes")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("payout-barcodes").getPublicUrl(path);
      setImageUploads((prev) => ({ ...prev, [invoice.id]: data.publicUrl }));
      toast.success("Bild hochgeladen");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Upload fehlgeschlagen");
    } finally {
      setUploadingId(null);
    }
  };

  const handleApprove = async (invoice: PayoutInvoice) => {
    const raw = (barcodeInputs[invoice.id] || "").trim();
    const uploadedImg = imageUploads[invoice.id] || null;
    const ean = raw ? normalizeEan13(raw) : null;

    if (!ean && !uploadedImg) {
      toast.error("Bitte EAN-13 eingeben oder ein Barcode-Bild hochladen");
      return;
    }
    if (raw && !ean) {
      toast.error("Ungültige EAN-13: 13 Ziffern mit korrekter Prüfziffer (oder 12 Ziffern, wir ergänzen sie)");
      return;
    }

    setSavingId(invoice.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const expiresAt = new Date(Date.now() + PAYOUT_VALIDITY_HOURS * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("freelancer_invoices")
        .update({
          payout_status: "approved",
          payout_barcode: ean,
          payout_image_url: uploadedImg,
          payout_expires_at: expiresAt,
          payout_approved_at: new Date().toISOString(),
          payout_approved_by: user?.id ?? null,
        })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success(`Auszahlung freigegeben (gültig ${PAYOUT_VALIDITY_HOURS}h)`);
      setBarcodeInputs((prev) => ({ ...prev, [invoice.id]: "" }));
      setImageUploads((prev) => {
        const n = { ...prev };
        delete n[invoice.id];
        return n;
      });
      // Push-Benachrichtigung an Mitarbeiter (best-effort)
      supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: invoice.user_id,
          title: "Auszahlung freigegeben",
          body: `Dein Bargeld-Code für ${invoice.task_title || "die Honorarabrechnung"} ist 2h gültig.`,
          url: "/dashboard/invoices",
          tag: `payout-${invoice.id}`,
          category: "payouts",
        },
      }).catch(() => {});
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Freigabe fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkRedeemed = async (invoice: PayoutInvoice) => {
    setSavingId(invoice.id);
    try {
      const { error } = await supabase
        .from("freelancer_invoices")
        .update({
          payout_status: "redeemed",
          payout_redeemed_at: new Date().toISOString(),
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success("Als eingelöst markiert");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Aktualisierung fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  };

  const handleReissue = async (invoice: PayoutInvoice) => {
    setSavingId(invoice.id);
    try {
      const { error } = await supabase
        .from("freelancer_invoices")
        .update({
          payout_status: "requested",
          payout_barcode: null,
          payout_image_url: null,
          payout_expires_at: null,
          payout_approved_at: null,
        })
        .eq("id", invoice.id);
      if (error) throw error;
      toast.success("Eintrag zurück in 'Offen' verschoben – neuen Code ausstellen");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Zurücksetzen fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <PageLoader />;

  const renderRequestedCard = (invoice: PayoutInvoice) => {
    const inputValue = barcodeInputs[invoice.id] ?? "";
    const uploadedImg = imageUploads[invoice.id] || null;
    const ean = normalizeEan13(inputValue);
    const canApprove = ean !== null || uploadedImg !== null;
    return (
      <Card key={invoice.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {invoice.task_title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{invoice.invoice_number}</p>
            </div>
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <Clock className="h-3 w-3 mr-1" /> Wartet auf Freigabe
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{fullName(invoice.profile)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{invoice.gross_amount.toFixed(2)} €</span>
            </div>
            <div className="text-muted-foreground">
              Angefragt:{" "}
              {invoice.payout_requested_at
                ? new Date(invoice.payout_requested_at).toLocaleString("de-DE")
                : "—"}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <Label htmlFor={`barcode-${invoice.id}`} className="flex items-center gap-2">
              <Barcode className="h-4 w-4" /> EAN-13 generieren (13 Ziffern)
            </Label>
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                id={`barcode-${invoice.id}`}
                value={inputValue}
                placeholder="z. B. 4060392659558"
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 13);
                  setBarcodeInputs((prev) => ({ ...prev, [invoice.id]: onlyDigits }));
                }}
                inputMode="numeric"
                maxLength={13}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setBarcodeInputs((prev) => ({ ...prev, [invoice.id]: generateDefaultCode() }))
                }
              >
                Vorschlag
              </Button>
            </div>

            {ean && (
              <div className="rounded-lg border bg-white p-3 flex justify-center">
                <Barcode128 value={ean} format="EAN13" height={70} fontSize={14} />
              </div>
            )}
            {!ean && inputValue.length > 0 && (
              <p className="text-xs text-amber-600">
                Bitte 13 Ziffern eingeben (oder 12, dann ergänzen wir automatisch die Prüfziffer).
              </p>
            )}

            {/* Bild-Upload Alternative */}
            <div className="border-t pt-3 space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Oder Barcode-Bild hochladen (PNG/JPG)
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploadingId === invoice.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadImage(invoice, f);
                    e.target.value = "";
                  }}
                  className="max-w-xs"
                />
                {uploadingId === invoice.id && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Upload className="h-3 w-3 animate-pulse" /> Lädt hoch...
                  </span>
                )}
              </div>
              {uploadedImg && (
                <div className="rounded-lg border bg-white p-3 flex justify-center">
                  <img src={uploadedImg} alt="Hochgeladener Barcode" className="max-h-32 object-contain" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Timer className="h-3 w-3" /> Code ist nach Freigabe {PAYOUT_VALIDITY_HOURS} Stunden gültig
              </p>
              <Button
                type="button"
                onClick={() => handleApprove(invoice)}
                disabled={savingId === invoice.id || !canApprove}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Freigeben
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderApprovedCard = (invoice: PayoutInvoice) => {
    const expired = invoice.payout_expires_at
      ? new Date(invoice.payout_expires_at).getTime() < Date.now()
      : false;
    return (
      <Card key={invoice.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">{invoice.task_title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{invoice.invoice_number}</p>
            </div>
            {expired ? (
              <Badge variant="destructive">
                <Timer className="h-3 w-3 mr-1" /> Abgelaufen
              </Badge>
            ) : (
              <Badge className="bg-emerald-500 hover:bg-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Freigegeben
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{fullName(invoice.profile)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{invoice.gross_amount.toFixed(2)} €</span>
            </div>
            <div className="text-muted-foreground">
              {expired ? "Abgelaufen am: " : "Gültig bis: "}
              {invoice.payout_expires_at
                ? new Date(invoice.payout_expires_at).toLocaleString("de-DE")
                : "—"}
            </div>
          </div>
          {invoice.payout_image_url ? (
            <div className="rounded-lg border bg-white p-3 flex justify-center">
              <img src={invoice.payout_image_url} alt="Barcode" className="max-h-32 object-contain" />
            </div>
          ) : invoice.payout_barcode ? (
            <div className="rounded-lg border bg-white p-3 flex justify-center">
              <Barcode128 value={invoice.payout_barcode} format="EAN13" height={70} fontSize={14} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            {expired && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleReissue(invoice)}
                disabled={savingId === invoice.id}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Neuen Code ausstellen
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMarkRedeemed(invoice)}
              disabled={savingId === invoice.id}
            >
              Als eingelöst markieren
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderRedeemedCard = (invoice: PayoutInvoice) => (
    <Card key={invoice.id}>
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <p className="font-medium">{invoice.task_title}</p>
          <p className="text-xs text-muted-foreground">
            {invoice.invoice_number} · {fullName(invoice.profile)}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold">{invoice.gross_amount.toFixed(2)} €</span>
          <Badge variant="secondary">
            Eingelöst{" "}
            {invoice.payout_redeemed_at
              ? new Date(invoice.payout_redeemed_at).toLocaleDateString("de-DE")
              : ""}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Barcode className="h-7 w-7 text-primary" />
            Auszahlungs-Freigaben
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auszahlungsanfragen von Freelancern prüfen und mit Code 128 Barcode freigeben.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="requested" className="w-full">
        <TabsList>
          <TabsTrigger value="requested">
            Offen <Badge variant="secondary" className="ml-2">{requested.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Freigegeben <Badge variant="secondary" className="ml-2">{approved.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="redeemed">
            Eingelöst <Badge variant="secondary" className="ml-2">{redeemed.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requested" className="space-y-4 mt-4">
          {requested.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Keine offenen Auszahlungsanfragen
              </CardContent>
            </Card>
          ) : (
            requested.map(renderRequestedCard)
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-4">
          {approved.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Keine freigegebenen Auszahlungen
              </CardContent>
            </Card>
          ) : (
            approved.map(renderApprovedCard)
          )}
        </TabsContent>

        <TabsContent value="redeemed" className="space-y-3 mt-4">
          {redeemed.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                Noch keine eingelösten Auszahlungen
              </CardContent>
            </Card>
          ) : (
            redeemed.map(renderRedeemedCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPayouts;
