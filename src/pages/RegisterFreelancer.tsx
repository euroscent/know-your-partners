import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast-stub";
import logo from "@/assets/bouncing-logo.png";
import contractLogo from "@/assets/epp-logo-dark.png";
import { Eye, EyeOff, Check, Trash2, Lock } from "lucide-react";
import { formatContractContent, replaceContractPlaceholders, generateContractHeader, generateContractPartiesBlock, CompanyInfo } from "@/lib/formatContractContent";
import { normalizeContractCategory } from "@/lib/contractTemplates";

const RegisterFreelancer = () => {
  const contractType = "freelancer";
  const contractTypeLabel = "Freelancer";
  
  const [searchParams] = useSearchParams();
  const isInvited = searchParams.get("invited") === "true";
  const prefilledStartDate = searchParams.get("startDate");
  const prefilledEmail = searchParams.get("email");
  
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState(prefilledEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAndNumber, setStreetAndNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [nationality, setNationality] = useState("Deutschland");
  const [startDate, setStartDate] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [signature, setSignature] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [companySignature, setCompanySignature] = useState<string>("");
  const [companySignerName, setCompanySignerName] = useState<string>("");
  const [companySignerTitle, setCompanySignerTitle] = useState<string>("");
  const [previewContractHTML, setPreviewContractHTML] = useState<string>("");
  const [companyContact, setCompanyContact] = useState<CompanyInfo | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Convert ISO date (YYYY-MM-DD) to German format (TT.MM.JJJJ)
  useEffect(() => {
    if (prefilledStartDate && isInvited) {
      const [year, month, day] = prefilledStartDate.split("-");
      if (year && month && day) {
        setStartDate(`${day}.${month}.${year}`);
      }
    }
  }, [prefilledStartDate, isInvited]);

  // Canvas initialization - same as standard Register.tsx
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showContractDialog) return;

    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const init = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scale = dpr;

      if (rect.width < 2 || rect.height < 2) {
        rafId = requestAnimationFrame(init);
        return;
      }

      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));

      const ctx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) return;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    rafId = requestAnimationFrame(init);
    resizeObserver = new ResizeObserver(() => init());
    resizeObserver.observe(canvas);

    const onResize = () => init();
    window.addEventListener('resize', onResize);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [showContractDialog]);

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) value = value.slice(0, 2) + '.' + value.slice(2);
    if (value.length >= 5) value = value.slice(0, 5) + '.' + value.slice(5);
    if (value.length > 10) value = value.slice(0, 10);
    setBirthDate(value);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) value = value.slice(0, 2) + '.' + value.slice(2);
    if (value.length >= 5) value = value.slice(0, 5) + '.' + value.slice(5);
    if (value.length > 10) value = value.slice(0, 10);
    setStartDate(value);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    fetchCompanySignature();
    fetchCompanyContact();
  }, [navigate]);

  const fetchCompanyContact = async () => {
    try {
      const { data } = await supabase.from("company_contact").select("*").maybeSingle();
      if (data) {
        setCompanyContact({
          name: data.company_name || undefined,
          street: data.street_address || undefined,
          postalCode: data.postal_code || undefined,
          city: data.city || undefined,
          country: data.country || undefined,
        });
      }
    } catch (err) {
      console.error("Error loading company contact:", err);
    }
  };

  // Build contract preview when dialog opens or inputs change
  useEffect(() => {
    const buildPreview = async () => {
      if (!showContractDialog) return;

      const categoryForDB = normalizeContractCategory(contractTypeLabel) ?? contractTypeLabel;
      const { data: templateData } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("category", categoryForDB)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const templateSalary = (templateData as any)?.default_salary as number | null;
      const monthlySalary = templateSalary != null ? String(templateSalary) : "Nach Vereinbarung";

      let content = templateData?.content || "";

      // Replace placeholders using the utility function
      content = replaceContractPlaceholders(content, {
        startDate,
        salary: monthlySalary,
        firstName,
        lastName,
        street: streetAndNumber,
        postalCode: zipCode,
        city,
        companySignature,
        employeeSignature: signature,
      });

      // Format the contract content with proper paragraphs and bold headings
      content = formatContractContent(content);

      // Build parties block (Vertrag zwischen)
      const contractTitle = `Freelancer-Vertrag`;
      const partiesBlock = generateContractPartiesBlock(
        contractTitle,
        companyContact || {},
        { firstName, lastName, street: streetAndNumber, postalCode: zipCode, city }
      );

      // Add header with logo
      const header = generateContractHeader(contractLogo);
      setPreviewContractHTML(header + partiesBlock + content);
    };

    buildPreview();
  }, [showContractDialog, startDate, firstName, lastName, streetAndNumber, zipCode, city, signature, companySignature, companyContact]);

  const fetchCompanySignature = async () => {
    try {
      const { data } = await supabase.from("company_signature").select("*").maybeSingle();
      if (data) {
        setCompanySignature(data.signature_data);
        setCompanySignerName(data.signer_name);
        setCompanySignerTitle(data.signer_title);
      }
    } catch (error) {
      console.error("Error loading company signature:", error);
    }
  };

  const validateStep1 = () => {
    if (!email || !password || !confirmPassword || !firstName || !lastName || !birthDate || !phone) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen", variant: "destructive" });
      return false;
    }
    const nameRegex = /^[a-zA-ZäöüÄÖÜßéèêëáàâãåçñíìîïóòôõúùûýÿÆæŒœ\s\-']+$/;
    if (!nameRegex.test(firstName)) {
      toast({ title: "Fehler", description: "Vorname darf nur Buchstaben enthalten", variant: "destructive" });
      return false;
    }
    if (!nameRegex.test(lastName)) {
      toast({ title: "Fehler", description: "Nachname darf nur Buchstaben enthalten", variant: "destructive" });
      return false;
    }
    if (password !== confirmPassword) {
      toast({ title: "Fehler", description: "Passwörter stimmen nicht überein", variant: "destructive" });
      return false;
    }
    if (password.length < 6) {
      toast({ title: "Fehler", description: "Passwort muss mindestens 6 Zeichen lang sein", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!streetAndNumber || !zipCode || !city ) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen", variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!startDate) {
      toast({ title: "Fehler", description: "Bitte Startdatum angeben", variant: "destructive" });
      return false;
    }
    const dateParts = startDate.split('.');
    if (dateParts.length === 3) {
      const selectedDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        toast({ title: "Fehler", description: "Das Startdatum darf nicht in der Vergangenheit liegen", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleOpenContractDialog = async () => {
    const categoryForDB = normalizeContractCategory(contractTypeLabel) ?? contractTypeLabel;
    const { data } = await supabase
      .from("contract_templates")
      .select("id,name,version,is_active")
      .eq("category", categoryForDB)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setPreviewContractHTML("");
      toast({
        title: "Keine aktive Vorlage",
        description: `Für ${contractTypeLabel} existiert keine aktive Vertragsvorlage.`,
        variant: "destructive",
      });
      return;
    }

    setPreviewContractHTML("");
    setShowContractDialog(true);
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ensureCanvasReady();

    const ctx = canvas.getContext('2d');
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

    const ctx = canvas.getContext('2d');
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
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.closePath();
    }
    
    setIsDrawing(false);
    if (e) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  const ensureCanvasReady = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr;

    const targetW = Math.max(1, Math.round(rect.width * scale));
    const targetH = Math.max(1, Math.round(rect.height * scale));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) return;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(false);

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr;

    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    setSignature("");
  };

  const handleSignContract = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
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
      toast({
        title: "Fehler",
        description: "Bitte unterschreiben Sie das Feld",
        variant: "destructive",
      });
      return;
    }

    const signatureData = canvas.toDataURL('image/jpeg', 0.85);
    setSignature(signatureData);
    setContractSigned(true);
    setShowContractDialog(false);
    toast({
      title: "Vertrag unterschrieben",
      description: "Sie können nun die Registrierung abschließen",
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    if (!contractSigned) {
      toast({ title: "Fehler", description: "Bitte unterschreiben Sie den Vertrag", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const birthDateParts = birthDate.split('.');
      const sqlBirthDate = birthDateParts.length === 3 
        ? `${birthDateParts[2]}-${birthDateParts[1]}-${birthDateParts[0]}`
        : birthDate;

      const sqlStartDate = (() => {
        if (startDate?.includes("-") && startDate.length >= 10) return startDate.slice(0, 10);
        const parts = startDate.split('.');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return new Date().toISOString().slice(0, 10);
      })();

      const signUpRes = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName,
            last_name: lastName,
            birth_date: sqlBirthDate,
            phone: phone,
            street_and_number: streetAndNumber,
            zip_code: zipCode,
            city: city,
            nationality: nationality,
            contract_type: contractType,
            start_date: startDate,
          },
        },
      });

      if (signUpRes.error) {
        const msg = signUpRes.error.message || "";
        const alreadyRegistered = /already registered|already exists|User already/i.test(msg);
        if (!alreadyRegistered) throw signUpRes.error;

        // Recovery: E-Mail existiert bereits (z. B. Altkonto ohne Profil) -> Anmeldung versuchen
        const { data: existing, error: existingErr } = await supabase.auth.signInWithPassword({ email, password });
        if (existingErr || !existing?.session) {
          toast({
            title: "E-Mail bereits registriert",
            description: "Für diese E-Mail existiert bereits ein Konto. Bitte melden Sie sich mit Ihrem Passwort an oder nutzen Sie \"Passwort vergessen\".",
            variant: "destructive",
          });
          navigate("/login");
          return;
        }
        (signUpRes as any).data = { user: existing.user, session: existing.session };
      }

      let userId = signUpRes.data?.user?.id || null;
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
        session = signInData?.session ?? null;
      }
      if (!userId) userId = session?.user?.id ?? null;

      if (!userId || !session) {
        toast({ title: "Bestätigung erforderlich", description: "Bitte prüfen Sie Ihre E‑Mail und bestätigen Sie die Registrierung.", variant: "destructive" });
        throw new Error("No active session after signup");
      }

      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          email: email,
          first_name: firstName,
          last_name: lastName,
          birth_date: sqlBirthDate,
          phone: phone,
          street: streetAndNumber,
          postal_code: zipCode,
          city: city,
          nationality: nationality,
          employment_type: contractType,
          signature_data: signature || null,
          start_date: sqlStartDate,
        }, { onConflict: "id" });

      if (upsertErr) {
        console.warn("Profile upsert error:", upsertErr);
        toast({ title: "Profil konnte nicht gespeichert werden", description: "Bitte versuchen Sie es erneut.", variant: "destructive" });
        return;
      }

      const { data: templateData } = await supabase
        .from("contract_templates")
        .select("content, default_salary")
        .eq("category", contractTypeLabel)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const templateSalary = (templateData as any)?.default_salary as number | null;
      const monthlySalary = templateSalary != null ? String(templateSalary) : "Nach Vereinbarung";

      let contractContent: string;
      if (templateData?.content) {
        const safe = (v: string) => v || "";
        contractContent = templateData.content
          .replace(/\{\{\s*startdatum\s*\}\}/gi, safe(startDate))
          .replace(/\{\{\s*salary\s*\}\}/gi, monthlySalary)
          .replace(/\{\{\s*first_name\s*\}\}/gi, safe(firstName))
          .replace(/\{\{\s*last_name\s*\}\}/gi, safe(lastName))
          .replace(/\{\{\s*full_name\s*\}\}/gi, `${safe(firstName)} ${safe(lastName)}`);
      } else {
        contractContent = `<h1>Freelancer-Vertrag</h1><p>Name: ${firstName} ${lastName}</p><p>Startdatum: ${startDate}</p><p>Vergütung: ${monthlySalary}</p>`;
      }

      if (companySignature) {
        const companySigTag = `<p><strong>Unterschrift Auftraggeber</strong></p><img src="${companySignature}" alt="Unterschrift Auftraggeber" style="max-height:128px;object-fit:contain;" />`;
        contractContent = /\{\{\s*company_signature\s*\}\}/i.test(contractContent)
          ? contractContent.replace(/\{\{\s*company_signature\s*\}\}/gi, companySigTag)
          : `${contractContent}\n\n${companySigTag}`;
      }

      if (signature) {
        const employeeSigTag = `<p><strong>Unterschrift Freelancer</strong></p><img src="${signature}" alt="Unterschrift Freelancer" style="max-height:128px;object-fit:contain;" />`;
        contractContent = /\{\{\s*signature\s*\}\}/i.test(contractContent)
          ? contractContent.replace(/\{\{\s*signature\s*\}\}/gi, employeeSigTag)
          : `${contractContent}\n\n${employeeSigTag}`;
      }

      await supabase.from("employee_documents").insert({
        user_id: userId,
        document_type: "contract",
        title: `Arbeitsvertrag - ${contractTypeLabel}`,
        description: `Ihr ${contractTypeLabel}-Vertrag mit Startdatum ${startDate}`,
        content: contractContent,
        signature_data: signature || null,
        start_date: sqlStartDate,
        contract_type: contractType,
      });

      // Send compliance email to employee inbox (fire-and-forget)
      supabase.functions.invoke("send-compliance-email", {
        body: { userId }
      }).catch(err => console.warn("Compliance email error:", err));

      toast({ title: "Registrierung erfolgreich!", description: "Ihr Konto wurde erstellt und der Vertrag wurde gespeichert." });
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Registration error:", error);
      if (!error.message?.includes("No active session")) {
        toast({ title: "Registrierung fehlgeschlagen", description: error.message || "Ein Fehler ist aufgetreten", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-12">
      <div className="flex items-center gap-4">
        {/* Step 1 */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
          </div>
          <span className="text-sm font-medium">Persönliche Daten</span>
        </div>

        {/* Connector */}
        <div className={`w-32 h-0.5 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`} />

        {/* Step 2 */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
          </div>
          <span className="text-sm font-medium">Adresse</span>
        </div>

        {/* Connector */}
        <div className={`w-32 h-0.5 ${currentStep >= 3 ? 'bg-primary' : 'bg-muted'}`} />

        {/* Step 3 */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            currentStep >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            3
          </div>
          <span className="text-sm font-medium">Vertrag</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <Link to="/register" className="inline-block">
            <img src={logo} alt="EPP Logo" className="h-10 w-10 object-contain mb-6 mx-auto" />
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Freelancer-Registrierung
          </h1>
          <p className="text-muted-foreground mb-3">
            Erstellen Sie Ihr Freelancer-Konto für EPP
          </p>
        </div>

        {renderStepIndicator()}

        <div className="bg-card p-8 rounded-lg shadow-lg">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Persönliche Informationen</h2>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mindestens 6 Zeichen"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[0-9]/g, '');
                      setFirstName(value);
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[0-9]/g, '');
                      setLastName(value);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Geburtsdatum</Label>
                <Input
                  id="birthDate"
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  maxLength={10}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+49"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-primary hover:bg-primary/90"
                >
                  Weiter
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Adresse</h2>

              <div className="space-y-2">
                <Label htmlFor="streetAndNumber">Straße und Hausnummer</Label>
                <Input
                  id="streetAndNumber"
                  value={streetAndNumber}
                  onChange={(e) => setStreetAndNumber(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode">PLZ</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setZipCode(value);
                    }}
                    maxLength={5}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Stadt</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
              </div>


              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  Zurück
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  className="bg-primary hover:bg-primary/90"
                >
                  Weiter
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <form onSubmit={handleRegister} className="space-y-6">
              <h2 className="text-2xl font-bold">Vertrag</h2>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-800 font-medium">Vertragsart: {contractTypeLabel}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">
                  {isInvited ? "Festgelegtes Startdatum" : "Gewünschtes Startdatum"}
                  {isInvited && <Lock className="inline-block w-3 h-3 ml-1 text-muted-foreground" />}
                </Label>
                <Input
                  id="startDate"
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={startDate}
                  onChange={isInvited ? undefined : handleStartDateChange}
                  maxLength={10}
                  required
                  disabled={isInvited}
                  className={isInvited ? "bg-muted cursor-not-allowed" : ""}
                />
                {isInvited && (
                  <p className="text-xs text-muted-foreground">
                    Das Startdatum wurde von EPP festgelegt und kann nicht geändert werden.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Bitte lesen Sie den Vertrag sorgfältig durch und unterschreiben Sie ihn, um fortzufahren.
                </p>
                
                <Button
                  type="button"
                  onClick={handleOpenContractDialog}
                  className="w-full bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  Vertrag anzeigen & unterschreiben
                </Button>

                {contractSigned && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    <span>Vertrag wurde unterschrieben</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                >
                  Zurück
                </Button>
                <LoadingButton
                  type="submit"
                  className="bg-primary hover:bg-primary/90"
                  disabled={!contractSigned}
                  loading={loading}
                  loadingText="Wird erstellt..."
                >
                  Registrieren
                </LoadingButton>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Bereits registriert? <Link to="/login" className="text-primary hover:underline font-medium">Anmelden</Link>
        </div>

        {/* Contract Dialog - same as standard Register.tsx */}
        <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Freelancer-Vertrag</DialogTitle>
              <DialogDescription>
                Bitte lesen Sie den Vertrag sorgfältig durch und unterschreiben Sie unten.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-white text-slate-900 p-6 rounded-lg text-sm max-h-[60vh] overflow-y-auto">
                {previewContractHTML ? (
                  <article
                    className="prose prose-sm max-w-none whitespace-pre-line leading-relaxed [&_strong]:font-bold [&_strong]:text-base [&_strong]:block [&_strong]:mt-4 [&_strong]:mb-2"
                    dangerouslySetInnerHTML={{ __html: previewContractHTML }}
                  />
                ) : (
                  <div className="text-muted-foreground space-y-2">
                    <h3 className="font-bold text-lg">Freelancer-Vertrag</h3>
                    <p>Für diese Kategorie wurde keine aktive Vorlage gefunden.</p>
                    <p>Bitte wenden Sie sich an die Administration oder wählen Sie eine andere Kategorie.</p>
                  </div>
                )}
              </div>

              {companySignature && (
                <div className="space-y-2 pt-4 border-t">
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

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Ihre Unterschrift (Freelancer)</Label>
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
                    Bitte unterschreiben Sie im Feld oben mit Ihrer Maus oder Ihrem Finger.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowContractDialog(false);
                      clearSignature();
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSignContract}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Vertrag unterschreiben
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RegisterFreelancer;
