import { useEffect, useState, useRef } from "react";
import { PageLoader } from "@/components/PageLoader";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { toast } from "@/lib/toast-stub";
import { Loader2, User, Home, Receipt, FileText, Info, ArrowLeft, Camera, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  birth_date: string | null;
  place_of_birth: string | null;
  country_of_birth: string | null;
  nationality: string | null;
  marital_status: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  account_holder: string | null;
  iban: string | null;
  bic: string | null;
  tax_id: string | null;
  social_security_number: string | null;
  health_insurance: string | null;
  employment_type: string | null;
  tax_class: number | null;
  federal_state: string | null;
  children_count: number | null;
  church_tax_liable: boolean;
  avatar_url: string | null;
}

// Helper functions for date format conversion
const formatDateForDisplay = (isoDate: string | null): string => {
  if (!isoDate) return "";
  // Handle already formatted dates (TT.MM.JJJJ)
  if (isoDate.includes('.')) return isoDate;
  // Convert YYYY-MM-DD to TT.MM.JJJJ
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }
  return isoDate;
};

const formatDateForDatabase = (displayDate: string | null): string | null => {
  if (!displayDate) return null;
  // Handle already ISO formatted dates (YYYY-MM-DD)
  if (displayDate.match(/^\d{4}-\d{2}-\d{2}$/)) return displayDate;
  // Convert TT.MM.JJJJ to YYYY-MM-DD
  const match = displayDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null; // Invalid format
};

export default function EmployeeSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "personal";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingBic, setFetchingBic] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<null | { type: "success" | "error"; message: string }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    birth_date: "",
    place_of_birth: "",
    country_of_birth: "",
    nationality: "",
    marital_status: "",
    street: "",
    postal_code: "",
    city: "",
    account_holder: "",
    iban: "",
    bic: "",
    tax_id: "",
    social_security_number: "",
    health_insurance: "",
    employment_type: "",
    tax_class: null,
    federal_state: null,
    children_count: 0,
    church_tax_liable: true,
    avatar_url: null,
  });

  const checkAuthAndFetchProfile = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        toast.error("Fehler beim Laden der Sitzung");
        navigate("/auth");
        return;
      }

      if (!session) {
        navigate("/auth");
        return;
      }

      // Fetch profile with retry logic
      let retries = 3;
      let profileData = null;
      let error = null;

      while (retries > 0 && !profileData) {
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (result.error) {
          error = result.error;
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        } else {
          profileData = result.data;
          break;
        }
      }

      if (error && !profileData) {
        console.error("Profile fetch error:", error);
        toast.error("Fehler beim Laden der Profildaten. Bitte versuchen Sie es erneut.");
        setLoading(false);
        return;
      }

      if (profileData) {
        setProfile({
          first_name: profileData.first_name || "",
          last_name: profileData.last_name || "",
          email: profileData.email || "",
          phone: profileData.phone || "",
          birth_date: formatDateForDisplay(profileData.birth_date),
          place_of_birth: (profileData as any).place_of_birth || "",
          country_of_birth: (profileData as any).country_of_birth || "",
          nationality: profileData.nationality || "",
          marital_status: profileData.marital_status || "",
          street: profileData.street || "",
          postal_code: profileData.postal_code || "",
          city: profileData.city || "",
          account_holder: profileData.account_holder || "",
          iban: profileData.iban || "",
          bic: profileData.bic || "",
          tax_id: profileData.tax_id || "",
          social_security_number: profileData.social_security_number || "",
          health_insurance: profileData.health_insurance || "",
          employment_type: profileData.employment_type || "",
          tax_class: profileData.tax_class || null,
          federal_state: profileData.federal_state || null,
          children_count: profileData.children_count || 0,
          church_tax_liable: profileData.church_tax_liable ?? true,
          avatar_url: (profileData as any).avatar_url || null,
        });
      } else {
        // Prefill from signup metadata if profile row doesn't exist yet
        const meta: any = session.user.user_metadata || {};
        setProfile({
          first_name: meta.first_name || "",
          last_name: meta.last_name || "",
          email: session.user.email || "",
          phone: meta.phone || "",
          birth_date: formatDateForDisplay(meta.birth_date) || "",
          place_of_birth: "",
          country_of_birth: "",
          nationality: meta.nationality || "",
          marital_status: "",
          street: meta.street_and_number || "",
          postal_code: meta.zip_code || "",
          city: meta.city || "",
          account_holder: "",
          iban: "",
          bic: "",
          tax_id: "",
          social_security_number: "",
          health_insurance: "",
          employment_type: meta.contract_type || "",
          tax_class: null,
          federal_state: null,
          children_count: 0,
          church_tax_liable: true,
          avatar_url: null,
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Fehler beim Laden der Daten: " + (error.message || "Unbekannter Fehler"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthAndFetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveFeedback(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Validate that first name and last name contain only letters, spaces, hyphens
      const nameRegex = /^[a-zA-ZäöüÄÖÜßéèêëáàâãåçñíìîïóòôõúùûýÿÆæŒœ\s\-']+$/;
      
      if (profile.first_name && !nameRegex.test(profile.first_name)) {
        setSaveFeedback({ type: "error", message: "Vorname darf nur Buchstaben enthalten (keine Zahlen)." });
        setSaving(false);
        return;
      }

      if (profile.last_name && !nameRegex.test(profile.last_name)) {
        setSaveFeedback({ type: "error", message: "Nachname darf nur Buchstaben enthalten (keine Zahlen)." });
        setSaving(false);
        return;
      }

      // IBAN-Validierung
      if (profile.iban) {
        const ibanCleaned = profile.iban.replace(/\s/g, '').toUpperCase();
        
        // IBAN-Format: Ländercode (2 Buchstaben) + Prüfziffer (2 Zahlen) + max. 30 alphanumerische Zeichen
        const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
        
        if (!ibanRegex.test(ibanCleaned)) {
          setSaveFeedback({ type: "error", message: "Ungültiges IBAN-Format. Bitte überprüfen Sie Ihre Eingabe." });
          setSaving(false);
          return;
        }
        
        // Deutsche IBAN: DE + 20 Ziffern = 22 Zeichen
        if (ibanCleaned.startsWith('DE') && ibanCleaned.length !== 22) {
          setSaveFeedback({ type: "error", message: "Deutsche IBAN muss genau 22 Zeichen haben (DE + 20 Ziffern)." });
          setSaving(false);
          return;
        }
        
        // IBAN formatiert speichern (mit Leerzeichen alle 4 Zeichen für Lesbarkeit)
        profile.iban = ibanCleaned.match(/.{1,4}/g)?.join(' ') || ibanCleaned;
      }

      // BIC-Validierung (optional, wenn angegeben)
      if (profile.bic) {
        const bicCleaned = profile.bic.replace(/\s/g, '').toUpperCase();
        const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
        
        if (!bicRegex.test(bicCleaned)) {
          setSaveFeedback({ type: "error", message: "Ungültiges BIC-Format. BIC muss 8 oder 11 Zeichen haben." });
          setSaving(false);
          return;
        }
        
        profile.bic = bicCleaned;
      }

      // Convert birth_date from display format (TT.MM.JJJJ) to database format (YYYY-MM-DD)
      const birthDateForDb = formatDateForDatabase(profile.birth_date);
      if (profile.birth_date && !birthDateForDb) {
        setSaveFeedback({ type: "error", message: "Geburtsdatum ist ungültig. Bitte im Format TT.MM.JJJJ eingeben." });
        setSaving(false);
        return;
      }
      
      const profileData = {
        id: session.user.id, // Required for upsert
        email: profile.email || session.user.email || '', // Required field
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        birth_date: birthDateForDb,
        place_of_birth: profile.place_of_birth,
        country_of_birth: profile.country_of_birth,
        nationality: profile.nationality,
        marital_status: profile.marital_status,
        street: profile.street,
        postal_code: profile.postal_code,
        city: profile.city,
        account_holder: profile.account_holder,
        iban: profile.iban,
        bic: profile.bic,
        tax_id: profile.tax_id,
        social_security_number: profile.social_security_number,
        health_insurance: profile.health_insurance,
        employment_type: profile.employment_type,
        tax_class: profile.tax_class,
        federal_state: profile.federal_state,
        children_count: profile.children_count,
        church_tax_liable: profile.church_tax_liable,
      };

      console.log("Saving profile for user:", session.user.id, profileData);

      // Use upsert to create profile if it doesn't exist (for admin-created accounts)
      const { data, error } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: 'id' })
        .select();

      console.log("Upsert result:", { data, error });

      if (error) {
        console.error("Profile save error:", error);
        throw error;
      }

      // Check if the operation was successful
      if (!data || data.length === 0) {
        console.error("No profile row was saved. This should not happen with upsert.");
        setSaveFeedback({ type: "error", message: "Profil konnte nicht gespeichert werden. Bitte erneut versuchen." });
        return;
      }

      setSaveFeedback({ type: "success", message: "Daten erfolgreich gespeichert." });
    } catch (error: any) {
      console.error("Error saving profile:", error);
      setSaveFeedback({
        type: "error",
        message: "Fehler beim Speichern der Daten: " + (error?.message || "Unbekannter Fehler"),
      });
    } finally {
      setSaving(false);
    }
  };

  const fetchBicFromIban = async (iban: string) => {
    if (!iban || iban.length < 15) return;
    
    setFetchingBic(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-bic-from-iban', {
        body: { iban }
      });

      if (error) throw error;

      if (data?.bic) {
        setProfile({ ...profile, bic: data.bic });
        toast.success(`BIC automatisch ermittelt: ${data.bic}${data.bankName ? ` (${data.bankName})` : ''}`);
      } else {
        toast.info('BIC konnte nicht automatisch ermittelt werden');
      }
    } catch (error: any) {
      console.error('Error fetching BIC:', error);
      toast.error('Fehler beim Abrufen der BIC');
    } finally {
      setFetchingBic(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte wählen Sie eine Bilddatei aus');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Die Datei darf maximal 5MB groß sein');
      return;
    }

    setUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Delete old avatar if exists
      await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.jpeg`, `${userId}/avatar.webp`]);

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('id', userId);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success('Profilbild erfolgreich hochgeladen');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Fehler beim Hochladen des Profilbilds');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="container mx-auto p-6 max-w-5xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Mein Profil</h1>
            <p className="text-muted-foreground">Hier können Sie Ihre persönlichen Daten einsehen und bearbeiten.</p>
          </div>

          <Tabs defaultValue={initialTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-2">
              <TabsTrigger value="personal" className="flex items-center gap-2 h-auto py-3">
                <User className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Persönliche Daten</span>
                <span className="sm:hidden text-xs">Personal</span>
              </TabsTrigger>
              <TabsTrigger value="address" className="flex items-center gap-2 h-auto py-3">
                <Home className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Adresse</span>
                <span className="sm:hidden text-xs">Adresse</span>
              </TabsTrigger>
              <TabsTrigger value="financial" className="flex items-center gap-2 h-auto py-3">
                <Receipt className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Finanzdaten</span>
                <span className="sm:hidden text-xs">Finanzen</span>
              </TabsTrigger>
              <TabsTrigger value="payroll" className="flex items-center gap-2 h-auto py-3">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Lohnabrechnung</span>
                <span className="sm:hidden text-xs">Lohn</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  {/* Avatar Upload Section */}
                  <div className="flex flex-col items-center gap-4 pb-6 border-b">
                    <div className="relative group">
                      <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                        <AvatarImage src={profile.avatar_url || undefined} alt="Profilbild" />
                        <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                          {profile.first_name?.[0] || ''}{profile.last_name?.[0] || ''}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 text-white" />
                        )}
                      </button>
                    </div>
                    <div className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Wird hochgeladen...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Profilbild ändern
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        JPG, PNG oder WebP (max. 5MB)
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Bitte geben Sie Ihre korrekten persönlichen Daten ein. Diese Informationen werden für die Vertragsabwicklung benötigt.
                    </AlertDescription>
                  </Alert>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">Vorname</Label>
                      <Input
                        id="first_name"
                        value={profile.first_name || ""}
                        onChange={(e) => {
                          // Only allow letters, spaces, hyphens, apostrophes - no numbers
                          const value = e.target.value.replace(/[0-9]/g, '');
                          setProfile({ ...profile, first_name: value });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Nachname</Label>
                      <Input
                        id="last_name"
                        value={profile.last_name || ""}
                        onChange={(e) => {
                          // Only allow letters, spaces, hyphens, apostrophes - no numbers
                          const value = e.target.value.replace(/[0-9]/g, '');
                          setProfile({ ...profile, last_name: value });
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="birth_date">Geburtsdatum</Label>
                    <Input
                      id="birth_date"
                      type="text"
                      placeholder="TT.MM.JJJJ"
                      maxLength={10}
                      value={profile.birth_date || ""}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + '.' + value.slice(2);
                        }
                        if (value.length >= 5) {
                          value = value.slice(0, 5) + '.' + value.slice(5);
                        }
                        if (value.length > 10) {
                          value = value.slice(0, 10);
                        }
                        setProfile({ ...profile, birth_date: value });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="place_of_birth">Geburtsort</Label>
                    <Input
                      id="place_of_birth"
                      placeholder="z.B. Berlin"
                      value={profile.place_of_birth || ""}
                      onChange={(e) => setProfile({ ...profile, place_of_birth: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country_of_birth">Geburtsland</Label>
                    <Input
                      id="country_of_birth"
                      placeholder="z.B. Deutschland"
                      value={profile.country_of_birth || ""}
                      onChange={(e) => setProfile({ ...profile, country_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationalität</Label>
                    <Input
                      id="nationality"
                      placeholder="z.B. DE"
                      value={profile.nationality || ""}
                      onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="marital_status">Familienstand</Label>
                    <Select
                      value={profile.marital_status || ""}
                      onValueChange={(value) => setProfile({ ...profile, marital_status: value })}
                    >
                      <SelectTrigger id="marital_status">
                        <SelectValue placeholder="Bitte auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ledig">Ledig</SelectItem>
                        <SelectItem value="verheiratet">Verheiratet</SelectItem>
                        <SelectItem value="geschieden">Geschieden</SelectItem>
                        <SelectItem value="verwitwet">Verwitwet</SelectItem>
                        <SelectItem value="eingetragene_lebenspartnerschaft">Eingetragene Lebenspartnerschaft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Kontakt-Rufnummer</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+49 123 456789"
                      value={profile.phone || ""}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      Ihre Telefonnummer für Rückfragen
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Bitte geben Sie Ihre aktuelle Adresse ein. Diese wird für offizielle Dokumente und Korrespondenz verwendet.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="street">Straße und Hausnummer</Label>
                    <Input
                      id="street"
                      value={profile.street || ""}
                      onChange={(e) => setProfile({ ...profile, street: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Postleitzahl</Label>
                      <Input
                        id="postal_code"
                        value={profile.postal_code || ""}
                        onChange={(e) => {
                          // Only allow numbers and max 5 digits
                          const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                          setProfile({ ...profile, postal_code: value });
                        }}
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Stadt</Label>
                      <Input
                        id="city"
                        value={profile.city || ""}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Diese Bankdaten werden für die Auszahlung Ihres Gehalts verwendet. Bitte stellen Sie sicher, dass die Angaben korrekt sind.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="account_holder">Kontoinhaber</Label>
                    <Input
                      id="account_holder"
                      placeholder="Name des Kontoinhabers"
                      value={profile.account_holder || ""}
                      onChange={(e) => setProfile({ ...profile, account_holder: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="iban">
                      IBAN <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="iban"
                      placeholder="z.B. DE12 5001 0517 0648 4889 0"
                      value={profile.iban || ""}
                      onChange={(e) => setProfile({ ...profile, iban: e.target.value })}
                      onBlur={(e) => {
                        const iban = e.target.value;
                        if (iban && iban.length >= 15) {
                          fetchBicFromIban(iban);
                        }
                      }}
                      className={!profile.iban ? "border-amber-500" : ""}
                    />
                    {!profile.iban && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        IBAN erforderlich für Gehaltszahlungen
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Format: DE + 20 Ziffern (Leerzeichen optional)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bic">BIC</Label>
                    <div className="relative">
                      <Input
                        id="bic"
                        placeholder="z.B. BYLADEM1001"
                        value={profile.bic || ""}
                        onChange={(e) => setProfile({ ...profile, bic: e.target.value })}
                        disabled={fetchingBic}
                      />
                      {fetchingBic && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Wird automatisch aus der IBAN ermittelt
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payroll">
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Diese Daten sind wichtig für die korrekte Berechnung Ihrer Lohnabrechnung. Bitte stellen Sie sicher, dass alle Angaben aktuell und korrekt sind.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tax_id">Steuer-Identifikationsnummer</Label>
                      <Input
                        id="tax_id"
                        placeholder="12 345 678 901"
                        value={profile.tax_id || ""}
                        onChange={(e) => setProfile({ ...profile, tax_id: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Ihre 11-stellige Steuer-ID (finden Sie auf Ihrer Lohnsteuerbescheinigung)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="social_security_number">Sozialversicherungsnummer</Label>
                      <Input
                        id="social_security_number"
                        placeholder="12 345678 A 901"
                        value={profile.social_security_number || ""}
                        onChange={(e) => setProfile({ ...profile, social_security_number: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Ihre Rentenversicherungsnummer (finden Sie auf Ihrem Sozialversicherungsausweis)
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tax_class">Steuerklasse</Label>
                        <Select
                          value={profile.tax_class?.toString() || ""}
                          onValueChange={(value) => setProfile({ ...profile, tax_class: parseInt(value) })}
                        >
                          <SelectTrigger id="tax_class">
                            <SelectValue placeholder="Bitte auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Steuerklasse I (Ledig)</SelectItem>
                            <SelectItem value="2">Steuerklasse II (Alleinerziehend)</SelectItem>
                            <SelectItem value="3">Steuerklasse III (Verheiratet, höheres Einkommen)</SelectItem>
                            <SelectItem value="4">Steuerklasse IV (Verheiratet, gleiches Einkommen)</SelectItem>
                            <SelectItem value="5">Steuerklasse V (Verheiratet, niedrigeres Einkommen)</SelectItem>
                            <SelectItem value="6">Steuerklasse VI (Zweiter Job)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="children_count">Anzahl Kinder</Label>
                        <Input
                          id="children_count"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={profile.children_count || 0}
                          onChange={(e) => setProfile({ ...profile, children_count: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Für Kinderfreibetrag
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="federal_state">Bundesland</Label>
                      <Select
                        value={profile.federal_state || ""}
                        onValueChange={(value) => setProfile({ ...profile, federal_state: value })}
                      >
                        <SelectTrigger id="federal_state">
                          <SelectValue placeholder="Bitte auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BW">Baden-Württemberg</SelectItem>
                          <SelectItem value="BY">Bayern</SelectItem>
                          <SelectItem value="BE">Berlin</SelectItem>
                          <SelectItem value="BB">Brandenburg</SelectItem>
                          <SelectItem value="HB">Bremen</SelectItem>
                          <SelectItem value="HH">Hamburg</SelectItem>
                          <SelectItem value="HE">Hessen</SelectItem>
                          <SelectItem value="MV">Mecklenburg-Vorpommern</SelectItem>
                          <SelectItem value="NI">Niedersachsen</SelectItem>
                          <SelectItem value="NW">Nordrhein-Westfalen</SelectItem>
                          <SelectItem value="RP">Rheinland-Pfalz</SelectItem>
                          <SelectItem value="SL">Saarland</SelectItem>
                          <SelectItem value="SN">Sachsen</SelectItem>
                          <SelectItem value="ST">Sachsen-Anhalt</SelectItem>
                          <SelectItem value="SH">Schleswig-Holstein</SelectItem>
                          <SelectItem value="TH">Thüringen</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Wichtig für die Kirchensteuer-Berechnung
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="health_insurance">Krankenkasse</Label>
                      <Select
                        value={profile.health_insurance || ""}
                        onValueChange={(value) => setProfile({ ...profile, health_insurance: value })}
                      >
                        <SelectTrigger id="health_insurance">
                          <SelectValue placeholder="Bitte auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AOK Baden-Württemberg">AOK Baden-Württemberg</SelectItem>
                          <SelectItem value="AOK Bayern">AOK Bayern</SelectItem>
                          <SelectItem value="AOK Nordost">AOK Nordost</SelectItem>
                          <SelectItem value="AOK NordWest">AOK NordWest</SelectItem>
                          <SelectItem value="AOK PLUS">AOK PLUS</SelectItem>
                          <SelectItem value="AOK Rheinland/Hamburg">AOK Rheinland/Hamburg</SelectItem>
                          <SelectItem value="AOK Rheinland-Pfalz/Saarland">AOK Rheinland-Pfalz/Saarland</SelectItem>
                          <SelectItem value="AOK Sachsen-Anhalt">AOK Sachsen-Anhalt</SelectItem>
                          <SelectItem value="Barmer">Barmer</SelectItem>
                          <SelectItem value="Techniker Krankenkasse">Techniker Krankenkasse (TK)</SelectItem>
                          <SelectItem value="DAK-Gesundheit">DAK-Gesundheit</SelectItem>
                          <SelectItem value="IKK classic">IKK classic</SelectItem>
                          <SelectItem value="Knappschaft">Knappschaft</SelectItem>
                          <SelectItem value="HKK">HKK - Handelskrankenkasse</SelectItem>
                          <SelectItem value="andere">Andere</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="church_tax_liable"
                          checked={!profile.church_tax_liable}
                          onCheckedChange={(checked) => setProfile({ ...profile, church_tax_liable: !checked })}
                        />
                        <Label htmlFor="church_tax_liable" className="font-normal cursor-pointer">
                          Ich bin nicht kirchensteuerpflichtig
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Kirchensteuer wird nur berechnet wenn Sie Mitglied einer Kirche sind (8% in Bayern & Baden-Württemberg, 9% in anderen Bundesländern)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {saveFeedback && (
            <Alert className="mt-6" variant={saveFeedback.type === "error" ? "destructive" : "default"}>
              <AlertDescription>{saveFeedback.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between gap-4 mt-6">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zum Dashboard
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
