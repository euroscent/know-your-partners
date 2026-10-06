import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/lib/toast-stub";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Application = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthDate: "",
    message: "",
    employmentType: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

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
      toast.error("Bitte geben Sie ein gültiges Geburtsdatum ein (TT.MM.JJJJ)");
      return;
    }

    if (!formData.employmentType) {
      toast.error("Bitte wählen Sie ein Zeitmodell aus");
      return;
    }

    // Resume file is optional now

    setLoading(true);

    try {
      // Convert DD.MM.YYYY to YYYY-MM-DD for database
      const [day, month, year] = formData.birthDate.split(".");
      const birthDateISO = `${year}-${month}-${day}`;

      // Check for existing pending application with same email
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("email", formData.email)
        .in("status", ["pending", "approved"])
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("Es liegt bereits eine Bewerbung mit dieser E-Mail-Adresse vor.");
        setLoading(false);
        return;
      }

      let filePath: string | null = null;

      // Upload resume file to storage if provided
      if (resumeFile) {
        filePath = `${Date.now()}_${resumeFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('applications')
          .upload(filePath, resumeFile);
        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Datei konnte nicht hochgeladen werden: " + uploadError.message);
          setLoading(false);
          return;
        }
      }

      // Insert application with resume path
      const { error } = await supabase.from("applications").insert({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        birth_date: birthDateISO,
        message: formData.message,
        resume_path: filePath,
        employment_type: formData.employmentType,
      });

      if (error) throw error;

      // Send confirmation email to applicant
      try {
        console.log("Sending email to:", formData.email);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/send-application-confirmation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
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
    } catch (error: any) {
      toast.error("Fehler beim Einreichen der Bewerbung: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-2xl mx-auto px-4 py-20">
        <Card>
          {submitted ? (
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="bg-primary/10 rounded-full p-5">
                  <CheckCircle className="h-14 w-14 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  Bewerbung erfolgreich eingereicht!
                </h2>
                <p className="text-muted-foreground">
                  Vielen Dank für Ihre Bewerbung bei PayExpert. Wir haben Ihre Unterlagen erhalten und werden diese sorgfältig prüfen.
                </p>
                <p className="text-muted-foreground text-sm">
                  Sie erhalten in Kürze eine Bestätigungs-E-Mail an Ihre angegebene E-Mail-Adresse.
                </p>
                <div className="bg-muted rounded-xl p-5 w-full text-left space-y-2 mt-4">
                  <p className="font-semibold text-foreground text-sm">Was passiert als Nächstes?</p>
                  <ul className="space-y-1.5 text-muted-foreground text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">1.</span>
                      Unser HR-Team prüft Ihre Bewerbungsunterlagen.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">2.</span>
                      Bei positivem Feedback erhalten Sie eine Einladung per E-Mail.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">3.</span>
                      Sie können sich dann in unserem System registrieren und loslegen.
                    </li>
                  </ul>
                </div>
                <Link to="/start">
                  <Button variant="outline" className="mt-4 gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Zurück zur Startseite
                  </Button>
                </Link>
              </div>
            </CardContent>
          ) : (
          <>
          <CardHeader>
            <CardTitle>Bewerbungsformular</CardTitle>
            <CardDescription>
              Füllen Sie das Formular aus, um sich bei uns zu bewerben
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefonnummer *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="employmentType">Gewünschtes Zeitmodell *</Label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, employmentType: value })
                  }
                  required
                >
                  <SelectTrigger id="employmentType" className="bg-background">
                    <SelectValue placeholder="Bitte wählen Sie ein Zeitmodell" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="minijob">Minijob (603€ Basis)</SelectItem>
                    <SelectItem value="teilzeit">Teilzeit</SelectItem>
                    <SelectItem value="vollzeit">Vollzeit</SelectItem>
                    <SelectItem value="freelancer">Freelancer (Auftragsbasis)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Nachricht (optional)</Label>
                <Textarea
                  id="message"
                  rows={5}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  placeholder="Erzählen Sie uns etwas über sich..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resume">Dokumente hochladen (PDF, optional)</Label>
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("Datei zu groß (max. 5MB)");
                        e.target.value = "";
                        return;
                      }
                      setResumeFile(file);
                    }
                  }}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Max. 5MB | Nur PDF-Dateien
                </p>
              </div>
              <LoadingButton type="submit" className="w-full !rounded-full" loading={loading} loadingText="Wird gesendet...">
                Bewerbung einreichen
              </LoadingButton>
            </form>
          </CardContent>
          </>
          )}
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Application;