import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast-stub";
import logo from "@/assets/bouncing-logo.png";
import contractLogo from "@/assets/epp-logo-dark.png";
import { Eye, EyeOff, Check, Trash2, ArrowLeft, Lock } from "lucide-react";
import { formatContractContent, replaceContractPlaceholders, generateContractHeader, generateContractPartiesBlock, CompanyInfo } from "@/lib/formatContractContent";
import { normalizeContractCategory } from "@/lib/contractTemplates";

const RegisterVollzeit = () => {
  const contractType = "vollzeit";
  const contractTypeLabel = "Vollzeit";
  
  const [searchParams] = useSearchParams();
  const isInvited = searchParams.get("invited") === "true";
  const prefilledStartDate = searchParams.get("startDate");
  const prefilledEmail = searchParams.get("email");
  
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState(prefilledEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [salutation, setSalutation] = useState("");
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

      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
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

  useEffect(() => {
    const buildPreview = async () => {
      if (!showContractDialog) return;

      const categoryForDB = normalizeContractCategory(contractTypeLabel) ?? contractTypeLabel;
      const { data: templateData, error } = await supabase
        .from("contract_templates")
        .select("*")
        .eq("category", categoryForDB)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Contract template load error:", error);
        setPreviewContractHTML(`<p>Vertrag konnte nicht geladen werden: ${error.message}</p>`);
        return;
      }

      if (!templateData) {
        setPreviewContractHTML(`<p>Keine aktive Vertragsvorlage für ${contractTypeLabel} gefunden.</p>`);
        return;
      }

      const templateSalary = (templateData as any)?.default_salary as number | null;
      const monthlySalary = templateSalary != null ? String(templateSalary) : "3890";

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
      const contractTitle = `Arbeitsvertrag - ${contractTypeLabel}`;
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
    if (!salutation) {
      toast({ title: "Fehler", description: "Bitte wählen Sie eine Anrede aus", variant: "destructive" });
      return false;
    }
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
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleOpenContractDialog = async () => {
    try {
      setPreviewContractHTML("<p>Vertrag wird geladen…</p>");
      setShowContractDialog(true);

      const categoryForDB = normalizeContractCategory(contractTypeLabel) ?? contractTypeLabel;
      const { data, error } = await supabase
        .from("contract_templates")
        .select("id,name,version,is_active")
        .eq("category", categoryForDB)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Contract template lookup error:", error);
        toast({
          title: "Vertrag konnte nicht geladen werden",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        toast({
          title: "Keine aktive Vorlage",
          description: `Für ${contractTypeLabel} existiert keine aktive Vertragsvorlage.`,
          variant: "destructive",
        });
        return;
      }
    } catch (e) {
      console.error("handleOpenContractDialog failed:", e);
      toast({
        title: "Vertrag konnte nicht geöffnet werden",
        description: "Bitte Seite neu laden und erneut versuchen.",
        variant: "destructive",
      });
    }
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make sure the canvas is correctly initialized for the current size
    ensureCanvasReady();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    setIsDrawing(true);

    // Coordinates in CSS pixels (match setTransform scale)
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    // Tiny line so taps produce a visible dot
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
    
    // Use CSS pixel coordinates to match transform
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

  // Ensure backing store size matches current element size before drawing
  const ensureCanvasReady = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr;

    const targetW = Math.max(1, Math.round(rect.width * scale));
    const targetH = Math.max(1, Math.round(rect.height * scale));

    // If the internal size doesn't match the element size, reinitialize
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setSignature("");
    setContractSigned(false);
  };

  const handleSignContract = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const imageData = ctx.getImageData(0, 0, rect.width * dpr, rect.height * dpr);
    const data = imageData.data;
    let hasDrawing = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
        hasDrawing = true;
        break;
      }
    }
    if (!hasDrawing) {
      toast({ title: "Fehler", description: "Bitte unterschreiben Sie im Feld", variant: "destructive" });
      return;
    }
    const signatureData = canvas.toDataURL('image/png');
    setSignature(signatureData);
    setContractSigned(true);
    setShowContractDialog(false);
    toast({ title: "Vertrag unterschrieben", description: "Ihre Unterschrift wurde erfolgreich gespeichert" });
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
        // Accept both "TT.MM.JJJJ" and "YYYY-MM-DD" (used by invited links)
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
            salutation: salutation,
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
      let session = signUpRes.data?.session ?? null;

      if (!session) {
        await new Promise((r) => setTimeout(r, 500));
        const { data: { session: s } } = await supabase.auth.getSession();
        session = s;
      }

      if (!session) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInErr) session = signInData?.session ?? null;
      }

      if (!userId) userId = session?.user?.id ?? null;

      if (!userId || !session) {
        toast({ title: "Registrierung eingegangen", description: "Bitte prüfen Sie Ihre E‑Mail und bestätigen Sie die Registrierung, bevor Sie sich anmelden." });
        navigate("/login");
        return;
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
        .ilike("category", contractTypeLabel)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const templateSalary = (templateData as any)?.default_salary as number | null;
      const monthlySalary = templateSalary != null ? String(templateSalary) : "3890";

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
        contractContent = `<h1>Arbeitsvertrag - ${contractTypeLabel}</h1><p>Name: ${firstName} ${lastName}</p><p>Startdatum: ${startDate}</p><p>Gehalt: ${monthlySalary}€</p>`;
      }

      if (companySignature) {
        const companySigTag = `<p><strong>Unterschrift Arbeitgeber</strong></p><img src="${companySignature}" alt="Unterschrift Arbeitgeber" style="max-height:128px;object-fit:contain;" />`;
        contractContent = /\{\{\s*company_signature\s*\}\}/i.test(contractContent)
          ? contractContent.replace(/\{\{\s*company_signature\s*\}\}/gi, companySigTag)
          : `${contractContent}\n\n${companySigTag}`;
      }

      if (signature) {
        const employeeSigTag = `<p><strong>Unterschrift Arbeitnehmer</strong></p><img src="${signature}" alt="Unterschrift Arbeitnehmer" style="max-height:128px;object-fit:contain;" />`;
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/register" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <img src={logo} alt="EPP Logo" className="h-10 w-10 object-contain" />
          </div>

          <div className="mb-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-2">
              {contractTypeLabel}
            </div>
            <h1 className="text-2xl font-bold text-foreground">Registrierung</h1>
            <p className="text-muted-foreground">Erstellen Sie Ihr Mitarbeiterkonto</p>
          </div>

          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > step ? <Check className="h-5 w-5" /> : step}
                </div>
                {step < 3 && <div className={`w-16 h-1 mx-2 ${currentStep > step ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleRegister}>
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold mb-4">Persönliche Daten</h2>
                <div className="space-y-2">
                  <Label htmlFor="salutation">Anrede *</Label>
                  <Select value={salutation} onValueChange={setSalutation} required>
                    <SelectTrigger id="salutation" className="bg-background">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="Herr">Herr</SelectItem>
                      <SelectItem value="Frau">Frau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="firstName">Vorname *</Label><Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max" required /></div>
                  <div><Label htmlFor="lastName">Nachname *</Label><Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mustermann" required /></div>
                </div>
                <div><Label htmlFor="email">E-Mail *</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@beispiel.de" required /></div>
                <div><Label htmlFor="phone">Telefon *</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 123 456789" required /></div>
                <div><Label htmlFor="birthDate">Geburtsdatum *</Label><Input id="birthDate" value={birthDate} onChange={handleBirthDateChange} placeholder="TT.MM.JJJJ" required /></div>
                <div className="relative"><Label htmlFor="password">Passwort *</Label><Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-muted-foreground">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
                <div className="relative"><Label htmlFor="confirmPassword">Passwort bestätigen *</Label><Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-8 text-muted-foreground">{showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
                <Button type="button" onClick={handleNext} className="w-full">Weiter</Button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold mb-4">Adresse</h2>
                <div><Label htmlFor="streetAndNumber">Straße und Hausnummer *</Label><Input id="streetAndNumber" value={streetAndNumber} onChange={(e) => setStreetAndNumber(e.target.value)} placeholder="Musterstraße 123" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="zipCode">PLZ *</Label><Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="12345" required /></div>
                  <div><Label htmlFor="city">Stadt *</Label><Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Berlin" required /></div>
                </div>
                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={handleBack} className="flex-1">Zurück</Button>
                  <Button type="button" onClick={handleNext} className="flex-1">Weiter</Button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold mb-4">Vertragsdaten</h2>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800 font-medium">Vertragsart: {contractTypeLabel}</p>
                </div>
                <div>
                  <Label htmlFor="startDate">
                    {isInvited ? "Festgelegtes Startdatum" : "Gewünschtes Startdatum *"}
                    {isInvited && <Lock className="inline-block w-3 h-3 ml-1 text-muted-foreground" />}
                  </Label>
                  <Input 
                    id="startDate" 
                    value={startDate} 
                    onChange={isInvited ? undefined : handleStartDateChange} 
                    placeholder="TT.MM.JJJJ" 
                    required 
                    disabled={isInvited}
                    className={isInvited ? "bg-muted cursor-not-allowed" : ""}
                  />
                  {isInvited && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Das Startdatum wurde von EPP festgelegt und kann nicht geändert werden.
                    </p>
                  )}
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div><h3 className="font-medium">Arbeitsvertrag</h3><p className="text-sm text-muted-foreground">{contractSigned ? "Unterschrieben ✓" : "Noch nicht unterschrieben"}</p></div>
                    <Button type="button" variant={contractSigned ? "outline" : "default"} onClick={handleOpenContractDialog}>{contractSigned ? "Erneut ansehen" : "Vertrag ansehen & unterschreiben"}</Button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={handleBack} className="flex-1">Zurück</Button>
                  <LoadingButton type="submit" disabled={!contractSigned} loading={loading} loadingText="Wird registriert..." className="flex-1">Registrierung abschließen</LoadingButton>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Bereits registriert? <Link to="/login" className="text-primary hover:underline font-medium">Anmelden</Link>
          </div>
        </div>
      </div>

      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Arbeitsvertrag - {contractTypeLabel}</DialogTitle>
            <DialogDescription>Bitte lesen Sie den Vertrag sorgfältig durch und unterschreiben Sie unten.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div
              className="border rounded-lg p-6 bg-white text-slate-900 max-h-96 overflow-y-auto prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewContractHTML }}
            />

            {companySignature && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Unterschrift des Arbeitgebers</Label>
                <div className="bg-white p-4 rounded-lg border">
                  <img
                    src={companySignature}
                    alt="Unterschrift des Arbeitgebers"
                    className="max-w-xs border-b-2 border-foreground/20"
                  />
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p className="font-medium">{companySignerName}</p>
                    <p>{companySignerTitle}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Label>Ihre Unterschrift</Label>
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
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={clearSignature} className="flex items-center gap-2"><Trash2 className="h-4 w-4" />Löschen</Button>
                <Button type="button" onClick={handleSignContract} className="flex-1">Vertrag unterschreiben</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegisterVollzeit;
