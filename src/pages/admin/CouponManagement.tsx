import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  QrCode, 
  Send, 
  Upload, 
  CheckCircle2, 
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Move,
  X,
  Search,
  Mail,
  AlertCircle,
  Loader2,
  FileText,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// POSTIDENT template - in public folder (cache bust to ensure latest version)
const POSTIDENT_TEMPLATE = "/postident-template.png?v=2";

interface UnverifiedEmployee {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  verified: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  sender_name: string | null;
  sender_email: string | null;
}

const CouponManagement = () => {
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Coupon erstellen
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrPosition, setQrPosition] = useState({ x: 80, y: 56 });
  const [qrSize, setQrSize] = useState(340);
  const [isDragging, setIsDragging] = useState(false);
  const [generatedCoupon, setGeneratedCoupon] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Step 2: Mitarbeiter auswählen
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<UnverifiedEmployee | null>(null);
  const [unverifiedEmployees, setUnverifiedEmployees] = useState<UnverifiedEmployee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<UnverifiedEmployee[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Step 3: E-Mail Template
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  
  // Step 4: Versenden
  const [isSending, setIsSending] = useState(false);

  // Generate random coupon code
  const generateCouponCode = useCallback(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "MIETER-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponCode(code);
    return code;
  }, []);

  // Fetch unverified employees on mount
  const fetchUnverifiedEmployees = useCallback(async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, phone, verified")
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setUnverifiedEmployees(data || []);
      setFilteredEmployees(data || []);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Fehler beim Laden der Mitarbeiter");
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Fetch email templates
  const fetchEmailTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject, content, sender_name, sender_email")
        .order("name");

      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error) {
      console.error("Templates fetch error:", error);
    }
  }, []);

  useEffect(() => {
    fetchUnverifiedEmployees();
    fetchEmailTemplates();
  }, [fetchUnverifiedEmployees, fetchEmailTemplates]);

  // Filter employees based on search
  useEffect(() => {
    if (searchEmail.length === 0) {
      setFilteredEmployees(unverifiedEmployees);
    } else {
      const filtered = unverifiedEmployees.filter(emp => 
        emp.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
        (emp.first_name?.toLowerCase().includes(searchEmail.toLowerCase())) ||
        (emp.last_name?.toLowerCase().includes(searchEmail.toLowerCase()))
      );
      setFilteredEmployees(filtered);
    }
  }, [searchEmail, unverifiedEmployees]);

  // Handle QR code upload
  const handleQrUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setQrCodeImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle drag on preview
  const handleMouseDown = () => {
    if (!qrCodeImage) return;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !previewRef.current) return;
    
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setQrPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Generate final image and proceed to step 2
  const generateFinalImage = async () => {
    if (!qrCodeImage) {
      toast.error("Bitte laden Sie zuerst einen QR-Code hoch");
      return;
    }

    setIsGenerating(true);
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const templateImg = new Image();
      templateImg.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        templateImg.onload = resolve;
        templateImg.onerror = reject;
        templateImg.src = POSTIDENT_TEMPLATE;
      });

      canvas.width = templateImg.width;
      canvas.height = templateImg.height;
      ctx.drawImage(templateImg, 0, 0);

      const qrImg = new Image();
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = qrCodeImage;
      });

      // Calculate QR size proportionally to canvas width (matching the preview calculation)
      const scaledQrSize = (qrSize / 1200) * canvas.width;
      const qrX = (qrPosition.x / 100) * canvas.width - (scaledQrSize / 2);
      const qrY = (qrPosition.y / 100) * canvas.height - (scaledQrSize / 2);

      ctx.drawImage(qrImg, qrX, qrY, scaledQrSize, scaledQrSize);

      const dataUrl = canvas.toDataURL("image/png");
      setGeneratedCoupon(dataUrl);
      generateCouponCode();
      setCurrentStep(2);
      toast.success("Coupon-Bild erstellt! Wählen Sie jetzt einen Empfänger.");
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Fehler beim Erstellen des Bildes");
    } finally {
      setIsGenerating(false);
    }
  };

  // Select employee and proceed to step 3
  const selectEmployee = (emp: UnverifiedEmployee) => {
    setSelectedEmployee(emp);
    setSearchEmail(emp.email);
    setCurrentStep(3);
  };

  // Get selected template
  const selectedTemplate = emailTemplates.find(t => t.id === selectedTemplateId);

  // Replace placeholders in template
  const replacePlaceholders = (text: string) => {
    if (!selectedEmployee) return text;
    return text
      .replace(/\{\{vorname\}\}/gi, selectedEmployee.first_name || "")
      .replace(/\{\{nachname\}\}/gi, selectedEmployee.last_name || "")
      .replace(/\{\{firstName\}\}/gi, selectedEmployee.first_name || "")
      .replace(/\{\{lastName\}\}/gi, selectedEmployee.last_name || "")
      .replace(/\{\{email\}\}/gi, selectedEmployee.email)
      .replace(/\{\{couponCode\}\}/gi, couponCode);
  };

  // Send coupon email
  const sendCouponEmail = async () => {
    if (!selectedEmployee || !generatedCoupon || !selectedTemplate) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    setIsSending(true);

    try {
      const { error } = await supabase.functions.invoke("send-coupon-email", {
        body: {
          to: selectedEmployee.email,
          firstName: selectedEmployee.first_name || "",
          lastName: selectedEmployee.last_name || "",
          couponCode: couponCode,
          couponImage: generatedCoupon,
          subject: replacePlaceholders(selectedTemplate.subject),
          htmlContent: replacePlaceholders(selectedTemplate.content),
          senderName: selectedTemplate.sender_name,
          senderEmail: selectedTemplate.sender_email
        }
      });

      if (error) throw error;

      toast.success(`Coupon erfolgreich an ${selectedEmployee.email} gesendet!`);
      
      // Reset all
      setCurrentStep(1);
      setSelectedEmployee(null);
      setSearchEmail("");
      setCouponCode("");
      setSelectedTemplateId("");
      setGeneratedCoupon(null);
      setQrCodeImage(null);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Fehler beim Senden der E-Mail");
    } finally {
      setIsSending(false);
    }
  };

  // Download coupon
  const downloadCoupon = () => {
    if (!generatedCoupon) return;
    
    const link = document.createElement("a");
    link.download = `postident-coupon-${couponCode || "generated"}.png`;
    link.href = generatedCoupon;
    link.click();
  };

  // Step indicator component
  const StepIndicator = ({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) => (
    <div className="flex items-center gap-2">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
        ${completed ? 'bg-green-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
      `}>
        {completed ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span className={`text-sm ${active ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <QrCode className="h-8 w-8 text-primary" />
          POSTIDENT Coupon versenden
        </h1>
        <p className="text-muted-foreground mt-2">
          Erstellen und versenden Sie personalisierte POSTIDENT Coupons an Mitarbeiter
        </p>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <StepIndicator step={1} label="Coupon erstellen" active={currentStep === 1} completed={currentStep > 1} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <StepIndicator step={2} label="Empfänger wählen" active={currentStep === 2} completed={currentStep > 2} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <StepIndicator step={3} label="Template wählen" active={currentStep === 3} completed={currentStep > 3} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <StepIndicator step={4} label="Versenden" active={currentStep === 4} completed={false} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Current Step */}
        <div className="space-y-6">
          {/* Step 1: Create Coupon */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Schritt 1: QR-Code hochladen & Coupon erstellen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label>Coupon-Vorlage</Label>
                    <div className="mt-2 p-3 border rounded-lg bg-muted/30 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 font-medium">POSTIDENT Vorlage integriert</span>
                    </div>
                  </div>

                  <div>
                    <Label>QR-Code hochladen</Label>
                    <div className="mt-2">
                      {qrCodeImage ? (
                        <div className="p-3 border rounded-lg bg-muted/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="text-green-600 font-medium">QR-Code hochgeladen</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setQrCodeImage(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-sm text-muted-foreground">Klicken zum Hochladen</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      <Move className="h-4 w-4" />
                      Position: X: {qrPosition.x.toFixed(0)}% Y: {qrPosition.y.toFixed(0)}%
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">Klicken Sie in die Vorschau rechts, um die Position anzupassen</p>
                  </div>

                  <div>
                    <Label>QR-Code Größe</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Button variant="outline" size="icon" onClick={() => setQrSize(Math.max(100, qrSize - 20))}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="flex-1 text-center">{qrSize}px</span>
                      <Button variant="outline" size="icon" onClick={() => setQrSize(Math.min(800, qrSize + 20))}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button className="w-full" onClick={generateFinalImage} disabled={!qrCodeImage || isGenerating}>
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Bild erstellen & Weiter
                  </Button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Employee */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Schritt 2: Empfänger auswählen
                </CardTitle>
                <p className="text-sm text-muted-foreground">Mitarbeiter mit ausstehender Verifizierung</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nach Name oder E-Mail suchen..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="h-64 border rounded-lg">
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Lade Mitarbeiter...
                    </div>
                  ) : filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        className="w-full p-3 text-left hover:bg-muted flex items-center justify-between border-b last:border-b-0"
                        onClick={() => selectEmployee(emp)}
                      >
                        <div>
                          <p className="font-medium">
                            {emp.first_name || "Kein Vorname"} {emp.last_name || "Kein Nachname"}
                          </p>
                          <p className="text-sm text-muted-foreground">{emp.email}</p>
                        </div>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                          Nicht verifiziert
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      Keine unverifzierten Mitarbeiter gefunden
                    </div>
                  )}
                </ScrollArea>

                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Zurück
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Template */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Schritt 3: E-Mail Vorlage wählen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Employee Info */}
                {selectedEmployee && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <Label className="text-xs text-muted-foreground">Empfänger</Label>
                    <p className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedEmployee.email}</p>
                  </div>
                )}

                <div>
                  <Label>Coupon-Code</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="MIETER-XXXXXX"
                      className="font-mono"
                    />
                    <Button variant="outline" onClick={generateCouponCode}>
                      Neu
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>E-Mail Vorlage</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Vorlage auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Template Preview */}
                {selectedTemplate && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 border-b">
                      <p className="text-sm font-medium">Vorschau: {replacePlaceholders(selectedTemplate.subject)}</p>
                    </div>
                    <div className="p-4 max-h-48 overflow-auto bg-white">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: replacePlaceholders(selectedTemplate.content) }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    Zurück
                  </Button>
                  <Button 
                    className="flex-1"
                    disabled={!selectedTemplateId || isSending}
                    onClick={sendCouponEmail}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    E-Mail mit Coupon senden
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: POSTIDENT Template/Coupon Preview with QR positioning */}
        <div>
          <Card className="sticky top-6">
            <CardContent className="p-4">
              {currentStep === 1 && !generatedCoupon ? (
                <div
                  ref={previewRef}
                  className="relative border rounded-lg overflow-hidden shadow-md cursor-crosshair select-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img src={POSTIDENT_TEMPLATE} alt="POSTIDENT Vorlage" className="w-full h-auto" draggable={false} />
                  {qrCodeImage && (
                    <div
                      className="absolute border-2 border-primary border-dashed rounded-lg shadow-lg pointer-events-none"
                      style={{
                        left: `${qrPosition.x}%`,
                        top: `${qrPosition.y}%`,
                        transform: "translate(-50%, -50%)",
                        width: `${(qrSize / 1200) * 100}%`,
                        aspectRatio: "1/1"
                      }}
                    >
                      <img src={qrCodeImage} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden shadow-md">
                  {generatedCoupon ? (
                    <img src={generatedCoupon} alt="Generierter Coupon" className="w-full h-auto" />
                  ) : (
                    <img src={POSTIDENT_TEMPLATE} alt="POSTIDENT Vorlage" className="w-full h-auto" />
                  )}
                </div>
              )}
              {generatedCoupon && (
                <div className="mt-4">
                  <Button variant="outline" className="w-full" onClick={downloadCoupon}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Coupon herunterladen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CouponManagement;
