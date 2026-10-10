import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountryAutocomplete } from "@/components/ui/country-autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast-stub";
import logo from "@/assets/bouncing-logo.png";
import contractLogo from "@/assets/epp-logo-dark.png";
import { Eye, EyeOff, Check, Trash2, Loader2 } from "lucide-react";
import { formatContractContent, replaceContractPlaceholders, generateContractHeader, generateContractPartiesBlock, CompanyInfo } from "@/lib/formatContractContent";
import { normalizeContractCategory } from "@/lib/contractTemplates";

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState("");
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
  const [country, setCountry] = useState("Deutschland");
  const [nationality, setNationality] = useState("Deutschland");
  const [contractType, setContractType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [signature, setSignature] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [companySignature, setCompanySignature] = useState<string>("");
  const [companySignerName, setCompanySignerName] = useState<string>("");
  const [companySignerTitle, setCompanySignerTitle] = useState<string>("");
  const [previewContractHTML, setPreviewContractHTML] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [companyContact, setCompanyContact] = useState<CompanyInfo | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  const previewReqIdRef = useRef(0);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showContractDialog) return;

    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const init = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scale = dpr;

      // Skip init until canvas has a measurable size (avoids blurry first render)
      if (rect.width < 2 || rect.height < 2) {
        rafId = requestAnimationFrame(init);
        return;
      }

      // Set canvas size in device pixels
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));

      const ctx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) return;

      // Map 1 unit to 1 CSS pixel
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      // Drawing settings with thicker line
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // White background in CSS pixel space
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
    };

    // Initialize after dialog open animation and once element has a size
    rafId = requestAnimationFrame(init);

    // Keep canvas crisp on size changes
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
    let value = e.target.value.replace(/\D/g, ''); // Nur Zahlen
    
    if (value.length >= 2) {
      value = value.slice(0, 2) + '.' + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + '.' + value.slice(5);
    }
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    
    setBirthDate(value);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Nur Zahlen
    
    if (value.length >= 2) {
      value = value.slice(0, 2) + '.' + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + '.' + value.slice(5);
    }
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    
    setStartDate(value);
  };

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
    
    // Load company signature
    fetchCompanySignature();
    // Load company contact for parties block
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

  // Build contract preview from active template when dialog opens or inputs change
  useEffect(() => {
    const reqRef = previewReqIdRef;

    const buildPreview = async () => {
      if (!showContractDialog || !contractType) return;

      const requestId = ++reqRef.current;
      setPreviewLoading(true);

      const categoryForDB = normalizeContractCategory(contractType) ?? getContractTypeLabel(contractType);
      const timeoutMs = 12000;
      let timeoutId: number | undefined;

      try {
        const queryPromise = supabase
          .from("contract_templates")
          .select("content, default_salary")
          .eq("category", categoryForDB)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
        });

        const { data: templateData, error: templateError } = (await Promise.race([
          queryPromise,
          timeoutPromise,
        ])) as Awaited<typeof queryPromise>;

        // Ignore stale responses
        if (reqRef.current !== requestId) return;

        if (templateError) {
          console.error("[Contract] Preview error:", templateError);
          setPreviewContractHTML("");
          toastRef.current({
            title: "Fehler",
            description: `Vertrag konnte nicht geladen werden (Kategorie: ${categoryForDB}).`,
            variant: "destructive",
          });
          return;
        }

        if (!templateData?.content) {
          setPreviewContractHTML("");
          return;
        }

        const templateSalary = (templateData as any)?.default_salary as number | null;
        const monthlySalary =
          templateSalary != null
            ? String(templateSalary)
            : contractType === "minijob"
              ? "556"
              : contractType === "teilzeit"
                ? "2580"
                : contractType === "vollzeit"
                  ? "3890"
                  : "Nach Vereinbarung";

        let content = replaceContractPlaceholders(templateData.content, {
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

        content = formatContractContent(content);

        // Build parties block (Vertrag zwischen)
        const contractTitle = `Arbeitsvertrag - ${getContractTypeLabel(contractType)}`;
        const partiesBlock = generateContractPartiesBlock(
          contractTitle,
          companyContact || {},
          { firstName, lastName, street: streetAndNumber, postalCode: zipCode, city, country }
        );

        const header = generateContractHeader(contractLogo);
        setPreviewContractHTML(header + partiesBlock + content);
      } catch (err) {
        // Ignore stale responses
        if (reqRef.current !== requestId) return;

        console.error("[Contract] Preview timeout/error:", err);
        setPreviewContractHTML("");
        toastRef.current({
          title: "Zeitüberschreitung",
          description: "Der Vertrag lädt zu lange. Bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        // Only the latest request may end the loading state
        if (reqRef.current === requestId) setPreviewLoading(false);
      }
    };

    buildPreview();
  }, [showContractDialog, contractType, startDate, firstName, lastName, streetAndNumber, zipCode, city, country, signature, companySignature, companyContact]);

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
    } catch (err) {
      console.error("Error loading company signature:", err);
    }
  };

  const validateStep1 = () => {
    if (!salutation) {
      toast({ title: "Fehler", description: "Bitte wählen Sie eine Anrede aus", variant: "destructive" });
      return false;
    }
    if (!email || !password || !confirmPassword || !firstName || !lastName || !birthDate || !phone) {
      toast({
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfüllen",
        variant: "destructive",
      });
      return false;
    }

    // Validate that first name and last name contain only letters, spaces, hyphens
    const nameRegex = /^[a-zA-ZäöüÄÖÜßéèêëáàâãåçñíìîïóòôõúùûýÿÆæŒœ\s\-']+$/;
    
    if (!nameRegex.test(firstName)) {
      toast({
        title: "Fehler",
        description: "Vorname darf nur Buchstaben enthalten (keine Zahlen)",
        variant: "destructive",
      });
      return false;
    }

    if (!nameRegex.test(lastName)) {
      toast({
        title: "Fehler",
        description: "Nachname darf nur Buchstaben enthalten (keine Zahlen)",
        variant: "destructive",
      });
      return false;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Passwörter stimmen nicht überein",
        variant: "destructive",
      });
      return false;
    }

    if (password.length < 6) {
      toast({
        title: "Fehler",
        description: "Passwort muss mindestens 6 Zeichen lang sein",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!streetAndNumber || !zipCode || !city || !country) {
      toast({
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfüllen",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!contractType || !startDate) {
      toast({
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfüllen",
        variant: "destructive",
      });
      return false;
    }

    // Validate that start date is not in the past
    const dateParts = startDate.split('.');
    if (dateParts.length === 3) {
      const selectedDate = new Date(
        parseInt(dateParts[2]), 
        parseInt(dateParts[1]) - 1, 
        parseInt(dateParts[0])
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        toast({
          title: "Fehler",
          description: "Das Startdatum darf nicht in der Vergangenheit liegen",
          variant: "destructive",
        });
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
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Open contract dialog and build preview inside the dialog (prevents "stuck loading" on slow network)
  const handleOpenContractDialog = () => {
    if (!contractType || contractLoading) return;

    setContractLoading(true);
    setPreviewContractHTML("");
    setShowContractDialog(true);

    // allow one paint so the user sees immediate feedback, then release the button
    setTimeout(() => setContractLoading(false), 0);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep3()) return;

    if (!contractSigned) {
      toast({
        title: "Fehler",
        description: "Bitte unterschreiben Sie den Vertrag",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Convert birthDate from DD.MM.YYYY to YYYY-MM-DD for SQL
      const birthDateParts = birthDate.split('.');
      const sqlBirthDate = birthDateParts.length === 3 
        ? `${birthDateParts[2]}-${birthDateParts[1]}-${birthDateParts[0]}`
        : birthDate;

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
            // NOTE: Do NOT store signature image in auth metadata (bloats JWT & breaks uploads)
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

      // Get a user id we can use immediately (don't rely solely on session timing)
      let userId = signUpRes.data?.user?.id || null;
      let session = signUpRes.data?.session ?? null;

      // Wait briefly for the session to propagate
      if (!session) {
        await new Promise((r) => setTimeout(r, 500));
        const { data: { session: s } } = await supabase.auth.getSession();
        session = s;
      }

      // Fallback: try explicit sign-in (works when auto-confirm is on)
      if (!session) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInErr) {
          session = signInData?.session ?? null;
        }
      }

      if (!userId) userId = session?.user?.id ?? null;

      // If we still couldn't determine a user id, abort with a clear error
      if (!userId || !session) {
        toast({
          title: "Registrierung eingegangen",
          description: "Bitte prüfen Sie Ihre E‑Mail und bestätigen Sie die Registrierung, bevor Sie sich anmelden.",
        });
        navigate("/login");
        return;
      }

      // Convert startDate from DD.MM.YYYY to YYYY-MM-DD for SQL
      const startDateParts = startDate.split('.');
      const sqlStartDate = startDateParts.length === 3 
        ? `${startDateParts[2]}-${startDateParts[1]}-${startDateParts[0]}`
        : startDate;

      // Update profile immediately with registration data for instant availability
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(
          {
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
          },
          { onConflict: "id" }
        );
      if (upsertErr) {
        console.warn("Profile upsert error:", upsertErr);
        toast({
          title: "Profil konnte nicht gespeichert werden",
          description: "Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.",
          variant: "destructive",
        });
        return;
      }

      // Fetch contract template and preferred default salary based on contract type
      const categoryForDB = normalizeContractCategory(contractType) ?? getContractTypeLabel(contractType);
      const { data: templateData, error: templateError } = await supabase
        .from("contract_templates")
        .select("content, default_salary")
        .eq("category", categoryForDB)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Determine salary: use template.default_salary first, fallback by category
      const templateSalary = (templateData as any)?.default_salary as number | null;
      const monthlySalary = templateSalary != null
        ? String(templateSalary)
        : (
          contractType === "minijob" ? "556" :
          contractType === "teilzeit" ? "2580" :
          contractType === "vollzeit" ? "3890" :
          "Nach Vereinbarung"
        );

      // Build content from template using the shared utility function
      let contractContent: string;
      if (!templateError && templateData?.content) {
        contractContent = replaceContractPlaceholders(templateData.content, {
          startDate,
          salary: monthlySalary,
          firstName,
          lastName,
          companySignature,
          employeeSignature: signature,
        });
      } else {
        console.warn("No active template found for", contractType, templateError);
        contractContent = `Arbeitsvertrag – ${getContractTypeLabel(contractType)}\n\n` +
          `Vergütung\nMonatliches Gehalt: ${monthlySalary} €\n\n` +
          `1. Beginn und Art des Arbeitsverhältnisses\n\n` +
          `Das Arbeitsverhältnis beginnt am ${startDate}.`;

        // Append signatures for fallback content
        if (companySignature) {
          contractContent += `\n\n<p><strong>Unterschrift Arbeitgeber</strong></p><img src="${companySignature}" alt="Unterschrift Arbeitgeber" style="max-height:128px;object-fit:contain;" />`;
        }
        if (signature) {
          contractContent += `\n\n<p><strong>Unterschrift Arbeitnehmer</strong></p><img src="${signature}" alt="Unterschrift Arbeitnehmer" style="max-height:128px;object-fit:contain;" />`;
        }
      }

      // Save the contract as a document
      const { error: docError } = await supabase
        .from("employee_documents")
        .insert({
          user_id: userId,
          document_type: "contract",
          title: `Arbeitsvertrag - ${getContractTypeLabel(contractType)}`,
          description: `Ihr ${getContractTypeLabel(contractType)}-Vertrag mit Startdatum ${startDate}`,
          contract_type: contractType,
          start_date: startDate,
          signature_data: signature,
          content: contractContent,
        });

      if (docError) {
        console.error("Error saving contract:", docError);
        toast({
          title: "Hinweis",
          description: "Vertrag konnte nicht gespeichert werden, bitte kontaktieren Sie den Support",
          variant: "destructive",
        });
      } else {
        console.log("Contract saved successfully");
      }


      // Send compliance email to employee inbox (fire-and-forget)
      supabase.functions.invoke("send-compliance-email", {
        body: { userId }
      }).catch(err => console.warn("Compliance email error:", err));

      toast({
        title: "Registrierung erfolgreich!",
        description: "Vertrag wurde im Postfach abgelegt.",
      });
      
      setTimeout(() => {
        navigate("/documents");
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

    // Stop any active drawing
    setIsDrawing(false);

    // Reset canvas by re-initializing (cleanest way to reset all state)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scale = dpr;

    // Reset size (this clears all transforms and state)
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    // Reapply all settings from scratch
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    setSignature("");
  };

  const getContractTypeLabel = (type: string) => {
    const normalized = normalizeContractCategory(type);
    if (normalized) return normalized;

    const labels: Record<string, string> = {
      minijob: "Minijob",
      teilzeit: "Teilzeit",
      vollzeit: "Vollzeit",
      freelancer: "Freelancer",
    };
    return labels[type?.trim?.() ?? ""] || type;
  };

  const handleSignContract = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if canvas has any signature (black pixels)
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Check for black pixels (signature strokes)
    // Since we have a white background (255,255,255), we need to check for pixels that are not white
    let hasSignature = false;
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      // Check if pixel is not white (allowing small tolerance)
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

    // Save signature as base64
    const signatureData = canvas.toDataURL('image/jpeg', 0.85);
    setSignature(signatureData);
    setContractSigned(true);
    setShowContractDialog(false);
    toast({
      title: "Vertrag unterschrieben",
      description: "Sie können nun die Registrierung abschließen",
    });
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
          <img src={logo} alt="EuroScent Logo" className="h-10 w-10 object-contain mb-6 mx-auto" />
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Mitarbeiter-Registrierung
          </h1>
          <p className="text-muted-foreground mb-3">
            Erstellen Sie Ihr Mitarbeiterkonto für EuroScent
          </p>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm inline-block">
            <strong>Sie sind Unternehmen?</strong> Nutzen Sie die{" "}
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-primary font-semibold hover:underline"
            >
              Firmen-Registrierung
            </button>
          </div>
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
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => {
                      // Only allow letters, spaces, hyphens, apostrophes - no numbers
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
                      // Only allow letters, spaces, hyphens, apostrophes - no numbers
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

              <div className="space-y-2">
                <Label htmlFor="nationality">Nationalität</Label>
                <CountryAutocomplete
                  value={nationality}
                  onValueChange={setNationality}
                  placeholder="Land suchen..."
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
                      // Only allow numbers and max 5 digits
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

              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Deutschland" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deutschland">Deutschland</SelectItem>
                    <SelectItem value="Österreich">Österreich</SelectItem>
                    <SelectItem value="Schweiz">Schweiz</SelectItem>
                    <SelectItem value="Andere">Andere</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="space-y-2">
                <Label htmlFor="contractType">Vertrag auswählen</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bitte Vertrag auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minijob">Minijob</SelectItem>
                    <SelectItem value="teilzeit">Teilzeit</SelectItem>
                    <SelectItem value="vollzeit">Vollzeit</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Gewünschtes Startdatum</Label>
                <Input
                  id="startDate"
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={startDate}
                  onChange={handleStartDateChange}
                  maxLength={10}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  * Wählen Sie das Datum, an dem Ihr Arbeitsverhältnis beginnen soll
                </p>
              </div>

              {contractType && (
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Bitte lesen Sie den Vertrag sorgfältig durch und unterschreiben Sie ihn, um fortzufahren.
                  </p>
                  
                  <LoadingButton
                    type="button"
                    onClick={handleOpenContractDialog}
                    className="w-full bg-primary hover:bg-primary/90"
                    size="lg"
                    loading={contractLoading}
                    loadingText="Wird geladen..."
                  >
                    Vertrag anzeigen & unterschreiben
                  </LoadingButton>

                  {contractSigned && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      <span>Vertrag wurde unterschrieben</span>
                    </div>
                  )}
                </div>
              )}

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

        {/* Contract Dialog */}
        <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Arbeitsvertrag - {contractType === "minijob" ? "Minijob" : contractType === "teilzeit" ? "Teilzeit" : contractType === "vollzeit" ? "Vollzeit" : "Freelancer"}</DialogTitle>
              <DialogDescription>
                Bitte lesen Sie den Vertrag sorgfältig durch und unterschreiben Sie unten.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-white text-slate-900 p-6 rounded-lg text-sm max-h-[60vh] overflow-y-auto">
                {previewLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Vertrag wird geladen…</span>
                  </div>
                ) : previewContractHTML ? (
                  <article
                    className="prose prose-sm max-w-none whitespace-pre-line leading-relaxed [&_strong]:font-bold [&_strong]:text-base [&_strong]:block [&_strong]:mt-4 [&_strong]:mb-2"
                    dangerouslySetInnerHTML={{ __html: previewContractHTML }}
                  />
                ) : (
                  <div className="text-muted-foreground space-y-2">
                    <h3 className="font-bold text-lg">Arbeitsvertrag – {getContractTypeLabel(contractType)}</h3>
                    <p>Für diese Kategorie wurde keine aktive Vorlage gefunden.</p>
                    <p>Bitte wenden Sie sich an die Administration oder wählen Sie eine andere Kategorie.</p>
                  </div>
                )}
              </div>

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

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Ihre Unterschrift (Arbeitnehmer)</Label>
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

export default Register;
