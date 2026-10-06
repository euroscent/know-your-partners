import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, CheckCircle2, KeyRound, UserCog, FileSignature, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateToGerman } from "@/lib/dateUtils";
import { normalizeContractCategory } from "@/lib/contractTemplates";
import {
  formatContractContent,
  replaceContractPlaceholders,
  generateContractHeader,
  generateContractPartiesBlock,
  CompanyInfo,
} from "@/lib/formatContractContent";
import logo from "@/assets/epp-logo-dark.png";

interface OnboardingModalProps {
  open: boolean;
  userId: string;
  email: string;
  employmentType: string | null;
  initialFirstName?: string | null;
  initialLastName?: string | null;
  onComplete: () => void;
}

type Step = "password" | "personal" | "address" | "contract";

export function OnboardingModal({
  open,
  userId,
  email,
  employmentType,
  initialFirstName,
  initialLastName,
  onComplete,
}: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("password");
  const [submitting, setSubmitting] = useState(false);

  // Password
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Personal
  const [salutation, setSalutation] = useState<string>("");
  const [firstName, setFirstName] = useState(initialFirstName || "");
  const [lastName, setLastName] = useState(
    initialLastName && initialLastName !== "-" ? initialLastName : ""
  );
  const [birthDate, setBirthDate] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [nationality, setNationality] = useState("");

  // Address
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  // Contract preview & signature
  const [previewContractHTML, setPreviewContractHTML] = useState("");
  const [companySignature, setCompanySignature] = useState("");
  const [companySignerName, setCompanySignerName] = useState("");
  const [companySignerTitle, setCompanySignerTitle] = useState("");
  const [companyContact, setCompanyContact] = useState<CompanyInfo>({});
  const [signature, setSignature] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [contractCategory, setContractCategory] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setFirstName(initialFirstName || "");
    setLastName(initialLastName && initialLastName !== "-" ? initialLastName : "");
  }, [initialFirstName, initialLastName]);

  // Load company signature & contact once (per-user override wins)
  useEffect(() => {
    (async () => {
      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser?.user?.id;
      const [{ data: sigData }, { data: contactData }, profileRes] = await Promise.all([
        supabase.from("company_signature").select("*").maybeSingle(),
        supabase.from("company_contact").select("*").maybeSingle(),
        uid
          ? supabase.from("profiles").select("contract_company_override").eq("id", uid).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (sigData) {
        setCompanySignature(sigData.signature_data || "");
        setCompanySignerName(sigData.signer_name || "");
        setCompanySignerTitle(sigData.signer_title || "");
      }
      const base: CompanyInfo = {
        name: contactData?.company_name || undefined,
        street: contactData?.street_address || undefined,
        postalCode: contactData?.postal_code || undefined,
        city: contactData?.city || undefined,
        country: contactData?.country || undefined,
      };
      const override = (profileRes as any)?.data?.contract_company_override as any | null;
      if (override && (override.name || override.company_name)) {
        // Merge: override fields win, missing fields fall back to company_contact
        setCompanyContact({
          name: override.name || override.company_name || base.name,
          street: override.street || override.street_address || base.street,
          postalCode: override.postalCode || override.postal_code || base.postalCode,
          city: override.city || base.city,
          country: override.country || base.country,
        });
      } else {
        setCompanyContact(base);
      }
    })();
  }, []);

  // Build contract preview when entering contract step or inputs change
  useEffect(() => {
    if (step !== "contract") return;
    (async () => {
      const category = normalizeContractCategory(employmentType);
      if (!category) {
        setContractCategory(null);
        setPreviewContractHTML("");
        return;
      }
      setContractCategory(category);

      const { data: templateData } = await supabase
        .from("contract_templates")
        .select("*")
        .ilike("category", category)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const templateSalary = (templateData as any)?.default_salary as number | null;
      const monthlySalary = templateSalary != null ? String(templateSalary) : "Nach Vereinbarung";

      let content = templateData?.content || "";
      content = replaceContractPlaceholders(content, {
        startDate: new Date().toLocaleDateString("de-DE"),
        salary: monthlySalary,
        firstName,
        lastName,
        street,
        postalCode,
        city,
        companySignature,
        employeeSignature: signature,
      });
      content = formatContractContent(content);

      const partiesBlock = generateContractPartiesBlock(
        `${category}-Vertrag`,
        companyContact || {},
        { firstName, lastName, street, postalCode, city }
      );

      const header = generateContractHeader(logo);
      setPreviewContractHTML(header + partiesBlock + content);
    })();
  }, [step, employmentType, firstName, lastName, street, postalCode, city, signature, companySignature, companyContact]);

  // Init canvas when contract step is shown
  useEffect(() => {
    if (step !== "contract") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const init = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (rect.width < 2 || rect.height < 2) {
        rafId = requestAnimationFrame(init);
        return;
      }
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    rafId = requestAnimationFrame(init);
    resizeObserver = new ResizeObserver(() => init());
    resizeObserver.observe(canvas);
    const onResize = () => init();
    window.addEventListener("resize", onResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
  }, [step]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    ctx?.closePath();
    setIsDrawing(false);
    if (e) e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setSignature("");
  };

  const handlePasswordSubmit = async () => {
    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    if (password === "PxP-2026!") {
      toast.error("Bitte wähle ein neues Passwort (nicht das Standard-Passwort)");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSubmitting(false);

    if (error) {
      toast.error(`Fehler: ${error.message}`);
      return;
    }
    toast.success("Passwort gesetzt");
    setStep("personal");
  };

  const handlePersonalSubmit = () => {
    if (!salutation || !firstName.trim() || !lastName.trim()) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    setStep("address");
  };

  const handleAddressSubmit = () => {
    if (!street.trim() || !postalCode.trim() || !city.trim()) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    setStep("contract");
  };

  const handleSignAndComplete = async () => {
    // Validate signature exists on canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hasSignature = false;
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      if (r < 250 || g < 250 || b < 250) {
        hasSignature = true;
        break;
      }
    }
    if (!hasSignature) {
      toast.error("Bitte unterschreiben Sie das Feld");
      return;
    }

    const signatureData = canvas.toDataURL("image/jpeg", 0.85);
    setSignature(signatureData);

    setSubmitting(true);
    try {
      // 1. Save profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          salutation,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          street: street.trim(),
          postal_code: postalCode.trim(),
          city: city.trim(),
          signature_data: signatureData,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // 2. Clear onboarding flag
      await supabase.auth.updateUser({
        data: { must_complete_onboarding: false },
      });

      // 3. Generate signed contract
      if (contractCategory) {
        // Build final content with embedded signatures
        let finalContent = previewContractHTML;
        const employeeSigTag = `<p><strong>Unterschrift Mitarbeiter</strong></p><img src="${signatureData}" alt="Unterschrift Mitarbeiter" style="max-height:128px;object-fit:contain;" />`;
        finalContent = /\{\{\s*signature\s*\}\}/i.test(finalContent)
          ? finalContent.replace(/\{\{\s*signature\s*\}\}/gi, employeeSigTag)
          : `${finalContent}\n\n${employeeSigTag}`;

        // Remove old unsigned contracts
        await supabase
          .from("employee_documents")
          .delete()
          .eq("user_id", userId)
          .eq("document_type", "contract")
          .or("signature_data.is.null,signature_data.eq.");

        await supabase.from("employee_documents").insert({
          user_id: userId,
          document_type: "contract",
          title: `Arbeitsvertrag - ${contractCategory} - ${firstName} ${lastName}`,
          description: `${contractCategory}-Vertrag für ${firstName} ${lastName}`,
          contract_type: contractCategory.toLowerCase(),
          start_date: new Date().toISOString().split("T")[0],
          signature_data: signatureData,
          content: finalContent,
        });
      }

      toast.success("Vertrag unterschrieben. Willkommen!");
      onComplete();
    } catch (e: any) {
      console.error(e);
      toast.error(`Fehler: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const stepIndex =
    step === "password" ? 1 : step === "personal" ? 2 : step === "address" ? 3 : 4;

  return (
    <Dialog open={open} onOpenChange={() => { /* blocking */ }}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "password" && <KeyRound className="h-5 w-5 text-primary" />}
            {step === "personal" && <UserCog className="h-5 w-5 text-primary" />}
            {step === "address" && <FileSignature className="h-5 w-5 text-primary" />}
            {step === "contract" && <FileText className="h-5 w-5 text-primary" />}
            Willkommen! ({stepIndex}/4)
          </DialogTitle>
          <DialogDescription>
            {step === "password" && "Bitte vergib zuerst ein neues, sicheres Passwort."}
            {step === "personal" && "Persönliche Daten für deinen Arbeitsvertrag."}
            {step === "address" && "Anschrift für deinen Arbeitsvertrag."}
            {step === "contract" && "Bitte lies den Vertrag sorgfältig durch und unterschreibe unten."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-2 py-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === "password" && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              Account: <span className="font-medium text-foreground">{email}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Passwort bestätigen</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
            <LoadingButton loading={submitting} onClick={handlePasswordSubmit} className="w-full">
              Weiter
            </LoadingButton>
          </div>
        )}

        {step === "personal" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Anrede *</Label>
                <Select value={salutation} onValueChange={setSalutation}>
                  <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Herr">Herr</SelectItem>
                    <SelectItem value="Frau">Frau</SelectItem>
                    <SelectItem value="Divers">Divers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vorname *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nachname *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("password")}>Zurück</Button>
              <Button onClick={handlePersonalSubmit} className="flex-1">Weiter</Button>
            </div>
          </div>
        )}

        {step === "address" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-3">
                <Label>Straße & Hausnummer *</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>PLZ *</Label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Stadt *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div className="rounded-md border bg-primary/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  Im nächsten Schritt siehst du deinen <strong>Arbeitsvertrag</strong> zur
                  Durchsicht und Unterschrift.
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("personal")} disabled={submitting}>Zurück</Button>
              <Button onClick={handleAddressSubmit} className="flex-1">Weiter zum Vertrag</Button>
            </div>
          </div>
        )}

        {step === "contract" && (
          <div className="space-y-4">
            <div className="bg-white text-slate-900 p-6 rounded-lg text-sm max-h-[50vh] overflow-y-auto border">
              {previewContractHTML ? (
                <article
                  className="prose prose-sm max-w-none whitespace-pre-line leading-relaxed [&_strong]:font-bold [&_strong]:text-base [&_strong]:block [&_strong]:mt-4 [&_strong]:mb-2"
                  dangerouslySetInnerHTML={{ __html: previewContractHTML }}
                />
              ) : (
                <div className="text-muted-foreground space-y-2">
                  <h3 className="font-bold text-lg">Kein Vertrag verfügbar</h3>
                  <p>
                    Für deinen Beschäftigungstyp ({employmentType || "unbekannt"}) wurde keine
                    aktive Vertragsvorlage gefunden. Bitte wende dich an die Administration.
                  </p>
                </div>
              )}
            </div>

            {companySignature && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Unterschrift des Auftraggebers</Label>
                <div className="bg-white p-4 rounded-lg border">
                  <img
                    src={companySignature}
                    alt="Unterschrift des Auftraggebers"
                    className="max-w-xs border-b-2 border-foreground/20"
                  />
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p className="font-medium">{companySignerName}</p>
                    <p>{companySignerTitle}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Deine Unterschrift</Label>
              <div className="border-2 border-muted rounded-lg relative bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full h-[200px] cursor-crosshair touch-none block"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  onPointerCancel={stopDrawing}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2 z-10"
                  onClick={clearSignature}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Bitte unterschreibe im Feld oben mit Maus oder Finger.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("address")} disabled={submitting}>
                Zurück
              </Button>
              <LoadingButton
                loading={submitting}
                onClick={handleSignAndComplete}
                className="flex-1"
                disabled={!previewContractHTML}
              >
                Vertrag unterschreiben & abschließen
              </LoadingButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
