import { EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_KEY, EXTERNAL_PROJECT_ID } from "@/integrations/external/client";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clock, ArrowLeft, Info, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/lib/toast-stub";
import fulltimeIcon from "@/assets/fulltime-icon-new.png";
import locationIcon from "@/assets/location-pin-gradient.png";
import { supabase } from "@/integrations/supabase/client";

const jobDetails: Record<string, any> = {
  "senior-backend-engineer": {
    title: "Senior Software Engineer (Backend)",
    type: "Vollzeit",
    location: "Nürnberg / Remote",
    department: "Engineering",
    description: "Wir suchen einen erfahrenen Backend-Entwickler, der unser Team verstärkt und an der Entwicklung skalierbarer KYC-Lösungen arbeitet.",
    responsibilities: [
      "Entwicklung und Wartung von Backend-Services und APIs",
      "Design und Implementierung skalierbarer Microservices-Architekturen",
      "Optimierung der Performance und Sicherheit unserer Systeme",
      "Code Reviews und Mentoring von Junior-Entwicklern",
      "Zusammenarbeit mit Product Managern und Frontend-Teams"
    ],
    requirements: [
      "5+ Jahre Erfahrung in der Backend-Entwicklung",
      "Expertise in Node.js, Python oder Go",
      "Erfahrung mit Cloud-Infrastrukturen (AWS, GCP oder Azure)",
      "Kenntnisse in Datenbank-Design (SQL und NoSQL)",
      "Sehr gute Deutsch- und Englischkenntnisse"
    ],
    benefits: [
      "Attraktives Gehalt mit Leistungsprämien",
      "Flexible Arbeitszeiten und Remote-Optionen",
      "Moderne Tech-Stack und Tools",
      "Weiterbildungsbudget und Konferenzbesuche",
      "Zentrale Bürolage in Nürnberg"
    ]
  },
  "frontend-developer": {
    title: "Frontend Developer (React/TypeScript)",
    type: "Vollzeit",
    location: "Nürnberg",
    department: "Engineering",
    description: "Gestalten Sie mit uns die Zukunft der KYC-Technologie durch intuitive und leistungsstarke Benutzeroberflächen.",
    responsibilities: [
      "Entwicklung moderner Web-Anwendungen mit React und TypeScript",
      "Implementierung responsiver und barrierefreier UI-Komponenten",
      "Zusammenarbeit mit UX/UI-Designern zur Umsetzung von Designs",
      "Performance-Optimierung und Best Practices",
      "Integration von REST- und GraphQL-APIs"
    ],
    requirements: [
      "3+ Jahre Erfahrung mit React und TypeScript",
      "Fundierte Kenntnisse in HTML, CSS und modernen CSS-Frameworks",
      "Erfahrung mit State Management (Redux, Zustand, etc.)",
      "Verständnis für Web-Performance und SEO",
      "Gute Deutschkenntnisse"
    ],
    benefits: [
      "Moderne Entwicklungsumgebung",
      "Flexible Arbeitszeiten",
      "Team-Events und Weiterbildung",
      "Gesundheits- und Wellness-Programme",
      "Attraktive Vergütung"
    ]
  },
  "devops-engineer": {
    title: "DevOps Engineer",
    type: "Vollzeit",
    location: "Nürnberg / Remote",
    department: "Engineering",
    description: "Helfen Sie uns, eine robuste und skalierbare Infrastruktur aufzubauen und zu betreiben.",
    responsibilities: [
      "Aufbau und Verwaltung von CI/CD-Pipelines",
      "Infrastructure as Code mit Terraform oder CloudFormation",
      "Monitoring, Logging und Incident Management",
      "Automatisierung von Deployment-Prozessen",
      "Sicherstellung der System-Sicherheit und Compliance"
    ],
    requirements: [
      "3+ Jahre Erfahrung im DevOps-Bereich",
      "Expertise mit Docker und Kubernetes",
      "Erfahrung mit Cloud-Plattformen (AWS bevorzugt)",
      "Kenntnisse in Scripting (Bash, Python)",
      "Sehr gute Englischkenntnisse"
    ],
    benefits: [
      "Spannende technische Herausforderungen",
      "Remote-Arbeit möglich",
      "Moderne Tools und Technologien",
      "Weiterbildung und Zertifizierungen",
      "Wettbewerbsfähiges Gehalt"
    ]
  },
  "product-manager": {
    title: "Product Manager (KYC Solutions)",
    type: "Vollzeit",
    location: "Nürnberg",
    department: "Product & Design",
    description: "Gestalten Sie die Zukunft unserer KYC-Produkte und treiben Sie Innovation voran.",
    responsibilities: [
      "Produktstrategie und Roadmap-Entwicklung",
      "Stakeholder-Management und Kundeninterviews",
      "Definition von Features und User Stories",
      "Zusammenarbeit mit Engineering und Design Teams",
      "Marktanalyse und Wettbewerbsbeobachtung"
    ],
    requirements: [
      "3+ Jahre Erfahrung im Product Management",
      "Verständnis für FinTech und Compliance",
      "Analytisches Denken und datengetriebene Entscheidungen",
      "Ausgezeichnete Kommunikationsfähigkeiten",
      "Sehr gute Deutsch- und Englischkenntnisse"
    ],
    benefits: [
      "Gestaltungsspielraum für Produktentwicklung",
      "Direkte Zusammenarbeit mit C-Level",
      "Flexible Arbeitszeiten",
      "Attraktives Gehaltspaket",
      "Zentrale Bürolage"
    ]
  },
  "ux-ui-designer": {
    title: "UX/UI Designer",
    type: "Vollzeit",
    location: "Nürnberg / Remote",
    department: "Product & Design",
    description: "Kreieren Sie außergewöhnliche Nutzererlebnisse für komplexe KYC-Workflows.",
    responsibilities: [
      "User Research und Usability Testing",
      "Erstellung von Wireframes, Prototypen und High-Fidelity Designs",
      "Design System Entwicklung und Pflege",
      "Zusammenarbeit mit Product und Engineering Teams",
      "Kontinuierliche Verbesserung der User Experience"
    ],
    requirements: [
      "3+ Jahre Erfahrung im UX/UI Design",
      "Portfolio mit B2B oder FinTech Projekten",
      "Expertise in Figma oder ähnlichen Tools",
      "Verständnis für Design Thinking und User-Centered Design",
      "Gute Deutschkenntnisse"
    ],
    benefits: [
      "Kreative Freiheit",
      "Moderne Design-Tools",
      "Remote-Arbeit möglich",
      "Weiterbildung und Konferenzen",
      "Tolle Team-Atmosphäre"
    ]
  },
  "business-development": {
    title: "Business Development Manager",
    type: "Vollzeit",
    location: "Nürnberg",
    department: "Sales & Business",
    description: "Erweitern Sie unsere Marktpräsenz und bauen Sie strategische Partnerschaften auf.",
    responsibilities: [
      "Identifikation und Entwicklung neuer Geschäftsmöglichkeiten",
      "Aufbau und Pflege strategischer Partnerschaften",
      "Lead-Generierung und Vertriebsunterstützung",
      "Marktanalyse und Wettbewerbsbeobachtung",
      "Präsentationen auf Events und Konferenzen"
    ],
    requirements: [
      "3+ Jahre Erfahrung im Business Development",
      "Erfahrung im FinTech oder SaaS-Bereich",
      "Ausgezeichnete Kommunikations- und Präsentationsfähigkeiten",
      "Netzwerk in der Branche von Vorteil",
      "Sehr gute Deutsch- und Englischkenntnisse"
    ],
    benefits: [
      "Attraktives Grundgehalt plus Provision",
      "Flexible Arbeitszeiten",
      "Reisemöglichkeiten",
      "Weiterbildung im Vertrieb",
      "Dynamisches Team"
    ]
  },
  "customer-success": {
    title: "Customer Success Manager",
    type: "Vollzeit",
    location: "Nürnberg",
    department: "Sales & Business",
    description: "Sorgen Sie für den Erfolg unserer Kunden und bauen Sie langfristige Beziehungen auf.",
    responsibilities: [
      "Onboarding neuer Kunden",
      "Kontinuierliche Betreuung und Support",
      "Identifikation von Upselling-Möglichkeiten",
      "Kundenfeedback sammeln und kommunizieren",
      "Training und Workshops für Kunden"
    ],
    requirements: [
      "2+ Jahre Erfahrung im Customer Success",
      "Technisches Verständnis für SaaS-Produkte",
      "Empathie und lösungsorientiertes Denken",
      "Ausgezeichnete Kommunikationsfähigkeiten",
      "Sehr gute Deutsch- und Englischkenntnisse"
    ],
    benefits: [
      "Direkte Kundenkontakte",
      "Flexible Arbeitszeiten",
      "Weiterbildung im Customer Success",
      "Attraktive Vergütung",
      "Tolle Team-Atmosphäre"
    ]
  },
  "kyc-assistant": {
    title: "Know Your Customer Assistent/in",
    type: "Minijob / Teilzeit / Vollzeit / Freiberuflich",
    location: "Remote",
    department: "Compliance & Operations",
    description: "Unterstützen Sie unser Team bei der Bearbeitung von KYC- und AML-Prozessen für Banken, Kryptobörsen, FinTechs und weitere Finanzdienstleister.",
    responsibilities: [
      "Prüfung und Bearbeitung von Kundenunterlagen nach KYC- & AML-Vorgaben",
      "Administrative Unterstützung im Tagesgeschäft",
      "Durchführung von Evaluierungen im Rahmen der Compliance-Prozesse",
      "Absolvieren interner Tests zur Qualitätssicherung",
      "Abgabe von Feedback zur Optimierung von Abläufen und Schulungen",
      "Koordination und Kommunikation mit internen und externen Stakeholdern",
      "Sicherstellung der Einhaltung rechtlicher Vorgaben und Datenschutzrichtlinien"
    ],
    requirements: [
      "Sorgfältigkeit, Zuverlässigkeit und hohe Qualitätsstandards",
      "Interesse an Compliance, Banken/FinTech/Krypto-Umfeld",
      "Gute Deutschkenntnisse; weitere Sprachen von Vorteil",
      "Grundlegende IT-Affinität und Erfahrung mit digitalen Tools",
      "Bereitschaft, regelmäßig Tests und Feedback im Rahmen der Einarbeitung und Weiterentwicklung zu leisten",
      "Erste Erfahrung im Bereich KYC/Compliance wünschenswert, aber nicht Voraussetzung"
    ],
    benefits: [
      "Einblick in die Compliance-Prozesse führender Finanzunternehmen",
      "Flexible Arbeitsmodelle mit Remote-Option",
      "Umfassende Einarbeitung und Weiterbildungsmöglichkeiten",
      "Attraktive Vergütung mit Entwicklungsperspektiven",
      "Modernes Arbeitsumfeld in einem wachsenden Unternehmen"
    ]
  }
};

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthDate: "",
    message: "",
    files: [] as File[]
  });

  const job = jobId ? jobDetails[jobId] : null;

  if (!job) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Position nicht gefunden</h1>
            <Button onClick={() => navigate("/careers")}>
              Zurück zu Karriere
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove non-digits
    
    if (value.length >= 2) {
      value = value.slice(0, 2) + "." + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + "." + value.slice(5);
    }
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    
    setFormData({ ...formData, birthDate: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.birthDate || formData.birthDate.length !== 10) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie ein gültiges Geburtsdatum ein (TT.MM.JJJJ)",
        variant: "destructive",
      });
      return;
    }

    // Files are optional now

    if (formData.files.length > 5) {
      toast({ title: "Zu viele Dateien", description: "Maximal 5 Dateien erlaubt.", variant: "destructive" });
      return;
    }

    // Geburtsdatum validieren
    const [day, month, year] = formData.birthDate.split(".");
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > new Date().getFullYear()) {
      toast({
        title: "Ungültiges Datum",
        description: "Bitte geben Sie ein gültiges Datum ein (z.B. 19.02.1992)",
        variant: "destructive",
      });
      return;
    }

    const birth_date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    setLoading(true);

    try {
      // Name aufteilen
      const parts = formData.name.trim().split(/\s+/);
      const first_name = parts[0] || "";
      const last_name = parts.slice(1).join(" ") || "";

      // Check for existing pending application with same email
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("email", formData.email)
        .in("status", ["pending", "approved"])
        .limit(1);

      if (existing && existing.length > 0) {
        toast({ title: "Bewerbung existiert bereits", description: "Es liegt bereits eine Bewerbung mit dieser E-Mail-Adresse vor.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Upload files to storage
      const uploadedPaths: string[] = [];
      for (let i = 0; i < formData.files.length; i++) {
        const file = formData.files[i];
        const filePath = `${Date.now()}_${i}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('applications')
          .upload(filePath, file);
        if (uploadError) {
          console.error("Upload error:", uploadError);
        } else {
          uploadedPaths.push(filePath);
        }
      }

      // Bewerbung speichern (erste Datei als resume_path für Kompatibilität)
      const { error } = await supabase.from("applications").insert({
        first_name,
        last_name,
        email: formData.email,
        phone: formData.phone,
        birth_date,
        message: uploadedPaths.length > 0
          ? `${formData.message}\n\nHochgeladene Dateien: ${uploadedPaths.map(p => p.split('_').slice(2).join('_')).join(', ')}`
          : formData.message,
        resume_path: uploadedPaths[0] || null,
      });
      if (error) throw error;

      // Send confirmation email to applicant
      try {
        console.log("Sending email to:", formData.email);
        const supabaseUrl = EXTERNAL_SUPABASE_URL;
        const supabaseKey = EXTERNAL_SUPABASE_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/send-application-confirmation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            firstName: first_name,
            lastName: last_name,
            email: formData.email,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("Email sent successfully:", data);
        } else {
          console.error("Email send failed:", await response.text());
        }
      } catch (emailError) {
        console.error("Email error:", emailError);
        // Don't fail the submission if email fails
      }

      setSubmitted(true);
      setFormData({ name: "", email: "", phone: "", birthDate: "", message: "", files: [] });
    } catch (err: any) {
      toast({ title: "Fehler beim Senden", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Header */}
      <section className="relative z-10 py-12 bg-muted/30 border-b border-border">
        <div className="container mx-auto px-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/careers")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Karriere
          </Button>
          
          <div className="max-w-4xl">
            <Badge variant="outline" className="mb-4">{job.department}</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              {job.title}
            </h1>
            
            <div className="flex flex-wrap gap-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <img src={locationIcon} alt="Standort" className="h-5 w-5" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <img src={fulltimeIcon} alt="Vollzeit" className="h-5 w-5" />
                <span>{job.type}</span>
              </div>
            </div>
            
            {/* Freelancer Info Link - only for kyc-assistant */}
            {jobId === "kyc-assistant" && (
              <Button 
                variant="outline" 
                onClick={() => navigate("/careers/freelancer-info")}
                className="mt-6"
              >
                <Info className="h-4 w-4 mr-2" />
                Infos für Freiberufler: Ablauf & Vergütung
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12 max-w-7xl">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Über die Position
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {job.description}
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Ihre Aufgaben
                </h2>
                <ul className="space-y-3">
                  {job.responsibilities.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Ihr Profil
                </h2>
                <ul className="space-y-3">
                  {job.requirements.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Das bieten wir
                </h2>
                <ul className="space-y-3">
                  {job.benefits.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Application Form Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-24">
                {submitted ? (
                  <div className="flex flex-col items-center text-center py-8 space-y-4">
                    <div className="bg-primary/10 rounded-full p-4">
                      <CheckCircle className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      Bewerbung erfolgreich gesendet!
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Vielen Dank für Ihre Bewerbung. Wir haben Ihre Unterlagen erhalten und werden diese sorgfältig prüfen.
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Sie erhalten in Kürze eine Bestätigungs-E-Mail.
                    </p>
                    <div className="bg-muted rounded-lg p-4 w-full text-left space-y-2 mt-4">
                      <p className="font-semibold text-foreground text-sm">Nächste Schritte:</p>
                      <ul className="space-y-1 text-muted-foreground text-xs">
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold mt-0.5">1.</span>
                          Prüfung Ihrer Bewerbungsunterlagen
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold mt-0.5">2.</span>
                          Einladung per E-Mail bei positivem Feedback
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary font-bold mt-0.5">3.</span>
                          Registrierung und Onboarding
                        </li>
                      </ul>
                    </div>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/careers")}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Zurück zu Karriere
                    </Button>
                  </div>
                ) : (
                <>
                <h3 className="text-xl font-bold text-foreground mb-6">
                  Jetzt bewerben
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Vollständiger Name *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">E-Mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefon *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="birthDate">Geburtsdatum *</Label>
                    <Input
                      id="birthDate"
                      placeholder="TT.MM.JJJJ"
                      required
                      value={formData.birthDate}
                      onChange={handleBirthDateChange}
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <Label htmlFor="files">Dokumente hochladen (PDF, max. 5 Dateien)</Label>
                    <Input
                      id="files"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 5) {
                          toast({
                            title: "Zu viele Dateien",
                            description: "Maximal 5 Dateien erlaubt.",
                            variant: "destructive",
                          });
                          e.target.value = "";
                          return;
                        }
                        setFormData({...formData, files});
                      }}
                      className="cursor-pointer"
                    />
                    {formData.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">{formData.files.length} Datei(en) ausgewählt:</p>
                        {formData.files.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                            <span className="truncate">{file.name}</span>
                            <span className="ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="message">Anschreiben</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      rows={6}
                    />
                  </div>

                  <LoadingButton type="submit" className="w-full !rounded-full hover-scale-glow" size="lg" loading={loading} loadingText="Wird gesendet...">
                    Bewerbung absenden
                  </LoadingButton>

                  <p className="text-xs text-muted-foreground text-center">
                    Mit dem Absenden bestätigen Sie unsere Datenschutzerklärung
                  </p>
                </form>
                </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default JobDetail;
